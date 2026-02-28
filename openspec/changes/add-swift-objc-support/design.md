# Design: Swift and Objective-C Language Support

## Architecture Overview

GitNexus uses a dual-deployment model: **CLI (Node.js native tree-sitter)** and **Web UI (WASM tree-sitter)**. Adding a new language requires touching both stacks identically, plus writing the tree-sitter query strings that define symbol extraction.

```
File Extension (.swift / .m / .mm)
      │
      ▼
getLanguageFromFilename()        ← utils.ts
      │
      ▼
SupportedLanguages enum          ← supported-languages.ts
      │
      ├─ Native path ─────────────────────────────────────────────────────┐
      │    loadLanguage(lang)    ← parser-loader.ts (tree-sitter-swift/objc)
      │                                                                    │
      ├─ WASM path ────────────────────────────────────────────────────────┤
      │    loadLanguage(lang)    ← web parser-loader.ts (/wasm/swift/*.wasm)
      │                                                                    │
      ▼                                                                    ▼
LANGUAGE_QUERIES[lang]           ← tree-sitter-queries.ts
      │
      ▼
Symbol extraction + isNodeExported()  ← parsing-processor.ts
      │
      ▼
Import/call edges                ← import-processor.ts
```

## Tree-Sitter Query Strategy

### Swift

Swift's grammar (`tree-sitter-swift`) exposes these key node types for extraction:

| Construct | tree-sitter node type | Graph label |
|-----------|----------------------|-------------|
| `func foo()` | `function_declaration` | `Function` |
| `class Foo` | `class_declaration` | `Class` |
| `struct Foo` | `struct_declaration` | `Struct` |
| `enum Foo` | `enum_declaration` | `Enum` |
| `protocol Foo` | `protocol_declaration` | `Interface` |
| `extension Foo` | `extension_declaration` | `Class` (treated as extension of existing class) |
| `init()` inside class/struct | `init_declaration` | `Constructor` |
| Method inside class/struct/extension | `function_declaration` inside body | `Method` |
| `import Foundation` | `import_declaration` | (import edge) |
| `Foo.bar()` call | `call_expression` | (call edge) |

**Export detection:** Swift uses explicit access modifiers. `public` and `open` are exported; `internal` (the default), `private`, and `fileprivate` are not. Walk ancestor nodes looking for a `visibility_modifier` with text `public` or `open`.

**Heritage:** `class Foo: Bar, BazProtocol` → `EXTENDS` Bar, `IMPLEMENTS` BazProtocol.

### Objective-C

ObjC's grammar (`tree-sitter-objc`) exposes:

| Construct | tree-sitter node type | Graph label |
|-----------|----------------------|-------------|
| `@interface Foo` | `class_interface` | `Class` |
| `@implementation Foo` | `class_implementation` | `Class` |
| `@protocol Foo` | `protocol_declaration` | `Interface` |
| `-/+ (void)doSomething` | `method_declaration` / `method_definition` | `Method` |
| `@interface Foo : Bar` | `superclass_reference` inside `class_interface` | `EXTENDS` |
| `@interface Foo <Protocol>` | `protocol_reference_list` inside `class_interface` | `IMPLEMENTS` |
| `#import "Header.h"` | `preproc_import` | (import edge) |
| `#import <Framework/Header.h>` | `preproc_import` | (external import, skip file resolution) |
| `[obj message]` / `[Obj classMethod]` | `message_expression` | (call edge) |

**Export detection:** ObjC has no access modifiers — everything in a `.h` public header is implicitly public, everything in `.m` is implementation. For simplicity, treat **all** ObjC symbols as exported (matches C/C++ convention in the existing code, which also returns `false` but still indexes everything).

## Import Resolution

### Swift
- `import Foundation`, `import UIKit` → system frameworks, no local file → skip resolution (treat as external, no file edge)
- `import MyModule` → could be a local module; attempt suffix resolution against `.swift` files
- No relative import syntax in Swift (no `./` paths)

### Objective-C
- `#import <Framework/Header.h>` → angle-bracket = system framework → skip
- `#import "LocalHeader.h"` → quoted = local file → resolve against `.h` and `.m` files
- `#include` variants → same rules as `#import`

The existing generic suffix-based resolution in `import-processor.ts` handles local resolution. System framework imports will simply fail to resolve (no matching file in the repo), which is already the correct behavior for npm packages, etc.

## WASM Compilation

The web UI requires pre-compiled WASM binaries. The `tree-sitter` CLI can compile grammars:

```bash
npx tree-sitter build --wasm node_modules/tree-sitter-swift
npx tree-sitter build --wasm node_modules/tree-sitter-objc
```

The resulting `.wasm` files are committed to `gitnexus-web/public/wasm/swift/` and `gitnexus-web/public/wasm/objc/` following the existing pattern.

## Dual `supported-languages.ts` Files

Both `gitnexus/src/config/supported-languages.ts` and `gitnexus-web/src/config/supported-languages.ts` must be kept in sync (they are separate copies for native vs. WASM builds). Both files need identical enum additions.

## Node Label Mapping for Swift Extensions

Swift `extension` declarations don't create a new type; they add methods to an existing type. We map them to `Class` label (same as the extended type) to keep the graph consistent. The `name` captured will be the extended type name (e.g., `String` for `extension String { ... }`), so the symbol will appear as an additional node for that type in that file.
