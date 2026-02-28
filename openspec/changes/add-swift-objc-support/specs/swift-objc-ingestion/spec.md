# Spec: Swift and Objective-C Ingestion

**Capability:** `swift-objc-ingestion`
**Change:** `add-swift-objc-support`

## ADDED Requirements

---

### Requirement: Swift file recognition

GitNexus MUST recognize `.swift` files as the Swift language and include them in the ingestion pipeline.

#### Scenario: Swift file is parsed during analysis

**Given** a repository contains a file `Sources/MyApp/ViewController.swift`
**When** `gitnexus analyze` runs
**Then** the file is included in symbol extraction and not silently skipped

#### Scenario: Non-Swift file is not misidentified

**Given** a repository contains `Config.json`
**When** `getLanguageFromFilename` is called with `Config.json`
**Then** it returns `null` (not Swift)

---

### Requirement: Objective-C file recognition

GitNexus MUST recognize `.m` and `.mm` files as Objective-C and include them in ingestion.

#### Scenario: ObjC implementation file is parsed

**Given** a repository contains `MyViewController.m`
**When** `gitnexus analyze` runs
**Then** the file is parsed and ObjC symbols are extracted

#### Scenario: ObjC++ file is parsed as ObjC

**Given** a repository contains `Renderer.mm`
**When** `getLanguageFromFilename("Renderer.mm")` is called
**Then** it returns `SupportedLanguages.ObjectiveC`

#### Scenario: C header files remain mapped to C

**Given** a repository contains `utils.h`
**When** `getLanguageFromFilename("utils.h")` is called
**Then** it returns `SupportedLanguages.C` (unchanged — ObjC headers share `.h` with C)

---

### Requirement: Swift symbol extraction

GitNexus MUST extract the following Swift constructs as graph nodes:

- Top-level functions → `Function`
- Classes → `Class`
- Structs → `Struct`
- Enums → `Enum`
- Protocols → `Interface`
- Extensions → `Class` (named after the extended type)
- Methods inside class/struct/extension bodies → `Method`
- Initializers (`init`) → `Constructor`

#### Scenario: Public class is extracted and marked exported

**Given** a Swift file contains:
```swift
public class NetworkManager {
    public func fetch(url: URL) { }
}
```
**When** the file is parsed
**Then** a `Class` node named `NetworkManager` with `isExported: true` is added to the graph
**And** a `Method` node named `fetch` with `isExported: true` is added

#### Scenario: Internal struct is extracted but not marked exported

**Given** a Swift file contains:
```swift
struct InternalConfig {
    var timeout: Int = 30
}
```
**When** the file is parsed
**Then** a `Struct` node named `InternalConfig` with `isExported: false` is added (no `public`/`open` modifier)

#### Scenario: Protocol is mapped to Interface label

**Given** a Swift file contains:
```swift
public protocol Sendable {
    func send()
}
```
**When** the file is parsed
**Then** a node with label `Interface` and name `Sendable` with `isExported: true` is added

---

### Requirement: Objective-C symbol extraction

GitNexus MUST extract the following ObjC constructs as graph nodes:

- `@interface` declarations → `Class`
- `@implementation` blocks → `Class` (same name, may co-locate with interface)
- `@protocol` declarations → `Interface`
- Instance methods (`-`) and class methods (`+`) → `Method`

#### Scenario: ObjC class interface is extracted

**Given** an ObjC header file contains:
```objc
@interface MyViewController : UIViewController
- (void)viewDidLoad;
+ (instancetype)create;
@end
```
**When** the file is parsed
**Then** a `Class` node named `MyViewController` is added
**And** `Method` nodes for `viewDidLoad` and `create` are added

#### Scenario: ObjC protocol is extracted as Interface

**Given** an ObjC file contains:
```objc
@protocol MyDelegate <NSObject>
- (void)didFinish;
@end
```
**When** the file is parsed
**Then** a node with label `Interface` and name `MyDelegate` is added

#### Scenario: All ObjC symbols are treated as exported

**Given** any ObjC file is parsed
**When** `isNodeExported` is called for any ObjC symbol
**Then** it returns `true` (ObjC has no access modifiers; header presence implies public)

---

### Requirement: Swift import edge extraction

GitNexus MUST extract `import` statements from Swift files as import edges, skipping unresolvable system framework imports gracefully.

#### Scenario: Local module import creates an edge (when resolvable)

**Given** a Swift project has `import Networking` and a file `Networking/Client.swift` exists
**When** the file is parsed
**Then** an `IMPORTS` edge is created toward the resolved file

#### Scenario: System framework import is skipped

**Given** a Swift file contains `import UIKit`
**When** the import is processed
**Then** no error is thrown and no dangling edge is created (UIKit has no matching local file)

---

### Requirement: Objective-C import edge extraction

GitNexus MUST extract `#import` and `#include` directives from ObjC files and resolve local (quoted) imports to file edges.

#### Scenario: Quoted import resolves to local file

**Given** an ObjC file contains `#import "MyHeader.h"` and `MyHeader.h` exists in the repo
**When** imports are processed
**Then** an `IMPORTS` edge is created toward `MyHeader.h`

#### Scenario: Angle-bracket import is treated as external

**Given** an ObjC file contains `#import <Foundation/Foundation.h>`
**When** imports are processed
**Then** no file edge is created (system framework)

---

### Requirement: Swift heritage (EXTENDS / IMPLEMENTS) edges

GitNexus MUST extract class inheritance and protocol conformance from Swift class declarations.

#### Scenario: Class inheritance creates EXTENDS edge

**Given** a Swift file contains:
```swift
class ChildVC: ParentVC { }
```
**When** heritage is processed
**Then** an `EXTENDS` edge from `ChildVC` to `ParentVC` is created

#### Scenario: Protocol conformance creates IMPLEMENTS edge

**Given** a Swift file contains:
```swift
class MyVC: UIViewController, Sendable { }
```
**When** heritage is processed
**Then** an `EXTENDS` edge to `UIViewController` and an `IMPLEMENTS` edge to `Sendable` are created

---

### Requirement: Objective-C heritage edges

GitNexus MUST extract `@interface Foo : Bar` superclass and `<Protocol>` conformance as heritage edges.

#### Scenario: ObjC superclass creates EXTENDS edge

**Given** an ObjC file contains `@interface MyVC : UIViewController`
**When** heritage is processed
**Then** an `EXTENDS` edge from `MyVC` to `UIViewController` is created

#### Scenario: ObjC protocol adoption creates IMPLEMENTS edges

**Given** an ObjC file contains `@interface Foo : NSObject <MyDelegate, NSCopying>`
**When** heritage is processed
**Then** `IMPLEMENTS` edges to both `MyDelegate` and `NSCopying` are created

---

### Requirement: Web UI WASM support

The web UI MUST be able to parse Swift and Objective-C files using compiled WASM grammars.

#### Scenario: Swift WASM grammar loads successfully

**Given** `tree-sitter-swift.wasm` is present at `/wasm/swift/tree-sitter-swift.wasm`
**When** the web UI parses a Swift file
**Then** `loadLanguage(SupportedLanguages.Swift)` resolves without error

#### Scenario: ObjC WASM grammar loads successfully

**Given** `tree-sitter-objc.wasm` is present at `/wasm/objc/tree-sitter-objc.wasm`
**When** the web UI parses an ObjC file
**Then** `loadLanguage(SupportedLanguages.ObjectiveC)` resolves without error
