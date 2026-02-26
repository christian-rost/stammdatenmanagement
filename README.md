# Stammdatenmanagement

Webanwendung zur Bereinigung von Dubletten im SAP-Lieferantenstamm (LFA1). Erkennt und verwaltet sowohl exakte Dubletten als auch ähnliche Einträge via Trigram-Matching.

## Features

- **Exakte Dubletten**: Gruppiert Lieferanten mit identischem Name und Ort
- **Fuzzy-Matching**: Erkennt ähnliche Einträge via PostgreSQL `pg_trgm` (konfigurierbarer Schwellenwert)
- **Entscheidungsworkflow**: Pro Gruppe festlegen, welcher Datensatz behalten wird
- **Statusverfolgung**: offen / bearbeitet / ignoriert
- **CSV-Export**: Alle Bereinigungsentscheidungen exportierbar
- **Benutzerverwaltung**: JWT-Auth mit Admin-Bootstrap

## Tech-Stack

| Schicht | Technologie |
|--------|------------|
| Backend | FastAPI + Python ≥3.10, UV |
| Frontend | React 19 + Vite |
| Datenbank | PostgreSQL via Supabase (self-hosted) |
| Auth | JWT + Bcrypt (python-jose, passlib) |
| Deployment | Nixpacks + Coolify |
| Design | XQT5 Corporate Design (reines CSS, keine UI-Lib) |

## Projektstruktur

```
stammdatenmanagement/
├── backend/
│   ├── main.py           # FastAPI-App, alle API-Endpunkte
│   ├── config.py         # Konfiguration & Umgebungsvariablen
│   ├── auth.py           # JWT-Token-Verwaltung
│   └── user_storage.py   # JSON-basierte Benutzerpersistenz
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Hauptkomponente
│   │   ├── auth.jsx                     # Auth-Kontext
│   │   ├── index.css                    # XQT5 Corporate Design
│   │   └── components/
│   │       ├── Login.jsx                # Login/Registrierung
│   │       ├── DublettenList.jsx        # Linkes Panel – exakte Dubletten
│   │       ├── DublettenDetail.jsx      # Rechtes Panel – Entscheidungsformular
│   │       ├── FuzzyList.jsx            # Linkes Panel – Ähnlichkeitspaare
│   │       └── FuzzyDetail.jsx          # Rechtes Panel – Paarvergleich
│   ├── package.json
│   ├── vite.config.js
│   └── nixpacks.toml     # Deployment-Konfiguration
├── scripts/
│   └── create_tables.sql # DB-Schema + PostgreSQL-Funktionen
├── data/
│   └── users/            # Benutzerdaten (JSON, auto-erstellt)
├── start.sh              # Lokales Entwicklungs-Startskript
├── parse_lfa1.py         # SAP-LFA1-CSV-Parser
├── LFA1.csv              # Quelldaten (5.433 Lieferanten)
├── pyproject.toml
└── .env.example
```

## Schnellstart

### Voraussetzungen

