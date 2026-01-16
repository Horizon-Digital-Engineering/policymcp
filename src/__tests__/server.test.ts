import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import cors from "cors";
import multer from "multer";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock the MCP SDK modules before importing anything else
vi.mock(
  "@modelcontextprotocol/sdk/server/mcp.js",
  () => ({
    McpServer: vi.fn().mockImplementation(() => ({
      tool: vi.fn(),
      addResource: vi.fn(),
      addPrompt: vi.fn(),
    })),
  })
);

vi.mock(
  "@modelcontextprotocol/sdk/server/streamableHttp.js",
  () => ({
    StreamableHTTPServerTransport: vi.fn(),
  })
);

vi.mock(
  "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js",
  () => ({
    InMemoryEventStore: vi.fn(),
  })
);

// Import after mocking
import { PolicyStore } from "../policy-store.js";

describe("REST API Endpoints", () => {
  let app: Express;
  let testDir: string;
  let testPdfPath: string;
  const policyStore = new PolicyStore();

  beforeAll(async () => {
    // Create test directory
    testDir = join(tmpdir(), `policymcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create a mock PDF file (just a text file for testing)
    testPdfPath = join(testDir, "test-policy.pdf");
    await writeFile(testPdfPath, "Mock PDF content");

    // Set up Express app with minimal routes for testing
    app = express();
    app.use(cors());
    app.use(express.json());

    // Configure multer for test uploads
    const upload = multer({
      dest: testDir,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") {
          cb(null, true);
        } else {
          cb(new Error("Only PDF files are allowed"));
        }
      },
    });

    // Define test routes
    app.get("/api/policies", (req, res) => {
      try {
        const category = req.query.category as string | undefined;
        const policies = policyStore.listPolicies(category);
        res.json(policies);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    });

    app.get("/api/policies/:id", (req, res) => {
      const policy = policyStore.getPolicy(req.params.id);
      if (!policy) {
        res.status(404).json({ error: "Policy not found" });
        return;
      }
      res.json(policy);
    });

    app.get("/api/search", (req, res) => {
      try {
        const query = req.query.query as string;
        const category = req.query.category as string | undefined;
        if (!query) {
          res.status(400).json({ error: "Query parameter required" });
          return;
        }
        const results = policyStore.searchPolicies(query, category);
        res.json(results);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    });

    app.post("/api/upload", upload.single("pdf"), async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "No file uploaded" });
          return;
        }

        const category = req.body.category;

        // In real implementation, this would parse the PDF
        // For testing, we'll just create a mock policy
        const mockParsedPDF = {
          title: req.file.originalname.replace(".pdf", ""),
          content: "Mock content",
          sections: [],
          metadata: {
            pageCount: 1,
          },
        };

        const policy = policyStore.addPolicy(
          mockParsedPDF,
          req.file.originalname,
          category
        );

        res.json({
          success: true,
          policyId: policy.id,
          title: policy.title,
        });
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    });

    app.delete("/api/policies/:id", (req, res) => {
      const removed = policyStore.removePolicy(req.params.id);
      if (!removed) {
        res.status(404).json({ error: "Policy not found" });
        return;
      }
      res.json({ success: true });
    });

    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe("GET /api/policies", () => {
    it("should return empty array when no policies exist", async () => {
      policyStore.clear();

      const response = await request(app).get("/api/policies");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return all policies", async () => {
      policyStore.clear();
      policyStore.addPolicy(
        {
          title: "Policy 1",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "policy1.pdf"
      );
      policyStore.addPolicy(
        {
          title: "Policy 2",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "policy2.pdf"
      );

      const response = await request(app).get("/api/policies");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it("should filter by category", async () => {
      policyStore.clear();
      policyStore.addPolicy(
        {
          title: "Security Policy",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "security.pdf",
        "security"
      );
      policyStore.addPolicy(
        {
          title: "HR Policy",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "hr.pdf",
        "hr"
      );

      const response = await request(app).get(
        "/api/policies?category=security"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Security Policy");
    });
  });

  describe("GET /api/policies/:id", () => {
    it("should return a policy by ID", async () => {
      policyStore.clear();
      const policy = policyStore.addPolicy(
        {
          title: "Test Policy",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "test.pdf"
      );

      const response = await request(app).get(`/api/policies/${policy.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(policy.id);
      expect(response.body.title).toBe("Test Policy");
    });

    it("should return 404 for non-existent policy", async () => {
      const response = await request(app).get(
        "/api/policies/non-existent-id"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Policy not found");
    });
  });

  describe("GET /api/search", () => {
    beforeAll(() => {
      policyStore.clear();
      policyStore.addPolicy(
        {
          title: "Encryption Policy",
          content: "This policy covers encryption standards",
          sections: [
            {
              heading: "1. Overview",
              content: "Encryption requirements",
              level: 1,
            },
          ],
          metadata: { pageCount: 1 },
        },
        "encryption.pdf",
        "security"
      );
    });

    it("should search policies", async () => {
      const response = await request(app)
        .get("/api/search")
        .query({ query: "encryption" });

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].policy.title).toBe("Encryption Policy");
    });

    it("should search with category filter", async () => {
      const response = await request(app)
        .get("/api/search")
        .query({ query: "encryption", category: "security" });

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("should return 400 when query is missing", async () => {
      const response = await request(app)
        .get("/api/search")
        .query({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Query parameter required");
    });

    it("should return empty array for no matches", async () => {
      const response = await request(app)
        .get("/api/search")
        .query({ query: "nonexistent" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("POST /api/upload", () => {
    it("should upload a PDF file", async () => {
      const response = await request(app)
        .post("/api/upload")
        .field("category", "test")
        .attach("pdf", Buffer.from("fake pdf"), {
          filename: "test-upload.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.policyId).toBeDefined();
      expect(response.body.title).toBe("test-upload");
    });

    it("should return 400 when no file is uploaded", async () => {
      const response = await request(app).post("/api/upload");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("No file uploaded");
    });
  });

  describe("DELETE /api/policies/:id", () => {
    it("should delete a policy", async () => {
      const policy = policyStore.addPolicy(
        {
          title: "To Be Deleted",
          content: "Content",
          sections: [],
          metadata: { pageCount: 1 },
        },
        "delete.pdf"
      );

      const response = await request(app).delete(
        `/api/policies/${policy.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(policyStore.getPolicy(policy.id)).toBeUndefined();
    });

    it("should return 404 for non-existent policy", async () => {
      const response = await request(app).delete(
        "/api/policies/non-existent-id"
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Policy not found");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });
});
