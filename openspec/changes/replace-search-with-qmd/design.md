# Design: Replace search layer with qmd

## Context

GitNexus CLI uses a two-phase search pipeline during `query` / `context` / `impact` MCP
tool calls:
1. **BM25** via KuzuDB FTS extension — queries `file_fts`, `function_fts`, `class_fts`,
   `method_fts`, `interface_fts` indexes in sequence (must be sequential; KuzuDB allows
   only one write transaction at a time).
2. **Vector** via `@huggingface/transformers` (Snowflake snowflake-arctic-embed-xs,
   384-dim) stored in a `CodeEmbedding` node table with HNSW cosine index in KuzuDB.
3. **Merge** via RRF in `hybrid-search.ts`.

qmd replaces steps 1 and 2 with a unified CLI/MCP that runs locally via Node.js (FTS5
BM25 + GGUF VRAM-resident embedding model + optional qwen3-reranker).

## Goals / Non-Goals

- **Goals**:
  - Replace FTS + embedding pipeline in the CLI package with qmd.
  - Improve `query` MCP tool result quality via LLM re-ranking.
  - Remove `onnxruntime-node` ABI fragility from the CLI package.
- **Non-Goals**:
  - Changing KuzuDB graph storage, Cypher query tools, or schema nodes/edges.
  - Modifying `gitnexus-web/` (browser WASM path, separate concern).
  - Replacing `@huggingface/transformers` in the web UI.

## Decisions

### Document format for qmd collection

Each indexed symbol is written as a small markdown file:

```
.gitnexus/qmd/<repoName>/<nodeId>.md
```

Content template:
```markdown
---
nodeId: Function:src/foo.ts:bar
label: Function
filePath: src/foo.ts
startLine: 12
endLine: 25
---

# bar

```typescript
function bar(x: number): string {
  ...
}
```
```

**Why per-symbol files (not per-source-file):** qmd's FTS and vector search operate on
document chunks. One symbol = one document gives direct line-level attribution and avoids
chunking ambiguity. This also mirrors qmd's intended use pattern.

**Alternatives considered:**
- *One file per source file*: simpler write path, but loses symbol-level attribution;
  FTS scores averaged across the whole file.
- *Append to existing source files*: depends on file paths staying stable; breaks for
  generated/virtual files.

### qmd invocation mode

Two options: **subprocess** (simple) vs **MCP daemon** (fast).

| | Subprocess | MCP daemon |
|---|---|---|
| Cold-start per query | ~1-2s (model already loaded by qmd?) | ~0ms (model resident) |
| Setup complexity | Spawn + parse stdout | MCP client in gitnexus |
| Reliability | Simple; no state | Requires daemon lifecycle |

**Decision: subprocess first.** qmd keeps models loaded in VRAM across requests when
run as a daemon, but the overhead of managing a daemon process in gitnexus outweighs the
benefit at this stage. Use subprocess calls with `--json` output. Revisit if latency
becomes a complaint.

### qmd as optional vs required dependency

`qmd` (`@tobilu/qmd`) is added as an **optional peer dependency**. If qmd is not
installed, `gitnexus analyze` skips the qmd phase (no BM25/vector search available) and
logs a warning. The `query` MCP tool falls back to graph-only results.

**Why optional:** avoids forcing users who only use graph tools (Cypher, impact) to
install qmd's GGUF runtime.

### Re-ranking

qmd's `qmd query` (deep search) invokes LLM re-ranking via qwen3-reranker. Enable this
for the `query` MCP tool's ranked process search, off by default, toggled via
`--rerank` flag on `gitnexus analyze` or a config option. Re-ranking adds ~1-3s per
query but meaningfully improves precision.

### Web UI

`gitnexus-web` is entirely browser-side (WASM). It uses `kuzu-wasm` + WASM-based
embeddings. qmd is a Node.js CLI; there is no browser-compatible qmd runtime. The web UI
search path is unchanged.

## Risks / Trade-offs

- **New native dependency** (qmd uses node-llama-cpp): same ABI concern as kuzu/onnxruntime.
  Mitigation: make qmd optional; fall back gracefully.
- **qmd document directory size**: one `.md` per symbol can mean 50k+ files for large
  repos. Mitigation: keep in `.gitnexus/qmd/` (already gitignored); benchmark on
  gitnexus itself (~1400 symbols).
- **qmd is early-stage** (v0.x): API may change. Mitigation: pin exact version; wrap all
  qmd calls behind a thin adapter module (`qmd-search.ts`) so swapping is isolated.
- **Breaking for existing users**: KuzuDB `CodeEmbedding` table and FTS indexes are
  removed from the schema. Re-analyze required.

## Migration Plan

1. `gitnexus analyze` detects presence of `.gitnexus/qmd/` directory.
2. If missing (fresh or stale), writes symbol documents and runs `qmd embed`.
3. `--force` flag forces full re-write of qmd collection.
4. Old KuzuDB `CodeEmbedding` data is ignored (no migration needed; just re-analyze).

## Open Questions

- Should `gitnexus analyze --no-embeddings` flag be renamed or kept for compatibility?
  (Currently skips ONNX embedding; with qmd, it would skip `qmd embed`.)
- Should qmd run in HTTP daemon mode when `gitnexus serve` is active, to amortize
  model load time across multiple MCP requests?
