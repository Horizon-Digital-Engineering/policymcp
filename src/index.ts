#!/usr/bin/env node

import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import {
  parseDocument,
  getMimeTypeFromExtension,
  SUPPORTED_MIME_TYPES,
} from "./parsers/index.js";
import { PolicyStore } from "./policy-store.js";
import {
  createAuthHandler,
  loadMcpAuthConfig,
  loadWebAuthConfig,
} from "./auth-manager.js";
import { readFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
const VERSION = packageJson.version;

// Shared policy store
const policyStore = new PolicyStore();

// Use system temp directory with app-specific subdirectory for better security
const UPLOAD_DIR = join(tmpdir(), "policymcp-uploads");

// Configure multer for file uploads
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype as typeof SUPPORTED_MIME_TYPES[number])) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word (.docx), and Markdown (.md) files are allowed"));
    }
  },
});

// ============================================
// MCP SERVER SETUP
// ============================================

function createMCPServer(): McpServer {
  const server = new McpServer({
    name: "policymcp",
    version: VERSION,
  });

  // Register tools with Zod schemas
  server.registerTool(
    "scan_document",
    {
      description: "Scan a policy document (PDF, Word, or Markdown) and extract policy information. The policy will be stored and made available for searching and querying.",
      inputSchema: {
        filePath: z.string().describe("Absolute path to the document file to scan (PDF, .docx, or .md)"),
        category: z.string().optional().describe("Optional category to assign to this policy (e.g., 'HR', 'Security', 'Compliance')"),
      },
    },
    async ({ filePath, category }) => {
      const resolvedPath = resolve(filePath);

      if (!existsSync(resolvedPath)) {
        return {
          content: [{ type: "text", text: `Error: File not found: ${resolvedPath}` }],
          isError: true,
        };
      }

      try {
        // Detect MIME type from file extension
        const mimeType = getMimeTypeFromExtension(resolvedPath);
        const parsed = await parseDocument(resolvedPath, mimeType);
        const policy = policyStore.addPolicy(parsed, resolvedPath, category);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  policyId: policy.id,
                  title: policy.title,
                  sectionsFound: policy.sections.length,
                  effectiveDate: policy.effectiveDate,
                  version: policy.version,
                  message: `Successfully scanned "${policy.title}" with ${policy.sections.length} sections.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error parsing document: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "search_policies",
    {
      description: "Search through all loaded policies for relevant content. Returns matching policies and sections.",
      inputSchema: {
        query: z.string().describe("Search query - keywords or phrases to find"),
        category: z.string().optional().describe("Optional category to filter results"),
      },
    },
    async ({ query, category }) => {
      if (!query) {
        return {
          content: [{ type: "text", text: "Error: Query is required" }],
          isError: true,
        };
      }

      const results = policyStore.searchPolicies(query, category);

      if (results.length === 0) {
        const categoryMsg = category ? ` in category "${category}"` : "";
        return {
          content: [
            {
              type: "text",
              text: `No policies found matching "${query}"${categoryMsg}.`,
            },
          ],
        };
      }

      const formatted = results.map((r) => ({
        policyId: r.policy.id,
        title: r.policy.title,
        category: r.policy.category,
        relevanceScore: r.relevanceScore,
        matchedSections: r.matchedSections,
        excerpt:
          r.policy.content.substring(0, 500) +
          (r.policy.content.length > 500 ? "..." : ""),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query,
                resultsCount: results.length,
                results: formatted,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_policies",
    {
      description: "List all loaded policies with their summaries. Use this to see what policies are available.",
      inputSchema: {
        category: z.string().optional().describe("Optional category to filter the list"),
      },
    },
    async ({ category }) => {
      const policies = policyStore.listPolicies(category);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalPolicies: policyStore.count,
                filter: category || "none",
                policies,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_policy",
    {
      description: "Get the full content of a specific policy by its ID.",
      inputSchema: {
        id: z.string().describe("The policy ID"),
      },
    },
    async ({ id }) => {
      if (!id) {
        return {
          content: [{ type: "text", text: "Error: Policy ID is required" }],
          isError: true,
        };
      }

      const policy = policyStore.getPolicy(id);

      if (!policy) {
        return {
          content: [{ type: "text", text: `Policy not found with ID: ${id}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(policy, null, 2) }],
      };
    }
  );

  return server;
}

// ============================================
// EXPRESS SERVER WITH STREAMABLE HTTP
// ============================================

