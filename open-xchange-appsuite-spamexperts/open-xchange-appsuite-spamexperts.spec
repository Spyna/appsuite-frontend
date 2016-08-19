Name:           open-xchange-appsuite-spamexperts
Version:        @OXVERSION@
%define         ox_release 47
Release:        %{ox_release}_<CI_CNT>.<B_CNT>
Group:          Applications/Productivity
Packager:       Viktor Pracht <viktor.pracht@open-xchange.com>
License:        CC-BY-NC-SA-3.0
Summary:        Configuration UI for SpamExperts
Source:         %{name}_%{version}.orig.tar.bz2

BuildArch:      noarch
BuildRoot:      %{_tmppath}/%{name}-%{version}-root
BuildRequires:  ant-nodeps
BuildRequires:  java-devel >= 1.6.0
BuildRequires:  nodejs >= 0.10.0

Requires(post): open-xchange-appsuite-manifest

%description
Configuration UI for SpamExperts

## Uncomment for multiple packages (1/4)
#%if 0%{?rhel_version} || 0%{?fedora_version}
#%define docroot /var/www/html/appsuite
#%else
#%define docroot /srv/www/htdocs/appsuite
#%endif
#
#%package        static
#Group:          Applications/Productivity
#Summary:        Configuration UI for SpamExperts
#Requires:       open-xchange-appsuite
#
#%description    static
#Configuration UI for SpamExperts
#
#This package contains the static files for the theme.

%prep
%setup -q

%build

%install
export NO_BRP_CHECK_BYTECODE_VERSION=true
ant -Dbasedir=build -DdestDir=%{buildroot} -DpackageName=%{name} -Dhtdoc=%{docroot} -DkeepCache=true -f build/build.xml build

## Uncomment for multiple packages (2/4)
#files=$(find "%{buildroot}/opt/open-xchange/appsuite/" -type f \
#             ! -regex '.*\.\(js\|css\|less\|json\)' -printf '%%P ')
#for i in $files
#do
#    mkdir -p "%{buildroot}%{docroot}/$(dirname $i)"
#    cp "%{buildroot}/opt/open-xchange/appsuite/$i" "%{buildroot}%{docroot}/$i"
#done

%clean
%{__rm} -rf %{buildroot}

## Uncomment for multiple packages (3/4)
#rm -r "%{buildroot}%{docroot}"

%define update /opt/open-xchange/appsuite/share/update-themes.sh

%post
if [ $1 -eq 1 -a -x %{update} ]; then %{update}; fi

%postun
if [ -x %{update} ]; then %{update}; fi

%files
%defattr(-,root,root)
%dir /opt/open-xchange
%dir /opt/open-xchange/appsuite
%dir /opt/open-xchange/appsuite/apps
%dir /opt/open-xchange/appsuite/apps/com.spamexperts
%dir /opt/open-xchange/appsuite/apps/com.spamexperts/settings
/opt/open-xchange/appsuite/apps/com.spamexperts/*
/opt/open-xchange/appsuite/apps/com.spamexperts/settings/*
%dir /opt/open-xchange/appsuite/manifests
/opt/open-xchange/appsuite/manifests/open-xchange-appsuite-spamexperts.json

## Uncomment for multiple packages (4/4)
#%files static
#%defattr(-,root,root)
#%{docroot}

%changelog
* Fri Aug 19 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-08-29 (3518)
* Fri Jul 22 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-08-01 (3463)
* Thu Jun 16 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-06-24 (3362)
* Wed Jun 01 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-06-06 (3314)
* Mon May 02 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-05-09 (3269)
* Mon Apr 18 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-04-14 (3227)
* Tue Mar 22 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-03-29 (3186)
* Wed Mar 09 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-03-14 (3162)
* Tue Feb 23 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-02-24 (3129)
* Tue Feb 16 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-02-17 (3107)
* Mon Feb 01 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-02-08 (3071)
* Wed Jan 20 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-01-25 (3029)
* Fri Jan 08 2016 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2016-01-13 (2980)
* Mon Dec 14 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-12-21 (2952)
* Fri Dec 04 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-12-07 (2916)
* Thu Dec 03 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-12-02 (2930)
* Tue Nov 17 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-11-23 (2882)
* Mon Nov 16 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-11-13 (2879)
* Wed Nov 11 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-11-16 (2862)
* Tue Nov 03 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-11-09 (2841)
* Thu Oct 29 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-11-11 (2844)
* Wed Sep 30 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch  2015-10-12 (2784)
* Thu Sep 24 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-09-28 (2767)
* Tue Sep 08 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-09-14 (2732)
* Tue Aug 18 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-08-24 (2674)
* Wed Aug 05 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-08-10
* Tue Aug 04 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-08-03 (2650)
* Fri Jul 17 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-07-20 (2614)
* Tue Jun 30 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-06-29 (2569)
* Wed Jun 10 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-06-08 (2540)
* Tue May 19 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-05-26 (2521)
* Tue May 05 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-05-04 (2496)
* Fri Apr 24 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-09-09 (2495)
* Thu Apr 23 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-04-17 (2491)
* Tue Apr 14 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-04-13 (2474)
* Fri Mar 13 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Twelfth candidate for 7.6.2 release
* Fri Mar 13 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-03-16
* Fri Mar 06 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Eleventh candidate for 7.6.2 release
* Wed Mar 04 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Tenth candidate for 7.6.2 release
* Tue Mar 03 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Nineth candidate for 7.6.2 release
* Tue Feb 24 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Eighth candidate for 7.6.2 release
* Thu Feb 12 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-02-23
* Wed Feb 11 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Seventh candidate for 7.6.2 release
* Tue Feb 10 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-02-11
* Tue Feb 03 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-02-09
* Fri Jan 30 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Sixth candidate for 7.6.2 release
* Tue Jan 27 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Fifth candidate for 7.6.2 release
* Wed Jan 21 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-27
* Wed Jan 21 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-01-26
* Wed Jan 07 2015 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2015-01-12
* Tue Dec 16 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-12-22
* Fri Dec 12 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Fourth candidate for 7.6.2 release
* Wed Dec 10 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-12-15
* Fri Dec 05 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Third candidate for 7.6.2 release
* Tue Nov 25 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-12-01
* Fri Nov 21 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Second candidate for 7.6.2 release
* Thu Nov 13 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-11-17
* Fri Oct 31 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
First candidate for 7.6.2 release
* Tue Oct 28 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-11-03
* Mon Oct 27 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-30
* Wed Oct 22 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-22
* Tue Oct 14 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Fifth candidate for 7.6.1 release
* Mon Oct 13 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-20
* Fri Oct 10 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Fourth candidate for 7.6.1 release
* Thu Oct 02 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Third candidate for 7.6.1 release
* Tue Sep 30 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-06
* Tue Sep 23 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-10-02
* Wed Sep 17 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
prepare for 7.6.2 release
* Tue Sep 16 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Second candidate for 7.6.1 release
* Thu Sep 11 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-09-15
* Fri Sep 05 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
First release candidate for 7.6.1
* Fri Sep 05 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
prepare for 7.6.1
* Wed Aug 20 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-08-25
* Mon Aug 11 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-08-11
* Wed Jul 23 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-07-30
* Mon Jul 21 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Build for patch 2014-07-21
* Wed Jun 25 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Seventh candidate for 7.6.0 release
* Fri Jun 20 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Sixth candidate for 7.6.0 release
* Fri Jun 13 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Fifth candidate for 7.6.0 release
* Thu Jan 23 2014 Viktor Pracht <viktor.pracht@open-xchange.com>
Initial Release.
