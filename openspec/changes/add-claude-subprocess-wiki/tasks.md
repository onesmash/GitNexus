## 1. llm-client.ts — Agent CLI backend

- [x] 1.1 Add `detectAgentCLI(): 'claude' | 'cursor' | null` — probe `claude --version` then `agent --version` via `execFileSync` with 5s timeout; cache result per process
- [x] 1.2 Add `callAgentCLI(prompt, agent, model?, systemPrompt?, opts?)` — shells out using `execFile` (not `exec`) to avoid shell injection:
  - Claude: `claude -p "<prompt>" [--model <model>]`
  - Cursor: `agent --print "<prompt>" --force --output-format=text [--model <model>]`
- [x] 1.3 Prepend `systemPrompt` as inline prefix `"[System: ...]\n\n"` in the prompt (neither CLI exposes a `--system-prompt` flag)
- [x] 1.4 Enforce 120-second hard timeout with SIGKILL; throw `"agent timed out (120s) — try reducing --concurrency"` or `"claude timed out (120s)"` on expiry
- [x] 1.5 Map non-zero exit codes to thrown errors using stderr content
- [x] 1.6 Map empty stdout to `'<agent> returned empty response'` error
- [x] 1.7 Fire `onChunk` progress callback once on completion with `output.length` as char count

## 2. generator.ts — Pluggable LLM caller

- [x] 2.1 Define `LLMCaller` type: `(prompt: string, systemPrompt?: string, opts?: CallLLMOptions) => Promise<LLMResponse>`
- [x] 2.2 Replace `llmConfig: LLMConfig` field in `WikiGenerator` with `llmCaller: LLMCaller`
- [x] 2.3 Update all internal `callLLM(prompt, this.llmConfig, ...)` call sites to `this.llmCaller(prompt, ...)`
- [x] 2.4 Update `WikiGenerator` constructor signature accordingly

## 3. wiki.ts CLI — `--agent` flag and interactive update

- [x] 3.1 Add `--agent <agent>` option to the Commander command definition (allowed values: `claude`, `cursor`; error on unknown values with list of valid options)
- [x] 3.2 Add `agent?: string` field to `WikiCommandOptions`
- [x] 3.3 In the LLM resolution block: if `--agent` flag is set, skip API key setup entirely and construct an `LLMCaller` wrapping `callAgentCLI` — do NOT read or write config
- [x] 3.4 In the interactive setup wizard: call `detectAgentCLI()`; for each detected agent, prepend it to the menu:
  - `claude` → `"[1] Claude Code (no API key needed)"`
  - `agent` → `"[N] Cursor (no API key needed) (beta)"` (shift numbering for HTTP options)
- [x] 3.5 When an agent menu option is chosen interactively, build the `callAgentCLI` caller and proceed — do NOT write anything to `~/.gitnexus/config.json`
- [x] 3.6 Pass the resolved `LLMCaller` (not `LLMConfig`) to `WikiGenerator` constructor
- [x] 3.7 Surface ENOENT and timeout errors as clear user-facing messages:
  - `ENOENT` (claude): "claude CLI not found in PATH. Install Claude Code at https://claude.ai/download"
  - `ENOENT` (cursor): "agent not found in PATH. Ensure Cursor is installed and its CLI is in PATH"
  - timeout: re-throw with the timeout message from `callAgentCLI`

## 4. Validation

- [ ] 4.1 Run `gitnexus wiki --agent claude --force` on the GitNexus repo; verify all pages generated and HTML viewer loads
- [ ] 4.2 Run `gitnexus wiki --agent cursor --force` on a small repo; verify pages generated within timeout
- [ ] 4.3 Run `gitnexus wiki --agent claude` with `claude` not in PATH; verify clean error and non-zero exit
- [ ] 4.4 Run `gitnexus wiki` interactively on fresh config with `claude` in PATH; verify it appears as option [1] and selecting it does NOT modify config
- [ ] 4.5 Run the existing OpenAI-compatible flow to confirm no regressions
