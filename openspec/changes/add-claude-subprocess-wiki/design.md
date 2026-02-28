# Design: AI Agent CLI Subprocess Backend

## Context

The wiki generator makes 1 + N + 1 LLM calls (grouping + one per module + overview). Currently all calls go through `callLLM()` which POSTs to an OpenAI-compatible HTTP endpoint. We need a second code path that routes those same calls through a local AI agent CLI subprocess (`claude` or `agent`) instead.

## Goals / Non-Goals

- **Goals**: zero-config wiki generation for Claude Code and Cursor users; no new external dependencies; existing HTTP path untouched
- **Non-Goals**: MCP-orchestration mode; streaming token-by-token output from subprocess; Gemini CLI or other agent tools

## CLI Invocations

### Claude Code
```bash
claude -p "<prompt>" [--model <model>]
```
- `-p` / `--print` — non-interactive, writes full response to stdout and exits
- `--model` — optional model override (e.g. `claude-sonnet-4-5`)
- Stable: exits cleanly on completion

### Cursor
```bash
agent --print "<prompt>" --force --output-format=text [--model <model>]
```
- `agent` — standalone Cursor CLI binary
- `--print` — non-interactive print mode
- `--force` — skips interactive confirmation prompts
- `--output-format=text` — plain text output (not JSON)
- `--model` — optional (e.g. `claude-3-5-sonnet`, `auto`)
- **Known issues (as of early 2026)**: process may hang on exit and never return. A hard timeout with `SIGKILL` is required. Community reports suggest `--force --output-format=text` reduces (but does not eliminate) hangs.

## Architecture

### Pluggable LLM Caller

`WikiGenerator` currently holds an `llmConfig: LLMConfig` and calls `callLLM(prompt, this.llmConfig, systemPrompt, opts)` directly. We introduce a `LLMCaller` type and inject it at construction time:

```ts
type LLMCaller = (prompt: string, systemPrompt?: string, opts?: CallLLMOptions) => Promise<LLMResponse>;
```

`wiki.ts` (CLI layer) is responsible for creating the right caller based on the resolved agent/config and passing it to `WikiGenerator`. This keeps `WikiGenerator` backend-agnostic.

### `callAgentCLI(prompt, agent, model?, systemPrompt?, opts?)`

Single function handling both agents, selected by the `agent: 'claude' | 'cursor'` parameter.

- Uses `execFile` (not `exec`) with the prompt passed as an explicit argument — avoids shell injection from prompt content containing quotes, backticks, or `${}` expansions
- Concatenates `systemPrompt` into the user prompt when the CLI has no `--system-prompt` flag (both CLIs lack it): prefix with `"[System: ...]\n\n"`
- **Timeout**: 120 seconds hard timeout with `SIGKILL` fallback (required for Cursor; harmless for Claude)
- Non-zero exit or timeout → throw with stderr or `"Agent CLI timed out"` as message
- Empty stdout → throw `'<agent> returned empty response'`
- Progress callback: fires once on completion with `output.length` as char count

### `detectAgentCLI(): 'claude' | 'cursor' | null`

```ts
// Claude Code: `claude --version`
// Cursor: `agent --version`
try { execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 5000 }); return 'claude'; } catch {}
try { execFileSync('agent', ['--version'], { stdio: 'ignore', timeout: 5000 }); return 'cursor'; } catch {}
return null;
```

Returns the first agent CLI found in PATH. Cached per process.

### Interactive Setup Flow Update

`--agent` is a runtime-only flag; nothing is written to `~/.gitnexus/config.json`. When the user omits both `--agent` and a configured API key, the interactive setup wizard detects available agent CLIs and offers them upfront.

Current menu:
```
[1] OpenAI
[2] OpenRouter
[3] Custom endpoint
```

Updated menu (zero-config agents prepended when detected):
```
[1] Claude Code (no API key needed)    ← shown if claude in PATH
[2] Cursor (no API key needed)         ← shown if agent in PATH
[3] OpenAI
[4] OpenRouter
[5] Custom endpoint
```

Selecting an agent option runs the wiki immediately — no key is saved. HTTP options still save credentials as before. Agents not in PATH are not shown.

## Decisions

| Decision | Rationale |
|---|---|
| `execFile` over `exec` | Avoids shell injection; prompt content may contain quotes, backticks, `${}` |
| 120s timeout + SIGKILL | Cursor headless mode has well-documented hang bugs; without a timeout the wiki command would freeze indefinitely |
| Prepend system prompt inline | Neither `claude` nor `agent` exposes a `--system-prompt` flag; inline prefix is the only option |
| Single `callAgentCLI` for both | Both CLIs share the same pattern; branching is minimal (`claude -p` vs `agent --print --force --output-format=text`) |
| `--agent` not `--llm` | User mental model: they're choosing their AI agent (Claude Code / Cursor), not an LLM model string |
| No config persistence for `--agent` | Agent choice is ephemeral; users re-specify per run or rely on auto-detect; avoids config churn |
| Auto-detect on first run | Reduces setup friction to zero when the agent CLI is already in PATH |
| No retry in agent backend | Subprocess failures are almost always config/auth; retrying won't help |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Cursor hangs and never exits | Hard 120s timeout + SIGKILL; surface `"agent timed out (120s) — try reducing --concurrency"` |
| Cursor `-p` still unreliable in current releases | Document as beta: `--agent cursor` works on best-effort basis; recommend Claude Code for production use |
| Very long prompts exceeding ARG_MAX (~2MB on macOS) | Prompts are already truncated at `maxTokensPerModule` (30k tokens ≈ 120k chars). If exceeded, write to a temp file and pass `$(cat tmpfile)` — defer to implementation |
| Windows `cursor` PATH resolution | `execFile('cursor', ['agent', ...])` should work if the `cursor` binary is on PATH; verify with `which cursor` / `where cursor` |

## Open Questions

- Should `--model` be forwarded? Yes — pass it through to both CLIs when set.
- Should we surface Cursor as "beta" in the interactive menu? Yes — add `(beta)` label to the Cursor option.
- Should `gitnexus config set agent cursor` be supported? No — `--agent` is runtime-only; out of scope.
