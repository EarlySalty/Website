# Sichtprüfung der ersten Vorschau durch Hauptsession

Gelesen: `/tmp/deadlock-world-preview-20261007/home-1440-js-top.png`, `home-1440-js-middle.png`, `home-1440-js-coaching.png`, `home-390-js-top.png`.

Der Desktop-Entwurf hat die gewünschte Richtung sichtbar aufgenommen: plakative elfenbeinfarbene Überschrift, kräftiges Originalbild, schiefe Portraitreihe, farbige Kapitel mit versetzten Fotos. Das ist keine Fertigfreigabe; die vollständigen Valve-Referenzen und die restliche eigene Seite gehören noch zum Gesamtvergleich.

Konkreter Befund in der mobilen Erstaufnahme:
- Die schwebende goldene Menülasche überdeckt die große Überschrift links und den orangefarbenen Einladungssatz. In den besuchten Valve-Seiten gibt es keine solche alte Elevator-Lasche. Die Navigation muss erhalten bleiben, auf diesen neu gestalteten Seiten aber mobil als normaler zugänglicher Menüknopf in der Kopfzeile oder sonst ohne Überdeckung funktionieren. Keine globale Änderung an fremden Seiten nötig.
- „DEADLOCK“ reicht im mobilen Hero bis über die rechte sichtbare Kante, unten ist ein horizontaler Scrollbalken sichtbar. Tatsächlich sichtbare Glyphen/Transform-Bounds prüfen, nicht nur untransformierte Layoutbox oder globale overflow:hidden-Abdeckung. Überschrift muss bei 390 px ganz lesbar sein.

Diese Befunde in die bereits vorgesehene Sammelfixrunde aufnehmen, falls nicht ohnehin behoben. Keine zusätzlichen offenen Polierschleifen. Die Referenz-Vollprüfung steht in REFERENZEN-VOLLSTAENDIG.md.
