# Scrim-Selbst-Onboarding — offene Punkte

**Stand:** 2026-07-16, Session-Ende.
**Live-Zustand ist stabil.** Alles unten Beschriebene ist zusätzlich — nichts ist halb deployed,
nichts wartet auf einen Fix. Wer hier weitermacht, kann in Ruhe anfangen.

Kontext und Bedienung: `Deadlock-Docs/internal/website/scrim-cockpit-handbuch.html`

---

## LIVE und bewiesen (nichts zu tun)

| Was | Wo |
|---|---|
| Anmeldung: Erwartung, Pflicht-Zeiten, Rang + Unterstufe | `/coaching/scrims/signup` |
| „Scrims"-Tab ohne Login | `dl-coaching/src/components/Layout.tsx` |
| Rolle + DM automatisch bei ✅ auf die Ankündigung | `bot.reaction_role_mappings` id=2 |
| Vier Töpfe (Neu / Spieler-Pool / Auswechselspieler / In Teams) | `/coaching/scrims` |
| Einspringer-Suche + Team-Rolle + DM + 24h-Ablauf | `POST /api/scrim/teams/{id}/substitute` |
| Team-Stammzeit + „Aufruf posten" | `PATCH /api/scrim/teams/{id}`, `POST …/announce` |
| Coach per Dropdown + Team-Rolle für den Coach | `GET /api/scrim/coaches` |

Website-Branch **`feat/brand-black-standard`** = LIVE-Branch (nicht `main`!), gepusht.
Letzter Commit: `7889dd8 feat(scrim): Coach per Dropdown statt Freitext`.

---

## 1. Bot deployen — Broker kann Reaktionen setzen (angefangen, NICHT fertig)

**Warum:** Nach „Aufruf posten" muss Leo aktuell selbst in Discord den ersten ✅-Haken unter den
Aufruf setzen. Ohne ersten Haken muss jeder das Emoji suchen, und dann reagiert kaum wer. Der
Broker konnte bisher keine Reaktionen — das ist jetzt gebaut, aber **nicht deployed**.

**Stand:** Repo `Deadlock-Bots`, Branch **`feat/broker-add-reaction`** (enthält
`feat/scrim-substitute-expiry` als Vorfahre), Commit `00f1cd8d`. Tests + Clippy grün.
Neuer Endpunkt: `POST /internal/master/v1/discord/add-reaction` mit `{channel_id, message_id, emoji}`,
prüft die Channel-Allowlist wie `send-rich-message`, nutzt Serenity `create_reaction` (kodiert selbst).

**Zu tun:**
```bash
cd ~/Documents/Deadlock-Bots/rust
RUSTC_WRAPPER= cargo build --release -p dl-bot -j 2   # -j 2: earlyoom killt den Build sonst (SIGTERM)
systemctl --user restart deadlock-bot-rust.service
# Beweis: PID-Wechsel + /proc/<pid>/exe zeigt auf die frische Binary + Journal ohne error/panic
```
Danach nach `main` mergen (Test-Gate + Merge-Kritiker beachten).

**Vorsicht:** Der Bot-Neustart löst `run_pending_backfills()` aus. Aktuell steht kein Mapping auf
`backfill_pending=TRUE`, also passiert nichts — vor dem Restart trotzdem kurz prüfen:
`SELECT id, backfill_pending FROM bot.reaction_role_mappings;`

## 2. Website: den Haken automatisch setzen — erledigt

`DiscordRoleBroker` unterstützt den neuen `add-reaction`-Endpunkt. Nach einem erfolgreichen
`send_rich_message` setzt `announce_team` automatisch ✅ auf die zurückgegebene Nachricht. Der
Erfolgstext fordert nicht mehr zum Handklick auf. Schlägt nur die Reaktion fehl, bleibt der bereits
gepostete Aufruf erfolgreich und die Antwort nennt den manuellen Haken als Fallback.

Auf Website-Seite ist nichts mehr offen. Wirksam wird der Ablauf, sobald der Broker aus Abschnitt 1
live ist.

## 3. Stammzeiten eintragen (Leo, 2 Minuten, kein Code)

