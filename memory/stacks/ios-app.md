# ios-app Memory

## Behavior
- Xcode project, scheme, signing, and simulator/device selection are stack infrastructure.
- SwiftUI/AppKit behavior requires native build and simulator/device evidence.

## Recovery Recipes
- `native_tooling_infra_failure`: Treat simulator/Xcode availability problems as environment or stack infrastructure until product code is proven faulty.

## Do Not Do
- Do not require web runtime or browser DOM evidence for native iOS acceptance.

