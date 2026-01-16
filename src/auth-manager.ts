import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Authentication configuration
 */
export interface AuthConfig {
  mode: "none" | "api-key" | "jwt";
  apiKey?: string;
  jwtSecret?: string;
  jwtAudience?: string;
  jwtIssuer?: string;
}

/**
 * Extended request type with auth context
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    authenticated: boolean;
    userId?: string;
    scopes?: string[];
  };
}

/**
 * Create authentication middleware based on configuration
 */
export function createAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    // No authentication required
    if (config.mode === "none") {
      authReq.auth = { authenticated: false };
      next();
      return;
    }

    // Extract bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid Authorization header. Expected: Authorization: Bearer <token>",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // API Key authentication
    if (config.mode === "api-key") {
      if (!config.apiKey) {
        console.error("AUTH_MODE=api-key but AUTH_API_KEY is not configured");
        res.status(500).json({
          error: "Internal Server Error",
          message: "Authentication not properly configured",
        });
        return;
      }

      if (token !== config.apiKey) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Invalid API key",
        });
        return;
      }

      authReq.auth = { authenticated: true };
      next();
      return;
    }

    // JWT authentication
    if (config.mode === "jwt") {
      if (!config.jwtSecret) {
        console.error("AUTH_MODE=jwt but AUTH_JWT_SECRET is not configured");
        res.status(500).json({
          error: "Internal Server Error",
          message: "Authentication not properly configured",
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret, {
          audience: config.jwtAudience,
          issuer: config.jwtIssuer,
        }) as jwt.JwtPayload;

        authReq.auth = {
          authenticated: true,
          userId: decoded.sub,
          scopes: decoded.scope
            ? Array.isArray(decoded.scope)
              ? decoded.scope
              : decoded.scope.split(" ")
            : undefined,
        };

        next();
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError || (error as Error).name === "TokenExpiredError") {
          res.status(401).json({
            error: "Unauthorized",
            message: "Token has expired",
          });
          return;
        }

        if (error instanceof jwt.JsonWebTokenError || (error as Error).name === "JsonWebTokenError") {
          res.status(401).json({
            error: "Unauthorized",
            message: "Invalid token",
          });
          return;
        }

        console.error("JWT verification error:", error);
        res.status(500).json({
          error: "Internal Server Error",
          message: "Token verification failed",
        });
        return;
      }
    }

    // Should never reach here
    res.status(500).json({
      error: "Internal Server Error",
      message: "Invalid authentication mode",
    });
  };
}

/**
 * Load MCP authentication configuration from environment variables
 */
export function loadMcpAuthConfig(): AuthConfig {
  const mode = (process.env.MCP_AUTH_MODE || "none").toLowerCase();

  if (!["none", "api-key", "jwt"].includes(mode)) {
    console.warn(
      `Invalid MCP_AUTH_MODE="${mode}". Falling back to "none". Valid options: none, api-key, jwt`
    );
    return { mode: "none" };
  }

  const config: AuthConfig = {
    mode: mode as "none" | "api-key" | "jwt",
  };

  if (mode === "api-key") {
    config.apiKey = process.env.MCP_AUTH_API_KEY;
    if (!config.apiKey) {
      console.error(
        "MCP_AUTH_MODE=api-key but MCP_AUTH_API_KEY is not set. Authentication will fail!"
      );
    }
  }

  if (mode === "jwt") {
    config.jwtSecret = process.env.MCP_AUTH_JWT_SECRET;
    config.jwtAudience = process.env.MCP_AUTH_JWT_AUDIENCE;
    config.jwtIssuer = process.env.MCP_AUTH_JWT_ISSUER;

    if (!config.jwtSecret) {
      console.error(
        "MCP_AUTH_MODE=jwt but MCP_AUTH_JWT_SECRET is not set. Authentication will fail!"
      );
    }
  }

  return config;
}

/**
 * Load Web/API authentication configuration from environment variables
 */
export function loadWebAuthConfig(): AuthConfig {
  const mode = (process.env.WEB_AUTH_MODE || "none").toLowerCase();

  if (!["none", "api-key", "jwt"].includes(mode)) {
    console.warn(
      `Invalid WEB_AUTH_MODE="${mode}". Falling back to "none". Valid options: none, api-key, jwt`
    );
    return { mode: "none" };
  }

  const config: AuthConfig = {
    mode: mode as "none" | "api-key" | "jwt",
  };

  if (mode === "api-key") {
    config.apiKey = process.env.WEB_AUTH_API_KEY;
    if (!config.apiKey) {
      console.error(
        "WEB_AUTH_MODE=api-key but WEB_AUTH_API_KEY is not set. Authentication will fail!"
      );
    }
  }

  if (mode === "jwt") {
    config.jwtSecret = process.env.WEB_AUTH_JWT_SECRET;
    config.jwtAudience = process.env.WEB_AUTH_JWT_AUDIENCE;
    config.jwtIssuer = process.env.WEB_AUTH_JWT_ISSUER;

    if (!config.jwtSecret) {
      console.error(
        "WEB_AUTH_MODE=jwt but WEB_AUTH_JWT_SECRET is not set. Authentication will fail!"
      );
    }
  }

  return config;
}

/**
 * Middleware to check if request is authenticated
 * Use this AFTER createAuthMiddleware to enforce authentication
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.auth?.authenticated) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  next();
}
