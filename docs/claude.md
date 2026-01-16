# CLAUDE.md - Policy MCP Development Guide

This file provides guidance for AI assistants (like Claude) working with this codebase.

## Project Overview

Policy MCP is a Model Context Protocol server that:
1. Ingests PDF documents containing organizational policies
2. Extracts and structures policy content
3. Exposes policies to AI chat assistants via MCP tools and resources
4. Provides a web UI for policy management
5. Supports flexible authentication (none, API key, or JWT)

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run the server (no auth by default)
npm start

# Or with authentication
cp .env.example .env
# Edit .env to configure auth
npm start
```

## Architecture

```
src/
├── index.ts          # Express server + MCP endpoints + REST API
├── pdf-parser.ts     # PDF text extraction and section parsing
├── policy-store.ts   # In-memory policy storage with search
├── auth-manager.ts   # Authentication middleware (API key & JWT)
├── types.ts          # TypeScript interfaces
├── public/
│   └── index.html    # Web UI for policy management
└── __tests__/
    ├── pdf-parser.test.ts        # Unit tests for PDF parsing
    ├── policy-store.test.ts      # Unit tests for policy storage
    ├── server.test.ts            # Integration tests for REST API
    ├── auth-manager.test.ts      # Unit tests for auth middleware
    └── auth-integration.test.ts  # Integration tests for auth flows
```

## Key Components

### PDF Parser (`pdf-parser.ts`)
- Uses `pdf-parse` library for text extraction
- `parsePDF(filePath)` - Main entry point
- `extractSections()` - Detects section headings via regex patterns (numbered, roman numerals, letters, ALL CAPS)
- `extractMetadata()` - Finds effective dates and version numbers
- Returns structured `ParsedPDF` with title, content, sections, and metadata

### Policy Store (`policy-store.ts`)
- In-memory Map-based storage (policies lost on restart)
- `addPolicy()` - Store parsed PDF as policy with UUID
- `getPolicy(id)` - Retrieve policy by ID
- `searchPolicies(query, category?)` - Full-text search with relevance scoring
- `listPolicies(category?)` - Get summaries with optional category filter
- `removePolicy(id)` - Delete a policy
- `clear()` - Remove all policies
- Search relevance: title match (+10), section matches (+1 per term), content matches (+0.5 per occurrence)

### Auth Manager (`auth-manager.ts`)
- Supports three modes: `none` (default), `api-key`, `jwt`
- Separate configs for MCP endpoints vs Web/API endpoints
- `createAuthMiddleware(config)` - Express middleware factory
- `loadMcpAuthConfig()` - Load MCP endpoint auth from env vars
- `loadWebAuthConfig()` - Load Web/API endpoint auth from env vars
- JWT validation supports audience, issuer, and expiration checks
- OAuth 2.1 compliant for MCP 2025 spec

### MCP Server (`index.ts`)
**Express Setup:**
- Port: 3000 (configurable via `PORT` env var)
- CORS enabled (configurable via `CORS_ORIGIN`)
- JSON parsing for non-MCP routes
- Static file serving for web UI
- Separate auth for MCP vs Web/API endpoints

**MCP Tools:**
- `scan_pdf` - Scan a PDF file and extract policy information
- `search_policies` - Search through loaded policies by keywords
- `list_policies` - List all loaded policies with summaries
- `get_policy` - Get full content of a specific policy by ID

**REST API Endpoints:**
- `GET /api/policies` - List all policies (optional `?category=` filter)
- `GET /api/policies/:id` - Get single policy by ID
- `POST /api/policies` - Upload PDF (multipart form with `file` field)
- `DELETE /api/policies/:id` - Delete a policy
- `GET /api/search` - Search policies (`?query=` required, `?category=` optional)
- `GET /api/categories` - Get list of unique categories
- `GET /health`, `/ready`, `/live` - Health check endpoints

**MCP Endpoints:**
- `POST /mcp` - MCP request handler (Streamable HTTP transport)
- `GET /mcp` - Server-to-client notifications (SSE)
- `DELETE /mcp` - Session termination

## Authentication

See [docs/authorization.md](authorization.md) for comprehensive guide.

### Quick Reference

**Environment Variables:**
```bash
# MCP endpoint authentication (AI assistants)
MCP_AUTH_MODE=none|api-key|jwt
MCP_AUTH_API_KEY=your-key-here
MCP_AUTH_JWT_SECRET=your-secret
MCP_AUTH_JWT_AUDIENCE=https://your-audience
MCP_AUTH_JWT_ISSUER=https://your-issuer

# Web/API endpoint authentication (humans/apps)
WEB_AUTH_MODE=none|api-key|jwt
WEB_AUTH_API_KEY=your-key-here
WEB_AUTH_JWT_SECRET=your-secret
WEB_AUTH_JWT_AUDIENCE=https://your-audience
WEB_AUTH_JWT_ISSUER=https://your-issuer
```

**Usage:**
```bash
# With API key
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/policies

# With JWT
curl -H "Authorization: Bearer eyJhbGciOi..." \
  http://localhost:3000/api/policies