`/coaching/scrims` → Team → „Bearbeiten" → Übliche Spielzeit. Aus dem Kanal belegt:
- **Team 2 und Team 4:** 20:00 Uhr („Team 2 und 4 spielen um 20 Uhr immer")
- **Team 3:** ab 16:00 („Team 3 hat die allgemeine Gruppenzeit ab 16 Uhr")
- **Team 1:** unbekannt — Leo fragen.

Bis dahin steht in den Aufrufen keine Zeit und die Einspringer-Suche ist nicht vorausgefüllt.
Bewusst nicht selbst eingetragen: „ab 16 Uhr" sagt nicht, bis wann — das ist Leos Entscheidung.

## 4. Coach-Zuordnung richtigstellen (Leo, kein Code)

`scrim.teams.coach` steht als Freitext auf Team 1+2 = Leo, Team 3+4 = Deniz. Laut User veraltet.
Im Bearbeiten-Dialog jetzt den echten Coach auswählen → er bekommt automatisch die Team-Rolle.
Erst dann ist `coach_discord_id` gesetzt; der alte Freitext bleibt als Anzeige-Fallback stehen.

## 5. Entscheidung offen: `/scrim-signup` anschalten oder begraben?

Der Slash-Befehl ist **vollständig gebaut** (`dl-community/src/scrim_signup.rs`): Modal, Rang aus
Steam-Rang oder Rangrolle, Freitext-Parser („Mo-Fr ab 19 Uhr" → `availability_slots`).

**Er ist bei Discord nicht registriert** und war es offenbar nie: `sync_commands`
(`dl-discord/src/dispatch.rs:674`) wird **nie beim Bot-Start aufgerufen** — einziger Aufrufer ist ein
manueller Admin-Befehl (`bin/dl-bot/src/master.rs:169`). In der Live-Befehlsliste (22 Stück) fehlt er;
im Pool gibt es null Einträge mit `source='discord_modal'`.

- **Anschalten:** Befehls-Sync auslösen. **Achtung:** `create_guild_commands` überschreibt die
  komplette Befehlsliste auf einen Schlag — vorher sicherstellen, dass der Router wirklich alle
  Befehle kennt, sonst verschwinden welche.
- **Begraben:** Code entfernen, damit niemand denkt, es gäbe ihn.

Die öffentliche Doku bewarb ihn bis heute als den Anmeldeweg; sie zeigt jetzt auf die Website
(`Deadlock-Docs/public/discord-server/scrims.html`).

## 6. Testlauf (User)

Einmal komplett durchspielen: anmelden → Topf verschieben → Aufruf posten → Einspringer suchen →
einspringen lassen. Besonders auf `dm.ok`/`discord_sync.ok` in den Antworten achten: Der Weg
Website → Broker ist verifiziert (Token da, Broker antwortet 200), aber ein echter Rollen-Grant der
**Website** wurde noch nie beobachtet — die bisherigen Rollen kamen vom Bot.

---

## Bewusst NICHT gebaut (mit Begründung)

- **Mobile-Navigation:** Auf der Coaching-Seite ist die Navigation unter `md` komplett ausgeblendet
  (`Layout.tsx:27`, kein Burger-Menü). User: „Handy ist egal, das ist ein DC für nicht Handy."
- **Kapazität** („schaffe nur 1–2 die Woche", 5 Belege im Kanal): User: „unnötig, wenn wir die
  Zeitslots kennen".
- **Schichtarbeit** („von Tag zu Tag anders"): lässt sich in einem Wochenraster nicht abbilden.
  User: geht nicht, ignorieren. Mit den Leuten wird geredet wie bisher.

## Fallstricke für die nächste Session

- **`npm run build` in `dl-coaching/` IST der Deploy** — Caddy serviert `dist/` direkt aus dem
  Arbeitsverzeichnis. Immer **Backend zuerst** bauen+neustarten, sonst ruft die neue Oberfläche
  Endpunkte, die es noch nicht gibt. (Ist mir in dieser Session einmal passiert, ~3 Min Lücke.)
- **LIVE-Branch der Website ist `feat/brand-black-standard`, nicht `main`.**
- **Migrationen laufen nur über `dl-central-migrate`** (Repo Deadlock-Bots), das Website-Backend hat
  keinen Runner. Vorher `touch bin/dl-central-migrate/src/main.rs`, sonst sieht `sqlx::migrate!` neue
  `.sql`-Dateien nicht und meldet trotzdem Erfolg.
- **Release-Builds mit `-j 2`** — earlyoom killt sie sonst mit SIGTERM (in dieser Session passiert).
- **`reaction_role_dm_log.sent_at` heißt „versucht", nicht „zugestellt"** — wird schon beim
  Reservieren gesetzt. Zustellung = Zeile da UND kein „permanente DM-Ablehnung" im Journal.
- **Beweise gegen einen bekannten Treffer eichen.** `grep … | head -1 && echo "ok"` liefert immer
  „ok" (Exit-Code kommt von `head`), und Vite schreibt Strings mit Backticks statt Anführungszeichen.
  Beide Fallen sind hier zugeschnappt.

## Nebenbei repariert (nicht Scrim, aber wichtig)

Die zentrale Datenbank nahm **seit dem 14.07. keine Migrationen mehr an**: Migration `2026071402`
(steam_links Re-Friend-Backfill) hatte eine Prüfsumme, die nicht zur Datei passte — angewendet aus
einem Worktree mit abweichendem Stand. sqlx verweigert dann **jeden** weiteren Lauf, für alle
Projekte. Zwei Tage unbemerkt, weil niemand migrierte.

Belegt kein Datenschaden (98 Zeilen korrekt markiert, ein erneuter Lauf wäre ein No-Op), alte
Prüfsumme gesichert (`scratchpad/alte_checksum_2026071402.txt`), korrigiert. **Lehre: Migrationen
immer aus dem kanonischen Checkout einspielen, nie aus einem Worktree.**
