-- ============================================================
-- Stammdatenmanagement: Tabellen & Funktionen für Dubletten-Tool
-- In Supabase SQL-Editor ausführen
-- ============================================================

-- 1. Entscheidungstabelle für Dubletten-Bereinigung
CREATE TABLE IF NOT EXISTS dubletten_entscheidungen (
    id                SERIAL PRIMARY KEY,
    name1             varchar(35)  NOT NULL,
    ort01             varchar(35)  NOT NULL DEFAULT '',
    lifnr_behalten    varchar(10),
    lifnr_loeschen    TEXT[]       DEFAULT '{}',
    notiz             TEXT,
    bearbeitet_von    varchar(100),
    bearbeitet_am     TIMESTAMP    DEFAULT NOW(),
    status            varchar(20)  NOT NULL DEFAULT 'offen',
    UNIQUE (name1, ort01)
);

-- 2. Hilfsfunktion: Dubletten-Gruppen aggregieren
--    Wird vom Backend via supabase.rpc("get_duplicate_groups") aufgerufen
CREATE OR REPLACE FUNCTION get_duplicate_groups()
RETURNS TABLE (
    name1        varchar,
    ort01        varchar,
    anzahl       bigint,
    lifnr_liste  text[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        l.name1,
        COALESCE(l.ort01, '')   AS ort01,
        COUNT(*)                AS anzahl,
        array_agg(l.lifnr ORDER BY l.lifnr) AS lifnr_liste
    FROM lfa1 l
    WHERE l.name1 IS NOT NULL AND l.name1 <> ''
    GROUP BY l.name1, COALESCE(l.ort01, '')
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, l.name1;
$$;
