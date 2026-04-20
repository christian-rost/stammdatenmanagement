# Stammdaten-Bereinigung — Ausführliche Anwender-Dokumentation

**Produkt:** XQT5 Stammdatenmanagement — Dubletten-Bereinigung
**Version:** 1.0 | Stand: März 2026

---

## Inhaltsverzeichnis

1. [Überblick](#1-überblick)
2. [Anmeldung & Registrierung](#2-anmeldung--registrierung)
3. [Benutzeroberfläche](#3-benutzeroberfläche)
4. [Tab: Exakt — Exakte Dubletten](#4-tab-exakt--exakte-dubletten)
5. [Tab: Ähnlich — Fuzzy-Matching](#5-tab-ähnlich--fuzzy-matching)
6. [Tab: Suche](#6-tab-suche)
7. [Tab: Regeln — KI-gestützter Regel-Assistent](#7-tab-regeln--ki-gestützter-regel-assistent)
8. [Daten importieren (Admin)](#8-daten-importieren-admin)
9. [CSV-Export](#9-csv-export)
10. [Statistiken & Fortschritt](#10-statistiken--fortschritt)
11. [Glossar](#11-glossar)

---

## 1. Überblick

### Was macht die Anwendung?

Das **Stammdaten-Bereinigungssystem** unterstützt Sie dabei, doppelte Einträge im SAP-Lieferantenstamm (Tabelle LFA1) zu identifizieren, zu bewerten und zur Bereinigung vorzumerken — ohne direkten SAP-Zugriff.

Dubletten entstehen in SAP durch manuelle Mehrfacherfassung, Migrationen oder fehlende Datenprüfungen. Sie verursachen:
- Fehler bei der Kreditorenbuchhaltung
- Doppelte Bestellungen und Zahlungen
- Inkonsistente Stammdaten in Auswertungen

Dieses System bietet einen strukturierten, revisionssicheren Workflow: Alle Entscheidungen werden mit Benutzer, Zeitstempel und optionaler Begründung protokolliert.

### Abgrenzung

Die Anwendung **markiert** Datensätze zur Bereinigung — die eigentliche Löschung in SAP erfolgt separat durch den SAP-Administrator auf Basis des CSV-Exports.

### Datengrundlage

Aktuell werden **5.433 Lieferantendatensätze** aus LFA1 verwaltet. Der Import weiterer SAP-Objekte (Materialien MARA, Debitoren KNA1) ist geplant.

---

## 2. Anmeldung & Registrierung

### Login

1. Öffnen Sie die Anwendung im Browser.
2. Geben Sie Benutzernamen und Passwort ein.
3. Klicken Sie auf **„Anmelden"**.

Bei Fehleingaben erscheint eine rote Fehlermeldung.

### Registrierung (neues Konto anlegen)

1. Klicken Sie oben auf den Tab **„Registrieren"**.
2. Wählen Sie einen **Benutzernamen** (3–32 Zeichen, keine Sonderzeichen).
3. Geben Sie eine **E-Mail-Adresse** ein (für die Anzeige; kein Passwort-Reset).
4. Vergeben Sie ein **Passwort** (mind. 8 Zeichen).
5. Wiederholen Sie das Passwort zur Bestätigung.
6. Klicken Sie auf **„Registrieren"**.

> **Hinweis:** Benutzernamen müssen eindeutig sein. Falls der gewählte Name bereits vergeben ist, erscheint eine Fehlermeldung.

### Abmelden

Klicken Sie jederzeit auf **„Abmelden"** (oben rechts im Header). Ihre Session wird beendet und Sie werden zur Anmeldemaske weitergeleitet.

---

## 3. Benutzeroberfläche

### Header

```
┌────────────────────────────────────────────────────────────────────┐
│ Stammdaten — Dubletten-Bereinigung  [Daten importieren*]  [max]    │
│                                     [CSV Export]  [Abmelden]       │
└────────────────────────────────────────────────────────────────────┘
* nur für Administratoren sichtbar
```

| Element | Beschreibung |
|---|---|
| Titel | Anwendungsname |
| **Daten importieren** | XLSX-Datei mit LFA1-Daten hochladen *(nur Admin)* |
| **CSV Export** | Alle Entscheidungen als CSV herunterladen |
| Benutzername | Zeigt den aktuell angemeldeten Benutzer |
| **Abmelden** | Session beenden |

### Tabs

```
[ Exakt ] [ Ähnlich ] [ Suche ] [ Regeln ]
```

Klicken Sie auf einen Tab, um zwischen den vier Arbeitsbereichen zu wechseln. Der aktive Tab ist farblich hervorgehoben.

### Zwei-Panel-Layout

Die meisten Tabs sind in zwei Bereiche aufgeteilt:

| Bereich | Inhalt |
|---|---|
| **Linkes Panel** | Liste aller Gruppen/Paare mit Filter und Statistik |
| **Rechtes Panel** | Detailansicht des ausgewählten Eintrags und Entscheidungsformular |

---

## 4. Tab: Exakt — Exakte Dubletten

Dieser Tab ist der Hauptarbeitsbereich. Er zeigt alle Lieferanten, die identischen **Namen (NAME1)** und identischen **Ort (ORT01)** haben.

### 4.1 Linkes Panel — Gruppenliste

#### Statistikleiste

Am oberen Rand des linken Panels wird der aktuelle Bearbeitungsstand angezeigt:

```
Gesamt: 142 | Offen: 89 | Bearbeitet: 38 | Ignoriert: 15
```

#### Filter

| Filter | Zeigt |
|---|---|
| **Alle** | Alle Dublettengruppen |
| **Offen** | Noch nicht bearbeitete Gruppen |
| **Bearbeitet** | Gruppen mit gespeicherter Entscheidung |
| **Ignoriert** | Als "alle behalten" markierte Gruppen |

#### Gruppeneinträge

Jeder Eintrag zeigt:
- **Name** und **Ort** der Gruppe
- **Anzahl** der enthaltenen Datensätze (z. B. `3×`)
- **Statusfarbe** (grau = offen, grün = bearbeitet, gelb = ignoriert)

Klicken Sie auf eine Gruppe, um sie im rechten Panel zu öffnen.

### 4.2 Rechtes Panel — Detailansicht & Entscheidung

#### Datensatztabelle

Die Tabelle zeigt alle Datensätze der gewählten Gruppe mit folgenden Feldern:

| Spalte | SAP-Feld | Bedeutung |
|---|---|---|
| LIFNR | LIFNR | Lieferantennummer |
| Name | NAME1 | Hauptname |
| Zusatz | NAME2 | Namenszusatz |
| Straße | STRAS | Straße und Hausnummer |
| PLZ | PSTLZ | Postleitzahl |
| Ort | ORT01 | Ort |
| Land | LAND1 | Länderkennzeichen |
| Telefon | TELF1 | Telefonnummer |
| USt-IdNr | STCEG | Umsatzsteuer-ID |
| Angelegt am | ERDAT | Anlagedatum |
| Löschkennz. | LOEVM | Löschkennzeichen |

#### Entscheidung treffen

**Option A — Einen Datensatz behalten:**

1. Wählen Sie per **Radiobutton** in der Spalte „Behalten" den Datensatz, der in SAP erhalten bleiben soll.
2. Die übrigen Datensätze erscheinen automatisch in der Liste „Zur Löschung vorgemerkt".
3. Tragen Sie optional eine **Begründung** in das Notizfeld ein.
4. Klicken Sie auf **„Entscheidung speichern"**.

**Option B — Gruppe ignorieren (alle behalten):**

Wenn alle Datensätze der Gruppe berechtigt sind (z. B. verschiedene Standorte desselben Unternehmens), klicken Sie auf **„Ignorieren"**. Die Gruppe wird als *ignoriert* markiert, keine Datensätze werden zur Löschung vorgemerkt.

#### Statusmeldung

Nach dem Speichern erscheint eine grüne Erfolgsmeldung. Die Gruppe verschwindet aus der „Offen"-Ansicht und der Zähler in der Statistikleiste wird aktualisiert.

---

## 5. Tab: Ähnlich — Fuzzy-Matching

Dieser Tab findet Lieferantenpaare, deren Namen sich **ähneln**, aber nicht exakt übereinstimmen. Typische Fälle: Tippfehler, abgekürzte Namen, Schreibvarianten.

> **Beispiel:** „Müller GmbH" vs. „Mueller GmbH" vs. „Müller GmbH & Co."

### 5.1 Ähnlichkeitsschwellenwert

Am oberen Rand des linken Panels befindet sich ein **Schieberegler** (50 % – 95 %):

- **Hoher Wert (z. B. 90 %):** Nur sehr ähnliche Paare — wenige, aber treffsichere Ergebnisse
- **Niedriger Wert (z. B. 60 %):** Mehr Paare — breiteres Netz, mehr manuelle Prüfung nötig
- **Standardwert: 75 %**

Nach dem Verschieben des Reglers werden die Ergebnisse automatisch neu geladen.

### 5.2 Ähnlichkeitsbadges

Jedes Paar in der Liste trägt ein farbiges Badge mit dem Ähnlichkeitswert:

| Farbe | Bereich | Bedeutung |
|---|---|---|
| Rot | ≥ 85 % | Sehr wahrscheinlich Dublette |
| Orange | 70–85 % | Wahrscheinlich Dublette |
| Gelb | < 70 % | Möglicherweise Dublette, genau prüfen |

### 5.3 Feldvergleich im rechten Panel

Das rechte Panel zeigt beide Datensätze nebeneinander. Felder, die voneinander **abweichen**, sind hervorgehoben. Dies erleichtert die schnelle Bewertung.

Ein horizontaler **Ähnlichkeitsbalken** mit Prozentzahl gibt die rechnerische Übereinstimmung an.

### 5.4 Entscheidung

Identisch wie im Exakt-Tab: Radiobutton für den zu behaltenden Datensatz wählen → optional Notiz → **„Entscheidung speichern"** oder **„Ignorieren"**.

---

## 6. Tab: Suche

Die Suche ermöglicht gezielte Abfragen über alle Lieferantendatensätze.

### Suchfelder

Die Volltextsuche durchsucht gleichzeitig folgende Felder:
LIFNR, NAME1–4, ORT01–02, STRAS, PSTLZ, LAND1, STCEG (USt-IdNr), TELF1, ERNAM, SORTL, MCOD1–3

### Bedienung

1. Geben Sie einen Suchbegriff in das Eingabefeld ein (mind. 1 Zeichen).
2. Drücken Sie **Enter** oder klicken Sie auf **„Suchen"**.
3. Die Trefferliste erscheint im linken Panel (max. 500 Ergebnisse).
4. Klicken Sie auf einen Treffer.

### Rechtes Panel — Datensatzdetails

Das rechte Panel zeigt:

1. **Alle Felder** des ausgewählten Datensatzes (nur befüllte Felder werden angezeigt).
2. **Dubletten-Schnellprüfung:** Die Anwendung prüft automatisch, ob zu diesem Datensatz exakte Dubletten existieren (gleicher NAME1 + ORT01).
   - Werden Dubletten gefunden, erscheinen diese in einer Liste.
   - Mit **„Zur Dubletten-Bereinigung →"** springen Sie direkt zur entsprechenden Gruppe im Exakt-Tab.

---

## 7. Tab: Regeln — KI-gestützter Regel-Assistent

Der Regel-Assistent ermöglicht die **Massenbereinigung** auf Basis selbst definierter Geschäftsregeln. Sie beschreiben eine Regel in natürlicher Sprache — die KI generiert daraus automatisch eine SQL-Abfrage.

Der Tab besteht aus zwei Untertabs: **„Neue Regel"** und **„Gespeicherte Regeln"**.

### 7.1 Neue Regel erstellen und ausführen

#### Schritt 1 — Regel beschreiben

Geben Sie Ihre Regel im Texteingabefeld ein. Beschreiben Sie, **welche Lieferanten** Sie identifizieren möchten und **was** damit geschehen soll.

**Beispiele für Regelbeschreibungen:**

```
Lieferanten mit gleicher Adresse aber unterschiedlicher USt-IdNr sollen alle behalten werden.

Lieferanten ohne Telefonnummer und ohne USt-IdNr, die doppelt vorkommen, sollen geprüft werden.

Alle Dubletten bei denen ein Datensatz ein Löschkennzeichen hat, sollen ignoriert werden.

Lieferanten aus Deutschland (LAND1 = 'DE') mit identischem NAME1 und ORT01 sollen bereinigt werden.
```

#### Schritt 2 — Regel ausführen

Klicken Sie auf **„Regel ausführen"**. Die Anwendung:

1. Sendet Ihre Beschreibung an die KI (Claude AI)
2. Generiert eine SQL-Abfrage für die LFA1-Tabelle
3. Führt die Abfrage aus
4. Zeigt die Ergebnisse an

> **Transparenz:** Unterhalb des Regelfelds wird aufgeklappt angezeigt, welche SQL-Abfrage die KI erzeugt hat. Sie können diese bei Bedarf manuell anpassen, bevor Sie sie ausführen.

#### Schritt 3 — Ergebnisse prüfen

Im linken Panel erscheinen alle gefundenen Datensatzgruppen mit Statistik:
- **Gefundene Gruppen insgesamt**
- **Offene Gruppen** (noch nicht entschieden)
- **Bereits bereinigte Gruppen**

Klicken Sie auf eine Gruppe, um die Datensätze im rechten Panel zu sehen.

#### Schritt 4 — Aktion wählen

Wählen Sie im Dropdown, was mit den gefundenen Gruppen geschehen soll:

| Aktion | Bedeutung |
|---|---|
| **Ignorieren** | Alle Gruppen werden als "ignoriert" markiert — alle Datensätze bleiben |
| **Prüfen** | Gruppen werden zur manuellen Überprüfung markiert |

#### Schritt 5 — Auf alle Gruppen anwenden

Klicken Sie auf **„Auf X Gruppen anwenden"**. Die gewählte Aktion wird auf alle gefundenen offenen Gruppen angewendet. Eine Erfolgsmeldung bestätigt die Anzahl der bearbeiteten Gruppen.

### 7.2 Regel speichern

Nach der Ausführung können Sie die Regel für spätere Wiederverwendung speichern:

1. Geben Sie einen **Namen** für die Regel ein (z. B. „Löschkennzeichen-Dubletten")
2. Klicken Sie auf **„Regel speichern"**

Die Regel wird mit folgenden Informationen gespeichert:
- Regeltext (Ihre Beschreibung)
- Generiertes SQL
- Erklärung der KI
- Vorgeschlagene Aktion
- Erstellt von, Erstellungszeitpunkt

### 7.3 Gespeicherte Regeln verwalten

Im Untertab **„Gespeicherte Regeln"** sehen Sie alle bisher angelegten Regelvorlagen.

Jede Regelkarte zeigt:
- **Name** der Regel
- **Aktions-Badge** (ignorieren / prüfen)
- **Erklärung** (was die Regel bewirkt)
- **Erstellt von** und Erstellungsdatum
- **Letzte Ausführung** mit Ergebnisstatistik

**Aktionen pro Regel:**

| Schaltfläche | Funktion |
|---|---|
| **Ausführen** | Lädt die Regel in „Neue Regel" und führt sie sofort aus |
| **Löschen** | Entfernt die Regelvorlage dauerhaft |

Das Badge zeigt auf einen Blick den aktuellen Bereinigungsstand der letzten Ausführung:
- Grün: Alle Gruppen bereits bereinigt
- Orange: Noch X offene Gruppen vorhanden

### 7.4 Hinweise zur Regel-KI

- Die KI generiert ausschließlich **SELECT-Abfragen** — keine Änderungen an den Daten
- Abfragen beziehen sich nur auf die Tabelle **LFA1** (keine Joins zu anderen Tabellen)
- Ergebnisse sind auf **1.000 Gruppen** begrenzt
- Bei unklaren Beschreibungen schlägt die KI eine Interpretation vor — prüfen Sie die SQL-Erklärung
- Die generierte SQL ist für Sie immer einsehbar und kann manuell angepasst werden

---

## 8. Daten importieren (Admin)

> Dieser Bereich ist **nur für Administratoren** zugänglich.

### Voraussetzung

Eine XLSX-Datei im Format des SAP LFA1-Exports (`LFA1_komplett.XLSX`). Die Datei muss die Felder LIFNR, NAME1 etc. als Spaltenköpfe in der ersten Zeile enthalten.

### Ablauf

1. Klicken Sie im Header auf **„Daten importieren"**.
2. Das Import-Dialogfeld öffnet sich.
3. Klicken Sie auf **„Datei auswählen"** und wählen Sie die XLSX-Datei.
4. Der Import startet automatisch nach der Dateiauswahl.
5. Ein **Fortschrittsbalken** zeigt den Upload-Status: `X / Y Datensätze`
6. Nach Abschluss erscheint eine Erfolgsmeldung mit der Anzahl importierter Datensätze.

### Verhalten beim Import

- **Neue Datensätze** werden eingefügt
- **Vorhandene Datensätze** (gleiche LIFNR) werden aktualisiert (Upsert)
- Die Datei wird in **Paketen von 500 Datensätzen** übertragen

> **Wichtig:** Der Import überschreibt vorhandene Datensätze mit gleicher LIFNR. Bereits getroffene Bereinigungsentscheidungen bleiben davon unberührt.

---

## 9. CSV-Export

Klicken Sie im Header auf **„CSV Export"**, um eine CSV-Datei aller getroffenen Entscheidungen herunterzuladen.

### Dateiinhalt

Die Datei `dubletten_entscheidungen.csv` enthält folgende Spalten:

| Spalte | Inhalt |
|---|---|
| `name1` | Lieferantenname der Gruppe |
| `ort01` | Ort der Gruppe |
| `status` | bearbeitet / ignoriert |
| `lifnr_behalten` | LIFNR des zu behaltenden Datensatzes |
| `lifnr_loeschen` | LIFNRs der zu löschenden Datensätze (durch `\|` getrennt) |
| `notiz` | Optionale Begründung |
| `bearbeitet_von` | Benutzername |
| `bearbeitet_am` | Zeitstempel (ISO 8601) |

### Verwendung

Diese Datei übergeben Sie dem SAP-Administrator zur Durchführung der eigentlichen Bereinigung in SAP (LIFNR-Zusammenführung oder Löschung).

---

## 10. Statistiken & Fortschritt

### Statusleiste im linken Panel (Exakt & Ähnlich)

Die Leiste zeigt den aktuellen Bearbeitungsstand:

```
Gesamt: 142  |  Offen: 89  |  Bearbeitet: 38  |  Ignoriert: 15
```

| Wert | Bedeutung |
|---|---|
| **Gesamt** | Alle erkannten Dublettengruppen |
| **Offen** | Noch nicht bearbeitete Gruppen |
| **Bearbeitet** | Gruppen mit gespeicherter Entscheidung (ein Datensatz wird behalten) |
| **Ignoriert** | Gruppen, bei denen alle Datensätze behalten werden |

### Fortschrittsbewertung

```
Fertigstellungsgrad = (Bearbeitet + Ignoriert) / Gesamt × 100 %
```

Die Bereinigung ist vollständig, wenn **Offen = 0**.

---

## 11. Glossar

| Begriff | Erklärung |
|---|---|
| **LFA1** | SAP-Tabelle für Lieferantenstammdaten (Kreditoren) |
| **LIFNR** | Lieferantennummer — eindeutiger Schlüssel in SAP |
| **NAME1** | Erster Namensbestandteil des Lieferanten |
| **ORT01** | Ortsangabe des Lieferanten |
| **STCEG** | Umsatzsteuer-Identifikationsnummer |
| **LOEVM** | Löschkennzeichen — markiert einen Datensatz zur Löschung in SAP |
| **Dublette** | Mehrfach vorhandener Datensatz, der nur einmal existieren sollte |
| **Exakte Dublette** | Datensätze mit identischem NAME1 und ORT01 |
| **Fuzzy-Dublette** | Datensätze mit ähnlichem (aber nicht identischem) Namen |
| **Ähnlichkeitsschwellenwert** | Mindestwert für die Übereinstimmung bei der Fuzzy-Suche (0–100 %) |
| **Trigram-Matching** | Technik zur Berechnung von Textähnlichkeit auf Buchstabenebene (PostgreSQL pg_trgm) |
| **Bearbeitet** | Status: Entscheidung gespeichert, ein Datensatz zur Behaltung vorgesehen |
| **Ignoriert** | Status: Alle Datensätze der Gruppe werden in SAP behalten |
| **Offen** | Status: Gruppe wurde noch nicht entschieden |
| **Upsert** | Datenbankoperation: Einfügen wenn neu, Aktualisieren wenn vorhanden |
| **JWT** | JSON Web Token — Technologie für sichere Benutzer-Sessions |
| **KI / Claude AI** | Künstliche Intelligenz (Anthropic Claude) für die SQL-Generierung im Regel-Assistenten |

---

*Dieses Dokument bezieht sich auf die aktuelle Version des XQT5 Stammdaten-Bereinigungssystems.*
*Bei Fragen oder Problemen wenden Sie sich an Ihren Systemadministrator.*
