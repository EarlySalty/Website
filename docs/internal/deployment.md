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
| `/patch/` | `dl-patch/dist` |
| `/aktivitaet/` | `dl-activity/dist` |
| `/coaching/` | `dl-coaching/dist` |
| `/builds/` | `dl-tierlist/dist` |
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

Wenn das Backend neue zentrale DB-Spalten voraussetzt, müssen die zugehörigen
Migrationen zuerst versioniert, der zentrale Migrator neu gebaut und die
Migrationen vor dem Website-Neustart angewendet werden.

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

Die Video-Anwendung ist ein Sonderfall: Caddy liest
`builds/frontend/dist-ddl`. Änderungen daran müssen deshalb gezielt gegen
dieses Live-Ziel gebaut und separat geprüft werden; das normale
`builds/frontend`-Build ist nicht das `/builds/`-Portal.

## Abschlussprüfung

- neuer Backend-PID und aktuelles, nicht gelöschtes Binary
- lokaler und öffentlicher Healthcheck erfolgreich
- Journal ohne neue `error`, `panic` oder `fatal`-Einträge
- geänderte Frontend-Routen liefern HTTP 200 und aktuelle Assets
- keine Migration oder ignoriertes `dist`-Artefakt bleibt nur in einem anderen
  Worktree liegen
