# Review-Fix: Navigation zwischen Timeline und Lesefassung

Das Gate für 03535c8 hat einen echten Fehler erkannt: Der markierte Etagenlink wurde vom bestehenden Clickhandler wie eine bereits geöffnete identische Seite behandelt. Dadurch ließ sich die neue Lesefassung aus der alten Timeline nicht öffnen.

Behoben: Der Clickhandler unterbindet eine Navigation nur noch bei exakt gleicher normalisierter Zieladresse. Die alte Timeline wird am Archivlink mit aria-current=location statt mit aria-current=page markiert. Die Etagenzuordnung P bleibt bestehen, ohne das Ziel zu sperren.

Browsernachweis mit dem echten nav.js, ohne Produktionszugriff: check_navigation.mjs lädt /patch/, /patch/hero/yamato.html, /patchnotes/patch-3/ und /patchnotes/. Von allen vier Seiten funktioniert die Tastaturaktivierung des Archivlinks; ein Control-Klick aus /patch/ öffnet die richtige Adresse in einem separaten Tab und lässt die Timeline stehen. Alle Prüfungen erfolgreich, keine JavaScript-Fehler. Auch die bestehenden drei Startseiten-Footertests sind grün.

Der neue Bot-Stand ist 58a27f0; seine Tests prüfen zusätzlich, dass ein gescheiterter Discord-Zusatzbutton keinen Patchtext doppelt verschickt. Caddy c9e6fe9 hat ALLOW. Eine separate echte Caddy-Instanz auf Loopback prüfte die vorgesehene Route: /patchnotes und /patchnotes/patch-3 leiten jeweils mit HTTP 308 unter Erhaltung des Präfixes auf die Slash-Adresse; Archiv und Artikel HTTP 200, unbekannte Artikel/Assets und versteckte Dateien HTTP 404. Kein produktiver Reload für diese Tests.
