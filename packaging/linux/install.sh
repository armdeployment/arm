#!/usr/bin/env sh
# ARM Agent Client installer (docs/guides/03-client-downloader.md §7).
# Usage: curl -fsSL https://arm.example/install.sh | sh
#
# Downloads the ONE signed generic client binary (A4) for this machine's
# platform, verifies its published SHA256, and installs it to
# ~/.local/bin/arm (no root required — matches the "very easy" adoption bar).
# Prefer the .deb/.rpm packages (build-deb.sh / build-rpm.sh) when you want
# .armsetup double-click file-association registration too; this script
# just gets `arm` onto PATH as fast as possible.

set -eu

RELEASE_BASE="${ARM_RELEASE_BASE:-https://arm.example/releases/latest}"
INSTALL_DIR="${ARM_INSTALL_DIR:-$HOME/.local/bin}"

arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "arm-install: unsupported architecture '$arch'" >&2
    exit 1
    ;;
esac

os="$(uname -s)"
case "$os" in
  Linux) platform="linux" ;;
  Darwin) platform="darwin" ;;
  *)
    echo "arm-install: unsupported OS '$os' — this script targets Linux/macOS. Use the MSI on Windows." >&2
    exit 1
    ;;
esac

url="$RELEASE_BASE/arm-$platform-$arch"
sha_url="$url.sha256"
tmp="$(mktemp)"

echo "arm-install: downloading $url"
curl -fsSL "$url" -o "$tmp"

echo "arm-install: verifying sha256 against $sha_url"
expected="$(curl -fsSL "$sha_url" | awk '{print $1}')"
actual="$(sha256sum "$tmp" 2>/dev/null | awk '{print $1}')"
if [ -z "$actual" ]; then
  actual="$(shasum -a 256 "$tmp" | awk '{print $1}')"
fi
if [ "$expected" != "$actual" ]; then
  echo "arm-install: SHA256 MISMATCH — expected $expected, got $actual. Refusing to install unverified bytes." >&2
  rm -f "$tmp"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
mv "$tmp" "$INSTALL_DIR/arm"
chmod 755 "$INSTALL_DIR/arm"

echo "arm-install: installed to $INSTALL_DIR/arm"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "arm-install: add $INSTALL_DIR to your PATH, e.g.: echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.profile" ;;
esac
echo "arm-install: run 'arm setup' to get started."
