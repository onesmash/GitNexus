# tree-sitter-swift.wasm

This file must be compiled from the `tree-sitter-swift` npm package.

Requires Docker or Emscripten (emcc) on PATH:

```bash
cd gitnexus
npx tree-sitter build --wasm node_modules/tree-sitter-swift \
  -o ../gitnexus-web/public/wasm/swift/tree-sitter-swift.wasm
```

Until this file is present, the web UI will skip Swift file parsing
(the CLI/native path is unaffected and fully functional).