- Python ≥ 3.10 + [UV](https://docs.astral.sh/uv/)
- Node.js ≥ 22
- Supabase-Instanz mit eingerichtetem Schema (siehe `scripts/create_tables.sql`)

### 1. Umgebungsvariablen

```bash
cp .env.example .env
# .env bearbeiten und Werte eintragen
```

Erforderliche Variablen:

| Variable | Beschreibung |
|----------|-------------|
| `SUPABASE_URL` | URL der Supabase-Instanz |
| `SUPABASE_KEY` | Supabase Anon Key |
| `JWT_SECRET` | Geheimer Schlüssel für JWT-Token |
| `admin_user` | Benutzername des initialen Admins |
| `admin_pw` | Passwort des initialen Admins |
| `CORS_ORIGINS` | Erlaubte Frontend-Origins (kommagetrennt) |

### 2. Datenbank einrichten

Das SQL-Skript im Supabase SQL-Editor ausführen:

```bash
# Inhalt von scripts/create_tables.sql in den Supabase SQL-Editor kopieren und ausführen
```

Das Skript erstellt:
- Tabelle `lfa1` (SAP-Lieferantenstamm)
- Tabelle `dubletten_entscheidungen`
- Tabelle `fuzzy_entscheidungen`
- Funktion `get_duplicate_groups()`
- Funktion `get_fuzzy_duplicates(threshold)`
- GiST-Index für Trigram-Suche (`pg_trgm`)

### 3. Daten importieren

```bash
# LFA1.txt (SAP-Export) in CSV umwandeln
python parse_lfa1.py

# CSV in Supabase importieren (über Supabase-Dashboard oder psql)
```

### 4. Starten

```bash
# Backend + Frontend gleichzeitig starten
./start.sh
```

Oder einzeln:

```bash
# Backend (Port 8002)
uv run python -m backend.main

# Frontend (Port 5173)
cd frontend && npm install && npm run dev
```

Die Anwendung ist dann erreichbar unter: `http://localhost:5173`

## API-Referenz

Alle Endpunkte (außer Auth) erfordern einen gültigen JWT-Token im `Authorization: Bearer <token>`-Header.

### Auth

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| POST | `/api/auth/register` | Neuen Benutzer registrieren (Rate-Limit: 3/min) |
| POST | `/api/auth/login` | Einloggen, JWT erhalten (Rate-Limit: 5/min) |
| GET | `/api/auth/me` | Aktuelle Benutzerinfo |

### Exakte Dubletten

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/duplicates` | Alle Dubletten-Gruppen |
| GET | `/api/duplicates/records?name1=...&ort01=...` | Datensätze einer Gruppe |
| POST | `/api/decisions` | Entscheidung speichern (upsert) |
| GET | `/api/stats` | Statistik (gesamt/offen/bearbeitet/ignoriert) |
| GET | `/api/export` | CSV-Export aller Entscheidungen |

### Fuzzy-Matching

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/fuzzy?threshold=0.7` | Ähnlichkeitspaare (Schwellenwert 0.0–1.0) |
| POST | `/api/fuzzy/decision` | Fuzzy-Entscheidung speichern |

### System

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/` | Health-Check (Coolify) |
| GET | `/api/health` | Health-Check |

## Datenbankstruktur

### `lfa1` — SAP-Lieferantenstamm

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `mandt` | text | SAP-Mandant |
| `lifnr` | text | Lieferantennummer (PK) |
| `land1` | text | Land |
| `name1`–`name4` | text | Lieferantenbezeichnungen |
| `ort01` | text | Hauptort |
| `ort02` | text | Zweiter Ort |

### `dubletten_entscheidungen`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `name1` | text | Gruppenkey (mit ort01 unique) |
| `ort01` | text | Gruppenkey |
| `lifnr_behalten` | text | Zu behaltende Lieferantennummer |
| `lifnr_loeschen` | text[] | Zu löschende Nummern |
| `notiz` | text | Freitext-Notiz |
| `status` | text | offen / bearbeitet / ignoriert |
| `bearbeitet_von` | text | Benutzername |
| `bearbeitet_am` | timestamptz | Zeitstempel |

### `fuzzy_entscheidungen`

Analog zu `dubletten_entscheidungen`, aber auf Basis von Paaren (`lifnr_a`, `lifnr_b`).

## Deployment (Coolify + Nixpacks)

### Backend
- Nixpacks erkennt Python automatisch via `pyproject.toml`
- Startbefehl: `uv run python -m backend.main`
- Port: `8002`
- Umgebungsvariablen in Coolify konfigurieren

### Frontend
- Konfiguration via `frontend/nixpacks.toml`
- Build: `npm run build` → `dist/`
- Serve: `npx serve dist -s -p 3000`
- Port: `3000`
- `VITE_API_BASE` auf die Backend-URL setzen

## Entwicklung

### Backend-Tests

```bash
uv run python -m pytest
```

### Abhängigkeiten hinzufügen

```bash
# Python
uv add <paket>

# Node
cd frontend && npm install <paket>
```

### Neue Benutzer anlegen

Beim ersten Start wird der Admin-Benutzer automatisch aus den Umgebungsvariablen `admin_user` / `admin_pw` erstellt. Weitere Benutzer können über `/api/auth/register` angelegt werden.

## Lizenz

Internes Projekt — XQT5 GmbH
