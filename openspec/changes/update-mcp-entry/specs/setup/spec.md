# Capability: setup

The `gitnexus setup` command detects installed AI editors and writes the
appropriate MCP server configuration so GitNexus is available without manual
configuration.

## MODIFIED Requirements

### Requirement: MCP server entry uses the installed gitnexus binary

The MCP entry written to editor configuration files SHALL invoke the globally
installed `gitnexus` binary directly rather than routing through `npx`. The
Windows platform branch is retained (using `cmd /c`) because `gitnexus` is a
`.cmd` script on Windows.

**Rationale:** `gitnexus setup` is only reachable after global installation, so
the binary is guaranteed to be in PATH. Using the binary directly avoids npx
version-resolution overhead and ensures the running server version matches the
installed version.

#### Scenario: Cursor MCP config written by setup on non-Windows

- **WHEN** the user has Cursor installed, runs `gitnexus setup` on a non-Windows OS
- **THEN** `~/.cursor/mcp.json` contains `"command": "gitnexus"` and `"args": ["mcp"]` for the `gitnexus` entry
- **AND** the entry MUST NOT reference `npx` or `gitnexus@latest`

#### Scenario: Cursor MCP config written by setup on Windows

- **WHEN** the user has Cursor installed, runs `gitnexus setup` on Windows
- **THEN** `~/.cursor/mcp.json` contains `"command": "cmd"` and `"args": ["/c", "gitnexus", "mcp"]` for the `gitnexus` entry
- **AND** the entry MUST NOT reference `npx` or `gitnexus@latest`

#### Scenario: Claude Code manual step printed by setup

- **WHEN** the user has Claude Code installed and runs `gitnexus setup`
- **THEN** the printed manual registration command is `claude mcp add gitnexus -- gitnexus mcp`
- **AND** the output MUST NOT reference `npx` or `gitnexus@latest`
