#!/usr/bin/env bash
# Notarization for arm-setup.pkg (docs/guides/03-client-downloader.md §7).
# Unsigned/unnotarized packages get blocked by Gatekeeper on first launch —
# signing is required from the first beta (A7).
#
# CREDENTIAL GATE: when ARM_APPLE_TEAM_ID / ARM_APPLE_NOTARY_PROFILE are
# unset, this script does NOT sign or notarize — it reports the gate and
# exits 0, leaving the artifact unsigned (packaging/README.md tags it
# unsigned-dev). Never fabricate a signature or notarization ticket.
#
# Usage: packaging/macos/notarize.sh <path-to.pkg>

set -euo pipefail

PKG_PATH="${1:?usage: notarize.sh <path-to.pkg>}"
SIGN_IDENTITY="${ARM_MACOS_SIGN_IDENTITY:-}"
NOTARY_PROFILE="${ARM_APPLE_NOTARY_PROFILE:-}"

if [[ -z "$SIGN_IDENTITY" || -z "$NOTARY_PROFILE" ]]; then
  echo "[notarize] CREDENTIAL GATE: ARM_MACOS_SIGN_IDENTITY and/or ARM_APPLE_NOTARY_PROFILE not set — leaving '$PKG_PATH' UNSIGNED (tag: unsigned-dev)."
  exit 0
fi

echo "[notarize] signing $PKG_PATH with identity '$SIGN_IDENTITY'"
productsign --sign "$SIGN_IDENTITY" "$PKG_PATH" "$PKG_PATH.signed"
mv "$PKG_PATH.signed" "$PKG_PATH"

echo "[notarize] submitting for notarization (profile: $NOTARY_PROFILE)"
xcrun notarytool submit "$PKG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait

echo "[notarize] stapling the notarization ticket"
xcrun stapler staple "$PKG_PATH"

echo "[notarize] verifying"
spctl --assess --type install "$PKG_PATH"
