## MODIFIED Requirements

### Requirement: MCP server entry uses npx to invoke gitnexus (local-first)

The MCP entry written to editor configuration files SHALL invoke `gitnexus mcp`
via `npx -y gitnexus mcp` (without `@latest`) so that npx uses the locally
installed version when available, and falls back to downloading from npm
non-interactively (`-y`) when no local installation exists. On Windows the entry
MUST route through `cmd /c` because `npx` is a `.cmd` script that cannot be
executed directly by MCP hosts.

**Rationale:** Omitting `@latest` lets npx respect the locally installed version,
giving users predictable behavior when they have `gitnexus` installed. The `-y`
flag ensures MCP hosts can start the server without blocking on a download
confirmation prompt.

#### Scenario: Cursor MCP config written by setup on non-Windows

- **WHEN** the user has Cursor installed and runs `gitnexus setup` on a non-Windows OS
- **THEN** `~/.cursor/mcp.json` contains `"command": "npx"` and `"args": ["-y", "gitnexus", "mcp"]` for the `gitnexus` entry
- **AND** the entry MUST NOT contain `@latest` or reference the bare `gitnexus` binary as the command

#### Scenario: Cursor MCP config written by setup on Windows

- **WHEN** the user has Cursor installed and runs `gitnexus setup` on Windows
- **THEN** `~/.cursor/mcp.json` contains `"command": "cmd"` and `"args": ["/c", "npx", "-y", "gitnexus", "mcp"]` for the `gitnexus` entry
- **AND** the entry MUST NOT contain `@latest`

#### Scenario: Claude Code manual step printed by setup

- **WHEN** the user has Claude Code installed and runs `gitnexus setup`
- **THEN** the printed manual registration command is `claude mcp add gitnexus -- npx -y gitnexus mcp`
- **AND** the output MUST NOT reference `@latest` or a bare `gitnexus` binary as the launcher

#### Scenario: npx uses local installation when present

- **WHEN** the user has `gitnexus` installed globally and the MCP host starts the server via `npx -y gitnexus mcp`
- **THEN** npx resolves to the locally installed binary without downloading from npm
