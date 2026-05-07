# Backlinks-Runbook

Wie Owned-Properties auf `deutsche-deadlock-community.de` verlinkt werden — automatisiert wo möglich, manuell wo der Token-Aufwand größer wäre als der Wert.

## Was ist eingerichtet

| Property                    | Skript                          | Modus       |
|-----------------------------|---------------------------------|-------------|
| GitHub-Repos READMEs (×5)   | `update-github-readmes.mjs`     | Auto        |
| Discord-Server-Description  | `print-paste-blocks.mjs discord`| Manual-Paste|
| Twitch-Channel-About        | `print-paste-blocks.mjs twitch` | Manual-Paste|
| Steam-Community-Group       | `print-paste-blocks.mjs steam`  | Manual-Paste|

Was NICHT gemacht wird: Listing-Submissions auf disboard.org, top.gg, discord.me, Forum-Posts, Reddit-Bots. Das ist Spam-Risiko und meist auch TOS-Verletzung.

## GitHub-READMEs (auto)

```bash
# Dry-run (zeigt nur was passieren würde):
node scripts/backlinks/update-github-readmes.mjs

# Datei-Änderung ohne Commit:
node scripts/backlinks/update-github-readmes.mjs --apply

# Datei-Änderung + Commit + Push (production):
node scripts/backlinks/update-github-readmes.mjs --apply --commit
```

**Idempotent**: jeder Lauf überschreibt nur den Block zwischen `<!-- DDC-LINK-START -->` und `<!-- DDC-LINK-END -->`. README-Inhalt drumherum bleibt unangetastet.

**Sicherheit**:
- Wird ein Repo gerade mit anderen Änderungen bearbeitet (uncommitted changes außer `README.md`), wird der Commit-Step für dieses Repo geskippt — der Patch ist dann nur lokal in der File. Mit `--dirty-ok` lässt sich das erzwingen.
- Repo wird komplett geskippt, wenn keine `README.md` existiert (z.B. `Deadlock-Turniere`). Wenn eine README ergänzt werden soll, einmal manuell `git add README.md && git commit && git push`, dann beim nächsten Skript-Lauf wird sie automatisch gepatcht.

**Repos, die das Skript anfasst** (Reihenfolge wie im Code):
- `~/Documents/Deadlock-Bots`
- `~/Documents/Deadlock--Patchnotes-Bot`
- `~/Documents/Deadlock-Steam-Bot`
- `~/Documents/Deadlock-Twitch-Bot`
- `~/Documents/Deadlock-Turniere` (skip falls README fehlt)

## Discord / Twitch / Steam (manual)

```bash
node scripts/backlinks/print-paste-blocks.mjs            # alle 3 auf einmal
node scripts/backlinks/print-paste-blocks.mjs discord    # nur einer
node scripts/backlinks/print-paste-blocks.mjs twitch
node scripts/backlinks/print-paste-blocks.mjs steam
```

**Discord-Server-Description** (Limit 300 Zeichen):
- Server-Settings → Server-Profil → Description
- Nur möglich, wenn der Server "Discoverable" ist (DDC-Server hat das Feature laut Bot-Check ✓)

**Twitch-Channel-About / Panels**:
- Creator-Dashboard → Settings → Channel → "Edit Panels" oder About-Field
- Markdown unterstützt — Block aus Skript-Output direkt rein paste

**Steam-Community-Group-Summary**:
- Group-Page → "Edit Group" → Summary
- BBCode unterstützt — Block paste

## Wann erneut ausführen

| Auslöser                                  | Aktion                                                |
|-------------------------------------------|-------------------------------------------------------|
| Discord-Invite-Code wechselt              | Konstante in `update-github-readmes.mjs` + `print-paste-blocks.mjs` anpassen, dann `--apply --commit` |
| Neue Hauptseite auf der Website           | Block-Inhalt in beiden Skripten erweitern, `--apply --commit` für Repos, manuell für Discord/Twitch/Steam |
| Neues Bot-Repo wird hinzugefügt           | Eintrag in `REPOS`-Array von `update-github-readmes.mjs` hinzufügen, `--apply --commit` |
| README in einem Repo wird komplett umgebaut| Skript läuft trotzdem — Marker-Block bleibt nur an seiner Position, alles andere unverändert |

## Wirkung

Das sind nicht die SEO-Megablitze — Discord-Server-Listings indexiert Google nicht direkt, und Steam-Group-Pages sind als "noindex" für externe Crawler. Aber:

1. **GitHub-READMEs** werden von Google indexiert, sind hochrangige `dofollow`-Links auf etablierten Repos und stützen das Domain-Authority-Profil.
2. **Twitch-Panels** liefern Traffic von echten Stream-Viewern — qualitativ sehr hoch, weil das genau die Zielgruppe ist.
3. **Discord-Server-Description** taucht in Discord-Discovery auf und in einigen externen Listing-Sites (die scrapen die Description).

Kein einzelner dieser Backlinks bewegt das Ranking allein. In der Summe + dem ehrlichen Content der Website ist das aber genug, um aus dem `0-Treffer`-Stand zumindest die ersten Seiten von `"deutsche deadlock community"` zu erobern, plus den Long-Tail (`"deadlock anfänger guide deutsch"`, `"deadlock helden liste"`, `"deadlock voice-lanes"`).
