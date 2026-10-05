# Deployment

## Laufzeitaufteilung

Das Repository enthält mehrere statische Frontends und ein gemeinsames
Rust-Backend. Der produktive Checkout ist
`/home/naniadm/Documents/Website`; Caddy und systemd lesen ausschließlich aus
diesem Pfad. Ein Merge in einem anderen Worktree aktualisiert die laufende
Website daher noch nicht.

| Öffentlicher Pfad | Live-Ziel |
|---|---|
| `/` | `dl-landing/dist` |
| `/patch/` | `dl-patch/dist` (bestehende Balance-Timeline) |
| `/patchnotes/` | `/home/nathanael/Documents/Runtime/patchnotes-web` (vom Patchnotes-Bot erzeugt) |
| `/aktivitaet/` | `dl-activity/dist` |
| `/coaching/` | `dl-coaching/dist` |
| `/builds/` | `dl-tierlist/dist` |
| `/videos/` | `/home/naniadm/Documents/Runtime/website-videos/current` |
| `/brand/` | direkt aus `dl-brand` |

Das Rust-Backend unter `builds/backend-rust` läuft auf `127.0.0.1:8772` und
bedient unter anderem `/coaching/api/*`, die Video-API und die öffentlichen
Patch-Endpunkte. `/builds/api/*` und `/aktivitaet/api/*` gehören dagegen zum
separaten Dienst auf Port `8771`.

## Backend prüfen

```bash
cd /home/naniadm/Documents/Website/builds/backend-rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

DB-Tests laufen ausschließlich gegen die zentrale Wegwerf-Testdatenbank. Für
die Scrim-Tests muss dieselbe DSN zusätzlich als `DATABASE_URL_TEST` gesetzt
werden:

```bash
cd /home/naniadm/Documents/Deadlock-Bots/rust
./scripts/central_test_db.sh bash -lc \
  'unset SQLX_OFFLINE; export DATABASE_URL_TEST="$CENTRAL_TEST_DSN" DATABASE_URL="$CENTRAL_TEST_DSN"; cargo test --manifest-path /home/naniadm/Documents/Website/builds/backend-rust/Cargo.toml --all-features'
```

Das zentrale Scrim-Schema gehört ausschließlich dem Repo `Deadlock-Bots`; die
Website dupliziert diese Migrationen absichtlich nicht. Vor diesem Stand müssen
dort `2026071601`, `2026071602`, `2026071603` und `2026071662` erfolgreich über
`dl-central-migrate` angewendet sein. Das Website-Backend prüft diese vier
Versionen beim Start und verweigert einen Betrieb gegen ein veraltetes Schema,
bevor Scrim-Routen oder der Aushilfen-Sweeper laufen.

## Backend deployen

```bash
cd /home/naniadm/Documents/Website/builds/backend-rust
cargo build --release
old_pid="$(systemctl --user show deadlock-website-backend.service -p MainPID --value)"
systemctl --user restart deadlock-website-backend.service
new_pid="$(systemctl --user show deadlock-website-backend.service -p MainPID --value)"
test "$old_pid" != "$new_pid"
readlink "/proc/$new_pid/exe"
readlink "/proc/$new_pid/cwd"
curl -fsS http://127.0.0.1:8772/api/health
```

Das neue Binary muss unter
`/home/naniadm/Documents/Website/builds/backend-rust/target/release/` liegen und
darf bei `/proc/<PID>/exe` nicht als `(deleted)` erscheinen. Anschließend sind
der öffentliche Healthcheck und das Journal auf Startfehler zu prüfen:

```bash
curl -fsS https://deutsche-deadlock-community.de/coaching/api/health
journalctl --user -u deadlock-website-backend.service --since "2 minutes ago" --no-pager
```

Der Service startet über `scripts/run_builds_backend.sh`; nur dieser Wrapper
lädt die Laufzeit-Secrets aus Infisical. Das Backend wird nicht direkt aus der
Shell gestartet.

## Frontends deployen

Nach Backend und Healthcheck werden die betroffenen Vite-Anwendungen gebaut:

```bash
for project in dl-landing dl-patch dl-activity dl-coaching dl-tierlist; do
  (cd "/home/naniadm/Documents/Website/$project" && npm run build)
done
```

Caddy liefert die jeweiligen `dist`-Verzeichnisse direkt aus; Merge und Push
allein aktualisieren diese Artefakte nicht. `dl-brand` und
`deco-elevator-new` werden ohne Build direkt ausgeliefert. Ein Caddy-Reload ist
nur bei einer Konfigurationsänderung nötig.

Die Video-Anwendung ist ein Sonderfall: `/builds/` kommt aus `dl-tierlist/dist`,
`/videos/` dagegen aus dem versionierten Runtime-Release des
`builds/frontend`-Frontends. `scripts/release_videos_frontend.sh deploy` baut
aus einem sauberen `main`, dessen SHA mit `origin/main` übereinstimmt. Es legt
den vollständigen DDL-Build unter
`/home/naniadm/Documents/Runtime/website-videos/releases/<SHA>` ab und
kopiert gehashte Assets vor dem Wechsel in einen gemeinsamen, nur ergänzten
Bestand und wechselt `current` atomar per Symlink. Damit bleiben alte HTML-Tabs
und Rollbacks mit ihren bisherigen CSS-/JS-URLs funktionsfähig. Ein fehlgeschlagener Build oder ein
abweichender Wiederholungsbuild derselben SHA lässt `current` unverändert.
`npm run build:builds` prüft zusätzlich den zweiten Build-Modus, ändert aber
keine `/builds/`-Live-Datei.

Erstmaliger Umstieg von den früher getrackten `builds/frontend/dist-ddl`-Dateien:

1. Den bereits ausgelieferten Stand mit `scripts/release_videos_frontend.sh bootstrap`
   unter der aktuellen Main-SHA nach Runtime kopieren. HTML, CSS und JS prüfen.
2. Den zugehörigen Caddy-PR `EarlySalty/caddy-config#4` auf
   `Runtime/website-videos/current` und die separate Route
   `/videos/assets/*` auf `Runtime/website-videos/assets` umstellen,
   Caddy validieren und neu laden. `/videos/`, CSS, JS und API live prüfen.