```

### When to Use Each Mode

- **none**: Local dev, demos, internal networks, behind API gateway
- **api-key**: Production without SSO, service-to-service, simple auth
- **jwt**: Enterprise SSO (Auth0, Okta), OAuth 2.1 compliance, fine-grained access

## Testing

### Test Suite

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **PDF Parser**: 18 tests covering section extraction, metadata, error handling
- **Policy Store**: 30+ tests covering CRUD, search, filtering, relevance scoring
- **REST API**: Integration tests for all endpoints (list, get, upload, delete, search)
- **Auth Manager**: Unit tests for all auth modes (none, API key, JWT)
- **Auth Integration**: End-to-end tests for OAuth 2.1 flows, mixed auth modes

### Coverage Thresholds

- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

## Common Tasks

### Adding a New Tool

1. Add tool registration in `createMCPServer()` function:
```typescript
server.tool(
  "tool_name",
  "Description of what the tool does",
  {
    param1: z.string().describe("Parameter description"),
  },
  async ({ param1 }) => {
    // Tool implementation
    return {
      content: [{ type: "text", text: "Result" }],
    };
  }
);
```

2. Tool is automatically available via MCP protocol

### Modifying PDF Parsing

**Section Detection:**
- Patterns are in `extractSections()` in `pdf-parser.ts`
- Add new regex patterns to `headingPatterns` array
- Adjust `level` calculation for new numbering schemes

**Metadata Extraction:**
- Patterns are in `extractMetadata()` in `pdf-parser.ts`
- Add date patterns to `datePatterns` array
- Add version patterns to `versionPatterns` array

### Adding Search Features

**Relevance Scoring:**
- Search logic is in `PolicyStore.searchPolicies()`
- Current weights: title match (+10), section matches (+1), content matches (+0.5)
- Modify scoring logic to adjust relevance

**New Search Criteria:**
- Add parameters to `searchPolicies()` method
- Filter policies before relevance calculation
- Update REST API endpoint to accept new params

### Adding Authentication

**New Auth Mode:**
1. Add mode to `AuthConfig` type in `auth-manager.ts`
2. Add validation logic to `createAuthMiddleware()`
3. Add config loading to `loadMcpAuthConfig()` / `loadWebAuthConfig()`
4. Add tests to `auth-manager.test.ts` and `auth-integration.test.ts`
5. Document in `docs/authorization.md`

**Changing Auth Behavior:**
- Modify `createAuthMiddleware()` in `auth-manager.ts`
- Update tests to verify new behavior
- Consider backwards compatibility

## Code Style

- TypeScript strict mode enabled
- ES modules (`.js` extensions in imports)
- Prefer async/await over callbacks
- Use descriptive error messages
- No console.log (use console.error for server logs)
- Use Zod for runtime validation
- Follow existing patterns for consistency

## CI/CD

### GitHub Actions

**Workflow:** `.github/workflows/ci.yml`
- Runs on: Push to main, PRs to main
- Node versions: 18, 20, 22
- Steps: Install → Build → **Test** → Lint
- SonarCloud: Runs on main branch pushes only

**Deployment:**
- DigitalOcean App Platform via `.do/deploy.template.yaml`
- Auto-deploys from main branch
- Health check: `/health` endpoint
- Environment variables configurable in DO dashboard

## Known Limitations

- **In-memory storage** - Policies lost on restart (no persistence)
- **No OCR support** - Scanned PDFs won't parse well
- **Basic section detection** - May miss complex/unusual formatting
- **No persistent indexing** - Search rebuilds on every query
- **No rate limiting** - API can be overwhelmed
- **No user management** - Auth is all-or-nothing (no per-user permissions)

## Future Improvements

See [docs/architecture.md](architecture.md) for planned enhancements including:
- **Persistence**: SQLite or PostgreSQL for policy storage
- **Semantic search**: Vector embeddings for better search results
- **OCR integration**: Support for scanned PDFs
- **Version tracking**: Track policy changes over time
- **Fine-grained permissions**: Scope-based access control
- **Rate limiting**: Protect against abuse
- **Multi-tenancy**: Support multiple organizations

## Troubleshooting

### Build Errors

**"Cannot find module" errors:**
- Run `npm install` to install dependencies
- Ensure `node_modules` is not in `.gitignore`
- Check TypeScript version (requires 5.3+)

**Type errors:**
- Run `npm run build` to see full type errors
- Check that all `.js` extensions are in import paths
- Verify `tsconfig.json` has `"module": "NodeNext"`

### Runtime Errors

**"Authentication not properly configured":**
- Check env vars are set correctly
- Verify `AUTH_MODE` matches available secrets
- See `docs/authorization.md` for config examples

**"Policy not found":**
- Policies are in-memory only (lost on restart)
- Re-upload PDFs after server restart
- Check policy ID is correct (UUIDs)

**"Failed to parse PDF":**
- Ensure file is a valid PDF
- Check PDF is not encrypted/password-protected
- Try opening PDF in a viewer to verify it's not corrupted

### Test Failures

**JWT tests failing:**
- Ensure `jsonwebtoken` is installed (`npm install`)
- Check test tokens aren't actually expired
- Verify mocks are set up correctly in beforeEach

**Integration tests failing:**
- Ensure no other server is running on test ports
- Check test database is clean (we use in-memory, so should be fine)
- Run tests individually to isolate failures

## Development Tips

1. **Use watch mode for rapid iteration:**
   ```bash
   npm run dev  # TypeScript watch mode
   npm run test:watch  # Test watch mode
   ```

2. **Test auth changes with curl:**
   ```bash
   # Test API key
   curl -H "Authorization: Bearer your-key" localhost:3000/api/policies

   # Test JWT (get token from Auth0/Okta first)
   curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/policies
   ```

3. **Use MCP Inspector for tool testing:**
   - Install: `npm install -g @modelcontextprotocol/inspector`
   - Run: `mcp-inspector http://localhost:3000/mcp`

4. **Check logs for auth info:**
   - Server logs auth config on startup
   - Look for "Authentication Configuration:" in console output

5. **Read the docs:**
   - [docs/authorization.md](authorization.md) - Comprehensive auth guide
   - [docs/architecture.md](architecture.md) - System design and future plans
   - [README.md](../README.md) - User-facing documentation
