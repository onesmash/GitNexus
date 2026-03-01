## 1. Restore skill source file
- [x] 1.1 Create `gitnexus/skills/gitnexus-wiki.md` with the skill content
      (copy from `.claude/skills/gitnexus/gitnexus-wiki/SKILL.md`, stripping the YAML front matter)

## 2. Restore setup.ts registration
- [x] 2.1 In `gitnexus/src/cli/setup.ts`, add `'gitnexus-wiki'` back to the `SKILL_NAMES` array

## 3. Restore ai-context.ts registration
- [x] 3.1 In `gitnexus/src/cli/ai-context.ts`, add the `gitnexus-wiki` entry back to the `skills[]` array
- [x] 3.2 In `gitnexus/src/cli/ai-context.ts`, add the wiki row back to `generateGitNexusContent()` skill table

## 4. Rebuild and regenerate
- [x] 4.1 Run `npm run build` in `gitnexus/` to compile the changes
- [x] 4.2 Run `node dist/cli/index.js analyze --force` to regenerate CLAUDE.md / AGENTS.md
          with the wiki skill row

## 5. Validation
- [x] 5.1 `npm run build` passes with no errors
- [x] 5.2 `gitnexus setup` reports 7 skills installed (including `gitnexus-wiki`)
- [x] 5.3 `.claude/skills/gitnexus/gitnexus-wiki/SKILL.md` exists and contains wiki skill content
- [x] 5.4 CLAUDE.md and AGENTS.md skill table contains the wiki row
