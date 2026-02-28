## ADDED Requirements

### Requirement: Symbol Document Export
During `gitnexus analyze`, the system SHALL export each indexed symbol as a markdown
document to `.gitnexus/qmd/<repoName>/` after the KuzuDB graph load phase completes.
Each document SHALL include the symbol's nodeId, label, filePath, line range, and source
content so that qmd can index it for both BM25 and vector search.

#### Scenario: Fresh analyze writes symbol documents
- **WHEN** `gitnexus analyze` runs on a repo
- **THEN** `.gitnexus/qmd/<repoName>/` is created (or overwritten) with one `.md` file per symbol

#### Scenario: Force flag overwrites existing collection
- **WHEN** `gitnexus analyze --force` runs
- **THEN** the `.gitnexus/qmd/<repoName>/` directory is wiped and rewritten before the qmd embed phase

#### Scenario: Symbol document format is parseable by qmd
- **WHEN** qmd indexes `.gitnexus/qmd/<repoName>/`
- **THEN** each document's frontmatter contains at minimum `nodeId`, `label`, `filePath`, `startLine`, `endLine`

---

### Requirement: qmd Collection Registration and Embedding
After symbol document export, `gitnexus analyze` SHALL register the qmd collection and
run `qmd embed` to generate vector embeddings for semantic search.
If qmd is not installed, this phase SHALL be skipped with a warning; the rest of the
analyze pipeline SHALL complete normally.

#### Scenario: qmd is installed — embed phase runs
- **WHEN** qmd is detected on PATH and symbol documents were written
- **THEN** `qmd collection add .gitnexus/qmd/<repoName>` is invoked, followed by `qmd embed`
- **AND** progress is reported in the analyze progress bar

#### Scenario: qmd is not installed — graceful skip
- **WHEN** qmd is not found on PATH
- **THEN** the analyze pipeline completes without embedding
- **AND** a warning is printed: "qmd not found — search will be unavailable. Install with: npm install -g @tobilu/qmd"

---

### Requirement: BM25 Keyword Search via qmd
The `query` MCP tool SHALL use qmd's BM25 search (`qmd search <term> --json`) as the
keyword search backend, replacing KuzuDB FTS extension queries.

#### Scenario: Keyword search returns ranked symbol results
- **WHEN** `query` is called with a keyword-style input
- **THEN** `qmd search` is invoked against the repo's qmd collection
- **AND** results are returned as `BM25SearchResult[]` with `filePath`, `score`, `rank`

#### Scenario: qmd unavailable — keyword search returns empty
- **WHEN** qmd is not installed or the collection is not yet populated
- **THEN** BM25 results are an empty array (no crash)
- **AND** the `query` tool continues with graph-only results

---

### Requirement: Vector Semantic Search via qmd
The `query` MCP tool SHALL use qmd's vector search (`qmd vsearch <query> --json`) as the
semantic search backend, replacing the `@huggingface/transformers` ONNX pipeline and
KuzuDB `CodeEmbedding` table.

#### Scenario: Semantic search returns ranked symbol results
- **WHEN** `query` is called with a natural-language input and embeddings are available
- **THEN** `qmd vsearch` is invoked against the repo's qmd collection
- **AND** results are returned as `SemanticSearchResult[]` with `nodeId`, `filePath`, `distance`

#### Scenario: First query after analyze — embeddings already computed
- **WHEN** `qmd embed` ran successfully during analyze
- **THEN** `qmd vsearch` returns results without re-embedding

---

### Requirement: Hybrid Search Preserved
The existing RRF hybrid merge (`hybrid-search.ts`) SHALL continue to combine BM25 and
semantic results after the backends are swapped to qmd. Result shape and ranking
behavior SHALL remain compatible with the `query` MCP tool's output contract.

#### Scenario: Hybrid results merge BM25 and semantic
- **WHEN** both BM25 and semantic results are available from qmd
- **THEN** `mergeWithRRF` produces a ranked list where symbols appearing in both lists score higher

---

### Requirement: Optional LLM Re-ranking
When qmd deep search is available, the `query` MCP tool SHALL support an opt-in
re-ranking mode using `qmd query` (hybrid + qwen3-reranker).

#### Scenario: Re-ranking improves precision for natural-language queries
- **WHEN** re-ranking is enabled (via config or `--rerank` analyze flag)
- **AND** `qmd query <term> --json` is invoked
- **THEN** the top results are re-scored by the LLM re-ranker
- **AND** the `query` MCP tool returns the re-ranked list

#### Scenario: Re-ranking disabled by default
- **WHEN** no explicit re-rank option is set
- **THEN** `qmd query` is NOT invoked; plain `qmd search` + `qmd vsearch` + RRF is used

## REMOVED Requirements

### Requirement: KuzuDB FTS Indexes
**Reason**: Replaced by qmd BM25. The `file_fts`, `function_fts`, `class_fts`,
`method_fts`, and `interface_fts` FTS indexes are no longer created during analyze.
`createFTSIndex`, `loadFTSExtension`, `queryFTS`, and `dropFTSIndex` are removed from
`kuzu-adapter.ts`.
**Migration**: Run `gitnexus analyze` after upgrading; qmd collection is created instead.

#### Scenario: FTS index creation is removed from analyze pipeline
- **WHEN** `gitnexus analyze` runs
- **THEN** no `CREATE_FTS_INDEX` Cypher calls are made
- **AND** no `fts` extension is loaded into KuzuDB

---

### Requirement: KuzuDB Vector Embeddings
**Reason**: Replaced by qmd vector search. The `CodeEmbedding` node table and
`code_embedding_idx` HNSW index are removed from the KuzuDB schema.
`@huggingface/transformers` is removed as a CLI dependency.
**Migration**: Run `gitnexus analyze`; qmd embed generates vector indexes outside KuzuDB.

#### Scenario: CodeEmbedding table is absent from schema
- **WHEN** KuzuDB is initialized for a fresh repo
- **THEN** no `CREATE NODE TABLE CodeEmbedding` query is executed
- **AND** no `CREATE_VECTOR_INDEX` Cypher call is made
