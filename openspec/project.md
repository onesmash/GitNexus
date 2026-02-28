# Project Context

## Purpose

GitNexus is a graph-powered code intelligence tool for AI agents — "building git for agent context." It indexes any codebase into a knowledge graph (symbols, call chains, dependencies, clusters, execution flows) and exposes it through MCP tools, a CLI, and a web UI so AI agents get deep architectural awareness instead of just file contents.

Two deployment modes:
- **CLI + MCP**: indexes locally via KùzuDB, serves an MCP server to Cursor, Claude Code, Windsurf, etc.
- **Web UI**: browser-only (WASM-based) visual graph explorer + AI chat at gitnexus.vercel.app; bridges to local CLI via `gitnexus serve`.

## Tech Stack

### Core package (`gitnexus/`)
- **TypeScript 5**, ES2022, ESM (`"type": "module"`), NodeNext module resolution
- **Node.js ≥18** runtime
- **KùzuDB** (`kuzu`) — embedded graph database; persists index on disk
- **Tree-sitter** (native bindings) — multi-language AST parsing (TS, JS, Python, Go, Rust, Java, C/C++, C#, PHP)
- **@huggingface/transformers** — local vector embeddings (no external API call)
- **@modelcontextprotocol/sdk** — MCP server (tools + resources)
- **Commander** — CLI framework
- **Express + CORS** — HTTP server for bridge/serve mode
- **graphology** — in-memory graph for build-time processing
- **BM25 + vector hybrid search** (Reciprocal Rank Fusion)
- Build: `tsc` → `dist/`; dev: `tsx watch`

### Web UI (`gitnexus-web/`)
- **React 18**, **Vite 5**, **TailwindCSS v4**
- **TypeScript 5**
- **kuzu-wasm** — in-browser KùzuDB
- **web-tree-sitter** — WASM language parsers
- **Sigma.js + D3** — graph visualization
- **LangChain** — multi-provider AI chat (Anthropic, OpenAI, Google, Ollama)
- **Zod** — schema validation
- Deployed to **Vercel**

### Eval (`eval/`)
- **Python** (pyproject.toml)
- Docker-based isolated environments
- Jinja prompt templates; YAML model/mode configs
- Tests multiple LLM models (Claude Haiku/Sonnet/Opus, MiniMax, GLM)

## Project Conventions

### Code Style
- TypeScript strict mode is **off** (`"strict": false`) in the core package
- ESM-only: always use `.js` extensions in imports (NodeNext resolution requires it)
- No enforced formatter config — follow the style of surrounding code
- Prefer named exports over default exports
- File naming: `kebab-case.ts` for all source files

### Architecture Patterns
- **Pipeline architecture**: Ingestion (tree-sitter parsing) → Graph (KùzuDB) → Embeddings (@huggingface/transformers) → Search (BM25 + vector) → MCP (tools/resources)
- **Worker pool** for parallel AST parsing (`core/ingestion/workers/`)
- **Dual deployment**: same domain logic has native (Node.js) and WASM (browser) variants — e.g., `kuzu` vs `kuzu-wasm`, `tree-sitter` vs `web-tree-sitter`
- **MCP server** exposes both `tools` (query, context, impact, rename, cypher, detect_changes) and `resources` (gitnexus://repo/... URIs)
- **Bridge mode**: `gitnexus serve` runs an Express server so the web UI can access CLI-indexed repos without re-indexing
- Keep CLI, core logic, MCP, storage, and server layers cleanly separated under `src/`

### Testing Strategy
- No unit test suite — the project currently relies on:
  - The **eval harness** (`eval/`) for end-to-end LLM benchmark testing across model/mode combos
  - Manual integration testing via the MCP tools and CLI
- When adding new features, prefer validating via `gitnexus analyze` on the repo itself and exercising the MCP tools

### Git Workflow
- **GitHub repo**: `abhigyanpatwari/GitNexus`
- Feature branches + PRs merged to `main`
- Commit messages are descriptive prose (not enforced conventional commits), e.g. `fix: remove unconditional embedder import`
- PRs are squash-merged; change IDs in commit subjects are common

## Domain Context

- A **symbol** is a function, class, method, interface, struct, etc. extracted by tree-sitter
- A **process** is an inferred execution flow — an ordered chain of symbols from an entry point to a terminal
- A **cluster/community** is an auto-detected functional area (Leiden algorithm on the call graph)
- **CodeRelation** is the single edge table in KùzuDB — all relationships (CALLS, IMPORTS, EXTENDS, IMPLEMENTS, MEMBER_OF, STEP_IN_PROCESS) use `type` as a property
- **Staleness**: the index can drift from the codebase; `npx gitnexus analyze` re-indexes; the MCP context resource warns when stale
- The web UI is privacy-first: everything runs in-browser with no server-side code execution

## Important Constraints

- **License**: PolyForm Noncommercial 1.0 — no commercial use without a separate agreement
- **Node ≥18** required for native bindings (tree-sitter, KùzuDB); Node 24+ requires lazy-loading of the embedder due to onnxruntime compatibility
- The WASM build must work without Node.js APIs — keep browser and Node paths strictly separated
- Avoid breaking the MCP tool/resource contract — downstream users (Cursor, Claude Code, etc.) depend on stable tool names and resource URI formats
- KùzuDB schema changes require migration handling; do not alter column names/types without updating `core/kuzu/schema.ts` and the CSV generators

## External Dependencies

| Service / Package | Purpose | Notes |
|---|---|---|
| KùzuDB (`kuzu`) | Persistent graph database | Local only, no network |
| @huggingface/transformers | Local vector embeddings | Runs ONNX models in-process |
| @modelcontextprotocol/sdk | MCP server protocol | Stable API contract |
| Tree-sitter (native + WASM) | Multi-language AST parsing | Vendored WASM binaries in `vendor/` |
| LangChain (web UI) | Multi-provider LLM chat | Anthropic, OpenAI, Google, Ollama |
| Vercel | Web UI hosting | `gitnexus-web/vercel.json` |
| npm registry | Package distribution | Published as `gitnexus` |
