# Feature: Material-Bestellhistorie

**Erstellt:** 2026-05-11  
**Status:** Spezifikation / bereit zur Umsetzung

---

## Hintergrund

Im SAP-System liegen ca. 15.560 Materialien in MARA. Nicht alle davon sind noch aktiv —
ein Teil wurde seit Jahren nicht mehr bestellt. Ziel: alle Materialien, die seit dem
01.01.2020 nicht mehr bestellt wurden, identifizieren und als CSV exportieren, damit sie
im SAP-System archiviert oder gesperrt werden können.

**Datengrundlage:** EKPO-Datei (Bestellpositionen aus SAP EKKO+EKPO ab 01.01.2020),
Blatt 2 "nur nach Artikelnummern" — 15.562 Zeilen, dedupliziert nach MATNR.

---

## Anforderungen

### 1. Neue Datenbank-Tabelle `ekpo_bestellungen`

Speichert die relevanten Felder aus EKPO Blatt 2 (je ein Datensatz pro MATNR).

| Spalte | Typ | Beschreibung |
|---|---|---|
| `matnr` | TEXT PRIMARY KEY | Materialnummer, normiert auf 18 Stellen mit führenden Nullen |
| `letztes_bestelldatum` | DATE | AEDAT aus EKPO (letztes Änderungsdatum der Bestellposition) |
| `ematn` | TEXT | Externe/Hersteller-Materialnummer (aus EMATN-Spalte) |
| `importiert_am` | TIMESTAMPTZ | Zeitstempel des letzten Imports |

**MATNR-Normierung:** EKPO enthält die MATNR als Integer (z. B. `2`). Beim Import wird
sie auf das SAP-Standard-Format normiert: 18-stelliger String mit führenden Nullen
(`000000000000000002`). Damit ist ein direkter JOIN mit `mara.matnr` möglich.

**Re-Import:** Ein neuer Upload löscht die gesamte Tabelle (TRUNCATE) und befüllt sie neu.
Es gibt keinen inkrementellen Abgleich.

---

### 2. Neue API-Endpunkte

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| `POST` | `/api/admin/upload-ekpo-xlsx` | Admin | EKPO-XLSX hochladen; Blatt 2 parsen; `ekpo_bestellungen` neu befüllen |
| `GET` | `/api/materials/bestellhistorie` | User | Alle MARA-Materialien mit Bestellstatus; Filter-Parameter: `filter=alle\|bestellt\|nicht_bestellt` |
| `GET` | `/api/materials/bestellhistorie/export` | User | CSV-Export der gefilterten Liste |

**`GET /api/materials/bestellhistorie` — Rückgabe je Datensatz:**

```json
{
  "matnr": "000000000000000002",
  "maktx": "Spironolacton ratiopharm 50 mg",
  "maktg": "SPIRONOLACTON RATIOPHARM 50 MG",
  "mtart": "ZHAN",
  "matkl": "C03CA",
  "letztes_bestelldatum": "2026-04-24",
  "bestellt": true
}
```

**`GET /api/materials/bestellhistorie/export` — CSV-Spalten:**

```
MATNR, MAKTX, MAKTG, MTART, MATKL, LETZTES_BESTELLDATUM
```

---

### 3. Neuer UI-Tab "Bestellhistorie"

**Platzierung:** Materialien → `[ Exakt | Ähnlich | Suche | Regeln | Bestellhistorie ]`

**Inhalt der Ansicht:**

- **Statistik-Leiste** (immer sichtbar):
  - Gesamt-Materialien in MARA
  - davon bestellt (seit 2020)
  - davon **nicht bestellt** (seit 2020) — hervorgehoben

- **Filter-Toggle:**  `Alle` | `Bestellt` | `Nicht bestellt`  
  Standard-Auswahl beim Öffnen: **Nicht bestellt**

- **Tabelle** mit den Spalten:
  | Spalte | Beschreibung |
  |---|---|
  | MATNR | Materialnummer (rechtsbündig, führende Nullen angezeigt) |
  | MAKTX | Kurzbezeichnung |
  | MTART | Materialart |
  | MATKL | Materialklasse |
  | Letztes Bestelldatum | Datum aus EKPO (leer = nie bestellt seit 2020) |
  | Status | Badge: „Bestellt" (grün) / „Nicht bestellt" (grau) |

