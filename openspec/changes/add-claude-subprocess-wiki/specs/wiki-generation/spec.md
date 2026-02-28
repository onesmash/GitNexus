## ADDED Requirements

### Requirement: AI Agent CLI Backend
The wiki generator SHALL support local AI agent CLI executables (`claude` for Claude Code, `agent` for Cursor) as zero-configuration LLM backends, so users who have either tool installed do not need a separate external API key to generate wikis.

#### Scenario: Wiki generated via Claude Code CLI
- **WHEN** `gitnexus wiki --agent claude` is run in a repo with a GitNexus index
- **AND** `claude` CLI is available in PATH
- **THEN** wiki pages are generated without prompting for an API key
- **AND** the output wiki is identical in structure to wikis generated via the HTTP backend

#### Scenario: Wiki generated via Cursor CLI
- **WHEN** `gitnexus wiki --agent cursor` is run in a repo with a GitNexus index
- **AND** `agent` CLI is available in PATH
- **THEN** wiki pages are generated without prompting for an API key
- **AND** each subprocess call has a hard timeout of 120 seconds with SIGKILL to guard against known Cursor headless hang issues

#### Scenario: Graceful error when specified agent not found
- **WHEN** `gitnexus wiki --agent claude` is run
- **AND** `claude` is not found in PATH
- **THEN** the command exits with a non-zero code
- **AND** prints a human-readable error naming the missing CLI and how to install it

#### Scenario: Agent subprocess timeout
- **WHEN** an agent CLI subprocess does not exit within 120 seconds
- **THEN** the subprocess is killed (SIGKILL)
- **AND** the error message instructs the user to retry with reduced `--concurrency`

### Requirement: --agent Flag
The `gitnexus wiki` command SHALL accept a runtime `--agent <agent>` flag (values: `claude`, `cursor`) that selects the AI agent CLI backend for the current run only. The flag is NOT persisted to `~/.gitnexus/config.json`.

#### Scenario: Agent flag used without API key config
- **WHEN** `gitnexus wiki --agent claude` is run
- **AND** no API key is configured in env or config
- **THEN** the Cursor backend is used for this run without prompting for a key
- **AND** no changes are written to `~/.gitnexus/config.json`

#### Scenario: Invalid agent value
- **WHEN** `gitnexus wiki --agent unknown` is run
- **THEN** the command exits immediately with a clear error listing valid agent values (`claude`, `cursor`)

### Requirement: Auto-detect in Interactive Setup
When no LLM backend is configured and the user runs `gitnexus wiki` interactively, the setup wizard SHALL detect available agent CLIs and offer them as zero-config options ahead of the HTTP provider options. Selecting an agent option does NOT save any credentials.

#### Scenario: Claude Code detected during first-time setup
- **WHEN** `gitnexus wiki` is run with no saved LLM config
- **AND** `claude` CLI is available in PATH
- **THEN** the interactive menu shows "Claude Code (no API key needed)" as an early option
- **AND** selecting it proceeds to generate the wiki without writing anything to config

#### Scenario: Cursor detected during first-time setup
- **WHEN** `gitnexus wiki` is run with no saved LLM config
- **AND** `agent` CLI is available in PATH
- **THEN** the interactive menu shows "Cursor (no API key needed) (beta)" as an early option
- **AND** selecting it proceeds to generate the wiki without writing anything to config

#### Scenario: No agent CLIs detected — menu unchanged
- **WHEN** `gitnexus wiki` is run with no saved LLM config
- **AND** neither `claude` nor `agent` is in PATH
- **THEN** the interactive menu shows only the existing HTTP-based options (OpenAI, OpenRouter, Custom)

### Requirement: Pluggable LLM Caller in WikiGenerator
`WikiGenerator` SHALL accept an injected `LLMCaller` function at construction time, decoupling it from any specific LLM implementation.

#### Scenario: WikiGenerator works with any caller
- **WHEN** a custom `LLMCaller` function is injected into `WikiGenerator`
- **THEN** all LLM calls (grouping, module pages, overview) are routed through the injected function
- **AND** the generator's output (wiki pages, metadata) is identical regardless of which caller is used
