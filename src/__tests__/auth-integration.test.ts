import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import jwt from "jsonwebtoken";
import { PolicyStore } from "../policy-store.js";
import {
  createAuthMiddleware,
  type AuthConfig,
} from "../auth-manager.js";

describe("Authentication Integration Tests", () => {
  let app: Express;
  const policyStore = new PolicyStore();

  // Test secrets and config
  const API_KEY = "test-api-key-12345";
  const JWT_SECRET = "test-jwt-secret";
  const JWT_AUDIENCE = "https://test-policymcp.com";
  const JWT_ISSUER = "https://test-auth.com";

  function createTestApp(
    mcpConfig: AuthConfig,
    webConfig: AuthConfig
  ): Express {
    const app = express();
    app.use(express.json());

    const mcpAuth = createAuthMiddleware(mcpConfig);
    const webAuth = createAuthMiddleware(webConfig);

    // Mock MCP endpoint
    app.post("/mcp", mcpAuth, (req, res) => {
      res.json({
        success: true,
        message: "MCP endpoint accessed",
        auth: (req as any).auth,
      });
    });

    // Mock Web API endpoints
    app.get("/api/policies", webAuth, (req, res) => {
      const policies = policyStore.listPolicies();
      res.json({ policies });
    });

    app.post("/api/policies", webAuth, (req, res) => {
      res.json({
        success: true,
        message: "Policy uploaded",
        auth: (req as any).auth,
      });
    });

    return app;
  }

  describe("No Auth Mode", () => {
    beforeAll(() => {
      app = createTestApp({ mode: "none" }, { mode: "none" });
    });

    it("should allow MCP requests without auth", async () => {
      const response = await request(app).post("/mcp").send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.auth.authenticated).toBe(false);
    });

    it("should allow Web API requests without auth", async () => {
      const response = await request(app).get("/api/policies");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("policies");
    });
  });

  describe("API Key Mode", () => {
    beforeAll(() => {
      app = createTestApp(
        { mode: "api-key", apiKey: API_KEY },
        { mode: "api-key", apiKey: API_KEY }
      );
    });

    it("should reject MCP requests without Authorization header", async () => {
      const response = await request(app).post("/mcp").send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject MCP requests with wrong API key", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer wrong-key")
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid API key");
    });

    it("should allow MCP requests with correct API key", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.auth.authenticated).toBe(true);
    });

    it("should allow Web API requests with correct API key", async () => {
      const response = await request(app)
        .get("/api/policies")
        .set("Authorization", `Bearer ${API_KEY}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("policies");
    });

    it("should reject Web API POST with wrong key", async () => {
      const response = await request(app)
        .post("/api/policies")
        .set("Authorization", "Bearer wrong-key")
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe("JWT Mode", () => {
    let validToken: string;
    let expiredToken: string;
    let wrongAudienceToken: string;

    beforeAll(() => {
      // Create valid token
      validToken = jwt.sign(
        {
          sub: "user-123",
          scope: "read write",
          name: "Test User",
        },
        JWT_SECRET,
        {
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
          expiresIn: "1h",
        }
      );

      // Create expired token
      expiredToken = jwt.sign(
        {
          sub: "user-123",
          scope: "read write",
        },
        JWT_SECRET,
        {
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
          expiresIn: "-1h", // Already expired
        }
      );

      // Create token with wrong audience
      wrongAudienceToken = jwt.sign(
        {
          sub: "user-123",
          scope: "read write",
        },
        JWT_SECRET,
        {
          audience: "https://wrong-audience.com",
          issuer: JWT_ISSUER,
          expiresIn: "1h",
        }
      );

      app = createTestApp(
        {
          mode: "jwt",
          jwtSecret: JWT_SECRET,
          jwtAudience: JWT_AUDIENCE,
          jwtIssuer: JWT_ISSUER,
        },
        {
          mode: "jwt",
          jwtSecret: JWT_SECRET,
          jwtAudience: JWT_AUDIENCE,
          jwtIssuer: JWT_ISSUER,
        }
      );
    });

    it("should reject requests without JWT", async () => {
      const response = await request(app).post("/mcp").send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should reject requests with expired JWT", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Token has expired");
    });

    it("should reject requests with wrong audience", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${wrongAudienceToken}`)
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid token");
    });

    it("should reject requests with malformed JWT", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer not-a-real-jwt")
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid token");
    });

    it("should allow MCP requests with valid JWT", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.auth.authenticated).toBe(true);
      expect(response.body.auth.userId).toBe("user-123");
      expect(response.body.auth.scopes).toEqual(["read", "write"]);
    });

    it("should allow Web API requests with valid JWT", async () => {
      const response = await request(app)
        .get("/api/policies")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("policies");
    });

    it("should extract user info from JWT claims", async () => {
      const response = await request(app)
        .post("/api/policies")
        .set("Authorization", `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.auth.userId).toBe("user-123");
      expect(response.body.auth.scopes).toContain("read");
      expect(response.body.auth.scopes).toContain("write");
    });
  });

  describe("Mixed Auth Modes", () => {
    const MCP_API_KEY = "mcp-key";
    const WEB_API_KEY = "web-key";

    beforeAll(() => {
      // MCP uses API key, Web uses JWT
      app = createTestApp(
        { mode: "api-key", apiKey: MCP_API_KEY },
        {
          mode: "jwt",
          jwtSecret: JWT_SECRET,
          jwtAudience: JWT_AUDIENCE,
          jwtIssuer: JWT_ISSUER,
        }
      );
    });

    it("should allow MCP with API key", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${MCP_API_KEY}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject MCP with JWT (expects API key)", async () => {
      const validToken = jwt.sign(
        { sub: "user-123" },
        JWT_SECRET,
        {
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
          expiresIn: "1h",
        }
      );

      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${validToken}`)
        .send({});

      // Will be rejected because it's checking for exact API key match
      expect(response.status).toBe(401);
    });

    it("should allow Web API with JWT", async () => {
      const validToken = jwt.sign(
        { sub: "user-123" },
        JWT_SECRET,
        {
          audience: JWT_AUDIENCE,
          issuer: JWT_ISSUER,
          expiresIn: "1h",
        }
      );

      const response = await request(app)
        .get("/api/policies")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    it("should reject Web API with API key (expects JWT)", async () => {
      const response = await request(app)
        .get("/api/policies")
        .set("Authorization", `Bearer ${MCP_API_KEY}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid token");
    });
  });

  describe("Real-world OAuth 2.1 Scenario", () => {
    // Simulate Auth0-style tokens
    const AUTH0_SECRET = "auth0-signing-secret";
    const API_AUDIENCE = "https://policymcp.company.com";
    const AUTH0_ISSUER = "https://company.auth0.com/";

    beforeAll(() => {
      app = createTestApp(
        {
          mode: "jwt",
          jwtSecret: AUTH0_SECRET,
          jwtAudience: API_AUDIENCE,
          jwtIssuer: AUTH0_ISSUER,
        },
        {
          mode: "jwt",
          jwtSecret: AUTH0_SECRET,
          jwtAudience: API_AUDIENCE,
          jwtIssuer: AUTH0_ISSUER,
        }
      );
    });

    it("should validate Auth0-style access token", async () => {
      // Simulate Auth0 client credentials flow token
      const accessToken = jwt.sign(
        {
          iss: AUTH0_ISSUER,
          sub: "service-account@clients",
          aud: API_AUDIENCE,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: "read:policies write:policies",
          gty: "client-credentials",
        },
        AUTH0_SECRET
      );

      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ tool: "scan_pdf" });

      expect(response.status).toBe(200);
      expect(response.body.auth.authenticated).toBe(true);
      expect(response.body.auth.scopes).toContain("read:policies");
      expect(response.body.auth.scopes).toContain("write:policies");
    });

    it("should reject token with wrong audience (confused deputy protection)", async () => {
      const tokenForWrongService = jwt.sign(
        {
          iss: AUTH0_ISSUER,
          sub: "service-account@clients",
          aud: "https://different-service.company.com", // Wrong audience!
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          scope: "read:policies",
        },
        AUTH0_SECRET
      );

      const response = await request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${tokenForWrongService}`)
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid token");
    });

    it("should work with machine-to-machine (M2M) tokens", async () => {
      // Typical M2M token from Auth0
      const m2mToken = jwt.sign(
        {
          iss: AUTH0_ISSUER,
          sub: "automation-service@clients",
          aud: API_AUDIENCE,
          azp: "automation-service",
          scope: "read:policies",
          gty: "client-credentials",
        },
        AUTH0_SECRET,
        { expiresIn: "24h" }
      );

      const response = await request(app)
        .get("/api/policies")
        .set("Authorization", `Bearer ${m2mToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    beforeAll(() => {
      app = createTestApp(
        { mode: "api-key", apiKey: "test-key" },
        { mode: "api-key", apiKey: "test-key" }
      );
    });

    it("should reject Authorization header without Bearer prefix", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Basic dXNlcjpwYXNz")
        .send({});

      expect(response.status).toBe(401);
    });

    it("should reject empty Authorization header", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "")
        .send({});

      expect(response.status).toBe(401);
    });

    it("should reject Bearer without token", async () => {
      const response = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer ")
        .send({});

      expect(response.status).toBe(401);
    });

    it("should handle case-sensitive Bearer prefix", async () => {
      // Should work with proper casing
      const response1 = await request(app)
        .post("/mcp")
        .set("Authorization", "Bearer test-key")
        .send({});

      expect(response1.status).toBe(200);

      // Should fail with wrong casing
      const response2 = await request(app)
        .post("/mcp")
        .set("Authorization", "bearer test-key")
        .send({});

      expect(response2.status).toBe(401);
    });
  });
});
