## 1. Remove skill source file
- [x] 1.1 Delete `gitnexus/skills/gitnexus-wiki.md`

## 2. Revert setup.ts registration
- [x] 2.1 In `gitnexus/src/cli/setup.ts`, remove `'gitnexus-wiki'` from the `SKILL_NAMES` array

## 3. Revert ai-context.ts registration
- [x] 3.1 In `gitnexus/src/cli/ai-context.ts`, remove the `gitnexus-wiki` entry from the `skills[]` array
- [x] 3.2 In `gitnexus/src/cli/ai-context.ts`, remove the wiki row from `generateGitNexusContent()` skill table

## 4. Remove installed skill artifact
- [x] 4.1 Delete `.claude/skills/gitnexus/gitnexus-wiki/SKILL.md` and its directory

## 5. Remove superseded proposal
- [x] 5.1 Delete `openspec/changes/add-wiki-skill/` directory

## 6. Regenerate CLAUDE.md / AGENTS.md
- [x] 6.1 Run `npm run build` in `gitnexus/` to compile the changes
- [x] 6.2 Run `node dist/cli/index.js analyze --force` (or `npx gitnexus analyze --force`)
        to regenerate CLAUDE.md / AGENTS.md without the wiki skill row

## 7. Validation
- [x] 7.1 `npm run build` passes with no errors
- [x] 7.2 `gitnexus setup` reports 6 skills installed (not 7)
- [x] 7.3 `.claude/skills/gitnexus/gitnexus-wiki/` does not exist after the above steps
- [x] 7.4 CLAUDE.md and AGENTS.md skill table no longer contains the wiki row
