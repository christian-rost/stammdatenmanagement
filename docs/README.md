# Stammdatenmanagement

Webanwendung zur Bereinigung von Dubletten im SAP-Stammdaten (LFA1 Lieferanten, MARA/MAKT Materialien). Erkennt und verwaltet exakte Dubletten, ähnliche Einträge via Trigram-Matching sowie einen KI-gestützten Regel-Assistenten.

## Features

### Lieferanten (LFA1)
- **Exakte Dubletten** — Gruppiert Lieferanten mit identischem Name und Ort
- **Fuzzy-Matching** — Erkennt ähnliche Einträge via PostgreSQL `pg_trgm` (konfigurierbarer Schwellenwert)
- **Freitextsuche** — Durchsucht alle LFA1-Felder, zeigt Dubletten-Status zum selektierten Datensatz
- **LFA1-Import** — XLSX-Datei wird im Browser geparst (SheetJS) und als JSON-Batches importiert
- **Regel-Assistent** — Klartextregel → Claude API generiert SQL → Anwender prüft Ergebnis → Entscheidung auf alle Gruppen anwenden

### Materialien (MARA/MAKT)
- **Exakte Dubletten** — Gruppiert Materialien mit identischer normierter Kurzbezeichnung (MAKTG)
- **Fuzzy-Matching** — Erkennt ähnliche Materialtexte via `pg_trgm` (konfigurierbarer Schwellenwert), schließt exakte Dubletten aus
- **Freitextsuche** — Durchsucht MATNR, MAKTX, MAKTG, MTART, MATKL, MEINS, MSTAE
- **MARA/MAKT-Import** — Server-seitiges Parsen großer XLSX-Dateien (openpyxl); alle 247 MARA-Spalten werden gespeichert

### Allgemein
- **Entscheidungsworkflow** — Pro Gruppe/Paar festlegen, welcher Datensatz behalten wird
- **Statusverfolgung** — offen / bearbeitet / ignoriert
- **CSV-Export** — Alle Bereinigungsentscheidungen exportierbar
- **Benutzerverwaltung** — JWT-Auth mit Admin-Bootstrap

## Tech-Stack

| Schicht | Technologie |
|--------|------------|
| Backend | FastAPI + Python ≥3.10, UV |
| Frontend | React 19 + Vite, SheetJS (xlsx, LFA1-Import) |
| Datenbank | PostgreSQL via Supabase (self-hosted) |
| KI | Anthropic Claude API (claude-opus-4-6) |
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
│   │   ├── App.jsx                        # Hauptkomponente (Domains: Lieferanten / Materialien)
│   │   ├── auth.jsx                       # Auth-Kontext
│   │   ├── index.css                      # XQT5 Corporate Design
│   │   └── components/
│   │       ├── Login.jsx                  # Login/Registrierung
│   │       ├── DublettenList.jsx          # Lieferanten: Exakte Dubletten – Liste
│   │       ├── DublettenDetail.jsx        # Lieferanten: Exakte Dubletten – Entscheidungsformular
│   │       ├── FuzzyList.jsx              # Lieferanten: Ähnlichkeitspaare – Liste
│   │       ├── FuzzyDetail.jsx            # Lieferanten: Ähnlichkeitspaare – Paarvergleich
│   │       ├── SearchView.jsx             # Lieferanten: Freitextsuche mit Dubletten-Check
│   │       ├── ImportModal.jsx            # Lieferanten: XLSX-Import (client-seitig via SheetJS)
│   │       ├── RegelView.jsx              # Regel-Assistent (LLM → SQL → Anwenden)
│   │       ├── MaterialList.jsx           # Materialien: Exakte Dubletten – Liste
│   │       ├── MaterialDetail.jsx         # Materialien: Exakte Dubletten – Entscheidungsformular
│   │       ├── MaterialFuzzyList.jsx      # Materialien: Ähnlichkeitspaare – Liste
│   │       ├── MaterialFuzzyDetail.jsx    # Materialien: Ähnlichkeitspaare – Paarvergleich
│   │       ├── MaterialSearchView.jsx     # Materialien: Freitextsuche
│   │       └── MaterialImportModal.jsx    # Materialien: XLSX-Upload (server-seitig via openpyxl)
│   ├── package.json
│   ├── vite.config.js
│   └── nixpacks.toml     # Deployment-Konfiguration
├── scripts/
│   ├── create_tables.sql                # DB-Schema + Funktionen Lieferanten (Ersteinrichtung)
│   ├── migrate_lfa1_add_columns.sql     # Migration: 130 neue LFA1-Spalten + UNIQUE auf lifnr
│   └── create_material_tables.sql       # DB-Schema + Funktionen Materialien (Ersteinrichtung)
├── data/
│   └── users/            # Benutzerdaten (JSON, auto-erstellt)
├── start.sh              # Lokales Entwicklungs-Startskript
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

