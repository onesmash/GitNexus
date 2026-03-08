# Change: Restore MCP server entry to npx-based invocation (local-first)

## Why

The `update-mcp-entry` change switched `getMcpEntry()` from npx-based invocation
to the locally-installed `gitnexus` binary directly. We want to go back to npx,
but using `npx -y gitnexus mcp` (without `@latest`) so that npx **prefers the locally
installed version** when present, and only falls back to downloading from npm when
no local installation is found. The `-y` flag suppresses the download confirmation
prompt so MCP hosts can start the server non-interactively.

## What Changes

- **`getMcpEntry()` in `gitnexus/src/cli/setup.ts`**: replace `{ command: 'gitnexus', args: ['mcp'] }` with `{ command: 'npx', args: ['-y', 'gitnexus', 'mcp'] }` on non-Windows; restore Windows to `{ command: 'cmd', args: ['/c', 'npx', '-y', 'gitnexus', 'mcp'] }`.
- **`setupClaudeCode()` manual command**: update printed command from `claude mcp add gitnexus -- gitnexus mcp` to `claude mcp add gitnexus -- npx -y gitnexus mcp`.
- **Cancel `update-mcp-entry`**: the in-progress change that introduced the binary-based entry is superseded by this proposal.

## Impact

- Affected specs: `setup` (MCP server entry requirement)
- Affected code: `gitnexus/src/cli/setup.ts` — `getMcpEntry()` and `setupClaudeCode()`
