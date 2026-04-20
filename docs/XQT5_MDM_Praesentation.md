# XQT5 MDM
## Stammdatenmanagement – Intelligente Dubletten­bereinigung für SAP-Stammdaten

Eine Plattform. Alle SAP-Stammdaten. Saubere Datenbasis.

---

# Ausgangslage & Ziel

- **Problem**: SAP-Stammdaten wachsen über Jahre – Dubletten entstehen durch manuelle Erfassung, Migrationen und fehlende Governance
- **Betroffen**: Lieferanten (LFA1), Materialien (MARA), Debitoren (KNA1) und weitere Stammdaten­objekte
- **Folge**: Fehlerhafte Auswertungen, doppelte Prozesse, inkonsistente Buchungen, mangelnde Datenqualität
- **Ziel**: Eine zentrale Web-Plattform zur strukturierten, nachvollziehbaren Bereinigung – ohne direkten SAP-Eingriff, für alle Stammdaten­bereiche

> **Aktueller Rollout-Stand:** Lieferantenstamm (LFA1) · 5.433 Datensätze bereits in Bereinigung
> **Nächste Ausbaustufen:** Materialstamm (MARA) · Debitorenstamm (KNA1) · weitere SAP-Objekte

---

# Funktionen im Überblick

**Exakte Dubletten­erkennung**
- Automatische Gruppierung nach konfigurierbaren Schlüsselfeldern (je Stammdatentyp anpassbar)
- Tabellarische Gegenüberstellung aller Datensätze einer Gruppe
- Entscheidung: welchen Eintrag behalten, welche löschen

**Ähnlichkeits­matching (Fuzzy)**
- Erkennung ähnlicher Einträge trotz abweichender Schreibweise (z. B. „Müller GmbH" vs. „Mueller GmbH")
- Konfigurierbarer Schwellenwert (50–95 % Ähnlichkeit)
- Visuelle Ähnlichkeits­anzeige pro Paar

**Workflow & Dokumentation**
- Status pro Gruppe: *Offen / Bearbeitet / Ignoriert*
- Freitext-Notizfeld und Benutzer-Protokollierung für jede Entscheidung
- Vollständiger CSV-Export aller Bereinigungsentscheidungen – SAP-Import-ready

---

# Highlights

**Eine Plattform – alle SAP-Stammdaten**
Modularer Aufbau: Neue Stammdaten­objekte (Material, Debitor, Kreditor, Kostenstelle …) werden als eigene Module ergänzt – Logik und Oberfläche bleiben identisch

**Intelligentes Matching**
Zwei Erkennungsverfahren kombiniert – exakt und fuzzy – für maximale Abdeckung auch bei historisch gewachsenen Daten­beständen

**Keine SAP-Abhängigkeit**
Läuft vollständig außerhalb von SAP auf Basis von Daten­exporten – kein SAP-Customizing, kein Systemeingriff erforderlich

**Mehrbenutzer-fähig & auditierbar**
JWT-Authentifizierung, alle Entscheidungen werden mit Benutzer & Zeitstempel protokolliert – revisionssicher

**Sofort einsatzbereit**
Web-basiert, keine Installation beim Anwender – Zugriff über Browser, geräteunabhängig

---

# Rahmenbedingungen & Roadmap

**Aktueller Stand – Lieferantenstamm (LFA1)**
- Vollständig implementiert und produktiv
- 5.433 Datensätze in aktiver Bereinigung

**Geplante Ausbaustufen**

| Modul | SAP-Tabelle | Status |
|---|---|---|
| Lieferantenstamm | LFA1 | ✅ Produktiv |
| Materialstamm | MARA / MAKT | 🔜 In Planung |
| Debitorenstamm | KNA1 | 🔜 In Planung |
| Weitere Objekte | individuell | 💬 Nach Bedarf |

**Technologie & Betrieb**
- Hosting: On-Premise oder Cloud (Coolify) – DSGVO-konform, kein externer Datenabfluss
- Backend: Python / FastAPI · Frontend: React 19 · Datenbank: PostgreSQL
- Corporate Design: XQT5 Farb- und Designsystem
