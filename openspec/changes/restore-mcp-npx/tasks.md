# Tasks: restore-mcp-npx

## 1. Implementation

- [x] 1.1 In `gitnexus/src/cli/setup.ts`, update `getMcpEntry()` to npx-based invocation (local-first, no `@latest`):
      - Non-Windows: `{ command: 'npx', args: ['-y', 'gitnexus', 'mcp'] }`
      - Windows: `{ command: 'cmd', args: ['/c', 'npx', '-y', 'gitnexus', 'mcp'] }`
      - Update the JSDoc comment: "On Windows, npx must be invoked via cmd /c since it's a .cmd script."

- [x] 1.2 In `setupClaudeCode()`, update the printed manual command to:
      `claude mcp add gitnexus -- npx -y gitnexus mcp`

## 2. Cleanup

- [x] 2.1 Cancel / close the `update-mcp-entry` change (it is superseded by this proposal)

## 3. Validation

- [x] 3.1 Build: `npm run build` in `gitnexus/` completes without errors
- [ ] 3.2 Smoke-test: run `gitnexus setup` on a machine with Cursor or OpenCode
      installed and confirm the written MCP JSON contains
      `"command": "npx"` and `"args": ["-y", "gitnexus", "mcp"]`
- [ ] 3.3 Verify MCP server starts correctly via the restored npx entry
