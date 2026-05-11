-- Tabelle für EKPO-Bestellhistorie (Blatt 2: "nur nach Artikelnummern")
-- Einmalig im Supabase SQL-Editor ausführen

CREATE TABLE IF NOT EXISTS ekpo_bestellungen (
    matnr                TEXT PRIMARY KEY,       -- 18-stellig, führende Nullen (z. B. 000000000000000002)
    letztes_bestelldatum DATE,                   -- AEDAT aus EKPO
    ematn                TEXT,                   -- Externe/Hersteller-Materialnummer
    importiert_am        TIMESTAMPTZ DEFAULT now()
);
