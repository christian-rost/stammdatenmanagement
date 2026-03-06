-- Migration: Regel-Vorlagen Tabelle
-- Einmalig im Supabase SQL-Editor ausführen

CREATE TABLE IF NOT EXISTS regel_vorlagen (
    id                      BIGSERIAL PRIMARY KEY,
    name                    TEXT NOT NULL,
    regel                   TEXT NOT NULL,
    sql_text                TEXT NOT NULL,
    erklaerung              TEXT DEFAULT '',
    aktion                  TEXT NOT NULL DEFAULT 'ignorieren',
    aktion_erklaerung       TEXT DEFAULT '',
    erstellt_von            TEXT,
    erstellt_am             TIMESTAMPTZ DEFAULT NOW(),
    letzte_ausfuehrung      TIMESTAMPTZ,
    letztes_ergebnis_anzahl INTEGER,  -- Gruppen gesamt beim letzten Lauf
    letztes_ergebnis_offen  INTEGER   -- Gruppen noch offen beim letzten Lauf
);
