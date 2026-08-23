#!/usr/bin/env bash
# Build arm-setup.pkg from build-sea.mjs's `arm` binary
# (docs/guides/03-client-downloader.md §7). Requires Xcode command-line
# tools (pkgbuild, productbuild) on macOS.
#
# Usage: packaging/macos/build-pkg.sh <version>

set -euo pipefail

VERSION="${1:?usage: build-pkg.sh <version>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ARM_BIN="$REPO_ROOT/packaging/dist/arm"
STAGE_DIR="$REPO_ROOT/packaging/.build/pkg-root"
OUT_PKG="$REPO_ROOT/packaging/dist/arm-setup-$VERSION.pkg"

if [[ ! -f "$ARM_BIN" ]]; then
  echo "arm binary not found at $ARM_BIN — run 'node packaging/build-sea.mjs' first." >&2
  exit 1
fi

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/usr/local/bin"
cp "$ARM_BIN" "$STAGE_DIR/usr/local/bin/arm"
chmod 755 "$STAGE_DIR/usr/local/bin/arm"

# NOTE: registering the ".armsetup" file association on macOS requires a
# real .app bundle (CFBundleDocumentTypes in Info.plist) — a bare Unix
# binary cannot own a document type. TODO(1.1): ship a minimal
# "ARM Setup.app" wrapper bundle for this pkg to install; until then,
# double-click activation only ships on Windows/Linux (packaging/README.md
# tracks this gap explicitly) and macOS users run
# `arm setup --setup-file ~/Downloads/arm-setup.armsetup` once from Terminal,
# or use the activation code.

echo "[build-pkg] building $OUT_PKG"
mkdir -p "$(dirname "$OUT_PKG")"
pkgbuild \
  --root "$STAGE_DIR" \
  --identifier "com.arm.agent-client" \
  --version "$VERSION" \
  --install-location "/" \
  "$OUT_PKG.unsigned"

mv "$OUT_PKG.unsigned" "$OUT_PKG"

echo "[build-pkg] notarizing (or reporting the credential gate)"
"$HERE/notarize.sh" "$OUT_PKG"

shasum -a 256 "$OUT_PKG" | awk '{print $1"  arm-setup-'"$VERSION"'.pkg"}' > "$OUT_PKG.sha256"
echo "[build-pkg] done: $OUT_PKG"
