# Change: Replace search layer with qmd

## Why

GitNexus's current BM25 search (KuzuDB FTS extension) and vector embedding search
(`@huggingface/transformers` ONNX + KuzuDB `CodeEmbedding` table) are functional but
have two pain points:
1. The ONNX embedder (`onnxruntime-node`) crashes on Node v24+ without a lazy-import
   workaround, and requires downloading a model binary at first use.
2. The KuzuDB FTS extension is a bolt-on; BM25 quality and stemming options are limited
   compared to dedicated full-text engines.

[qmd](https://github.com/tobi/qmd) is a lightweight Node.js search engine that bundles
FTS5-based BM25, local GGUF vector embeddings, and LLM re-ranking in a single CLI/MCP
tool. Adopting it for the search layer improves result quality and removes the ONNX
runtime dependency from the core CLI.

## What Changes

- **REMOVED**: KuzuDB FTS extension calls (`createFTSIndex`, `loadFTSExtension`,
  `queryFTS`, `dropFTSIndex`) from `kuzu-adapter.ts`.
- **REMOVED**: `CodeEmbedding` node table and HNSW vector index from KuzuDB schema.
- **REMOVED**: `@huggingface/transformers` embedding pipeline (`core/embeddings/`
  used by CLI path only; web UI WASM path is out of scope).
- **ADDED**: Symbol document writer — after graph load, export indexed symbols as
  markdown documents to `.gitnexus/qmd/` (one `.md` file per symbol).
- **ADDED**: qmd collection registration and `qmd embed` run as part of `gitnexus analyze`.
- **ADDED**: `core/search/qmd-search.ts` — replaces `bm25-index.ts`; invokes
  `qmd search` / `qmd vsearch` / `qmd query` via subprocess or qmd MCP.
- **MODIFIED**: `hybrid-search.ts` — adapts to qmd-backed BM25 and semantic results;
  optionally uses `qmd query` (deep search + re-ranking) for the `query` MCP tool.
- **MODIFIED**: `cli/analyze.ts` — removes FTS index creation phase, adds qmd
  collection write + embed phase.
- No changes to KuzuDB graph schema (nodes, edges, Cypher tools) — **KuzuDB stays**
  for all graph storage and traversal.

## Impact

- Affected specs: `search` (new capability spec)
- Affected code:
  - `gitnexus/src/core/kuzu/kuzu-adapter.ts` — remove FTS + embedding functions
  - `gitnexus/src/core/kuzu/schema.ts` — remove `EMBEDDING_SCHEMA`, `CREATE_VECTOR_INDEX_QUERY`, `EMBEDDING_TABLE_NAME`
  - `gitnexus/src/core/search/bm25-index.ts` — replace with qmd adapter
  - `gitnexus/src/core/search/hybrid-search.ts` — wire qmd results
  - `gitnexus/src/core/embeddings/` — remove CLI-path ONNX pipeline (keep types used by web UI)
  - `gitnexus/src/cli/analyze.ts` — swap FTS+embedding phase for qmd phase
  - `gitnexus/package.json` — remove/downgrade `@huggingface/transformers`; add qmd peer dep
- **Web UI (`gitnexus-web/`) is out of scope** — it uses `kuzu-wasm` + WASM embeddings
  in the browser; qmd is Node.js only.
- **Breaking**: users with existing `.gitnexus/` indexes must re-run `gitnexus analyze`
  to populate the qmd collection.
