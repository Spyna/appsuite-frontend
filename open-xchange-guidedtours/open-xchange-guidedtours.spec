Name:           open-xchange-guidedtours
BuildArch:      noarch
BuildRequires:  ant
BuildRequires:  ant-nodeps
BuildRequires:  java-devel >= 1.6.0
BuildRequires:  nodejs >= 0.10.0
Version:        @OXVERSION@
%define         ox_release 0
Release:        %{ox_release}_<CI_CNT>.<B_CNT>
Group:          Applications/Productivity
Vendor:         Open-Xchange
URL:            http://open-xchange.com
Packager:       Julian Baeume <julian.baeume@open-xchange.com>
License:        CC-BY-NC-SA
Summary:        The default version of the guided tours for the typical applications
Source:         %{name}_%{version}.orig.tar.bz2
BuildRoot:      %{_tmppath}/%{name}-%{version}-root

%description
The default version of the guided tours for the typical applications.

%prep

%setup -q

%build

%install
export NO_BRP_CHECK_BYTECODE_VERSION=true
ant -Dbasedir=build -DdestDir=%{buildroot} -DpackageName=%{name} -DkeepCache=true -f build/build.xml build

%clean
%{__rm} -rf %{buildroot}

%files
%defattr(-,root,root)
%dir /opt/open-xchange
%dir /opt/open-xchange/appsuite
%dir /opt/open-xchange/appsuite/apps
%dir /opt/open-xchange/appsuite/apps/io.ox
/opt/open-xchange/appsuite/apps/io.ox/tours.??_??.js
%dir /opt/open-xchange/appsuite/apps/io.ox/tours
/opt/open-xchange/appsuite/apps/io.ox/tours
%dir /opt/open-xchange/appsuite/manifests
/opt/open-xchange/appsuite/manifests/open-xchange-guidedtours.json
%dir /opt/open-xchange/etc
%dir /opt/open-xchange/etc/settings
/opt/open-xchange/etc/settings/guidedtours.properties

