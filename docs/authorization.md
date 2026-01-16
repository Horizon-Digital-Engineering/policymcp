# Authorization Guide

Policy MCP supports flexible authentication for both MCP endpoints (AI assistants) and Web/API endpoints (human users and applications). This guide covers when and how to use different authentication modes.

## Table of Contents

- [Overview](#overview)
- [When to Use No Auth](#when-to-use-no-auth)
- [When to Use API Keys](#when-to-use-api-keys)
- [When to Use JWT](#when-to-use-jwt)
- [Enterprise Patterns](#enterprise-patterns)
- [Configuration](#configuration)
- [Examples](#examples)

## Overview

Policy MCP provides **separate authentication** for two types of endpoints:

1. **MCP Endpoints** (`/mcp`) - For AI assistants connecting via Model Context Protocol
2. **Web/API Endpoints** (`/api/*`) - For humans and applications managing policies

Each can be configured independently with:
- `none` - No authentication (default, easy demos)
- `api-key` - Simple bearer token authentication
- `jwt` - JWT token validation for enterprise SSO integration

## When to Use No Auth

**Recommended for:**
- Local development and testing
- Demos and proof-of-concepts
- Internal networks with perimeter security
- Scenarios where the server itself is behind auth (API gateway, VPN, etc.)

**Configuration:**
```bash
MCP_AUTH_MODE=none
WEB_AUTH_MODE=none
```

**Security Considerations:**
- ✅ Safe for local development (`localhost` only)
- ✅ Safe behind corporate VPN or API gateway
- ✅ Safe for internal-only deployments with network segmentation
- ❌ **NOT** safe for public internet exposure
- ❌ **NOT** compliant with most security standards for production

**When it's okay to use `none`:**
- You're running on `localhost` for development
- The server is behind an API gateway that handles authentication
- You're in a trusted internal network (e.g., Kubernetes cluster with network policies)
- You're doing a quick demo or prototype

## When to Use API Keys

**Recommended for:**
- Production deployments without SSO requirements
- Service-to-service authentication
- Controlled access with key rotation
- Simple auth requirements

**Configuration:**
```bash
# Generate a strong random key (32+ characters)
MCP_AUTH_MODE=api-key
MCP_AUTH_API_KEY=your-secret-key-here

WEB_AUTH_MODE=api-key
WEB_AUTH_API_KEY=your-secret-key-here
```

**Usage:**
```bash
curl -H "Authorization: Bearer your-secret-key-here" \
  https://your-server.com/api/policies
```

**Best Practices:**
- Generate keys using cryptographically secure random number generators
- Use different keys for MCP and Web endpoints (separate concerns)
- Rotate keys regularly (e.g., every 90 days)
- Store keys in secret management systems (AWS Secrets Manager, Vault, etc.)
- Never commit keys to version control
- Use environment variables or secret injection

**Security Considerations:**
- ✅ Simple to implement and use
- ✅ Works with most enterprise tooling
- ✅ Easy to rotate and revoke
- ⚠️ All requests with the key have full access (no fine-grained permissions)
- ⚠️ Keys can leak if not handled carefully (logs, error messages, etc.)

## When to Use JWT

**Recommended for:**
- Enterprise SSO integration (Okta, Auth0, Azure AD, etc.)
- Fine-grained access control via JWT claims
- OAuth 2.1 compliance (as per MCP 2025 spec)
- Multi-tenant deployments
- Scenarios requiring user attribution

**Configuration:**
```bash
MCP_AUTH_MODE=jwt
MCP_AUTH_JWT_SECRET=your-jwt-signing-secret
MCP_AUTH_JWT_AUDIENCE=https://policymcp.yourcompany.com
MCP_AUTH_JWT_ISSUER=https://auth.yourcompany.com

WEB_AUTH_MODE=jwt
WEB_AUTH_JWT_SECRET=your-jwt-signing-secret
WEB_AUTH_JWT_AUDIENCE=https://policymcp.yourcompany.com/api
WEB_AUTH_JWT_ISSUER=https://auth.yourcompany.com
```

**Usage:**
```bash
# Get JWT from your auth provider (Auth0, Okta, etc.)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -H "Authorization: Bearer $TOKEN" \
  https://your-server.com/api/policies
```

**JWT Requirements:**
- Token must be signed with `AUTH_JWT_SECRET`
- Must include `aud` (audience) claim matching `AUTH_JWT_AUDIENCE`
- Must include `iss` (issuer) claim matching `AUTH_JWT_ISSUER`
- Should include `sub` (subject) claim for user identification
- Should include `exp` (expiration) for time-limited access

**Security Considerations:**
- ✅ Industry standard for enterprise authentication
- ✅ Supports SSO and identity federation
- ✅ Tokens are time-limited (expire automatically)
- ✅ Can include user identity and scopes
- ✅ Compliant with OAuth 2.1 / MCP 2025 spec
- ⚠️ Requires integration with external auth provider
- ⚠️ More complex setup than API keys

## Enterprise Patterns

### Pattern 1: Development → Staging → Production

**Development:**
```bash
# Local dev: no auth
MCP_AUTH_MODE=none
WEB_AUTH_MODE=none
```

**Staging:**
```bash
# Staging: API keys for testing
MCP_AUTH_MODE=api-key
MCP_AUTH_API_KEY=staging-key-123

WEB_AUTH_MODE=api-key
WEB_AUTH_API_KEY=staging-key-456
```

**Production:**
```bash
# Production: JWT with enterprise SSO
MCP_AUTH_MODE=jwt
MCP_AUTH_JWT_SECRET=prod-secret
MCP_AUTH_JWT_AUDIENCE=https://policymcp.prod.com
MCP_AUTH_JWT_ISSUER=https://auth.company.com

WEB_AUTH_MODE=jwt
WEB_AUTH_JWT_SECRET=prod-secret
WEB_AUTH_JWT_AUDIENCE=https://policymcp.prod.com/api
WEB_AUTH_JWT_ISSUER=https://auth.company.com
```

### Pattern 2: Hybrid Auth (Different Auth for MCP vs Web)

Some organizations may want AI assistants to use API keys while humans use SSO:

```bash
# MCP endpoints: API key (for programmatic access)
MCP_AUTH_MODE=api-key
MCP_AUTH_API_KEY=service-account-key

# Web endpoints: JWT (for human SSO)
WEB_AUTH_MODE=jwt
WEB_AUTH_JWT_SECRET=sso-secret
WEB_AUTH_JWT_AUDIENCE=https://policymcp.company.com/api
WEB_AUTH_JWT_ISSUER=https://sso.company.com
```

### Pattern 3: API Gateway Pattern

If you're using an API gateway (AWS API Gateway, Kong, Nginx, etc.), you may want the gateway to handle auth:

```bash
# PolicyMCP: no auth (gateway handles it)
MCP_AUTH_MODE=none
WEB_AUTH_MODE=none

# Your API gateway config handles:
# - JWT validation
# - API key checks
# - Rate limiting
# - IP whitelisting
```

**Architecture:**
```
[Client] → [API Gateway + Auth] → [PolicyMCP (no auth)]
```

Benefits:
- Centralized authentication
- Consistent auth across multiple services
- Gateway can add rate limiting, caching, etc.

### Pattern 4: OAuth 2.1 Resource Server (MCP 2025 Spec)

The [MCP 2025 specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) requires MCP servers to act as OAuth 2.1 Resource Servers. Here's how to comply:

**Setup with Auth0 (example):**

1. Create an API in Auth0 (get audience identifier)
2. Configure Policy MCP:
```bash
MCP_AUTH_MODE=jwt
MCP_AUTH_JWT_SECRET=your-auth0-secret
MCP_AUTH_JWT_AUDIENCE=https://your-auth0-api-identifier
MCP_AUTH_JWT_ISSUER=https://your-tenant.auth0.com/
```

3. MCP clients request tokens from Auth0:
```bash
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "audience": "https://your-auth0-api-identifier",
    "grant_type": "client_credentials"
  }'
```

4. Clients use the token with Policy MCP:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://policymcp.com/mcp
```

**Why this matters:**
- Prevents confused deputy attacks (tokens bound to specific resource)
- Enables fine-grained scopes (future: read-only vs. write access)
- Complies with enterprise security standards
- Supports token refresh and expiration

## Configuration

### Full Configuration Reference

See [`.env.example`](../.env.example) for all options.

### Environment Variable Precedence

1. Environment variables (highest priority)
2. `.env` file (if using dotenv)
3. Default values (lowest priority)

### Security Best Practices

**Secrets Management:**
- ✅ Use environment variables for secrets
- ✅ Use secret management systems (AWS Secrets Manager, Vault, etc.)
- ✅ Rotate secrets regularly
- ❌ Never commit secrets to git
- ❌ Never log secrets in application logs

**Key Generation:**
```bash
# Generate a secure random API key (256 bits)
openssl rand -base64 32

# Generate a JWT secret (512 bits recommended)
openssl rand -base64 64
```

**Network Security:**
- Always use HTTPS in production
- Consider IP whitelisting for MCP endpoints
- Use API gateway for rate limiting and DDoS protection
- Enable CORS restrictions (`CORS_ORIGIN` env var)

## Examples

### Example 1: Local Development (No Auth)

```bash
# .env
PORT=3000
MCP_AUTH_MODE=none
WEB_AUTH_MODE=none

# Start server
npm start

# Access without auth
curl http://localhost:3000/api/policies
```

### Example 2: Production with API Keys

```bash
# Generate keys
API_KEY=$(openssl rand -base64 32)

# .env
PORT=3000
MCP_AUTH_MODE=api-key
MCP_AUTH_API_KEY=$API_KEY
WEB_AUTH_MODE=api-key
WEB_AUTH_API_KEY=$API_KEY

# Start server
npm start

# Access with auth
curl -H "Authorization: Bearer $API_KEY" \
  https://your-server.com/api/policies
```

### Example 3: Enterprise with Auth0 JWT

**Step 1: Configure Auth0**
1. Create an API in Auth0
2. Note the API Identifier (e.g., `https://policymcp.company.com`)
3. Note your Auth0 domain (e.g., `company.auth0.com`)

**Step 2: Configure Policy MCP**
```bash
# .env
PORT=3000
MCP_AUTH_MODE=jwt
MCP_AUTH_JWT_SECRET=your-auth0-secret
MCP_AUTH_JWT_AUDIENCE=https://policymcp.company.com
MCP_AUTH_JWT_ISSUER=https://company.auth0.com/

WEB_AUTH_MODE=jwt
WEB_AUTH_JWT_SECRET=your-auth0-secret
WEB_AUTH_JWT_AUDIENCE=https://policymcp.company.com/api
WEB_AUTH_JWT_ISSUER=https://company.auth0.com/
```

**Step 3: Get Token and Use**
```bash
# Get token from Auth0
TOKEN=$(curl --request POST \
  --url https://company.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "audience": "https://policymcp.company.com",
    "grant_type": "client_credentials"
  }' | jq -r '.access_token')

# Use token with Policy MCP
curl -H "Authorization: Bearer $TOKEN" \
  https://policymcp.company.com/api/policies
```

### Example 4: Claude Desktop with API Key

```json
{
  "mcpServers": {
    "policymcp": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

## Troubleshooting

### "Unauthorized" / 401 Errors

**Symptom:** `{"error": "Unauthorized", "message": "Missing or invalid Authorization header"}`

**Solutions:**
1. Ensure you're sending `Authorization: Bearer <token>` header
2. Verify token is correct (no typos, no extra spaces)
3. Check token hasn't expired (for JWT)
4. Verify `AUTH_MODE` is set correctly

### JWT Validation Failures

**Symptom:** `{"error": "Unauthorized", "message": "Invalid token"}`

**Solutions:**
1. Check `AUTH_JWT_SECRET` matches your JWT signing key
2. Verify `AUTH_JWT_AUDIENCE` matches the `aud` claim in your token
3. Verify `AUTH_JWT_ISSUER` matches the `iss` claim in your token
4. Ensure token hasn't expired (`exp` claim)
5. Decode token at jwt.io to inspect claims

### Token Working Locally But Not in Production

**Common causes:**
1. Environment variables not set in production
2. Secret values different between environments
3. Audience/issuer URLs different (http vs https)
4. CORS issues (check browser console)

## Further Reading

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [OAuth 2.1 Authorization Framework](https://www.osohq.com/learn/authorization-for-ai-agents-mcp-oauth-21)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
