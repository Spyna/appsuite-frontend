Name:           open-xchange-appsuite-saml
Version:        @OXVERSION@
%define         ox_release 13
Release:        %{ox_release}_<CI_CNT>.<B_CNT>
Group:          Applications/Productivity
Packager:       Francisco Laguna <francisco.laguna@open-xchange.com>
License:        CC-BY-NC-SA-3.0
Summary:        Mandatory wizard with custom translations
Source:         %{name}_%{version}.orig.tar.bz2

BuildArch:      noarch
BuildRoot:      %{_tmppath}/%{name}-%{version}-root
%if 0%{?rhel_version} && 0%{?rhel_version} >= 700
BuildRequires:  ant
%else
BuildRequires:  ant-nodeps
%endif
BuildRequires:  java-devel >= 1.6.0
BuildRequires:  nodejs >= 0.10.0

Requires(post): open-xchange-appsuite-manifest

%description
SAML Login

%prep
%setup -q

%build

%install
export NO_BRP_CHECK_BYTECODE_VERSION=true
ant -Dbasedir=build -DdestDir=%{buildroot} -DpackageName=%{name} -Dhtdoc=%{docroot} -DkeepCache=true -f build/build.xml build

%clean
%{__rm} -rf %{buildroot}

%define update /opt/open-xchange/appsuite/share/update-themes.sh

%post
if [ $1 -eq 1 -a -x %{update} ]; then %{update} --later; fi

%postun
if [ -x %{update} ]; then %{update} --later; fi

%files
%defattr(-,root,root)
%dir /opt/open-xchange
/opt/open-xchange/appsuite

%changelog
* Tue Feb 14 2017 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2017-02-20 (3952)
* Fri Jan 27 2017 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2017-02-06 (3918)
* Mon Jan 16 2017 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2017-01-23 (3879)
* Mon Jan 09 2017 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2017-01-12 (3866)
* Thu Dec 22 2016 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2017-01-09 (3849)
* Wed Dec 14 2016 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2016-12-19 (3814)
* Tue Dec 13 2016 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2016-12-14 (3806)
* Tue Dec 06 2016 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2016-12-12 (3775)
* Tue Nov 29 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second release candidate for 7.8.3 release
* Thu Nov 24 2016 Markus Wagner <markus.wagner@open-xchange.com>
First release candidate for 7.8.3 release
* Tue Nov 15 2016 Markus Wagner <markus.wagner@open-xchange.com>
Third preview for 7.8.3 release
* Sat Oct 29 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second preview for 7.8.3 release
* Fri Oct 14 2016 Markus Wagner <markus.wagner@open-xchange.com>
First preview of 7.8.3 release
* Tue Sep 06 2016 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.8.3 release
* Tue Jul 12 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.8.2 release
* Wed Jul 06 2016 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.8.2 release
* Wed Jun 29 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second preview for 7.8.2 release
* Tue Jun 14 2016 Markus Wagner <markus.wagner@open-xchange.com>
First release candidate for 7.8.2
* Fri Apr 08 2016 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.8.2 release
* Wed Mar 30 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.8.1 release
* Fri Mar 25 2016 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.8.1 release
* Tue Mar 15 2016 Markus Wagner <markus.wagner@open-xchange.com>
Fifth preview of 7.8.1 release
* Fri Mar 04 2016 Markus Wagner <markus.wagner@open-xchange.com>
Fourth preview of 7.8.1 release
* Sat Feb 20 2016 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.8.1 release
* Tue Feb 02 2016 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.8.1 release
* Tue Jan 26 2016 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.8.1 release
* Wed Nov 11 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-16 (2862)
* Fri Nov 06 2015 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2015-11-09 (2840)
* Tue Nov 03 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-09 (2841)
* Thu Oct 29 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-11 (2844)
* Tue Oct 20 2015 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2015-10-26 (2816)
* Mon Oct 19 2015 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2015-10-26 (2812)
* Thu Oct 08 2015 Markus Wagner <markus.wagner@open-xchange.com>
Prepare for 7.8.1
* Tue Oct 06 2015 Markus Wagner <markus.wagner@open-xchange.com>
Sixth candidate for 7.8.0 release
* Wed Sep 30 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-10-12 (2784)
* Fri Sep 25 2015 Markus Wagner <markus.wagner@open-xchange.com>
Fith candidate for 7.8.0 release
* Thu Sep 24 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-09-28 (2767)
* Fri Sep 18 2015 Markus Wagner <markus.wagner@open-xchange.com>
Fourth candidate for 7.8.0 release
* Tue Sep 08 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-09-14 (2732)
* Mon Sep 07 2015 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.8.0 release
* Fri Aug 21 2015 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.8.0 release
* Tue Aug 18 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-08-24 (2674)
* Thu Aug 06 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-08-17 (2666)
* Wed Aug 05 2015 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.8.0 release
* Fri Jul 17 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-07-20 (2637)
* Tue Jul 07 2015 Markus Wagner <markus.wagner@open-xchange.com>
Prepare for 7.8.0
* Wed Jun 24 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-06-26 (2573)
* Mon Mar 30 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Intitial release.
* Mon Mar 30 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Intitial release.
