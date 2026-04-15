# API-Contract – Deadlock Tier-Liste

Dieses Dokument beschreibt die HTTP-Schnittstellen, die das Backend für die Tier-Listen-Frontend-Anbindung bereitstellen muss.

## Auth

- Authentifizierung via `master_dash_session` Cookie (Discord OAuth2 Flow)
- Login-URL: `/auth/discord/login` (Discord-Bot-Auth-Endpoint)
- Callback: `/auth/discord/callback`
- Session läuft über den bestehenden Deadlock-Bots Auth-Flow

---

## Endpunkte

### `GET /api/tierlist`

Gibt die aktuelle Tier-Einteilung zurück.

**Auth:** nicht erforderlich

**Response `200`:**
```json
{
  "lastUpdated": "2026-04-15T12:00:00Z",
  "description": "Tier-Liste der Deutschen Deadlock Community.",
  "tiers": {
    "S": {
      "label": "S Tier – Empfohlen",
      "color": "#FFD700",
      "heroes": ["haze", "infernus", "dynamo"]
    },
    "A": {
      "label": "A Tier – Meta-Defining",
      "color": "#FF8C00",
      "heroes": ["abrams", "ivy"]
    },
    "B": {
      "label": "B Tier – Viable",
      "color": "#3B82F6",
      "heroes": ["mcginnis", "lash"]
    },
    "C": {
      "label": "C Tier – Situativ",
      "color": "#06B6D4",
      "heroes": ["paradox", "pocket"]
    }
  }
}
```

---

### `PUT /api/tierlist`

Speichert eine neue Tier-Einteilung. Nur für authentifizierte Admins.

**Auth:** erforderlich (`master_dash_session` Cookie)

**Request Body:**
```json
{
  "tiers": {
    "S": { "label": "S Tier – Empfohlen", "color": "#FFD700", "heroes": ["haze"] },
    "A": { "label": "A Tier – Meta-Defining", "color": "#FF8C00", "heroes": ["abrams"] }
  }
}
```

**Response `200`:**
```json
{
  "ok": true,
  "lastUpdated": "2026-04-16T10:30:00Z"
}
```

**Response `401`:** Session abgelaufen oder fehlend

---

### `GET /api/tierlist/history`

Gibt den Änderungsverlauf der Tier-Liste zurück, sortiert nach Datum (neueste zuerst).

**Auth:** nicht erforderlich

**Response `200`:**
```json
[
  {
    "patch": "Patch 1.4",
    "date": "2026-04-10T12:00:00Z",
    "changes": [
      {
        "heroId": "haze",
        "heroName": "Haze",
        "heroImage": "/heroes/haze.png",
        "oldTier": "A",
        "newTier": "S",
        "oldColor": "#FF8C00",
        "newColor": "#FFD700"
      }
    ]
  }
]
```

Leere History → `[]`

---

### `GET /api/tierlist/me`

Gibt den aktuell eingeloggten Admin zurück. Wird vom Frontend zur Auth-Prüfung verwendet.

**Auth:** erforderlich (`master_dash_session` Cookie)

**Response `200`:**
```json
{
  "id": "1234567890",
  "username": "DiscordUser#0000"
}
```

**Response `401`:** Nicht eingeloggt → Frontend zeigt Login-Screen

---

### `GET /api/heroes`

Gibt alle konfigurierten Heroes zurück. Optional – Frontend kann auch statisches `heroes.json` nutzen.

**Auth:** nicht erforderlich

**Response `200`:**
```json
{
  "abrams": { "id": "abrams", "name": "Abrams", "image": "/heroes/abrams.png", "type": "Tank" },
  "haze": { "id": "haze", "name": "Haze", "image": "/heroes/haze.png", "type": "Carry" }
}
```

---

## Notizen

- Frontend verwendet `credentials: 'include'` bei allen authentifizierten Requests
- Bei `PUT /api/tierlist` → `401`: Frontend zeigt Toast "Sitzung abgelaufen"
- Bei Netzwerkfehler/Backend offline: Frontend zeigt Toast und bietet JSON-Export an
- `lastUpdated` im Response wird vom Backend gesetzt (nicht vom Client)
- Static Fallback: `public/data/tierlist.json` und `public/data/heroes.json` solange Backend nicht bereit
