# Change: Raise embedding auto-skip threshold to 100,000 nodes

## Why

The current `EMBEDDING_NODE_LIMIT` of 50,000 causes embeddings to be silently skipped for medium-to-large repos (e.g. GitNexus itself at 92,434 nodes), degrading hybrid search quality without a clear warning to the user.

## What Changes

- Increase `EMBEDDING_NODE_LIMIT` in `gitnexus/src/cli/analyze.ts` from `50_000` to `100_000`.
- The skip message already prints the node count and new limit, so the output will self-document the new threshold.

## Impact

- Affected specs: `embeddings`
- Affected code: `gitnexus/src/cli/analyze.ts:51` (`EMBEDDING_NODE_LIMIT`)
