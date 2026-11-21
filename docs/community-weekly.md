# Community-Wochenberichte

Stand: 2026-11-21. **MVP auf isolierter Feature-Branch, nicht live, nicht aktiviert.**

## Warum ein eigenes System?

`/devfeed/` zeigt Nachrichten externer Deadlock-Entwickler; die Seite bleibt unangetastet. Unsere eigenen Wochenberichte gehören unter `/blog/entwicklungsberichte/`. Der bestehende `Deadlock-Docs`-Korpus bleibt Quelle für überprüfte öffentliche Dokumentation. Dessen öffentliches GitHub-Repo ist keine Ablage für Agent-Chats und private Betriebsinformationen.

Der bisherige Changelog-Skill hat Commit-Messages direkt in Kommunikationssprache verwandelt. Das ist für mehr als ein Repo, mehrere Agenten und ungleichzeitige Deployments nicht verlässlich.

## Datenfluss

```text
12 konfigurierten Repositories        Agent-Task-Handoffs (.tasks/.../COMMUNITY-CHANGE.json)
          |                                  |
  Git-Log und Task-Metadaten -----------  taskActivity / handoffs
          |                                  |
          +--------> PRIVATE candidates.json <------- keine Publikationsfreigabe
                              |
               Redaktion prüft Code und Live-Status
                |                           |
      events.json (LIVE)       progress.json (IN ARBEIT)
                |                           |
                +--------- sichere Fakten --+
                              |
                  Claude Haiku 5.5 (Budgetlimit)
                              |
                      PRIVATE draft.json
                              |
               Review, Quelle, Sprache, Visuals
                              |
           approval.json = SHA256 des exakten Entwurfs
                              |
        HTML-Quellseite + Archiv in Website-Worktree
                              |
        Tests, Merge-Gate, Freigabe, Deployment, Live-Test
                              |
                /blog/entwicklungsberichte/
```

### Grenzen des MVP

- Kein roher Chat-Export zum Modell. Task-Aktivitätsmetadaten sind ausschließlich **unreviewed Indizien**, keine Arbeitszeitmessung.
- `collect` durchsucht konfigurierte lokale Git-HEADs. Es liest nicht automatisch alle Branches oder externe GitHub-PRs; unreleaste Arbeitsstände können fehlen.
- Kein automatisch 100 Prozent vollständiger Agent-Chat-Ingest. Künftig sollen Agenten geprüfte Task-Handoffs liefern. Aktuell gibt es noch keinen zentralen Hook für alle bestehenden Agenten.
- Eine redaktionell geprüfte `events.json` beziehungsweise `progress.json` wird aktuell **manuell** zusammengestellt. Automatische Docs-PRs, Screenshot-Aufnahme und Produktionsverifizierung sind Folgephasen.
- HTML-Rendering ersetzt nicht Merge-Gate, Browserprüfung oder Deployment.

## Lokale Befehle

```bash
cd /home/nathanael/repos/Website
node scripts/community-weekly.mjs collect 2026-W47
node scripts/community-weekly.mjs draft 2026-W47
node scripts/community-weekly.mjs check 2026-W47
node scripts/community-weekly.mjs render 2026-W47
node --test scripts/tests/community-weekly.test.mjs
```

`collect` erzeugt `~/.claude/community-weekly/weeks/<WOCHE>/candidates.json`, die ausschließlich privat zu behandeln ist. `draft` nimmt nur geprüfte public-safe Inhalte an. Ohne reviewed Events und Progress entstehen keine LLM-Kosten. `render` schreibt nach gesonderter signierter Freigabe nur HTML-Dateien im Quell-Checkout.

## Private Redaktionseingaben

Alle folgenden Beispiele sind **synthetisch und dürfen nicht direkt als echte Änderung publiziert werden**. Die Dateien gehören nur nach `~/.claude/community-weekly/weeks/<WOCHE>/`, niemals ins Git-Repo.

`events.json` (tatsächlich live, mit individueller prüfbarer Deployment-Evidenz und optionaler freigegebener öffentlicher Quelle):

```json
[
  {
    "id": "reconnect-2026w47",
    "groupId": "reconnect-bugfix",
    "status": "production",
    "editorialApproved": true,
    "userFacing": true,
    "type": "bugfix",
    "importance": 3,
    "title": "Wiederverbinden funktioniert zuverlässig",
    "before": "Nach einem kurzen Verbindungsabbruch blieb eine Nutzeranzeige manchmal stehen.",
    "after": "Der Status wird nach dem Wiederverbinden erneut angezeigt.",
    "why": "Eine veraltete Verbindung wurde nicht neu abgeglichen.",
    "deployedAt": "2026-11-19T15:30:00+01:00",
    "evidence": [{"kind": "deploy", "ref": "verifizierter-interner-release-nachweis", "public": false}],
    "docsRequired": true,
    "docsStatus": "reviewed",
    "docsUrl": "/docs/discord-server/...",
    "verifiedEffort": {"verified": true, "hours": 2, "evidence": ["intern-geprüftes-task-protokoll"]}
  }
]
```

