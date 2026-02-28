## REMOVED Requirements

### Requirement: Claude-native wiki generation via skill
~~The system SHALL provide a Claude Code skill that enables Claude to generate
repository wiki documentation directly from the GitNexus knowledge graph,
requiring no external LLM API key or CLI subprocess.~~

Removed. The `gitnexus-wiki` skill and all its registration points are deleted.
The standalone CLI wiki workflow (`add-claude-subprocess-wiki`) remains unaffected.

#### Scenario: Skill no longer installed by setup
- **WHEN** a user runs `gitnexus setup`
- **THEN** 6 skills are installed (not 7); `gitnexus-wiki` is absent from all
  target directories (`~/.claude/skills/`, `~/.cursor/skills/`, `~/.config/opencode/skill/`)

#### Scenario: Skill no longer registered per-repo
- **WHEN** `gitnexus analyze` runs
- **THEN** `.claude/skills/gitnexus/gitnexus-wiki/` is NOT created and the
  CLAUDE.md / AGENTS.md skill table does NOT contain a wiki row

### Requirement: Skill trigger phrase registration
~~The `CLAUDE.md` skill table SHALL include `gitnexus-wiki` with trigger phrases
"Generate wiki" and "Document this codebase".~~

Removed. The wiki row is absent from the generated skill table.

#### Scenario: No auto-routing for wiki requests
- **WHEN** the user asks to generate documentation or a wiki
- **THEN** no `gitnexus-wiki` skill entry exists in CLAUDE.md to match against
