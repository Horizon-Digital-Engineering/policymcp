# Policy MCP

A Model Context Protocol (MCP) server for ingesting PDF policy documents and exposing them to AI assistants.

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Horizon-Digital-Engineering/policymcp/tree/main)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Horizon-Digital-Engineering_policymcp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Horizon-Digital-Engineering_policymcp)
[![CI](https://github.com/Horizon-Digital-Engineering/policymcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Horizon-Digital-Engineering/policymcp/actions/workflows/ci.yml)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](LICENSE)

## Features

- **PDF Ingestion**: Upload PDF policy documents via web UI or MCP tools
- **Full-Text Search**: Search across all loaded policies with relevance scoring
- **MCP Protocol**: Exposes policies via the Model Context Protocol for AI assistants
- **Web UI**: Browser-based interface for uploading and managing policies
- **Remote Deployment**: Runs as an HTTP server with Streamable HTTP MCP transport

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

The server will start at `http://localhost:3000`:
- **Web UI**: `http://localhost:3000`
- **MCP Endpoint**: `http://localhost:3000/mcp`
- **Health Check**: `http://localhost:3000/health`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host binding |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `MCP_AUTH_MODE` | `none` | MCP endpoint authentication: `none`, `api-key`, or `jwt` |
| `MCP_AUTH_API_KEY` | - | API key for MCP endpoints (if `MCP_AUTH_MODE=api-key`) |
| `MCP_AUTH_JWT_SECRET` | - | JWT secret for token validation (if `MCP_AUTH_MODE=jwt`) |
| `WEB_AUTH_MODE` | `none` | Web/API endpoint authentication: `none`, `api-key`, or `jwt` |
| `WEB_AUTH_API_KEY` | - | API key for web endpoints (if `WEB_AUTH_MODE=api-key`) |
| `WEB_AUTH_JWT_SECRET` | - | JWT secret for token validation (if `WEB_AUTH_MODE=jwt`) |

See [`.env.example`](.env.example) for full configuration options and [docs/authorization.md](docs/authorization.md) for authentication setup.

## Connecting Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "policymcp": {
      "url": "https://your-app.ondigitalocean.app/mcp"
    }
  }
}
```

Then restart Claude Desktop. The policy tools will be available via the hammer icon.

## MCP Tools

| Tool | Description |
|------|-------------|
| `scan_pdf` | Scan a PDF file and extract policy information |
| `search_policies` | Search through loaded policies by keywords |
| `list_policies` | List all loaded policies with summaries |
| `get_policy` | Get full content of a specific policy by ID |

## API Reference

### Web API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/policies` | List all policies (optional `?category=` filter) |
| `GET` | `/api/policies/:id` | Get single policy by ID |
| `POST` | `/api/policies` | Upload PDF (multipart form with `file` field) |
| `DELETE` | `/api/policies/:id` | Delete a policy |
| `GET` | `/api/search` | Search policies (`?query=` required, `?category=` optional) |
| `GET` | `/api/categories` | Get list of unique categories |

### MCP Protocol (Streamable HTTP)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | MCP request handling (initialize, tool calls) |
| `GET` | `/mcp` | Server-to-client notifications (SSE) |
| `DELETE` | `/mcp` | Session termination |

### Health & Probes

| Path | Description |
|------|-------------|
| `/health` | Health check with status, version, policy count |
| `/ready` | Kubernetes readiness probe |
| `/live` | Kubernetes liveness probe |

## Deployment

### DigitalOcean App Platform

Click the "Deploy to DO" button above, or:

1. Fork this repository
2. Create a new app in [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. Connect your forked repository
4. The `.do/deploy.template.yaml` will auto-configure the deployment

### Manual Deployment

```bash
# Build for production
npm ci
npm run build

# Start the server
node dist/index.js
```

Ensure `HOST=0.0.0.0` is set for cloud deployments.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   HTTP Server (Express)                  │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │  /mcp      │  │  /api/*    │  │  / (static)      │  │
│  │  MCP Proto │  │  REST API  │  │  Web UI          │  │
│  └─────┬──────┘  └─────┬──────┘  └──────────────────┘  │
│        │               │                                 │
│        └───────┬───────┘                                │
│                ▼                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              PolicyStore (in-memory)              │  │
│  │                                                    │  │
│  │  • addPolicy()      • searchPolicies()           │  │
│  │  • getPolicy()      • listPolicies()             │  │
│  │  • removePolicy()   • getAllPolicies()           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript and copy static files |
| `npm start` | Run the production server |
| `npm run dev` | Watch mode for development |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

### Project Structure

```
src/
├── index.ts          # Express server, MCP setup, API routes
├── pdf-parser.ts     # PDF text extraction and section parsing
├── policy-store.ts   # In-memory policy storage with search
├── types.ts          # TypeScript interfaces
└── public/
    └── index.html    # Web UI (single-page app)
```

## Known Limitations

- **In-memory storage**: Policies are lost on server restart
- **No OCR**: Scanned PDFs with images are not supported
- **Basic section detection**: Complex document formatting may not parse correctly

## Contributing

Contributions are welcome! Please read the license terms before contributing.

## License

This project is licensed under the Business Source License 1.1 (BUSL-1.1). See [LICENSE](LICENSE) for details.

The license allows free use for non-production purposes. For production use, please contact [Horizon Digital Engineering](https://github.com/Horizon-Digital-Engineering).