`progress.json` (aus Agent-Arbeit, ausdrücklich NICHT live):

```json
[
  {
    "id": "better-queue-under-test",
    "status": "in_progress",
    "editorialApproved": true,
    "publicSafe": true,
    "reportedAt": "2026-11-20T11:00:00+01:00",
    "summary": "Eine bessere Warteschlange wird noch getestet; sie ist nicht für Mitglieder verfügbar.",
    "evidence": [{"kind": "task", "ref": "reviewed-task-summary-2026w47"}]
  }
]
```

Der Reviewer übernimmt diese Vorlagen **niemals ungeprüft**. Das Beispiel erklärt nur die Feldstruktur. Gleiche Features aus verschiedenen Repos werden vor Freigabe unter einer kanonischen `groupId` zusammengefasst, mit einem redaktionellen Event pro Feature. Commit-SHA und Tasknamen sind Belege, aber keine Argumente, die Leser verstehen müssen.

Das private `draft.json` kommt vom Modell. Erst wenn Redaktion Formulierungen, Links, Sichtbarkeit, Datenschutz, Doku und Claims geprüft hat, wird `approval.json` erzeugt, mit SHA256 über die **exakten Bytes** von `draft.json`:

```json
{
  "sha256": "<SHA256 der geprüften draft.json>",
  "reviewer": "<freigebende Person>",
  "approvedAt": "<ISO-8601-Zeit>"
}
```

Änderungen am Draft nach der Freigabe invalidieren die Freigabe. Eine vorhandene Wochenpost-Datei wird nicht stillschweigend überschrieben.

### Redaktionelle Doku-Gates

Wer ein User-Feature veröffentlicht, prüft `Deadlock-Docs/quellen.json`, `public-sources.json` und die vorhandenen Frische-/Corpus-Validatoren. Keine öffentlich sichtbare Featurebehauptung ohne passend geprüfte Doku, wenn die Änderung erklärungsbedürftig ist. Die Docs-Review-Pipeline wird nicht durch das Sprachmodell überschrieben.

### Screenshots, Clips und Datenschutz

Wenn eine echte UI-Veränderung existiert, ein geprüftes Bild aus einer Testinstanz oder einem synthetischen Account unter `dl-landing/blog/entwicklungsberichte/assets/` einspielen. In `events.json` `visual` mit `path`, `alt`, `caption` angeben. Keine Screenshots persönlicher Discord-Konversationen, Tokens oder Admin-Seiten. Die automatische visuelle Erfassung ist **noch nicht implementiert**.

## Kalender

Vorgefertigte User-systemd-Unit-Templates befinden sich unter `scripts/systemd`:
- `community-weekly-collect.timer`: Montag, 08:00 Uhr, nur Kandidaten.
- `community-weekly-draft.timer`: Dienstag, 08:00 Uhr, nur privater Haiku-Entwurf, falls vorher freigegebene Fakten vorliegen.

Erst nach Integration in den offiziellen Website-Checkout, Laufzeitprüfung und separater Freigabe installieren. Die Units sind **nicht** aktiviert. Soweit noch keine Freigabedaten vorliegen, entstehen weder ein Modellaufruf noch ein Bericht.

## Redaktionelle Erfolgskriterien

1. Jeder Satz über verfügbare Änderungen hat einen belegbaren Release-Nachweis.
2. Kein Merge, Agent-Chat oder Test wird als Produktion ausgegeben.
3. Wöchentlich höchstens drei Highlights, kleine Fixes zusammengefasst.
4. Jeder technische Begriff erhält bei Bedarf eine konkrete Nutzereinordnung.
5. Kein unbewiesener Umsatz, Zeitaufwand, Modellpreis, Performancegewinn oder Testergebnis.
6. Jedes Visual ist echt, datenschutzgeprüft und mit `alt` plus Bildunterschrift versehen.
7. Support-CTA ohne Druck; Zahlungslinks nur falls live bestätigt.
8. Ohne dokumentierte Freigabe kein Rendern, ohne Merge-Gate kein Live-Deploy.
9. Der HTML-Build, die automatisierten Prüfungen und die abschließende Sichtprüfung sind grün.