- **Export-Button:** CSV-Download der aktuell gefilterten Liste  
  Dateiname: `nicht_bestellt.csv` / `bestellt.csv` / `alle_materialien.csv`

- **Admin:** Upload-Button „EKPO-Daten aktualisieren" — öffnet Datei-Upload für neue EKPO-XLSX

---

### 4. Admin-Import (Upload-Modal oder bestehender Material-Import-Dialog)

Der Upload erfolgt über das bestehende `MaterialImportModal` (erweiterbar) oder als
eigener Dialog im Bestellhistorie-Tab.

**Verhalten beim Upload:**
1. Datei wird an `POST /api/admin/upload-ekpo-xlsx` gesendet
2. Backend liest Blatt 2 ("nur nach Artikelnummern")
3. Normiert MATNR auf 18 Stellen
4. TRUNCATE + Bulk-INSERT in `ekpo_bestellungen`
5. Rückgabe: `{ "imported": 15562 }`
6. UI zeigt Bestätigung und lädt Tabelle neu

---

## Implementierungsplan

### Schritt 1 — Datenbank (in Supabase SQL-Editor)

```sql
CREATE TABLE IF NOT EXISTS ekpo_bestellungen (
    matnr              TEXT PRIMARY KEY,
    letztes_bestelldatum DATE,
    ematn              TEXT,
    importiert_am      TIMESTAMPTZ DEFAULT now()
);
```

### Schritt 2 — Backend (`backend/main.py`)

1. `POST /api/admin/upload-ekpo-xlsx`
   - XLSX einlesen (openpyxl, Blatt 2 per Name)
   - MATNR: Integer → `str(v).zfill(18)`
   - AEDAT: datetime → date
   - EMATN: Integer → `str(v).zfill(18)` (falls vorhanden)
   - TRUNCATE + Batch-Upsert in `ekpo_bestellungen`

2. `GET /api/materials/bestellhistorie?filter=nicht_bestellt`
   - LEFT JOIN `mara` mit `ekpo_bestellungen` über `matnr`
   - `bestellt = (ekpo_bestellungen.matnr IS NOT NULL)`
   - Filter anwenden, Daten zurückgeben

3. `GET /api/materials/bestellhistorie/export?filter=nicht_bestellt`
   - Gleiche Logik, Rückgabe als CSV (StreamingResponse)

### Schritt 3 — Frontend

1. `MaterialBestellhistorieView.jsx` — neue Komponente
2. `App.jsx` — Tab "Bestellhistorie" einbinden, State/Loader ergänzen
3. `MaterialImportModal.jsx` — EKPO-Upload-Option ergänzen (oder eigener Mini-Dialog im Tab)

### Schritt 4 — Test

- Lokaler Import der `EKPO_ab_01.01.2020.xlsx`
- Prüfen: Anzahl importierter Datensätze = 15.562
- Prüfen: MATNR-Match mit MARA (wie viele treffen zu?)
- Filter "Nicht bestellt" → Export → Spalten und Encoding prüfen

---

## Offene Punkte / Hinweise

- **AEDAT ≠ Bestelldatum:** AEDAT in EKPO ist das *Änderungsdatum* der Bestellposition,
  nicht das ursprüngliche Bestelldatum (das wäre BEDAT in EKKO). Für die Frage
  "wurde nach 2020 bestellt?" ist das ausreichend, aber im UI als Hinweis kennzeichnen.

- **Freitext-Positionen:** 246.810 EKPO-Positionen haben keine MATNR (Einmalartikel).
  Diese tauchen in der Auswertung nicht auf — das ist korrekt, da sie kein MARA-Pendant haben.

- **Löschkennzeichen:** 2.071 EKPO-Positionen mit LOEKZ=L/S sind in Blatt 2
  möglicherweise noch enthalten. Falls relevant, müsste Blatt 2 neu gezogen werden
  mit LOEKZ-Filter.

- **Blatt 1 vs. Blatt 2:** Blatt 1 ("EKPO_ab_01.01.20 ohne doppelte") der gesendeten
  Datei ist **nicht** dedupliziert — es enthält alle 272.372 Rohdaten.
  Nur Blatt 2 ist auswertungsbereit.
