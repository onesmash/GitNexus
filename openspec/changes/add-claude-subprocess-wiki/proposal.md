# Change: Add AI agent CLI subprocess backend for wiki generation

> **Status: Deferred** — superseded by `add-wiki-skill` for Claude Code users.
> Standalone `npx gitnexus wiki` (without Claude Code) remains unaffected.
> This change may still be relevant for Cursor/terminal users in a future release.

## Why

Wiki generation currently requires configuring a separate external LLM API key (OpenAI, OpenRouter, etc.), creating friction for users who already have Claude Code or Cursor installed. Both tools ship CLI executables (`claude` for Claude Code, `agent` for Cursor) that can serve as zero-configuration LLM backends, eliminating the need for a separate API key entirely.

## What Changes

- Add `--agent <agent>` flag to `gitnexus wiki` (values: `claude`, `cursor`; runtime-only, not persisted to config)
- Implement a `callAgentCLI` subprocess backend in `llm-client.ts`:
  - Claude Code: `claude -p "<prompt>" [--model <model>]`
  - Cursor: `agent --print "<prompt>" --force --output-format=text [--model <model>]`
- Auto-detect: if `--agent` is omitted and no API key is configured, probe `claude` then `agent` in PATH and offer detected CLIs in the interactive setup menu
- Update the interactive LLM setup wizard to surface detected agent CLIs as zero-config options (no key saved on selection)
- Refactor `WikiGenerator` to accept a pluggable `LLMCaller` function, decoupling it from the HTTP-based `callLLM`

## Impact

- Affected specs: `wiki-generation` (new capability spec)
- Affected code:
  - `gitnexus/src/core/wiki/llm-client.ts` — new `callAgentCLI` + `detectAgentCLI` helper
  - `gitnexus/src/cli/wiki.ts` — `--agent` flag, updated interactive setup, config persistence
  - `gitnexus/src/core/wiki/generator.ts` — pluggable `LLMCaller` abstraction replacing hardcoded `callLLM`
- No breaking changes: existing OpenAI-compatible flow is fully preserved
