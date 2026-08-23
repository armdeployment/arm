# Homebrew formula (docs/guides/03-client-downloader.md §7).
# Submit to a tap (e.g. arm/homebrew-tap) on each release.
#
# NOTE: `sha256` below is a placeholder — the release pipeline regenerates
# this formula from packaging/dist/arm-<version>-<arch>.tar.gz.sha256, never
# hand-typed (AGENTS.md: never fabricate a credential/checksum).
class Arm < Formula
  desc "One-click provisioning for your ARM-managed AI agent"
  homepage "https://arm.example"
  version "1.0.0"
  license "Proprietary"

  on_macos do
    on_arm do
      url "https://arm.example/releases/download/v1.0.0/arm-1.0.0-darwin-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"[0, 64]
    end
    on_intel do
      url "https://arm.example/releases/download/v1.0.0/arm-1.0.0-darwin-x64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"[0, 64]
    end
  end

  def install
    bin.install "arm"
  end

  test do
    assert_match "ARM CLI", shell_output("#{bin}/arm help")
  end
end
