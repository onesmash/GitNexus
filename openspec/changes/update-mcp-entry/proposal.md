# Proposal: update-mcp-entry

## Summary

Simplify the MCP server registration entry written by `gitnexus setup` from
`npx -y gitnexus@latest mcp` to `gitnexus mcp`, using the globally-installed
binary directly instead of routing through npx.

## Current Behaviour

`getMcpEntry()` in `src/cli/setup.ts` writes:

```json
// Non-Windows
{ "command": "npx", "args": ["-y", "gitnexus@latest", "mcp"] }

// Windows
{ "command": "cmd", "args": ["/c", "npx", "-y", "gitnexus@latest", "mcp"] }
```

The Claude Code manual step also reflects this:
```
claude mcp add gitnexus -- npx -y gitnexus mcp
```

## Desired Behaviour

Replace `npx -y gitnexus@latest` with the installed `gitnexus` binary directly.
The Windows platform branch is retained because `gitnexus` is a `.cmd` script
on Windows and requires `cmd /c` to invoke:

```json
// Non-Windows
{ "command": "gitnexus", "args": ["mcp"] }

// Windows
{ "command": "cmd", "args": ["/c", "gitnexus", "mcp"] }
```

And update the Claude Code manual step to:
```
claude mcp add gitnexus -- gitnexus mcp
```

## Motivation

- **Version consistency**: `npx -y gitnexus@latest` always fetches the latest
  published npm version, which can differ from the locally installed version the
  user actually tested against.
- **Speed**: Eliminates the npx version-resolution round-trip on every MCP
  server start.
- **Prerequisite is already met**: `gitnexus setup` is only reachable after the
  user has `gitnexus` installed globally, so the binary is guaranteed to be in
  PATH when setup runs.

## Scope

Single-function change in `src/cli/setup.ts`:
- `getMcpEntry()` — replace `npx -y gitnexus@latest` with `gitnexus`; keep the Windows `cmd /c` branch
- `setupClaudeCode()` — update the printed manual command

No spec delta is needed: there is no existing `setup` capability spec to modify.

## Out of Scope

- No changes to the MCP server logic itself (`src/cli/mcp.ts`)
- No changes to skill installation or hook installation
- No changes to other editor setup paths beyond the MCP entry