%changelog
* Wed Oct 22 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-10-22
* Tue Oct 14 2014 Marcus Klein <marcus.klein@open-xchange.com>
Fifth candidate for 7.6.1 release
* Mon Oct 13 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-10-20
* Fri Oct 10 2014 Marcus Klein <marcus.klein@open-xchange.com>
Fourth candidate for 7.6.1 release
* Thu Oct 02 2014 Marcus Klein <marcus.klein@open-xchange.com>
Third candidate for 7.6.1 release
* Tue Sep 30 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-10-06
* Tue Sep 23 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-10-02
* Wed Sep 17 2014 Marcus Klein <marcus.klein@open-xchange.com>
prepare for 7.6.2 release
* Tue Sep 16 2014 Marcus Klein <marcus.klein@open-xchange.com>
Second candidate for 7.6.1 release
* Thu Sep 11 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-09-15
* Fri Sep 05 2014 Marcus Klein <marcus.klein@open-xchange.com>
First release candidate for 7.6.1
* Fri Sep 05 2014 Marcus Klein <marcus.klein@open-xchange.com>
prepare for 7.6.1
* Wed Aug 20 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-08-25
* Mon Aug 11 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-08-11
* Wed Jul 23 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-07-30
* Mon Jul 21 2014 Marcus Klein <marcus.klein@open-xchange.com>
Build for patch 2014-07-21
* Wed Jun 25 2014 Marcus Klein <marcus.klein@open-xchange.com>
Seventh candidate for 7.6.0 release
* Fri Jun 20 2014 Marcus Klein <marcus.klein@open-xchange.com>
Sixth candidate for 7.6.0 release
* Fri Jun 13 2014 Marcus Klein <marcus.klein@open-xchange.com>
Fifth candidate for 7.6.0 release
* Fri May 30 2014 Marcus Klein <marcus.klein@open-xchange.com>
Fourth candidate for 7.6.0 release
* Fri May 16 2014 Marcus Klein <marcus.klein@open-xchange.com>
Third candidate for 7.6.0 release
* Mon May 05 2014 Marcus Klein <marcus.klein@open-xchange.com>
Second release candidate for 7.6.0
* Tue Apr 22 2014 Marcus Klein <marcus.klein@open-xchange.com>
First release candidate for 7.6.0
* Fri Apr 04 2014 Marcus Klein <marcus.klein@open-xchange.com>
prepare for 7.6.0
* Fri Mar 21 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-03-24
* Fri Mar 21 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-03-24
* Wed Mar 19 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-03-24
* Fri Mar 14 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-03-14
* Tue Mar 04 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-03-04
* Tue Mar 04 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-03-05
* Thu Feb 27 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-03-05
* Thu Feb 27 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-03-05
* Tue Feb 25 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-02-24
* Tue Feb 25 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-02-26
* Tue Feb 25 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-02-26
* Thu Feb 20 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-02-20
* Tue Feb 11 2014 Markus Wagner <markus.wagner@open-xchange.com>
Sixth candidate for 7.4.2 release
* Fri Feb 07 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-02-07
* Thu Feb 06 2014 Markus Wagner <markus.wagner@open-xchange.com>
Fifth candidate for 7.4.2 release
* Tue Feb 04 2014 Markus Wagner <markus.wagner@open-xchange.com>
Fourth candidate for 7.4.2 release
* Tue Jan 28 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-01-30
* Fri Jan 24 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2014-01-22
* Thu Jan 23 2014 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.4.2 release
* Fri Jan 10 2014 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.4.2 release
* Thu Jan 02 2014 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-12-09
* Mon Dec 23 2013 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.4.2 release
* Thu Dec 19 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-12-23
* Thu Dec 19 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.4.2
* Tue Dec 10 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-11-29
* Thu Dec 05 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-12-09
* Wed Nov 20 2013 Markus Wagner <markus.wagner@open-xchange.com>
Fifth candidate for 7.4.1 release
* Mon Nov 18 2013 Markus Wagner <markus.wagner@open-xchange.com>
Fourth candidate for 7.4.1 release
* Tue Nov 12 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-11-13
* Mon Nov 11 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-11-08
* Thu Nov 07 2013 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.4.1 release
* Wed Oct 30 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-10-28
* Wed Oct 23 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-10-28
* Wed Oct 23 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.4.1 release
* Thu Oct 10 2013 Markus Wagner <markus.wagner@open-xchange.com>
First sprint increment for 7.4.1 release
* Wed Oct 09 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-10-09
* Wed Oct 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-10-03
* Wed Sep 25 2013 Markus Wagner <markus.wagner@open-xchange.com>
Eleventh candidate for 7.4.0 release
* Fri Sep 20 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.4.1 release
* Fri Sep 20 2013 Markus Wagner <markus.wagner@open-xchange.com>
Tenth candidate for 7.4.0 release
* Tue Sep 17 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-09-26
* Fri Sep 13 2013 Markus Wagner <markus.wagner@open-xchange.com>
Ninth candidate for 7.4.0 release
* Wed Sep 11 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2013-09-12
* Wed Sep 11 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-09-12
* Mon Sep 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-09-26
* Mon Sep 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Eighth candidate for 7.4.0 release
* Tue Aug 27 2013 Markus Wagner <markus.wagner@open-xchange.com>
Seventh candidate for 7.4.0 release
* Mon Aug 26 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-08-26
* Fri Aug 23 2013 Markus Wagner <markus.wagner@open-xchange.com>
Sixth candidate for 7.4.0 release
* Tue Aug 20 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-08-19
* Mon Aug 19 2013 Markus Wagner <markus.wagner@open-xchange.com>
Fifth candidate for 7.4.0 release
* Tue Aug 13 2013 Markus Wagner <markus.wagner@open-xchange.com>
Fourth candidate for 7.4.0 release
* Tue Aug 06 2013 Markus Wagner <markus.wagner@open-xchange.com>
Third release candidate for 7.4.0
* Mon Aug 05 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-08-09
* Fri Aug 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second release candidate for 7.4.0
* Mon Jul 22 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-07-22
* Wed Jul 17 2013 Markus Wagner <markus.wagner@open-xchange.com>
First release candidate for 7.4.0
* Tue Jul 16 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.4.0
* Mon Jul 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-07-25
* Thu Jul 11 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-07-09
* Tue Jul 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.2.2 release
* Fri Jun 28 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.2.2 release
* Wed Jun 26 2013 Markus Wagner <markus.wagner@open-xchange.com>
Release candidate for 7.2.2 release
* Fri Jun 21 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second feature freeze for 7.2.2 release
* Thu Jun 20 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-06-20
* Tue Jun 18 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-06-17
* Wed Jun 12 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-06-14
* Mon Jun 03 2013 Markus Wagner <markus.wagner@open-xchange.com>
Sprint increment for 7.2.2 release
* Mon Jun 03 2013 Markus Wagner <markus.wagner@open-xchange.com>
First sprint increment for 7.2.2 release
* Wed May 29 2013 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.2.2 release
* Wed May 22 2013 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.2.1 release
* Wed May 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.2.1 release
* Wed May 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-05-10
* Thu May 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Build for patch 2013-04-23
* Mon Apr 22 2013 Markus Wagner <markus.wagner@open-xchange.com>
First candidate for 7.2.1 release
* Mon Apr 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.2.1
* Wed Apr 10 2013 Markus Wagner <markus.wagner@open-xchange.com>
Fourth candidate for 7.2.0 release
* Mon Apr 08 2013 Markus Wagner <markus.wagner@open-xchange.com>
Third candidate for 7.2.0 release
* Tue Apr 02 2013 Markus Wagner <markus.wagner@open-xchange.com>
Second candidate for 7.2.0 release
* Tue Mar 26 2013 Markus Wagner <markus.wagner@open-xchange.com>
First release candidate for 7.2.0
* Fri Mar 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.2.0
* Fri Mar 15 2013 Markus Wagner <markus.wagner@open-xchange.com>
prepare for 7.2.0
* Thu Feb 28 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2013-03-01
* Tue Feb 19 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
Fourth release candidate for 7.0.1
* Tue Feb 19 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
Third release candidate for 7.0.1
* Thu Feb 14 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
Second release candiate for 7.0.1
* Fri Feb 01 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for 7.0.1
* Fri Feb 01 2013 Viktor Pracht <viktor.pracht@open-xchange.com>
prepare for 7.0.1
* Tue Dec 18 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Third release candidate for 7.0.0
* Mon Dec 17 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Second release candidate for 7.0.0
* Thu Dec 13 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Pre release candidate for 7.0.0
* Tue Dec 11 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for 7.0.0
* Tue Nov 13 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for EDP drop #6
* Mon Oct 22 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Third release candidate for EDP drop #5
* Mon Oct 22 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Second release candidate for EDP drop #5
* Fri Oct 12 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for EDP drop #5
* Tue Sep 04 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for EDP drop #4
* Tue Aug 07 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Release build for 7.0.0
* Tue Aug 07 2012 Viktor Pracht <viktor.pracht@open-xchange.com>
Release build for EDP drop #3
* Wed Nov 09 2011 Viktor Pracht <viktor.pracht@open-xchange.com>
Initial Release.
