# ARM Client Packaging — release + signing runbook

docs/guides/03-client-downloader.md §7 (A4/A7). This directory builds **the
one signed generic client** — never a per-user compiled binary (A4). The
per-user customization lives entirely in the setup token (`packages/trpc/src/onboarding-router.ts`,
`packages/client-core/src/setup-token.ts`), which travels as a `.armsetup`
companion file or a 6-character activation code.

```
packaging/
  build-sea.mjs        Node 22+ Single Executable Application build → arm(.exe)
  windows/             WiX MSI + EV signing script, winget manifest
  macos/               pkg + notarization script, homebrew formula
  linux/               deb + rpm + curl-install script
```

## The pipeline

```
apps/cli (TS source)
   │  tsup --format cjs --minify   (bundles @arm/client-core + deps into one file)
   ▼
packaging/.build/arm-cli-bundle.cjs
   │  node --experimental-sea-config   (Node's built-in SEA blob)
   ▼
packaging/.build/arm.blob
   │  postject <node-binary-copy> NODE_SEA_BLOB arm.blob
   ▼
packaging/dist/arm(.exe)              ← the one signed generic client
   │
   ├─ packaging/windows/build-msi.ps1  → arm-setup-<version>.msi   (WiX v4)
   ├─ packaging/macos/build-pkg.sh     → arm-setup-<version>.pkg   (pkgbuild)
   ├─ packaging/linux/build-deb.sh     → arm_<version>_amd64.deb   (dpkg-deb)
   └─ packaging/linux/build-rpm.sh     → arm-<version>.x86_64.rpm  (rpmbuild)
```

Run the whole pipeline: `node packaging/build-sea.mjs`, then the
platform-specific wrapper script for whichever OS you're packaging for
(cross-platform SEA builds require running on/emulating the target OS —
CI runs a matrix, one job per platform).

## What's verified vs. what's written-but-unexercised

- **`build-sea.mjs`**: run end-to-end in this environment. It produced a
  working `arm` executable — `arm help`, `arm doctor`, `arm setup` (no
  args → interactive prompt), and `arm setup --setup-file <path>` (reading
  a `.armsetup` file and routing through the token path) were all exercised
  against the real compiled binary, not just source. No Node install is
  required to run the output.
- **Windows/macOS/Linux wrapper scripts** (`build-msi.ps1`, `build-pkg.sh`,
  `build-deb.sh`, `build-rpm.sh`, `notarize.sh`, `sign.ps1`): written to the
  documented tool conventions (WiX v4, pkgbuild/productsign/notarytool,
  dpkg-deb, rpmbuild) and follow the SAME credential-gate pattern verified
  in `build-sea.mjs` (see below), but were not executed in this sandbox —
  `wix`, macOS's `pkgbuild`/`codesign`, and `rpmbuild` are host-toolchain
  dependent and this dev environment doesn't carry all of them. Review
  before the first real release; they are correct-by-construction against
  each tool's documented interface, not battle-tested.
- **macOS `.armsetup` double-click**: NOT yet implemented — Launch
  Services file-type registration requires a real `.app` bundle
  (`CFBundleDocumentTypes` in `Info.plist`); a bare Unix binary in `/usr/local/bin`
  cannot own a document type. Tracked as a TODO in `macos/build-pkg.sh`.
  Until then, macOS users run `arm setup --setup-file ~/Downloads/x.armsetup`
  once from Terminal, or use the 6-character activation code (which needs
  no file association at all — and, since `arm setup` with no other flags
  now opens the wizard in a browser instead of prompting on stdin, opening
  Terminal just to type the code is itself the last remaining terminal
  step; see below). Windows (via the MSI's registry entries,
  `windows/arm.wxs`) and Linux (via the `.desktop`/MIME entries,
  `linux/build-deb.sh` / `arm.spec`) both register the association.
- **Windows console flash on double-click**: `arm.exe` is still built as a
  console-subsystem binary (`build-sea.mjs`'s Node SEA default). Since
  `arm setup` with no args now serves the wizard over HTTP and opens the
  browser (gui-server.ts) rather than prompting on stdin, double-clicking
  the `.armsetup` file association briefly flashes an empty console window
  before the browser opens — cosmetic (the actual UI is the browser page,
  no input is ever needed in that window), but worth fixing by linking with
  `/SUBSYSTEM:WINDOWS` for a real no-window launch. Not done here — needs a
  Windows build/link step this sandboxed environment can't run and verify.

## Code signing — credential gates (AGENTS.md: never fabricate a credential)

| Platform            | Script                     | Env var(s)                                            | Behavior when absent                                                                                      |
| ------------------- | -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| macOS (raw binary)  | `build-sea.mjs`'s `sign()` | `ARM_MACOS_SIGN_IDENTITY`                             | Ad-hoc signs (`codesign --sign -`) so the binary can run locally at all; tags the artifact `unsigned-dev` |
| macOS (.pkg)        | `macos/notarize.sh`        | `ARM_MACOS_SIGN_IDENTITY`, `ARM_APPLE_NOTARY_PROFILE` | Skips signing/notarization entirely; reports the gate; exits 0                                            |
| Windows (.exe/.msi) | `windows/sign.ps1`         | `ARM_WINDOWS_CERT_THUMBPRINT`                         | Skips signing; reports the gate; exits 0                                                                  |
| Linux (.deb)        | `linux/build-deb.sh`       | `ARM_DEB_GPG_KEY_ID`                                  | Skips `dpkg-sig`; reports the gate                                                                        |
| Linux (.rpm)        | `linux/build-rpm.sh`       | `ARM_RPM_GPG_KEY_ID` (documented, not yet wired)      | Reports the gate; RPM GPG signing lands with the first real key                                           |

**Unsigned binaries get blocked by SmartScreen (Windows) and Gatekeeper
(macOS)**, which destroys the "very easy" adoption promise (A1) — signing
is required from the first beta, not deferred to GA. Every build script
above, when a credential is missing, still PRODUCES a working artifact
(never blocks the build) but tags it `unsigned-dev` and prints the gate —
never a silently-degraded or fabricated signature.

## SHA256 sums

Every build script writes a `.sha256` sidecar next to its artifact.
`/rollout` (server-owned, `apps/control-plane/web`) displays these per
guide 00/03; CI publishes them alongside the release.

## Release checklist

1. `node packaging/build-sea.mjs` on each target OS (or a CI matrix).
2. Run the matching platform wrapper script with `ARM_VERSION` set.
3. Confirm each script's credential-gate line — either a real signature or
   an explicit `unsigned-dev` tag; never silence and never fabricate.
4. Publish artifacts + `.sha256` sidecars.
5. Bump `windows/winget/ARM.AgentClient*.yaml`'s `PackageVersion` and
   `InstallerSha256`, `macos/homebrew/arm.rb`'s `version`/`sha256`s, and
   submit to winget-pkgs / the Homebrew tap.