| Variable | Beschreibung | Erforderlich für |
|----------|-------------|-----------------|
| `SUPABASE_URL` | URL der Supabase-Instanz | Alle DB-Features |
| `SUPABASE_KEY` | Supabase Anon Key | Alle DB-Features |
| `JWT_SECRET` | Geheimer Schlüssel für JWT-Token | Auth |
| `admin_user` | Benutzername des initialen Admins | Admin-Bootstrap |
| `admin_pw` | Passwort des initialen Admins | Admin-Bootstrap |
| `CORS_ORIGINS` | Erlaubte Frontend-Origins (kommagetrennt) | Deployment |
| `ANTHROPIC_API_KEY` | Anthropic API Key | Regel-Assistent (Tab „Regeln") |
| `SUPABASE_DB_URL` | Direkte PostgreSQL-URL für beliebige SQL-Ausführung | Regel-Assistent + Material-Fuzzy-Matching |

**Format für `SUPABASE_DB_URL`:**
```
postgresql://postgres:PASSWORD@HOST:PORT/postgres
```
Bei self-hosted Supabase: Host ist i. d. R. `db.PROJEKT.supabase.co` oder der direkte DB-Host.

### 2. Datenbank einrichten

**Ersteinrichtung** (Supabase SQL-Editor):
```sql
-- Inhalt von scripts/create_tables.sql ausführen
```

Erstellt: Tabellen `lfa1`, `dubletten_entscheidungen`, `fuzzy_entscheidungen`,
Funktionen `get_duplicate_groups()`, `get_fuzzy_duplicates(threshold)`, GiST-Index für `pg_trgm`.

**Migration für vollständigen LFA1-Import** (einmalig, falls noch nicht ausgeführt):
```sql
-- Inhalt von scripts/migrate_lfa1_add_columns.sql ausführen
```

Fügt 130 weitere LFA1-Spalten sowie einen UNIQUE-Constraint auf `lifnr` hinzu (nötig für Upsert).

**Material-Tabellen einrichten** (Supabase SQL-Editor):
```sql
-- Inhalt von scripts/create_material_tables.sql ausführen
```

Erstellt: Tabellen `mara` (247 Spalten), `makt`, `material_entscheidungen`, `material_fuzzy_entscheidungen`,
Funktionen `get_material_duplicate_groups()`, `get_material_fuzzy_duplicates(threshold)`,
GiST-Index `mara_maktx_trgm_idx` für Trigram-Fuzzy-Matching auf MAKTX.

Voraussetzung: `pg_trgm`-Extension muss in Supabase aktiviert sein (unter Database → Extensions).

### 3. Daten importieren

**Lieferanten (LFA1):** Als Admin einloggen → **„Daten importieren"** (Header-Button) → `LFA1_komplett.XLSX` auswählen → Importieren.
Die Datei wird im Browser geparst (SheetJS) und in Batches à 500 Datensätzen hochgeladen.

**Materialien (MARA/MAKT):** Als Admin einloggen → Domain „Materialien" wählen → **„Daten importieren"** → `MARA.XLSX` und `MAKT.XLSX` auswählen → Importieren.
Da MARA bis zu 35.000 Zeilen × 247 Spalten umfasst, erfolgt das Parsen vollständig server-seitig (openpyxl). Die Dateien werden per Datei-Upload an das Backend gesendet und dort direkt in die Datenbank importiert. SAP-Spaltennamen mit Sonderzeichen (z. B. `/BEV1/LULEINH`) werden automatisch normiert (→ `bev1_luleinh`).

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

Erreichbar unter: `http://localhost:5173`

---

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

### Suche

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/search?q=...` | Freitextsuche über alle relevanten LFA1-Felder (max. 500 Treffer) |

### Regel-Assistent

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| POST | `/api/rules/generate-sql` | Klartextregel → SQL via Claude API |
| POST | `/api/rules/execute` | SELECT-Statement direkt ausführen (psycopg2) |
| POST | `/api/rules/apply` | Entscheidung auf mehrere Gruppen anwenden (Batch-Upsert) |

**`POST /api/rules/generate-sql`** — Body:
```json
{ "regel": "Kreditoren mit gleicher Anschrift aber unterschiedlicher USt-IdNr → alle behalten" }
```
Response:
```json
{
  "sql": "SELECT lifnr, name1, ort01, stceg ... FROM lfa1 WHERE ...",
  "erklaerung": "Findet Gruppen mit identischer Adresse aber unterschiedlicher USt-IdNr",
  "aktion": "ignorieren",
  "aktion_erklaerung": "Alle Kreditoren werden beibehalten"
}
```

**`POST /api/rules/execute`** — Body:
```json
{ "sql": "SELECT lifnr, name1, ort01 FROM lfa1 WHERE ..." }
```
Nur SELECT erlaubt. Response: `{ "rows": [...], "count": 42 }`

**`POST /api/rules/apply`** — Body:
```json
{
  "groups": [{ "name1": "Müller GmbH", "ort01": "Hamburg" }],
  "status": "ignoriert",
  "notiz": "Regel: gleiche Adresse, versch. USt-ID"
}
```

### Materialien — Exakte Dubletten

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/materials/duplicates` | Alle Material-Dubletten-Gruppen (gruppiert nach MAKTG) |
| GET | `/api/materials/duplicates/records?maktg=...` | Datensätze einer Gruppe |
| POST | `/api/materials/decisions` | Entscheidung speichern (upsert nach MAKTG) |
| GET | `/api/materials/stats` | Statistik (gesamt/offen/bearbeitet/ignoriert) |
| GET | `/api/materials/export` | CSV-Export aller Material-Entscheidungen |

### Materialien — Fuzzy-Matching

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/materials/fuzzy?threshold=0.75` | Ähnliche Materialpaare (Schwellenwert 0.0–1.0) |
| POST | `/api/materials/fuzzy/decision` | Fuzzy-Entscheidung speichern |

Das Fuzzy-Matching verwendet eine direkte psycopg2-Verbindung (`SUPABASE_DB_URL`) und umgeht damit das PostgREST-Statement-Timeout (~8 s) von Supabase. Paare mit identischem MAKTG (exakte Dubletten) werden automatisch ausgeschlossen.

### Materialien — Suche

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/materials/search?q=...` | Freitextsuche über MATNR, MAKTX, MAKTG, MTART, MATKL, MEINS, MSTAE (max. 200 Treffer) |

### Admin (nur Admins)

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/admin/check-schema` | Prüft ob LFA1-Migration ausgeführt wurde |
| POST | `/api/admin/import-lfa1-batch` | Batch-Import von LFA1-Datensätzen (JSON) |
| GET | `/api/admin/check-material-schema` | Prüft ob Material-Tabellen vorhanden sind |
| POST | `/api/admin/upload-mara-xlsx` | MARA-XLSX hochladen und server-seitig importieren |
| POST | `/api/admin/upload-makt-xlsx` | MAKT-XLSX hochladen und server-seitig importieren |
| POST | `/api/admin/import-mara-batch` | Batch-Import von MARA-Datensätzen (JSON, intern) |
| POST | `/api/admin/import-makt-batch` | Batch-Import von MAKT-Datensätzen (JSON, intern) |

### System

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/` | Health-Check (Coolify) |
| GET | `/api/health` | Health-Check mit DB-Status |

---

## Datenbankstruktur

### `lfa1` — SAP-Lieferantenstamm (nach Migration: 139 Spalten)

Kernfelder:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `lifnr` | text | Kreditornummer (UNIQUE) |
| `mandt` | text | SAP-Mandant |
| `name1`–`name4` | text | Kreditorbezeichnungen |
| `ort01` | text | Ort (Dubletten-Key) |
| `stras` | text | Straße + Hausnummer |
| `pstlz` | text | Postleitzahl |
| `land1` | text | Länderkennzeichen |
| `stceg` | text | USt-IdNr |
| `telf1` | text | Telefon |
| `loevm` | text | Löschvormerkung ('X' = gelöscht) |
| `erdat` | date | Anlagedatum |

Vollständige Spaltenliste: `scripts/migrate_lfa1_add_columns.sql`

### `dubletten_entscheidungen`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `name1` | text | Gruppenkey (mit ort01 unique) |
| `ort01` | text | Gruppenkey |
| `lifnr_behalten` | text | Zu behaltende Kreditornummer |
| `lifnr_loeschen` | text[] | Zu löschende Nummern |
| `notiz` | text | Freitext-Notiz |
| `status` | text | offen / bearbeitet / ignoriert |
| `bearbeitet_von` | text | Benutzername |
| `bearbeitet_am` | timestamptz | Zeitstempel (auto) |

### `fuzzy_entscheidungen`

Analog zu `dubletten_entscheidungen`, aber auf Basis von Paaren (`lifnr_a`, `lifnr_b`).

---

### `mara` — SAP-Materialstamm (247 Spalten)

Alle Spalten aus SAP-Tabelle MARA werden gespeichert. SAP-Spaltennamen mit Namespaces (z. B. `/BEV1/LULEINH`) werden zu `bev1_luleinh` normiert. UNIQUE-Constraint auf `matnr`.

Angezeigte Kernfelder:

| Feld | Beschreibung |
|------|-------------|
| `matnr` | Materialnummer (UNIQUE) |
| `maktx` | Kurzbezeichnung (Originalschreibung) |
| `maktg` | Normierte Kurzbezeichnung (Großbuchstaben, Dubletten-Key) |
| `mtart` | Materialart |
| `matkl` | Materialgruppe |
| `meins` | Basismengeneinheit |
| `mstae` | Branchenspezifischer Materialstatus |
| `ersda` | Anlagedatum |
| `lvorm` | Löschvormerkung |

### `makt` — SAP-Materialbezeichnungen

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `matnr` | text | Materialnummer |
| `spras` | text | Sprache |
| `maktx` | text | Kurzbezeichnung |
| `maktg` | text | Normierte Kurzbezeichnung |

UNIQUE auf `(matnr, spras)`. Hinweis: MARA enthält bereits `maktx`/`maktg` in den letzten Spalten; die Auswertung der Dubletten basiert ausschließlich auf MARA.

### `material_entscheidungen`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `maktg` | text | Gruppenkey (UNIQUE) |
| `matnr_behalten` | text | Zu behaltende Materialnummer |
| `matnr_loeschen` | text[] | Zu löschende Nummern |
| `notiz` | text | Freitext-Notiz |
| `status` | text | offen / bearbeitet / ignoriert |
| `bearbeitet_von` | text | Benutzername |
| `bearbeitet_am` | timestamptz | Zeitstempel (auto) |

### `material_fuzzy_entscheidungen`

Analog zu `material_entscheidungen`, aber auf Basis von Paaren (`matnr_a`, `matnr_b`). UNIQUE auf `(matnr_a, matnr_b)`.

---

## Deployment (Coolify + Nixpacks)

### Backend
- Nixpacks erkennt Python automatisch via `pyproject.toml`
- Startbefehl: `uv run python -m backend.main`
- Port: `8002`
- Alle Umgebungsvariablen in Coolify unter „Environment Variables" konfigurieren

### Frontend
- Konfiguration via `frontend/nixpacks.toml`
- Build: `npm run build` → `dist/`
- Serve: `npx serve dist -s -p 3000`
- Port: `3000`
- `VITE_API_BASE` auf die Backend-URL setzen

---

## Entwicklung

```bash
# Abhängigkeiten installieren
uv sync
cd frontend && npm install

# Backend + Frontend starten
./start.sh
```

### Neue Benutzer

Beim ersten Start wird der Admin-Benutzer automatisch aus `admin_user` / `admin_pw` erstellt. Weitere Benutzer können über `/api/auth/register` angelegt werden.

---

## Lizenz

Internes Projekt — XQT5 GmbH
