# Deadlock Meta Website - WORKFLOW

## Ziel
Nachbau von deadlockmeta.com als `earlysalty.com/builds` mit eigenem Backend (FastAPI + SQLite + Discord OAuth)

## Status
- [x] Projektstruktur erstellt
- [x] Frontend (React + Vite + Tailwind) Basis
- [x] Frontend erfolgreich gebaut (dist/)
- [x] Backend (FastAPI) Basis mit allen Routern
- [x] Backend getestet (API funktioniert)
- [x] Datenbank-Schema mit Sample Data
- [x] Caddyfile aktualisiert (builds.earlysalty.com)
- [ ] Discord OAuth konfigurieren (Client ID/Secret)
- [ ] DNS/Subdomain einrichten

## Backend starten (Production)
```bash
cd /home/naniadm/Documents/Website/builds/backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v4 (dark mode)
- **Backend**: Python + FastAPI + aiosqlite
- **Auth**: Discord OAuth (bestehend aus Dashboard)
- **Datenbank**: SQLite

## Projektstruktur
```
/home/naniadm/Documents/Website/builds/
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── api/       # API Client
│   │   ├── components/ # Layout, etc.
│   │   ├── context/   # AuthContext
│   │   ├── hooks/     # useDragDrop
│   │   ├── pages/     # Alle Seiten
│   │   ├── types/     # TypeScript Types
│   │   └── App.tsx, main.tsx, index.css
│   └── package.json, vite.config.ts, tailwind.config.js
├── backend/           # FastAPI
│   ├── app/
│   │   ├── routers/   # auth, heroes, builds, items, tierlists, patchnotes, history, admin
│   │   ├── database.py
│   │   ├── schemas.py
│   │   └── main.py
│   └── package.json
└── WORKFLOW.md
```

## API Endpunkte
- `GET /api/auth/discord/login` - Login mit Discord
- `GET /api/auth/discord/callback` - OAuth Callback
- `GET /api/auth/me` - Current User
- `GET/POST/PUT/DELETE /api/heroes` - Heroes CRUD
- `GET/POST/PUT/DELETE /api/builds` - Builds CRUD
- `POST /api/builds/:id/vote` - Vote
- `POST /api/builds/:id/report` - Report
- `GET /api/tierlists` - Öffentliche Tierlisten
- `GET /api/tierlists/my` - Eigene Tierlisten
- `POST /api/tierlists/:id/fork` - Fork
- `GET/POST/DELETE /api/patchnotes`
- `GET /api/history`
- Admin: reports, votes, announcement, users

## Nächste Schritte
1. **Discord OAuth konfigurieren**: Client ID/Secret in `app/routers/auth.py` eintragen
2. **Backend installieren**: `cd backend && pip install -r requirements.txt` (oder npm scripts nutzen)
3. **Backend starten**: `python -m uvicorn app.main:app --reload --port 8000`
4. **Frontend installieren**: `cd frontend && npm install`
5. **Frontend starten**: `npm run dev`
6. **DNS**: Subdomain `builds.earlysalty.com` auf Server zeigen lassen

## Offene TODOs
- Admin Auth Guard implementieren
- Build Voting mit meta_votes Tabelle
- Drag & Drop Tier-Editor fertigstellen
- Feedback Formular an Backend anbinden