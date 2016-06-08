Name:           open-xchange-appsuite-saml
Version:        @OXVERSION@
%define         ox_release 22
Release:        %{ox_release}_<CI_CNT>.<B_CNT>
Group:          Applications/Productivity
Packager:       Francisco Laguna <francisco.laguna@open-xchange.com>
License:        CC-BY-NC-SA-3.0
Summary:        Mandatory wizard with custom translations
Source:         %{name}_%{version}.orig.tar.bz2

BuildArch:      noarch
BuildRoot:      %{_tmppath}/%{name}-%{version}-root
BuildRequires:  ant-nodeps
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
if [ $1 -eq 1 -a -x %{update} ]; then %{update}; fi

%postun
if [ -x %{update} ]; then %{update}; fi

%files
%defattr(-,root,root)
%dir /opt/open-xchange
/opt/open-xchange/appsuite

%changelog
* Wed Jun 01 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-06-06 (3314)
* Mon May 02 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-05-09 (3269)
* Mon Apr 18 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-04-14 (3227)
* Tue Mar 22 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-03-29 (3186)
* Wed Mar 09 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-03-14 (3162)
* Tue Feb 23 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-02-24 (3129)
* Tue Feb 16 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-02-17 (3107)
* Mon Feb 01 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-02-08 (3071)
* Wed Jan 20 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-01-25 (3029)
* Fri Jan 08 2016 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2016-01-13 (2980)
* Mon Dec 14 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-12-21 (2952)
* Fri Dec 04 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-12-07 (2916)
* Thu Dec 03 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-12-02 (2930)
* Tue Nov 17 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-23 (2882)
* Mon Nov 16 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-13 (2879)
* Wed Nov 11 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-16 (2862)
* Tue Nov 03 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-09 (2841)
* Thu Oct 29 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-11-11 (2844)
* Wed Sep 30 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch  2015-10-12 (2784)
* Thu Sep 24 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-09-28 (2767)
* Tue Sep 08 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-09-14 (2732)
* Tue Aug 18 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Build for patch 2015-08-24 (2674)
* Mon Mar 30 2015 Francisco Laguna <francisco.laguna@open-xchange.com>
Intitial release.
