# Stammdaten-Bereinigung — Quickstart-Guide

> **In 5 Minuten startklar:** Dieser Guide zeigt Ihnen, wie Sie schnell Ihre ersten Dubletten bereinigen.

---

## 1. Anmelden

Rufen Sie die Anwendung im Browser auf und melden Sie sich mit Ihren Zugangsdaten an.

Falls Sie noch kein Konto haben, klicken Sie auf **„Registrieren"**, vergeben Sie einen Benutzernamen (3–32 Zeichen) und ein Passwort (mind. 8 Zeichen).

---

## 2. Oberfläche auf einen Blick

```
┌─────────────────────────────────────────────────────────────────┐
│  Stammdaten — Dubletten-Bereinigung          [User] [Export] [Ab]│
├──────────┬──────────┬──────────┬──────────────────────────────── │
│  Exakt   │  Ähnlich │  Suche   │  Regeln                         │
├──────────┴──────────┴──────────┴──────────────────────────────── │
│ Linkes Panel (Liste)    │ Rechtes Panel (Detail & Entscheidung)  │
└─────────────────────────────────────────────────────────────────┘
```

| Tab | Wofür |
|---|---|
| **Exakt** | Lieferanten mit identischem Name + Ort |
| **Ähnlich** | Lieferanten mit ähnlichem Namen (Tippfehler, Schreibvarianten) |
| **Suche** | Gezielt nach einzelnen Datensätzen suchen |
| **Regeln** | KI-gestützte Massenbereinigung per Beschreibung |

---

## 3. Erste Dublette bereinigen (Tab: Exakt)

**Schritt 1 — Gruppe auswählen**
Im linken Panel sehen Sie alle Gruppen von Datensätzen mit identischem Name und Ort. Klicken Sie auf eine Gruppe, um die enthaltenen Datensätze anzuzeigen.

**Schritt 2 — Datensätze vergleichen**
Im rechten Panel erscheint eine Tabelle mit allen Datensätzen der Gruppe. Vergleichen Sie die Felder (LIFNR, Name, Adresse, Steuernummer, Telefon …).

**Schritt 3 — Entscheidung treffen**

- **Einen Datensatz behalten:** Wählen Sie per Radiobutton den Datensatz, der erhalten bleiben soll. Alle anderen werden zur Löschung vorgemerkt.
- **Alle behalten (Gruppe ignorieren):** Klicken Sie auf **„Ignorieren"**, wenn alle Datensätze berechtigt sind.

**Schritt 4 — Speichern**
Klicken Sie auf **„Entscheidung speichern"**. Die Gruppe wechselt auf Status *Bearbeitet* und Sie können zur nächsten Gruppe springen.

> **Tipp:** Mit den Filterbuttons **Offen / Bearbeitet / Ignoriert** blenden Sie bereits bearbeitete Gruppen aus und behalten die Übersicht.

---

## 4. Ähnliche Dubletten prüfen (Tab: Ähnlich)

1. Wechseln Sie in den Tab **„Ähnlich"**.
2. Passen Sie bei Bedarf den **Schwellenwert-Regler** an (Standard: 75 %). Niedrigere Werte zeigen mehr, höhere Werte zeigen nur sehr ähnliche Paare.
3. Klicken Sie auf ein Paar — das rechte Panel zeigt einen direkten Feldvergleich.
4. Farbliche Markierungen zeigen abweichende Felder.
5. Entscheiden Sie wie unter Schritt 3–4 oben.

---

## 5. Datensätze suchen (Tab: Suche)

Geben Sie einen Suchbegriff ein (Name, LIFNR, Ort, Steuernummer …). Klicken Sie auf einen Treffer — das rechte Panel zeigt alle Felder des Datensatzes und prüft automatisch, ob dazu exakte Dubletten existieren.

Mit **„Zur Dubletten-Bereinigung →"** springen Sie direkt zur entsprechenden Gruppe im Exakt-Tab.

---

## 6. Ergebnisse exportieren

Klicken Sie im Header auf **„CSV Export"** — die Datei enthält alle bisher getroffenen Entscheidungen (welcher Datensatz bleibt, welche werden gelöscht, Bearbeiter, Zeitstempel).

---

## 7. Nächste Schritte

- Alle offenen Gruppen abarbeiten → Statusleiste oben im linken Panel zeigt den Fortschritt
- Für Massenbereinigung nach Regeln → Tab **„Regeln"** (siehe ausführliche Dokumentation)
- Abschließenden CSV-Export für die SAP-Bereinigung herunterladen
