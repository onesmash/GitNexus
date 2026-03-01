# GitNexus Wiki Generation

Generate repository wiki documentation directly from the knowledge graph — no API key required.

## When to Use

- "Generate wiki"
- "Document this codebase"
- "Create documentation for this project"
- "Write a wiki"

## Workflow

```
Phase 0  Check prerequisites
Phase 1  Build module tree from file exports (same approach as CLI)
Phase 2  Generate per-module pages (one per module)
Phase 3  Generate overview page
```

> Always run phases in order. Never skip Phase 0.

---

## Phase 0 — Prerequisites

**READ** `gitnexus://repo/{name}/context`

- If the index is **stale**: stop, tell the user to run `npx gitnexus analyze`, then restart.
- Note the project name and tech stack — you will need them for the overview page.
- If `{name}` is unknown, **READ** `gitnexus://repos` first to discover registered repos.

---

## Phase 1 — Build Module Tree

Query all source files with their exported symbols. This gives the same view the CLI's grouping LLM call uses — it's the correct signal for deciding module boundaries.

**Step 1 — Get all source files + exports**
```cypher
MATCH (f:File)
OPTIONAL MATCH (f)-[:CodeRelation {type: 'DEFINES'}]->(n)
WHERE n.isExported = true
RETURN f.filePath, collect(n.name + ' (' + labels(n)[0] + ')') AS exports
ORDER BY f.filePath
LIMIT 300
```

Mentally filter out: test files (`.test.*`, `.spec.*`, `__tests__/`), config files, build output, `node_modules/`.

**Step 2 — Build module list**

Using file paths and their exported symbols as the primary signal, group files into logical modules. Apply these rules (from `GROUPING_SYSTEM_PROMPT` in the CLI):
- Target **5–15 modules**. Merge closely related files if grouping would exceed 15; split largest groups by subdirectory if fewer than 5.
- Name modules by **functionality**: e.g. `src/auth/login.ts` exporting `validateUser, LoginForm` → "Authentication".
- Group by what the code **does**, not by file type or directory structure alone.
- A file exporting `DatabaseConnection, QueryBuilder` → "Database Layer", not "Utils".

Record: `{ moduleName, slug (kebab-case), filePaths[] }`

---

## Phase 2 — Per-Module Pages

Process modules **leaf-first** (no inter-module dependencies before dependents). For each module:

### 2a — Read source files + query graph data

**Read source files first** (use the `Read` tool — this is what makes CLI-generated docs high quality):
- For modules with ≤8 files: read ALL source files in the module.
- For modules with >8 files: read the 3–5 most important files (entry points, main classes, largest exports).

**Then query graph data** (use `LIMIT 50` on all queries):

**Intra-module calls** (both endpoints inside this module):
```cypher
MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b)
WHERE a.filePath IN $filePaths AND b.filePath IN $filePaths
RETURN a.name, a.filePath, b.name, b.filePath
LIMIT 50
```

**Outgoing calls** (caller in module, callee outside):
```cypher
MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b)
WHERE a.filePath IN $filePaths AND NOT b.filePath IN $filePaths
RETURN a.name, b.name, b.filePath
LIMIT 50
```

**Incoming calls** (caller outside, callee in module):
```cypher
MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b)
WHERE NOT a.filePath IN $filePaths AND b.filePath IN $filePaths
RETURN a.name, a.filePath, b.name
LIMIT 50
```

**Execution flows** touching this module:
```cypher
MATCH (s)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
WHERE s.filePath IN $filePaths
RETURN p.heuristicLabel, r.step, s.name, s.filePath
ORDER BY p.heuristicLabel, r.step
LIMIT 50
```

### 2b — Write the page

Rules (from `MODULE_SYSTEM_PROMPT`):
- Reference **actual symbol names** from the source code and graph — do NOT invent APIs.
- Use the call graph and execution flow data for accuracy, but do NOT mechanically list every edge.
- Include a Mermaid diagram **only** when it genuinely clarifies the architecture (5–10 nodes max).
- Structure the document however makes sense for this module — no mandatory format.
- Write for a developer who needs to understand and contribute to this code.

**Output path:** `.gitnexus/wiki/modules/{slug}.md`

Use the `Write` tool to create the file. Create the directory if needed.

---

## Phase 3 — Overview Page

### 3a — Collect module summaries

Extract one paragraph from each module page you just wrote (use your own memory of what you generated — no need to re-read files).

### 3b — Query inter-module edges and top processes

**Inter-module call edges:**
```cypher
MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b)
WHERE a.filePath <> b.filePath
WITH a.filePath AS fromFile, b.filePath AS toFile, count(*) AS weight
ORDER BY weight DESC
LIMIT 30
RETURN fromFile, toFile, weight
```

**Top processes** (read 5–10):
```
READ gitnexus://repo/{name}/process/{processName}
```

### 3c — Write the overview

Rules (from `OVERVIEW_SYSTEM_PROMPT`):
- Be clear and welcoming — this is the entry point to the entire codebase.
- Include a **high-level Mermaid architecture diagram** (max 10 nodes, big-picture only).
- Link to module pages naturally in the text (e.g. `[Search Layer](modules/search-layer.md)`).
- Do NOT produce a flat module index table.
- Reference the project name and tech stack from Phase 0.

**Output path:** `.gitnexus/wiki/overview.md`

---

## Checklist

```
- [ ] Phase 0: READ context resource; confirmed index is fresh
- [ ] Phase 1: file+exports query run; module list built (5-15 modules, human-readable names)
- [ ] Phase 2: for each module — source files read; 4 graph queries run; page written to .gitnexus/wiki/modules/
- [ ] Phase 3: inter-module edges queried; top processes read; overview.md written
- [ ] All symbol names in pages come from actual source code or graph, not invented
```

## Output Structure

```
.gitnexus/wiki/
├── overview.md
└── modules/
    ├── {slug}.md
    └── ...
```
