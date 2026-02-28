## 1. Schema Cleanup
- [ ] 1.1 Remove `EMBEDDING_TABLE_NAME`, `EMBEDDING_SCHEMA`, `CREATE_VECTOR_INDEX_QUERY`
      from `gitnexus/src/core/kuzu/schema.ts`
- [ ] 1.2 Remove FTS functions (`createFTSIndex`, `loadFTSExtension`, `queryFTS`,
      `dropFTSIndex`, `loadCachedEmbeddings`, `getEmbeddingTableName`) and
      embedding helpers from `gitnexus/src/core/kuzu/kuzu-adapter.ts`

## 2. qmd Search Adapter
- [ ] 2.1 Create `gitnexus/src/core/search/qmd-search.ts` — wraps subprocess calls to
      `qmd search`, `qmd vsearch`, and `qmd query` with `--json` output; returns
      `BM25SearchResult[]` / `SemanticSearchResult[]` matching existing interfaces
- [ ] 2.2 Update `gitnexus/src/core/search/bm25-index.ts` to delegate to
      `qmd-search.ts` (or replace file entirely)
- [ ] 2.3 Update `gitnexus/src/core/search/hybrid-search.ts` to call qmd-backed
      functions; wire optional re-ranking path

## 3. Embedding Pipeline Replacement
- [ ] 3.1 Delete or stub out the CLI-path ONNX pipeline in
      `gitnexus/src/core/embeddings/embedding-pipeline.ts` (keep type definitions
      used by web UI if any are re-exported)
- [ ] 3.2 Delete `gitnexus/src/core/embeddings/embedder.ts` (CLI path; WASM path
      in web UI is unaffected)
- [ ] 3.3 Remove `@huggingface/transformers` from `gitnexus/package.json` (or
      scope it to optional/dev if web UI build still needs it in that package)

## 4. Symbol Document Writer
- [ ] 4.1 Create `gitnexus/src/core/search/symbol-doc-writer.ts` — takes
      `KnowledgeGraph` (or queries KuzuDB after load), writes per-symbol
      `.md` files to `.gitnexus/qmd/<repoName>/` with frontmatter + content
- [ ] 4.2 Define and document the markdown document format (frontmatter schema)

## 5. Analyze Pipeline Integration
- [ ] 5.1 In `gitnexus/src/cli/analyze.ts`, remove FTS index creation phase
      (currently Phase 3, lines ~213–226) and embedding re-insert block
- [ ] 5.2 Add new Phase 3: symbol document write via `symbol-doc-writer.ts`
- [ ] 5.3 Add new Phase 4: qmd collection registration + `qmd embed` subprocess call;
      detect qmd on PATH; skip gracefully with warning if absent
- [ ] 5.4 Update `--embeddings` / `--no-embeddings` flag semantics (or rename)
      to reflect qmd embed instead of ONNX

## 6. MCP / Storage Layer
- [ ] 6.1 Verify `gitnexus/src/mcp/local/local-backend.ts` has no direct FTS or
      embedding queries; update any that do
- [ ] 6.2 Verify `gitnexus/src/storage/repo-manager.ts` does not reference
      `CodeEmbedding` table or FTS index paths
- [ ] 6.3 Update `getStoragePaths` (if needed) to include `.gitnexus/qmd/` path

## 7. Dependency Updates
- [ ] 7.1 Add `@tobilu/qmd` as optional peer dependency in `gitnexus/package.json`
      with minimum tested version pinned
- [ ] 7.2 Update README / install docs: add qmd install step for search support

## 8. Validation
- [ ] 8.1 Run `gitnexus analyze --force` on this repo with qmd installed; confirm
      `.gitnexus/qmd/gitnexus/` is populated and `qmd search` returns results
- [ ] 8.2 Run `gitnexus analyze --force` on this repo **without** qmd installed;
      confirm graceful warning and analyze completes
- [ ] 8.3 Exercise `query` MCP tool (`mcp__gitnexus__query`) and confirm ranked
      results are returned via qmd search adapter
- [ ] 8.4 Confirm `cypher`, `context`, `impact`, `detect_changes` MCP tools
      are unaffected (graph-only, no search dependency)
