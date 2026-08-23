#!/usr/bin/env bash
# Build arm-<version>.x86_64.rpm from build-sea.mjs's `arm` binary
# (docs/guides/03-client-downloader.md §7). Requires rpmbuild.
#
# Usage: packaging/linux/build-rpm.sh <version>

set -euo pipefail

VERSION="${1:?usage: build-rpm.sh <version>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ARM_BIN="$REPO_ROOT/packaging/dist/arm"
RPMBUILD_ROOT="$REPO_ROOT/packaging/.build/rpmbuild"

if [[ ! -f "$ARM_BIN" ]]; then
  echo "arm binary not found at $ARM_BIN — run 'node packaging/build-sea.mjs' first." >&2
  exit 1
fi
if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "rpmbuild not found — install rpm-build (dnf/yum) or rpm (apt)." >&2
  exit 1
fi

mkdir -p "$RPMBUILD_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

ARM_BIN="$ARM_BIN" ARM_VERSION="$VERSION" rpmbuild \
  --define "_topdir $RPMBUILD_ROOT" \
  --define "_arm_bin $ARM_BIN" \
  --define "version $VERSION" \
  -bb "$HERE/arm.spec"

mkdir -p "$REPO_ROOT/packaging/dist"
find "$RPMBUILD_ROOT/RPMS" -name "*.rpm" -exec cp {} "$REPO_ROOT/packaging/dist/" \;

echo "[build-rpm] CREDENTIAL GATE: GPG-sign with 'rpm --addsign' + ARM_RPM_GPG_KEY_ID in CI — not attempted here without a real key (never fabricate one)."

for rpm in "$REPO_ROOT"/packaging/dist/*.rpm; do
  [[ -f "$rpm" ]] || continue
  sha256sum "$rpm" > "$rpm.sha256" 2>/dev/null || shasum -a 256 "$rpm" > "$rpm.sha256"
  echo "[build-rpm] done: $rpm"
done
