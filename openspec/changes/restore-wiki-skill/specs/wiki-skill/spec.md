## ADDED Requirements

### Requirement: Claude-native wiki generation via skill
The system SHALL provide a Claude Code skill that enables Claude to generate
repository wiki documentation directly from the GitNexus knowledge graph,
requiring no external LLM API key or CLI subprocess.

#### Scenario: Skill installed by setup
- **WHEN** a user runs `gitnexus setup`
- **THEN** 7 skills are installed including `gitnexus-wiki`, present in all
  target directories (`~/.claude/skills/`, `~/.cursor/skills/`, `~/.config/opencode/skill/`)

#### Scenario: Skill registered per-repo
- **WHEN** `gitnexus analyze` runs
- **THEN** `.claude/skills/gitnexus/gitnexus-wiki/` is created and the
  CLAUDE.md / AGENTS.md skill table contains a wiki row

### Requirement: Skill trigger phrase registration
The `CLAUDE.md` skill table SHALL include `gitnexus-wiki` with trigger phrases
"Generate wiki" and "Document this codebase".

#### Scenario: Auto-routing for wiki requests
- **WHEN** the user asks to generate documentation or a wiki
- **THEN** a `gitnexus-wiki` skill entry exists in CLAUDE.md to match against
