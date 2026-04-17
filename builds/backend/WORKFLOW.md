2026-04-16
- Aufgabe aufgenommen: Security-/Privacy-Härtung für `app/routers/coaching.py`.
- Kontext geprüft: `app/main.py`, `app/database.py`, `app/routers/auth.py`, bestehende Router-Patterns gelesen.
- Geplante Änderung: Bot-Token-Dependency für `POST /requests`, `PATCH /requests/{request_id}/match`, `POST /surveys`; anonymes Review-Label über Hash aus `discord_user_id` + `coach_id`.
- Implementiert: `require_bot_token()` mit `X-Bot-Token`, ENV `COACHING_BOT_TOKEN`, `hmac.compare_digest`, 503 bei fehlender ENV.
- Implementiert: Review-Anonymisierung über `sha256(str(discord_user_id) + coach_id)[:6]`, Fallback `Anonym`.
- Verifikation: `python3 -m py_compile app/routers/coaching.py` erfolgreich.
- Verifikation eingeschränkt: `python3 -c "from app.routers import coaching"` scheitert in dieser Umgebung an fehlendem Paket `fastapi`; `pytest` ist hier ebenfalls nicht installiert.
