# Change: Remove wiki generation skill

## Why

The `add-wiki-skill` change introduced a Claude Code skill for generating repository
wiki documentation directly from the knowledge graph. This change reverts that addition —
removing the skill source file, its registration in `setup.ts` and `ai-context.ts`, and
the installed skill artifact.

The `add-claude-subprocess-wiki` proposal (standalone CLI wiki) is unaffected and remains.

## What Changes

- **REMOVED** `gitnexus/skills/gitnexus-wiki.md` — skill source file
- **MODIFIED** `gitnexus/src/cli/setup.ts` — remove `'gitnexus-wiki'` from `SKILL_NAMES`
- **MODIFIED** `gitnexus/src/cli/ai-context.ts` — remove wiki skill entry from `skills[]`
  array and remove wiki row from `generateGitNexusContent()` skill table
- **REMOVED** `openspec/changes/add-wiki-skill/` — the superseded proposal directory
- **REMOVED** `.claude/skills/gitnexus/gitnexus-wiki/` — installed skill artifact (local)

## Out of Scope

- The `setup.ts` bonus fix (patching `cliPath` to absolute path in hook installer) was
  introduced alongside `add-wiki-skill` but is an independent bug fix. It is **retained**.
- `CLAUDE.md` / `AGENTS.md` wiki row will be removed automatically when
  `gitnexus analyze` regenerates them from the updated `ai-context.ts`.

## Impact

- Affected specs: `wiki-skill` (REMOVED)
- Affected code/files:
  - `gitnexus/skills/gitnexus-wiki.md` — deleted
  - `gitnexus/src/cli/setup.ts:232` — `SKILL_NAMES` array
  - `gitnexus/src/cli/ai-context.ts:60` — `generateGitNexusContent()` skill table
  - `gitnexus/src/cli/ai-context.ts:150` — `skills[]` array
  - `openspec/changes/add-wiki-skill/` — deleted
  - `.claude/skills/gitnexus/gitnexus-wiki/` — deleted
