# Instant — customer iPhone app

Swift, SwiftUI, ARKit and LiveKit. Built and installed with **xtool** (no Xcode needed).
Full steps: `HANDOVER.md`, Part 5, at the repository root.

```bash
./scripts/configure-server.sh /path/to/client-config.txt   # file produced by the installer
xtool dev run --usb                                         # build and install on the connected iPhone
```

Customers create their own account inside the app (email and password). Accounts are always
customers; the admin creates experts in the web console.

## Notes for developers

- The app reads its server addresses from `GGSApple/Config/ServerConfig.swift` only.
- `Vendor/client-sdk-swift` is LiveKit's Swift SDK with one change: the `@objcMembers`
  attributes are removed. Without that, xtool-linked builds crash at launch because Objective-C
  category methods are dropped by the linker. Do not replace it with the upstream package.
- The Xcode project (`GGSApple.xcodeproj`) is not maintained; use `Package.swift` with xtool.
- Minimum iOS version: 17.
