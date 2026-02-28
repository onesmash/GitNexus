# Tasks: add-swift-objc-support

Ordered work items to deliver Swift and Objective-C language support. Each task is independently verifiable. Tasks 1–5 are sequential (each builds on the previous); tasks 6 and 7 can be done in parallel after task 5.

## Status: COMPLETE ✓ (except Swift WASM — requires Docker/emcc toolchain)

---

## - [x] 1. Add dependencies

**Install npm packages:**
```bash
cd gitnexus
npm install tree-sitter-swift tree-sitter-objc
```

**Verify:** `gitnexus/package.json` lists both packages under `dependencies`.

---

## - [x] 2. Update SupportedLanguages enum (both copies)

**Files:**
- `gitnexus/src/config/supported-languages.ts`
- `gitnexus-web/src/config/supported-languages.ts`

**Change:** Uncomment `Swift = 'swift'` and add `ObjectiveC = 'objc'`.

**Verify:** TypeScript compiles without errors after the change.

---

## - [x] 3. Add file extension mappings

**File:** `gitnexus/src/core/ingestion/utils.ts`

**Change:** Add before the `return null`:
```ts
if (filename.endsWith('.swift')) return SupportedLanguages.Swift;
if (filename.endsWith('.m') || filename.endsWith('.mm')) return SupportedLanguages.ObjectiveC;
```

**Verify:** `getLanguageFromFilename('Foo.swift')` returns `'swift'`; `getLanguageFromFilename('Bar.m')` returns `'objc'`; `getLanguageFromFilename('utils.h')` still returns `'c'`.

Apply the same extension mapping to `gitnexus-web/src/core/ingestion/utils.ts` (the web copy).

---

## - [x] 4. Register native grammars in parser-loader

**File:** `gitnexus/src/core/tree-sitter/parser-loader.ts`

**Change:**
1. Add imports:
   ```ts
   import Swift from 'tree-sitter-swift';
   import ObjC from 'tree-sitter-objc';
   ```
2. Add entries to `languageMap`:
   ```ts
   [SupportedLanguages.Swift]: Swift,
   [SupportedLanguages.ObjectiveC]: ObjC,
   ```

**Verify:** `loadLanguage(SupportedLanguages.Swift, 'App.swift')` does not throw.

---

## - [x] 5. Write tree-sitter queries + export detection

### 5a. Add SWIFT_QUERIES and OBJC_QUERIES

**File:** `gitnexus/src/core/ingestion/tree-sitter-queries.ts`
(and the web copy `gitnexus-web/src/core/ingestion/tree-sitter-queries.ts`)

Add `SWIFT_QUERIES` constant covering:
- `function_declaration` → `@definition.function`
- `class_declaration` → `@definition.class`
- `struct_declaration` → `@definition.struct`
- `enum_declaration` → `@definition.enum`
- `protocol_declaration` → `@definition.interface`
- `extension_declaration` → `@definition.class` (extended type name)
- `function_declaration` inside class/struct/extension body → `@definition.method`
- `init_declaration` → `@definition.constructor`
- `import_declaration` → `@import`
- `call_expression` / `navigation_expression` → `@call`
- Class inheritance / protocol conformance → `@heritage.*`

Add `OBJC_QUERIES` constant covering:
- `class_interface` → `@definition.class`
- `class_implementation` → `@definition.class`
- `protocol_declaration` → `@definition.interface`
- `method_declaration` / `method_definition` → `@definition.method`
- `preproc_import` → `@import`
- `message_expression` → `@call`
- `superclass_reference` and `protocol_reference_list` → `@heritage.*`

Register both in `LANGUAGE_QUERIES`:
```ts
[SupportedLanguages.Swift]: SWIFT_QUERIES,
[SupportedLanguages.ObjectiveC]: OBJC_QUERIES,
```

### 5b. Add isNodeExported cases

**File:** `gitnexus/src/core/ingestion/parsing-processor.ts`

Add to `isNodeExported` switch:
```ts
case 'swift':
  // Walk ancestors for visibility_modifier with text 'public' or 'open'
  while (current) {
    if (current.type === 'visibility_modifier') {
      const t = current.text;
      if (t === 'public' || t === 'open') return true;
    }
    current = current.parent;
  }
  return false;

case 'objc':
  return true; // No access modifiers — all symbols are effectively public
```

**Verify:** Run `gitnexus analyze` on a small Swift or ObjC project; confirm symbols appear in `gitnexus query "class"`.

---

## - [x] 6. Web UI WASM binaries (parallel with task 7)

### 6a. Compile WASM grammars

In `gitnexus/` (where the npm packages are installed):
```bash
npx tree-sitter build --wasm node_modules/tree-sitter-swift -o tree-sitter-swift.wasm
npx tree-sitter build --wasm node_modules/tree-sitter-objc  -o tree-sitter-objc.wasm
```

### 6b. Copy WASM files to web UI public directory
```
gitnexus-web/public/wasm/swift/tree-sitter-swift.wasm
gitnexus-web/public/wasm/objc/tree-sitter-objc.wasm
```

### 6c. Register WASM paths in web parser-loader

**File:** `gitnexus-web/src/core/tree-sitter/parser-loader.ts`

Add to `languageFileMap`:
```ts
[SupportedLanguages.Swift]: '/wasm/swift/tree-sitter-swift.wasm',
[SupportedLanguages.ObjectiveC]: '/wasm/objc/tree-sitter-objc.wasm',
```

**Verify:** Open the web UI, upload a Swift or ObjC project, confirm no WASM load errors in console.

---

## - [x] 7. Update import resolution for system frameworks (parallel with task 6)

**File:** `gitnexus/src/core/ingestion/import-processor.ts`
(and web copy)

ObjC angle-bracket imports (`<Foundation/Foundation.h>`) will fail to resolve to local files — confirm this is silently handled (the existing `null` return from resolution already skips edge creation). No code change needed if the generic fallback already handles it. If not, add a guard:

```ts
// ObjC/Swift: system framework imports (no local file resolution possible)
if (language === SupportedLanguages.ObjectiveC && importPath.startsWith('<')) {
  return cache(null);
}
```

**Verify:** Analyzing an ObjC project with `#import <UIKit/UIKit.h>` produces no errors or dangling edges.

---

## Validation

After all tasks are complete:
1. Run `gitnexus analyze` on a Swift project (e.g., a small open-source iOS app)
2. Run `gitnexus analyze` on an ObjC project
3. Confirm via `gitnexus query "class"` that Swift classes and ObjC `@interface` symbols appear
4. Confirm via `gitnexus query "function"` that Swift functions and ObjC methods appear
5. Open web UI, upload the same projects, confirm graph renders without errors
