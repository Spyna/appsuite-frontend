/**
* All content on this website (including text, images, source
* code and any other original works), unless otherwise noted,
* is licensed under a Creative Commons License.
*
* http://creativecommons.org/licenses/by-nc-sa/2.5/
*
* Copyright (C) Open-Xchange Inc., 2006-2012
* Mail: info@open-xchange.com
*
* @author document.js build task
*/
define('io.ox/help/core_doc',  ['io.ox/core/extensions'], function (ext) {

    'use strict';

    var help = {
        'io.ox/calendar/detail/actions/create': '<a name="ox.appsuite.user.reference.calendar.gui.add"></a><p><b>Create.&nbsp;</b>Erstellt einen <a class="link" href="ox.appsuite.user.sect.calendar.add.html#ox.appsuite.user.concept.calendar.new">neuen Termin</a>.</p>',
        'io.ox/calendar/actions/switch-to-list-view': '<a name="ox.appsuite.user.reference.calendar.gui.contentlist"></a><p><b>Anzeigebereich in der Ansicht <span class="guilabel"><strong>List</strong></span>.&nbsp;</b>\n        </p>\n<div class="informalfigure">\n<a name="ox.appsuite.user.fig.calendar.gui.contentlist"></a><div class="screenshot"><div class="mediaobject"><img src="images/appsuite_user_calendar_app_content.png" /></div></div>\n</div>\n<p> Zeigt die Daten des Termins und die Funktionen, die Sie verwenden können: </p>\n<div class="itemizedlist"><ul type="disc">\n<li><p>Datum, bei einem Serientermin die Art der Serie, Uhrzeit, Zeitzone</p></li>\n<li><p>Betreff</p></li>\n<li><p>Ort des Termins, falls angegeben</p></li>\n<li><p>Schaltflächen: <a class="link" href="ox.appsuite.user.sect.calendar.manage.html#ox.appsuite.user.concept.calendar.edit">\n                <span class="guibutton"><strong>Bearbeiten</strong></span>\n              </a>, <a class="link" href="ox.appsuite.user.sect.calendar.manage.delete.html#ox.appsuite.user.concept.calendar.delete">\n                <span class="guibutton"><strong>Löschen</strong></span>\n              </a></p></li>\n<li><p>Beschreibung des Termins, falls angegeben</p></li>\n<li>\n<p>Namen der Teilnehmer, falls vorhanden. Anklicken eines Namens zeigt die <a class="link" href="ox.appsuite.user.chap.bestpractices.html#ox.appsuite.user.practice.haloview" title="Question">Halo View</a>. Sie enthält die\n              folgenden Bestandteile:</p>\n<div class="itemizedlist"><ul type="circle">\n<li><p>Die Kontaktdaten dieser Person</p></li>\n<li><p>Wenn Sie E-Mails mit dieser Person ausgetauscht haben, werden diese unter <span class="guilabel"><strong>Recent conversations</strong></span> angezeigt.</p></li>\n<li><p>Wenn Sie bevorstehende Termine mit dieser Person haben, werden diese unter <span class="guilabel"><strong>Shared appointments</strong></span> angezeigt.</p></li>\n</ul></div>\n<p> Anklicken eines Termins oder einer E-Mail öffnet eine weitere Halo View. </p>\n</li>\n<li>\n<p>Details</p>\n<div class="itemizedlist"><ul type="circle">\n<li><p>Verfügbarkeit</p></li>\n<li><p>welcher Ordner</p></li>\n<li><p>wer den Termin wann angelegt hat</p></li>\n<li><p>wer den Termin zuletzt geändert hat</p></li>\n</ul></div>\n<p>\n            </p>\n</li>\n</ul></div>',
        'io.ox/calendar/actions/switch-to-month-view': '<a name="ox.appsuite.user.reference.calendar.gui.contentmonth"></a><p><b>Anzeigebereich in der Ansicht <span class="guilabel"><strong>Month</strong></span>.&nbsp;</b>\n        </p>\n<div class="informalfigure">\n<a name="ox.appsuite.user.fig.calendar.gui.contentmonth"></a><div class="screenshot"><div class="mediaobject"><img src="images/appsuite_user_calendar_app_content.png" /></div></div>\n</div>\n<p> Zeigt den Monatskalender: </p>\n<div class="itemizedlist"><ul type="disc">\n<li><p>Ein Kalenderblatt zeigt den eingestellten Monat vor einem hellem Hintergrund.</p></li>\n<li><p>Der eingestellte Monat und das Jahr werden rechts vom Kalenderblatt angezeigt.</p></li>\n<li><p>Ein Rollbalken am rechten Rand stellt einen anderen Monat ein.</p></li>\n<li><p>Die Wochentage werden unterhalb des Kalenderblatts angezeigt.</p></li>\n<li><p>Der aktuelle Tag ist im Kalenderblatt hellblau unterlegt.</p></li>\n<li><p> Die Termine werden je nach Bestätigungsstatus in unterschiedlichen <a class="link" href="ox.appsuite.user.sect.calendar.view.appointments.html#ox.appsuite.user.concept.appointments.color">Farben</a>\n              angezeigt.</p></li>\n</ul></div>\n<p> Anklicken eines Termins zeigt die Daten in der <a class="link" href="ox.appsuite.user.chap.bestpractices.html#ox.appsuite.user.practice.haloview" title="Question">Halo View</a>. Sie zeigt die gleichen\n        Informationen wie der <a class="link" href="ox.appsuite.user.chap.calendar.html#ox.appsuite.user.reference.calendar.gui.contentlist" title="Anzeigebereich in der Ansicht List">Anzeigebereich in der Ansicht <span class="guilabel"><strong>List</strong></span></a>. </p>',
        'io.ox/contacts/main/create': '<a name="ox.appsuite.user.reference.contacts.gui.addcontact"></a><p><b>Add contact.&nbsp;</b>Erstellt einen <a class="link" href="ox.appsuite.user.sect.contacts.add.html#ox.appsuite.user.concept.contacts.new">neuen Kontakt</a>.\n        <span class="phrase"><strong>Hinweis:</strong></span> Diese Funktion wird nur angezeigt, wenn Sie ein Adressbuch geöffnet haben, in dem Sie die Berechtigung zum Anlegen\n        von Kontakten haben.</p>',
        'io.ox/contacts/main/distrib': '<a name="ox.appsuite.user.reference.contacts.gui.addlist"></a><p><b>Add distribution list.&nbsp;</b>Erstellt eine <a class="link" href="ox.appsuite.user.sect.contacts.add.html#ox.appsuite.user.concept.contacts.new">neue Verteilerliste</a>.\n        <span class="phrase"><strong>Hinweis:</strong></span> Diese Funktion wird nur angezeigt, wenn Sie ein Adressbuch geöffnet haben, in dem Sie die Berechtigung zum Anlegen\n        von Verteilerlisten haben.</p>',
        'io.ox/mail/actions/compose': '<a name="ox.appsuite.user.reference.email.gui.compose"></a><p><b>Compose new email.&nbsp;</b>Erstellt eine <a class="link" href="ox.appsuite.user.sect.email.send.html#ox.appsuite.user.concept.email.new">neue E-Mail</a>.</p>',
        'io.ox/files/actions/upload': '<a name="ox.appsuite.user.reference.files.gui.add"></a><p><b>Upload.&nbsp;</b>Erstellt ein <a class="link" href="ox.appsuite.user.sect.files.add.html#ox.appsuite.user.concept.files.new">neues Dokument</a>.</p>',
        'io.ox/files/actions/share': '<a name="ox.appsuite.user.reference.files.gui.share"></a><p><b>Share.&nbsp;</b>Erstellt eine <a class="link" href="ox.appsuite.user.sect.files.share.html#ox.appsuite.user.concept.files.share">Publikation</a> für diesen Ordner.</p>',
        'io.ox/files/actions/editor-new': '<a name="ox.appsuite.user.reference.files.gui.pad"></a><p><b>Pad!&nbsp;</b>Öffnet einen einfachen Editor zur Eingabe von <a class="link" href="ox.appsuite.user.sect.files.notes.html#ox.appsuite.user.concept.files.note">Notizen</a>.</p>',
        'io.ox/calendar/detail/actions/edit': '<a name="ox.appsuite.user.concept.calendar.edit"></a><p>Sie können alle Daten eines Termins nachträglich bearbeiten.</p>',
        'io.ox/calendar/detail/actions/delete': '<a name="ox.appsuite.user.concept.calendar.delete"></a><p>Sie können einen Termin oder mehrere\n        Termine gemeinsam löschen.</p>',
        'io.ox/contacts/main/move': '<a name="ox.appsuite.user.concept.contacts.move"></a><p>Sie können einen Kontakt oder <a class="link" href="ox.appsuite.user.sect.contacts.manage.multiple.html" title="Mehrere Kontakte gemeinsam bearbeiten">mehrere Kontakte\n          gemeinsam</a> in einen anderen Ordner verschieben.</p>',
        'io.ox/contacts/main/copy': '<a name="ox.appsuite.user.concept.contacts.copy"></a><p>Sie können einen Kontakt oder <a class="link" href="ox.appsuite.user.sect.contacts.manage.multiple.html" title="Mehrere Kontakte gemeinsam bearbeiten">mehrere Kontakte\n          gemeinsam</a> in einen anderen Ordner kopieren.</p>',
        'io.ox/contacts/main/update': '<a name="ox.appsuite.user.concept.contacts.edit"></a><p>Sie können alle Daten eines Kontakts nachträglich bearbeiten. Im Bearbeitungsfenster werden die Daten\n        angezeigt, die am häufigsten benötigt werden. Andere Daten können eingeblendet werden.</p>',
        'io.ox/contacts/main/delete': '<a name="ox.appsuite.user.concept.contacts.delete"></a><p>Sie können einen Kontakt oder <a class="link" href="ox.appsuite.user.sect.contacts.manage.multiple.html" title="Mehrere Kontakte gemeinsam bearbeiten">mehrere\n          Kontakte gemeinsam</a> löschen.</p>',
        'io.ox/mail/actions/copy': '<a name="ox.appsuite.user.concept.email.copy"></a><p>Sie können eine E-Mail in einen anderen Ordner kopieren.</p>',
        'io.ox/mail/actions/delete': '<a name="ox.appsuite.user.concept.email.delete"></a><p>Sie haben folgende Möglichkeiten: </p>\n<div class="itemizedlist"><ul type="disc" compact="compact">\n<li><p>E-Mails <a class="link" href="ox.appsuite.user.sect.email.manage.delete.html#ox.appsuite.user.task.email.delete" title="So löschen Sie eine E-Mail:">löschen</a>. Die E-Mails werden standardmäßig in den Papierkorb verschoben.</p></li>\n<li><p>Gelöschte E-Mails aus dem Papierkorb <a class="link" href="ox.appsuite.user.sect.email.manage.delete.html#ox.appsuite.user.task.email.undelete" title="So können Sie eine gelöschte E-Mail wieder herstellen:">wieder herstellen</a>.</p></li>\n<li><p>E-Mails im Papierkorb <a class="link" href="ox.appsuite.user.sect.email.manage.delete.html#ox.appsuite.user.task.email.deleteforever" title="So können Sie eine gelöschte E-Mail endgültig löschen:">endgültig löschen</a>. Endgültig gelöschte E-Mails sind unwiederbringlich\n              verloren.</p></li>\n</ul></div>\n<p>\n      </p>',
        'io.ox/mail/actions/move': '<a name="ox.appsuite.user.concept.email.move"></a><p>Sie können eine E-Mail in einen anderen Ordner verschieben.</p>',
        'io.ox/mail/actions/markread': '<a name="ox.appsuite.user.concept.email.mark"></a><p>Sie können eine E-Mail als gelesen oder als ungelesen markieren.</p>',
        'io.ox/mail/actions/source': '<a name="ox.appsuite.user.concept.email.source"></a><p>Der Quelltext enthält den vollständigen Inhalt einer E-Mail. Hierzu zählen vor allem die vollständigen\n        Angaben des E-Mail-Headers.</p>',
        'io.ox/mail/actions/forward': '<a name="ox.appsuite.user.concept.email.forward"></a><p>Wenn Sie eine E-Mail weiterleiten, werden im Fenster <span class="guilabel"><strong>E-Mail</strong></span> einige Eingabefelder\n        mit Werten gefüllt: </p>\n<div class="itemizedlist"><ul type="disc">\n<li><p>Der Betreff der E-Mail wird als Betreff der weitergeleiteten E-Mail eingetragen. Vor dem Betreff der Antwort-E-Mail steht der Text "Fwd: ".</p></li>\n<li>\n<p>Der Text der E-Mail wird in der weitergeleiteten E-Mail eingetragen. Vor dem Text stehen folgende Angaben:</p>\n<div class="itemizedlist"><ul type="none">\n<li style="list-style-type: none;"><p>Die Überschrift "Ursprüngliche Nachricht"</p></li>\n<li style="list-style-type: none;"><p>Absender, Adressat, Datum und Betreff der ursprünglichen Nachricht</p></li>\n</ul></div>\n</li>\n</ul></div>\n<p>\n      </p>',
        'io.ox/mail/actions/reply': '<a name="ox.appsuite.user.concept.email.reply"></a><p>Wenn Sie eine E-Mail beantworten, werden im Fenster <span class="guilabel"><strong>E-Mail</strong></span> einige Eingabefelder mit\n        Werten gefüllt: </p>\n<div class="itemizedlist"><ul type="disc">\n<li><p>Der Absender der E-Mail und weitere Empfänger der E-Mail werden automatisch als Empfänger der Antwort-E-Mail eingetragen. Sie können in den\n              E-Mail-Einstellungen <span class="phrase"><strong>\n                <a class="xref" href="ox.appsuite.user.sect.email.settings.compose.html#ox.appsuite.user.reference.email.settings.compose.replyall" title="Bei &quot;Allen antworten&quot;:">Bei "Allen antworten":</a>\n              </strong></span> wählen, ob weitere Empfänger in das Feld "An" oder in das Feld "Cc" eingetragen werden.</p></li>\n<li><p>Der Betreff der E-Mail wird als Betreff der Antwort-E-Mail eingetragen. Vor dem Betreff der Antwort-E-Mail steht der Text "Re: ".</p></li>\n<li><p>Der Text der E-Mail wird in der Antwort-E-Mail zitiert. Vor jeder Zeile kennzeichnet das Zeichen "&gt;" die Zeile als Zitat.</p></li>\n</ul></div>\n<p>\n      </p>',
        'io.ox/files/actions/edit': '<a name="ox.appsuite.user.concept.files.edit"></a><p>Sie können den Namen eines Dokuments oder die Anmerkungen zum Dokument nachträglich bearbeiten.</p>',
        'io.ox/files/actions/delete': '<a name="ox.appsuite.user.concept.files.delete"></a><p>Sie können ein einzelnes Dokument oder <a class="link" href="ox.appsuite.user.sect.files.manage.multiple.html" title="Mehrere Dokumente gemeinsam bearbeiten">mehrere\n          Dokumente gemeinsam</a> löschen.</p>',
        'io.ox/files/actions/download': '<a name="ox.appsuite.user.concept.files.versions"></a><p>Um mit Versionen zu arbeiten, haben Sie folgende Möglichkeiten: </p>\n<div class="itemizedlist"><ul type="disc">\n<li><p>die aktuelle <a class="link" href="ox.appsuite.user.sect.files.manage.versions.html#ox.appsuite.user.task.files.versions.open" title="So öffnen oder speichern Sie eine bestimmte Dateiversion:">Dateiversion öffnen oder speichern</a></p></li>\n<li><p>eine neue <a class="link" href="ox.appsuite.user.sect.files.manage.versions.html#ox.appsuite.user.task.files.versions.add" title="So laden Sie eine neue Dateiversion hoch:">Dateiversion hochladen</a></p></li>\n<li><p>eine bestimmte <a class="link" href="ox.appsuite.user.sect.files.manage.versions.html#ox.appsuite.user.task.files.versions.open" title="So öffnen oder speichern Sie eine bestimmte Dateiversion:">Dateiversion öffnen oder speichern</a></p></li>\n<li><p>eine bestimmte <a class="link" href="ox.appsuite.user.sect.files.manage.versions.html#ox.appsuite.user.task.files.versions.current" title="So legen Sie eine bestimmte Dateiversion als aktuelle Version fest:">Dateiversion als aktuelle Version festlegen</a></p></li>\n<li><p>eine bestimmte <a class="link" href="ox.appsuite.user.sect.files.manage.versions.html#ox.appsuite.user.task.files.versions.delete" title="So löschen Sie eine bestimmte Dateiversion:">Dateiversion löschen</a></p></li>\n</ul></div>\n<p>\n      </p>',
        'io.ox/files/actions/send': '<a name="ox.appsuite.user.concept.files.send"></a><p> Wenn ein Dokument Dateien enthält, können Sie die aktuelle Dateiversion als E-Mail-Anlage senden. Sie\n        können die aktuellen Dateiversionen von <a class="link" href="ox.appsuite.user.sect.files.manage.multiple.html" title="Mehrere Dokumente gemeinsam bearbeiten"> mehreren Dokumenten gemeinsam</a> als E-Mail-Anlagen\n        senden.</p>'
    };
    ext.point('io.ox/help/helper').extend({
        id: 'Core documentation',
        get: function (id) {
            if (help[id]) {
                return help[id];
            }
            return;
        },
        has: function (id) {
            return help.hasOwnProperty(id);
        }
    });
});

