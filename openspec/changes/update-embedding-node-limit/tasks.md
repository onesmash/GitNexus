## 1. Implementation

- [x] 1.1 Change `EMBEDDING_NODE_LIMIT` from `50_000` to `100_000` in `gitnexus/src/cli/analyze.ts:51`

## 2. Validation

- [x] 2.1 Build (`npm run build` in `gitnexus/`) and run `node dist/cli/index.js analyze --force --embeddings` on a repo with >50,000 nodes to confirm embeddings are no longer skipped
