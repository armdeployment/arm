# RPM spec for the ARM Agent Client (docs/guides/03-client-downloader.md §7).
# Build: rpmbuild -bb packaging/linux/arm.spec --define "_arm_bin %{getenv:ARM_BIN}" --define "version %{getenv:ARM_VERSION}"

Name:           arm
Version:        %{version}
Release:        1%{?dist}
Summary:        ARM Agent Client — one-click provisioning for your ARM-managed AI agent
License:        Proprietary
URL:            https://arm.example
BuildArch:      x86_64
%description
The same signed generic client for every employee (A4, docs/guides/
03-client-downloader.md). Run `arm setup`, or double-click a downloaded
.armsetup file — no terminal required.

%install
mkdir -p %{buildroot}/usr/bin
install -m 0755 %{_arm_bin} %{buildroot}/usr/bin/arm
mkdir -p %{buildroot}/usr/share/mime/packages
cat > %{buildroot}/usr/share/mime/packages/arm-setup.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-arm-setup">
    <comment>ARM setup file</comment>
    <glob pattern="*.armsetup"/>
  </mime-type>
</mime-info>
EOF

%files
/usr/bin/arm
/usr/share/mime/packages/arm-setup.xml

%post
update-mime-database /usr/share/mime >/dev/null 2>&1 || :

%changelog
* Fri Aug 21 2026 ARM <support@arm.example> - initial
- Initial RPM packaging of the ARM Agent Client (A7).
