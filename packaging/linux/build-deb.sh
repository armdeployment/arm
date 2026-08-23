#!/usr/bin/env bash
# Build arm_<version>_amd64.deb from build-sea.mjs's `arm` binary
# (docs/guides/03-client-downloader.md §7). Requires dpkg-deb.
#
# Usage: packaging/linux/build-deb.sh <version>

set -euo pipefail

VERSION="${1:?usage: build-deb.sh <version>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ARM_BIN="$REPO_ROOT/packaging/dist/arm"
STAGE_DIR="$REPO_ROOT/packaging/.build/deb-root"
OUT_DEB="$REPO_ROOT/packaging/dist/arm_${VERSION}_amd64.deb"

if [[ ! -f "$ARM_BIN" ]]; then
  echo "arm binary not found at $ARM_BIN — run 'node packaging/build-sea.mjs' first." >&2
  exit 1
fi

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/DEBIAN" "$STAGE_DIR/usr/bin" "$STAGE_DIR/usr/share/mime/packages" "$STAGE_DIR/usr/share/applications"

cp "$ARM_BIN" "$STAGE_DIR/usr/bin/arm"
chmod 755 "$STAGE_DIR/usr/bin/arm"

cat > "$STAGE_DIR/DEBIAN/control" <<EOF
Package: arm
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Maintainer: ARM <support@arm.example>
Description: ARM Agent Client — one-click provisioning for your ARM-managed AI agent
 The same signed generic client for every employee (A4). Run \`arm setup\`,
 or double-click a downloaded .armsetup file — no terminal required.
EOF

# Register the .armsetup MIME type + desktop entry so double-click works
# under GNOME/KDE file managers (xdg-mime), matching the Windows MSI's
# registry-based file association (arm.wxs).
cat > "$STAGE_DIR/usr/share/mime/packages/arm-setup.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-arm-setup">
    <comment>ARM setup file</comment>
    <glob pattern="*.armsetup"/>
  </mime-type>
</mime-info>
EOF

cat > "$STAGE_DIR/usr/share/applications/arm-setup.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=ARM Setup
Comment=Install your ARM-managed AI agent
Exec=arm setup --setup-file %f
Terminal=true
MimeType=application/x-arm-setup;
NoDisplay=true
EOF

cat > "$STAGE_DIR/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
command -v update-mime-database >/dev/null 2>&1 && update-mime-database /usr/share/mime || true
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database /usr/share/applications || true
EOF
chmod 755 "$STAGE_DIR/DEBIAN/postinst"

echo "[build-deb] building $OUT_DEB"
mkdir -p "$(dirname "$OUT_DEB")"
dpkg-deb --build --root-owner-group "$STAGE_DIR" "$OUT_DEB"

echo "[build-deb] GPG-signing the release (dpkg-sig) — CREDENTIAL GATE if ARM_DEB_GPG_KEY_ID is unset"
if [[ -n "${ARM_DEB_GPG_KEY_ID:-}" ]] && command -v dpkg-sig >/dev/null 2>&1; then
  dpkg-sig --sign builder -k "$ARM_DEB_GPG_KEY_ID" "$OUT_DEB"
else
  echo "[build-deb] CREDENTIAL GATE: ARM_DEB_GPG_KEY_ID not set (or dpkg-sig missing) — leaving '$OUT_DEB' UNSIGNED (tag: unsigned-dev)."
fi

sha256sum "$OUT_DEB" | awk '{print $1"  "$2}' > "$OUT_DEB.sha256" 2>/dev/null || shasum -a 256 "$OUT_DEB" > "$OUT_DEB.sha256"
echo "[build-deb] done: $OUT_DEB"