async function main() {
  // Ensure upload directory exists
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create upload directory:", error);
  }

  const app = express();
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  // Disable Express version disclosure for security
  app.disable("x-powered-by");

  // Load authentication configurations
  const mcpAuthConfig = loadMcpAuthConfig();
  const webAuthConfig = loadWebAuthConfig();

  console.log("Authentication Configuration:");
  console.log(`  MCP endpoints: ${mcpAuthConfig.mode}`);
  console.log(`  Web/API endpoints: ${webAuthConfig.mode}`);

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Mcp-Session-Id", "Authorization"],
  }));

  // JSON parsing only for non-MCP routes
  app.use((req, res, next) => {
    if (req.path === "/mcp") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // Serve static files from public directory (no auth required)
  app.use(express.static(join(__dirname, "public")));

  // Store active transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Create auth handler instances
  const mcpAuth = createAuthHandler(mcpAuthConfig);
  const webAuth = createAuthHandler(webAuthConfig);

  // ============================================
  // MCP STREAMABLE HTTP ENDPOINTS
  // ============================================

  // Handle MCP requests (POST /mcp)
  app.post("/mcp", mcpAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (sessionId === undefined) {
      // New session - create transport (it will handle initialize request validation)
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (id) => {
          transports[id] = transport;
          console.log(`New MCP session initialized: ${id}`);
        },
      });

      // Clean up on close
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id && transports[id]) {
          delete transports[id];
          console.log(`MCP session closed: ${id}`);
        }
      };

      // Connect MCP server to transport
      const server = createMCPServer();
      await server.connect(transport);
    } else {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    await transport.handleRequest(req, res);
  });

  // Handle server-to-client notifications (GET /mcp)
  app.get("/mcp", mcpAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle session termination (DELETE /mcp)
  app.delete("/mcp", mcpAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    delete transports[sessionId];
  });

  // ============================================
  // WEB API ENDPOINTS
  // ============================================

  // List all policies
  app.get("/api/policies", webAuth, (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const policies = policyStore.listPolicies(category);
    res.json({
      total: policies.length,
      policies,
    });
  });

  // Get single policy
  app.get("/api/policies/:id", webAuth, (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const policy = policyStore.getPolicy(id);
    if (!policy) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    res.json(policy);
  });

  // Upload document
  app.post(
    "/api/policies",
    webAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const tempPath = req.file.path;
      const category = req.body.category as string | undefined;

      try {
        const parsed = await parseDocument(tempPath, req.file.mimetype);
        const policy = policyStore.addPolicy(
          parsed,
          req.file.originalname,
          category
        );

        // Clean up temp file
        await unlink(tempPath);

        res.json({
          success: true,
          policy: {
            id: policy.id,
            title: policy.title,
            sourceFile: policy.sourceFile,
            category: policy.category,
            sectionCount: policy.sections.length,
            effectiveDate: policy.effectiveDate,
            version: policy.version,
          },
        });
      } catch (error) {
        // Clean up temp file on error
        try {
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }

        const message =
          error instanceof Error ? error.message : "Failed to parse document";
        res.status(500).json({ error: message });
      }
    }
  );

  // Delete policy
  app.delete("/api/policies/:id", webAuth, (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = policyStore.removePolicy(id);
    if (!deleted) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    res.json({ success: true });
  });

  // Search policies
  app.get("/api/search", webAuth, (req: Request, res: Response) => {
    const query = req.query.query as string;
    const category = req.query.category as string | undefined;

    if (!query) {
      res.status(400).json({ error: "Query parameter required" });
      return;
    }

    const results = policyStore.searchPolicies(query, category);
    res.json({
      query,
      total: results.length,
      results: results.map((r) => ({
        id: r.policy.id,
        title: r.policy.title,
        category: r.policy.category,
        matchedSections: r.matchedSections,
        relevanceScore: r.relevanceScore,
      })),
    });
  });

  // Get unique categories
  app.get("/api/categories", webAuth, (_req: Request, res: Response) => {
    const policies = policyStore.getAllPolicies();
    const categories = [
      ...new Set(policies.map((p) => p.category).filter(Boolean)),
    ];
    res.json(categories);
  });

  // ============================================
  // HEALTH & PROBE ENDPOINTS
  // ============================================

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: VERSION,
      policies: policyStore.count,
      activeSessions: Object.keys(transports).length,
    });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    res.json({ status: "ready" });
  });

  app.get("/live", (_req: Request, res: Response) => {
    res.json({ status: "live" });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down...");
    process.exit(0);
  });

  // Start server
  app.listen(port, host, () => {
    console.log(`Policy MCP Server running at http://${host}:${port}`);
    console.log(`  - Web UI: http://${host}:${port}`);
    console.log(`  - MCP endpoint: http://${host}:${port}/mcp`);
    console.log(`  - Health check: http://${host}:${port}/health`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