3. Erst dann diesen Website-PR mergen und den bisherigen getrackten
   `dist-ddl`-Baum aus dem Live-Checkout entfernen. Fremde untracked Dateien,
   insbesondere `dl-brand/social-preview/`, bleiben erhalten.
4. `scripts/release_videos_frontend.sh deploy` auf dem neuen sauberen `main`
   ausführen und erneut die öffentlichen HTML-/Asset-URLs prüfen.

Rollback: `current` auf den vorhandenen vorherigen Release-Symlink zurücksetzen;
Quell- und Zielverzeichnis müssen vor dem Wechsel vollständig geprüft sein.

## Abschlussprüfung

- neuer Backend-PID und aktuelles, nicht gelöschtes Binary
- lokaler und öffentlicher Healthcheck erfolgreich
- Journal ohne neue `error`, `panic` oder `fatal`-Einträge
- geänderte Frontend-Routen liefern HTTP 200 und aktuelle Assets
- keine Migration oder ignoriertes `dist`-Artefakt bleibt nur in einem anderen
  Worktree liegen


## Deutsche Patchnotes: gemeinsamer Release aus drei Repositories

Die neue Lesefassung ist bewusst **keine zweite Vite-Anwendung in diesem Repository**. `EarlySalty/Deadlock--Patchnotes-Bot` erzeugt aus den schon gespeicherten deutschen Übersetzungen statische Seiten unter `/home/nathanael/Documents/Runtime/patchnotes-web`. Dort liegen `index.html`, `patch-<ID>/index.html`, versionierte Assets und eine eigene `sitemap.xml`. Quellcode: `web_publish.py` und `web/`. Die Publikation und ihre Wiederholungen laufen im bestehenden Patchnotes-Dienst; das Website-Backend wird dafür nicht geändert oder neu gestartet.

`EarlySalty/caddy-config`, `hosts/v50671/Caddyfile`, ergänzt die Auslieferung mit `handle_path /patchnotes/*` vor dem breiten Legacy-Matcher `/patch*`. Auch die CSP für Discord-Emoji-Bilder steht dort. `/patch/` bleibt als Balance-Timeline unverändert. Es wird weder dessen Vite-Basis geändert noch dessen bisherige API umbenannt.

Die Navigation dieses Repositories darf **erst nach** der Caddy-Ergänzung, dem Publisher-Deploy und dem erfolgreichen öffentlichen Abruf von Archiv und Einzelpatch aktiviert werden. Danach werden `dl-brand/nav.js` und `deco-elevator-new/index.html` aus dem geprüften Stand übernommen, ohne andere Brand-Dateien oder `social-preview/` zu löschen. Auf `/patch/` bleibt die Patchnotes-Etage des Menüs aktiv.

Die Prüfnachweise und konkreten Gegenstücke dieses Releases stehen in `.tasks/2026-09-20-patchnotes-web/CONTRACT.md`. Für die Patchnotes-Änderung ist kein Website-Rust-Build und keine Migration nötig.

## Suchindexierung und Trainingscrawler

`node scripts/build-robots.mjs` erzeugt die gemeinsame Regel für alle Crawler. Öffentliche Community-Inhalte sind freigegeben. Rechtstexte, Authentifizierung, APIs, Dashboards und persönliche Seiten sind ausgeschlossen. `scripts/crawler-policy.mjs` enthält die gemeinsamen Ausschlüsse für robots.txt und Sitemap. Die Freigabe ermöglicht den Abruf; über Indexierung und Aufnahme in Trainingsdaten entscheidet der jeweilige Anbieter.

`node scripts/build-sitemap.mjs [ausgabedatei] [dokumentationssnapshot]` erzeugt die öffentliche Sitemap aus den Website-Einstiegen und dem freigegebenen öffentlichen Snapshot. Standard ist `/opt/deadlock-docs-web/current`; ein Quellcheckout wird nicht als freigegebener Suchbestand behandelt. Rechtstexte, private Pfade und die alte weitergeleitete Blogadresse gehören nicht hinein. Änderungsdaten stammen aus Git statt vom Anlegen des Build-Worktrees.

Der öffentliche Dokumentationssnapshot liegt unter `/opt/deadlock-docs-web/current/public`. Er wird mit `Deadlock-Docs/tools/deploy_corpus.sh --web-source <aktiver-snapshot> /opt/deadlock-docs-web` veröffentlicht. Der Brain-Release unter `/opt/deadlock-docs/current` bleibt unabhängig. Caddy liefert fehlende Dokumentationspfade als 404 aus.
