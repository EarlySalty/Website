# Briefing: objectives-blogpost (A)

[Orchestrator] Paket objectives-blogpost (A, Findings). Auftrag:
/home/nathanael/.worktrees/Website-blog-objectives/.tasks/2026-09-17-objectives-blogpost/AUFTRAG.md
(vollständig lesen, dann bauen).

- Worktree: /home/nathanael/.worktrees/Website-blog-objectives
- Branch: feat/blog-objectives-2026
- Intent-Thread: c2c38ea7-35b4-44d6-ad7e-f6344be66f09

## Regeln

- Du bist der einzige Thread für dieses Paket. Keine Unter-Threads oder Unter-Agenten spawnen.
- Keine Code-Kommentare schreiben, Code erklärt sich selbst.
- Nur den eigenen Branch pushen, nie main. Nichts nach main mergen.
- Nutzersichtbare Texte auf Deutsch mit echten Umlauten, keine Em-Dashes.
- Hilfsskripte für die Abfragen sind Einmal-Werkzeuge und bleiben unter `.tasks/.../data/`.

## Bump-up

Wird das Paket größer als beschrieben, nicht weiterbauen. Nachricht an den Intent-Thread, dann stoppen:

```
[Bump-up] Paket A: Grund: ... Erledigt: ... Worktree: <absoluter Pfad> Offen: ...
```

## Fertigmeldung

Melden hier im Thread: Branch, Commits (SHA), geänderte Dateien, was geprüft wurde, was offen ist.
Danach stoppen, kein Mitlaufen.
