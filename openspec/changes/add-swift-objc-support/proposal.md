# Proposal: Add Swift and Objective-C Language Support

**Change ID:** `add-swift-objc-support`
**Status:** Draft
**Date:** 2026-02-28

## Summary

Extend GitNexus's multi-language ingestion pipeline to support **Swift** (`.swift`) and **Objective-C** (`.m`, `.mm`) source files. Both languages are first-class Apple platform languages with active iOS/macOS codebases. Adding them makes GitNexus useful for the large ecosystem of Swift and ObjC projects that currently go un-indexed.

Swift was already stubbed out in `SupportedLanguages` (commented out as `// Swift = 'swift'`), confirming original intent. `tree-sitter-swift` and `tree-sitter-objc` npm packages are both available and MIT-licensed.

## Motivation

- iOS/macOS projects (apps, frameworks, SDKs) are entirely Swift or ObjC — currently invisible to GitNexus.
- Both languages have mature, stable tree-sitter grammars on npm.
- The addition follows the exact same pattern used for Go, Rust, PHP, etc. — low risk, well-defined scope.

## Scope

### In scope
- CLI + core (Node.js native bindings via `tree-sitter-swift` and `tree-sitter-objc`)
- Web UI (WASM binaries compiled from both grammars)
- Symbol extraction: functions/methods, classes/structs/enums/protocols, extensions, ObjC interfaces/implementations
- Import/call edge extraction
- Export/visibility detection
- File extension mapping: `.swift` → Swift, `.m` / `.mm` → ObjC

### Out of scope
- Swift Package Manager dependency graph resolution (cross-package)
- Objective-C++ (`@implementation … @end` with C++ code) — treated as plain ObjC
- Xcode project file (`.xcodeproj`, `.pbxproj`) parsing
- Ruby enumerations (already commented out in SupportedLanguages, separate effort)

## Affected Files

| File | Change |
|------|--------|
| `gitnexus/src/config/supported-languages.ts` | Add `Swift`, `ObjectiveC` enum values |
| `gitnexus/src/core/ingestion/utils.ts` | Add `.swift`, `.m`, `.mm` extension → language mapping |
| `gitnexus/src/core/tree-sitter/parser-loader.ts` | Import + register `tree-sitter-swift` and `tree-sitter-objc` |
| `gitnexus/src/core/ingestion/tree-sitter-queries.ts` | Add `SWIFT_QUERIES`, `OBJC_QUERIES`; register in `LANGUAGE_QUERIES` |
| `gitnexus/src/core/ingestion/parsing-processor.ts` | Add `case 'swift'` and `case 'objc'` to `isNodeExported` |
| `gitnexus/src/core/ingestion/import-processor.ts` | Ensure ObjC framework imports (UIKit, Foundation) are treated as external |
| `gitnexus/package.json` | Add `tree-sitter-swift` and `tree-sitter-objc` dependencies |
| `gitnexus-web/public/wasm/swift/tree-sitter-swift.wasm` | Add compiled WASM binary |
| `gitnexus-web/public/wasm/objc/tree-sitter-objc.wasm` | Add compiled WASM binary |
| `gitnexus-web/src/core/tree-sitter/parser-loader.ts` | Add WASM path entries for Swift and ObjC |
| `gitnexus-web/src/config/supported-languages.ts` | Add `Swift`, `ObjectiveC` enum values (web copy) |

## Dependencies

- `tree-sitter-swift@^0.7.1` (MIT, 75.9 MB unpacked — native bindings)
- `tree-sitter-objc@^3.0.2` (MIT, 66.4 MB unpacked — native bindings)
- WASM compilation from the same grammars for the web UI (compile once, commit binaries)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `.h` extension ambiguity — ObjC headers use `.h` just like C | Keep `.h` → C mapping unchanged; ObjC projects use `.m` for implementation, which is unambiguous |
| `.mm` files are Objective-C++ | Map `.mm` → ObjC (same grammar, C++ interop ignored at parse level) |
| `tree-sitter-swift` package is large (76 MB) | Consistent with existing grammars (tree-sitter-cpp is similar size) |
| WASM binary compilation requires local toolchain | Document one-time compile step; commit resulting `.wasm` to repo (matches existing pattern) |
| Swift access control: `internal` (default) is package-visible but not public | Treat `public` and `open` as exported; `internal`/`private`/`fileprivate` as non-exported |
