# Tasks: update-mcp-entry

## Implementation

- [x] In `gitnexus/src/cli/setup.ts`, update `getMcpEntry()` to replace
      `npx -y gitnexus@latest` with `gitnexus` directly, keeping the Windows
      `cmd /c` branch:
      - Non-Windows: `{ command: 'gitnexus', args: ['mcp'] }`
      - Windows: `{ command: 'cmd', args: ['/c', 'gitnexus', 'mcp'] }`

- [x] In `setupClaudeCode()`, update the printed manual command from
      `claude mcp add gitnexus -- npx -y gitnexus mcp`
      to
      `claude mcp add gitnexus -- gitnexus mcp`

## Validation

- [ ] Build: `npm run build` in `gitnexus/` completes without errors
- [ ] Smoke-test: run `gitnexus setup` on a machine with Cursor or OpenCode
      installed and confirm the written MCP JSON contains
      `"command": "gitnexus"` and `"args": ["mcp"]`
- [ ] Verify MCP server starts correctly via the new entry (e.g., open Cursor
      and confirm GitNexus MCP tools are available)
