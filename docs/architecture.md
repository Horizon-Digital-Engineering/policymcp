# Policy MCP - Architecture Document

## Overview

Policy MCP is a Model Context Protocol server that ingests PDF documents, extracts policy information, and exposes them to AI chat assistants. This enables AI systems to answer questions about organizational policies, compliance requirements, and procedural guidelines.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Chat Client                            │
│                   (Claude, etc via MCP)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (stdio/SSE)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Policy MCP Server                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   MCP Tools     │  │  MCP Resources  │  │   MCP Prompts   │  │
│  │                 │  │                 │  │                 │  │
│  │ - scan_pdf      │  │ - policy://list │  │ - policy_query  │  │
│  │ - search_policy │  │ - policy://{id} │  │                 │  │
│  │ - list_policies │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Policy Store                              ││
│  │  - In-memory storage of extracted policies                   ││
│  │  - Full-text search index                                    ││
│  │  - Metadata (source file, date, category)                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   PDF Parser Module                          ││
│  │  - Text extraction (pdf-parse)                               ││
│  │  - Policy section detection                                  ││
│  │  - Metadata extraction                                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PDF Files     │
                    │  (filesystem)   │
                    └─────────────────┘
```

## Components

### 1. MCP Server (`src/index.ts`)
The main entry point that initializes the MCP server and registers all tools, resources, and prompts.

### 2. PDF Parser (`src/pdf-parser.ts`)
Handles PDF ingestion and text extraction:
- Uses `pdf-parse` library for text extraction
- Detects policy sections using heuristics (headers, numbering patterns)
- Extracts metadata (title, date, version)

### 3. Policy Store (`src/policy-store.ts`)
In-memory storage and search:
- Stores extracted policies with unique IDs
- Provides full-text search capabilities
- Maintains policy metadata and relationships

### 4. MCP Handlers (`src/handlers/`)
Implements MCP protocol handlers:
- **Tools**: Actions the AI can perform (scan, search, list)
- **Resources**: Data the AI can read (policy content)
- **Prompts**: Pre-defined prompt templates

## Data Model

```typescript
interface Policy {
  id: string;
  title: string;
  content: string;
  sourceFile: string;
  category?: string;
  effectiveDate?: string;
  version?: string;
  sections: PolicySection[];
  extractedAt: Date;
}

interface PolicySection {
  heading: string;
  content: string;
  level: number;
}
```

## MCP Interface

### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `scan_pdf` | Scan a PDF file and extract policies | `filePath: string` |
| `search_policies` | Search policies by keyword/phrase | `query: string, category?: string` |
| `list_policies` | List all loaded policies | `category?: string` |

### Resources

| URI Pattern | Description |
|-------------|-------------|
| `policy://list` | JSON list of all policy summaries |
| `policy://{id}` | Full content of a specific policy |

### Prompts

| Prompt | Description |
|--------|-------------|
| `policy_query` | Template for querying policies with context |

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **PDF Parsing**: `pdf-parse`
- **Build**: TypeScript compiler

## File Structure

```
policymcp/
├── ARCHITECTURE.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── pdf-parser.ts     # PDF text extraction
│   ├── policy-store.ts   # Policy storage & search
│   └── types.ts          # TypeScript interfaces
└── policies/             # Default policy directory
```

## Usage Flow

1. **Initialization**: MCP server starts and loads any pre-existing policies
2. **Ingestion**: User/AI calls `scan_pdf` tool to ingest new PDFs
3. **Query**: AI uses `search_policies` or reads resources to find relevant policies
4. **Response**: AI uses policy content to answer user questions

## Future Enhancements

- Persistent storage (SQLite/PostgreSQL)
- Vector embeddings for semantic search
- OCR support for scanned PDFs
- Policy version tracking and diff
- Automatic categorization using AI
