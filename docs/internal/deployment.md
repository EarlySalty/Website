# Deployment

Das Website-Repo besteht aus mehreren getrennt buildbaren Frontends plus einer separaten `builds`-Backend-/Frontend-Kombination. Deployment ist deshalb kein einzelner "npm run build"-Schritt für alles, sondern ein Bündel aus statischen Vite-Builds und einer optionalen FastAPI-Anwendung.

## Subprojekte und Zielpfade

Aus dem Code lassen sich aktuell diese Basispfade ableiten:

- Landing: `/`
- Activity: `/aktivitaet/`
- Patch-Portal: `/patch/`
- Tierlist-/Builds-Portal: `/builds/`

Die Landing ist ein Multi-Page-Build mit mehreren HTML-Einstiegen, darunter Start, Mitspieler, Coaching, Streamer, Helden und Guide-Seiten. `dl-activity`, `dl-patch` und `dl-tierlist` werden jeweils als eigene Vite-Anwendungen gebaut.

## Landing-Deployment

Für `dl-landing` gibt es ein konkretes Deploy-Skript für IIS. Der Ablauf ist:

1. optional Build ausführen
2. sicherstellen, dass das Zielverzeichnis existiert
3. kompletten `dist`-Inhalt spiegeln
4. bestehende `robots.txt` und `sitemap.xml` aus dem Build mitnehmen

Das Skript ist klar auf statisches Hosting ausgelegt. Aus `setup.md` geht zusätzlich hervor, dass die Umgebung auf Windows/IIS mit URL-Rewrite, HTTPS und statischem Dateihosting ausgelegt ist.

## Vite-Builds

Alle vier Frontends bauen in `dist`, aber mit unterschiedlichen Basen:

- `dl-landing`: `base: '/'`
- `dl-activity`: `base: '/aktivitaet/'`
- `dl-patch`: `base: '/patch/'`
- `dl-tierlist`: `base: '/builds/'`

Wichtig für Deployments: Wer ein Portal unter einem anderen Prefix ausliefert, muss die jeweilige Vite-Base anpassen. Besonders `dl-tierlist` und `dl-patch` sind hart an ihre Routing-Basis gekoppelt.

## Builds-App

Unter `Website/builds/` existiert zusätzlich eine FastAPI-App mit React-Frontend. Das ist kein rein statisches Portal:

- Backend initialisiert beim Start die Datenbank
- Frontend spricht Router für Auth, Heroes, Builds, Items, Tierlists, Patchnotes, History, Admin und Coaching an
- Healthcheck liegt auf `/api/health`

Das bedeutet operativ: Für die `builds`-App reicht statisches Ausrollen allein nicht, wenn ihre API-Funktionen aktiv genutzt werden sollen. Dann müssen Frontend und Backend gemeinsam verfügbar sein.

## SEO-nahe Deploy-Schritte

Vor einem produktiven Deploy sollte die Sitemap neu gebaut werden. Die vorhandenen SEO-Skripte gehen davon aus, dass `sitemap.xml` und die IndexNow-Key-Datei aus dem Build ausgeliefert werden. Deshalb ist der korrekte Zeitpunkt:

1. Sitemap bauen
2. Frontend builden
3. Artefakte deployen
4. danach SEO-Submit ausführen

## Praktische Empfehlungen

- Portale getrennt deploybar halten; ein Fehler im Patch-Portal darf die Landing nicht blockieren.
- Basispfade nie "nebenbei" ändern, ohne Redirects und API-URLs gegenzuprüfen.
- Für das `builds`-Backend klare Prozesssteuerung und Healthchecks verwenden; es verhält sich anders als die statischen Seiten.
- Public-Folder-Artefakte wie `robots.txt`, `sitemap.xml` und Verifikationsdateien als festen Teil des Deployments behandeln.

Kurz: Das Repo deployt sich am stabilsten als Sammlung kleiner Websites plus optionaler API-App. Die operative Falle ist nicht der Build selbst, sondern inkonsistente Prefixe oder ein statisch ausgeliefertes Frontend ohne die dazugehörige API.
