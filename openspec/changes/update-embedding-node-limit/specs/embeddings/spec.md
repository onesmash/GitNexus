## MODIFIED Requirements

### Requirement: Embedding Auto-Skip Threshold

The `analyze` command SHALL automatically skip embedding generation when `--embeddings` is requested and the indexed node count exceeds **100,000** (previously 50,000).

When skipped, the output MUST display the actual node count and the current limit so users understand why embeddings were bypassed.

#### Scenario: Embeddings run for repo under 100k nodes

- **WHEN** `analyze --embeddings` is run and the repo has ≤ 100,000 nodes
- **THEN** embedding generation proceeds normally

#### Scenario: Embeddings skipped for repo over 100k nodes

- **WHEN** `analyze --embeddings` is run and the repo has > 100,000 nodes
- **THEN** embeddings are skipped and the summary line reads `skipped (N nodes > 100,000 limit)`
