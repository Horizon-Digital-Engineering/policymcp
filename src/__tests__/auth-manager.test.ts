import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock jsonwebtoken before importing
vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      expiredAt: Date;
      constructor(message: string, expiredAt: Date = new Date()) {
        super(message);
        this.name = "TokenExpiredError";
        this.expiredAt = expiredAt;
      }
    },
    JsonWebTokenError: class JsonWebTokenError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "JsonWebTokenError";
      }
    },
  },
}));

import jwt from "jsonwebtoken";
import {
  createAuthMiddleware,
  loadMcpAuthConfig,
  loadWebAuthConfig,
  requireAuth,
  type AuthenticatedRequest
} from "../auth-manager.js";

describe("auth-manager", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock<NextFunction>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis() as unknown as Response["status"],
      json: vi.fn().mockReturnThis() as unknown as Response["json"],
    };
    mockNext = vi.fn() as vi.Mock<NextFunction>;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAuthMiddleware - none mode", () => {
    it("should allow requests without authentication", () => {
      const middleware = createAuthMiddleware({ mode: "none" });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should set auth.authenticated to false", () => {
      const middleware = createAuthMiddleware({ mode: "none" });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as AuthenticatedRequest).auth).toEqual({ authenticated: false });
    });
  });

  describe("createAuthMiddleware - api-key mode", () => {
    it("should reject requests without Authorization header", () => {
      const middleware = createAuthMiddleware({
        mode: "api-key",
        apiKey: "test-key",
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: expect.stringContaining("Missing or invalid Authorization header"),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with invalid Bearer format", () => {
      const middleware = createAuthMiddleware({
        mode: "api-key",
        apiKey: "test-key",
      });
      mockReq.headers = { authorization: "Basic something" };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests with wrong API key", () => {
      const middleware = createAuthMiddleware({
        mode: "api-key",
        apiKey: "test-key",
      });
      mockReq.headers = { authorization: "Bearer wrong-key" };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid API key",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow requests with correct API key", () => {
      const middleware = createAuthMiddleware({
        mode: "api-key",
        apiKey: "test-key",
      });
      mockReq.headers = { authorization: "Bearer test-key" };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).auth).toEqual({ authenticated: true });
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 500 if apiKey is not configured", () => {
      const middleware = createAuthMiddleware({
        mode: "api-key",
      });
      mockReq.headers = { authorization: "Bearer test-key" };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Authentication not properly configured",
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("createAuthMiddleware - jwt mode", () => {
    beforeEach(() => {
      (vi.mocked(jwt).verify as vi.Mock).mockReset();
    });

    it("should reject requests without Authorization header", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should validate JWT with correct secret", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
        jwtAudience: "test-audience",
        jwtIssuer: "test-issuer",
      });
      mockReq.headers = { authorization: "Bearer valid-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockReturnValue({
        sub: "user-123",
        scope: "read write",
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(vi.mocked(jwt).verify).toHaveBeenCalledWith(
        "valid-token",
        "secret",
        {
          audience: "test-audience",
          issuer: "test-issuer",
        }
      );
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as AuthenticatedRequest).auth).toEqual({
        authenticated: true,
        userId: "user-123",
        scopes: ["read", "write"],
      });
    });

    it("should handle scopes as array", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });
      mockReq.headers = { authorization: "Bearer valid-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockReturnValue({
        sub: "user-123",
        scope: ["read", "write"],
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as AuthenticatedRequest).auth?.scopes).toEqual(["read", "write"]);
    });

    it("should handle missing scopes", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });
      mockReq.headers = { authorization: "Bearer valid-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockReturnValue({
        sub: "user-123",
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as AuthenticatedRequest).auth?.scopes).toBeUndefined();
    });

    it("should reject expired tokens", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });
      mockReq.headers = { authorization: "Bearer expired-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockImplementation(() => {
        const err = new Error("Token expired");
        err.name = "TokenExpiredError";
        throw err;
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Token has expired",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject invalid tokens", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });
      mockReq.headers = { authorization: "Bearer invalid-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockImplementation(() => {
        const err = new Error("Invalid token");
        err.name = "JsonWebTokenError";
        throw err;
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle unexpected JWT errors", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
        jwtSecret: "secret",
      });
      mockReq.headers = { authorization: "Bearer bad-token" };

      (vi.mocked(jwt).verify as vi.Mock).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Token verification failed",
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should return 500 if jwtSecret is not configured", () => {
      const middleware = createAuthMiddleware({
        mode: "jwt",
      });
      mockReq.headers = { authorization: "Bearer token" };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Authentication not properly configured",
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("loadMcpAuthConfig", () => {
    it("should default to 'none' mode when no env var set", () => {
      delete process.env.MCP_AUTH_MODE;

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("none");
    });

    it("should load api-key mode configuration", () => {
      process.env.MCP_AUTH_MODE = "api-key";
      process.env.MCP_AUTH_API_KEY = "test-api-key";

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("api-key");
      expect(config.apiKey).toBe("test-api-key");
    });

    it("should warn when api-key mode but no API key is set", () => {
      process.env.MCP_AUTH_MODE = "api-key";
      delete process.env.MCP_AUTH_API_KEY;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("api-key");
      expect(config.apiKey).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP_AUTH_API_KEY is not set")
      );

      consoleSpy.mockRestore();
    });

    it("should load jwt mode configuration", () => {
      process.env.MCP_AUTH_MODE = "jwt";
      process.env.MCP_AUTH_JWT_SECRET = "jwt-secret";
      process.env.MCP_AUTH_JWT_AUDIENCE = "test-aud";
      process.env.MCP_AUTH_JWT_ISSUER = "test-iss";

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("jwt");
      expect(config.jwtSecret).toBe("jwt-secret");
      expect(config.jwtAudience).toBe("test-aud");
      expect(config.jwtIssuer).toBe("test-iss");
    });

    it("should warn when jwt mode but no secret is set", () => {
      process.env.MCP_AUTH_MODE = "jwt";
      delete process.env.MCP_AUTH_JWT_SECRET;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("jwt");
      expect(config.jwtSecret).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP_AUTH_JWT_SECRET is not set")
      );

      consoleSpy.mockRestore();
    });

    it("should fallback to 'none' for invalid mode", () => {
      process.env.MCP_AUTH_MODE = "invalid-mode";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("none");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid MCP_AUTH_MODE="invalid-mode"')
      );

      consoleSpy.mockRestore();
    });

    it("should handle uppercase mode values", () => {
      process.env.MCP_AUTH_MODE = "API-KEY";
      process.env.MCP_AUTH_API_KEY = "test-key";

      const config = loadMcpAuthConfig();

      expect(config.mode).toBe("api-key");
    });
  });

  describe("loadWebAuthConfig", () => {
    it("should default to 'none' mode when no env var set", () => {
      delete process.env.WEB_AUTH_MODE;

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("none");
    });

    it("should load api-key mode configuration", () => {
      process.env.WEB_AUTH_MODE = "api-key";
      process.env.WEB_AUTH_API_KEY = "web-api-key";

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("api-key");
      expect(config.apiKey).toBe("web-api-key");
    });

    it("should warn when api-key mode but no API key is set", () => {
      process.env.WEB_AUTH_MODE = "api-key";
      delete process.env.WEB_AUTH_API_KEY;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("api-key");
      expect(config.apiKey).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("WEB_AUTH_API_KEY is not set")
      );

      consoleSpy.mockRestore();
    });

    it("should load jwt mode configuration", () => {
      process.env.WEB_AUTH_MODE = "jwt";
      process.env.WEB_AUTH_JWT_SECRET = "web-jwt-secret";
      process.env.WEB_AUTH_JWT_AUDIENCE = "web-aud";
      process.env.WEB_AUTH_JWT_ISSUER = "web-iss";

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("jwt");
      expect(config.jwtSecret).toBe("web-jwt-secret");
      expect(config.jwtAudience).toBe("web-aud");
      expect(config.jwtIssuer).toBe("web-iss");
    });

    it("should warn when jwt mode but no secret is set", () => {
      process.env.WEB_AUTH_MODE = "jwt";
      delete process.env.WEB_AUTH_JWT_SECRET;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("jwt");
      expect(config.jwtSecret).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("WEB_AUTH_JWT_SECRET is not set")
      );

      consoleSpy.mockRestore();
    });

    it("should fallback to 'none' for invalid mode", () => {
      process.env.WEB_AUTH_MODE = "invalid";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = loadWebAuthConfig();

      expect(config.mode).toBe("none");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid WEB_AUTH_MODE="invalid"')
      );

      consoleSpy.mockRestore();
    });
  });

  describe("requireAuth", () => {
    it("should allow authenticated requests", () => {
      (mockReq as AuthenticatedRequest).auth = { authenticated: true };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated requests", () => {
      (mockReq as AuthenticatedRequest).auth = { authenticated: false };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject requests without auth object", () => {
      delete (mockReq as AuthenticatedRequest).auth;

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
