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

-- 3. Fuzzy-Matching: Extension + Index + Funktion

-- Extension aktivieren (einmalig)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GiST-Index für schnelle Ähnlichkeitssuche auf name1
CREATE INDEX IF NOT EXISTS lfa1_name1_trgm_idx ON lfa1 USING GiST (name1 gist_trgm_ops);

-- Entscheidungstabelle für Fuzzy-Paare
CREATE TABLE IF NOT EXISTS fuzzy_entscheidungen (
    id                SERIAL PRIMARY KEY,
    lifnr_a           varchar(10)  NOT NULL,
    lifnr_b           varchar(10)  NOT NULL,
    lifnr_behalten    varchar(10),
    notiz             TEXT,
    bearbeitet_von    varchar(100),
    bearbeitet_am     TIMESTAMP    DEFAULT NOW(),
    status            varchar(20)  NOT NULL DEFAULT 'offen',
    UNIQUE (lifnr_a, lifnr_b)
);

-- Funktion: Ähnliche Paare via Trigram-Ähnlichkeit
--   Nutzt set_limit() + %-Operator → GiST-Index wird verwendet
--   threshold: Schwellwert 0.0–1.0 (Standard 0.6)
--   Exakte Dubletten (gleicher Name + Stadt) werden ausgeschlossen
CREATE OR REPLACE FUNCTION get_fuzzy_duplicates(threshold float DEFAULT 0.6)
RETURNS TABLE (
    lifnr_a      varchar,
    name1_a      varchar,
    ort01_a      varchar,
    lifnr_b      varchar,
    name1_b      varchar,
    ort01_b      varchar,
    aehnlichkeit float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Setzt den Schwellwert für den %-Operator, der den GiST-Index nutzt
    PERFORM set_limit(threshold);

    RETURN QUERY
    SELECT
        a.lifnr,
        a.name1,
        COALESCE(a.ort01, '')            AS ort01_a,
        b.lifnr,
        b.name1,
        COALESCE(b.ort01, '')            AS ort01_b,
        similarity(a.name1, b.name1)::float
    FROM lfa1 a
    JOIN lfa1 b
        ON a.lifnr < b.lifnr
        AND a.name1 % b.name1          -- nutzt GiST-Index
        AND NOT (
            a.name1 = b.name1
            AND COALESCE(a.ort01, '') = COALESCE(b.ort01, '')
        )
    ORDER BY similarity(a.name1, b.name1) DESC, a.name1
    LIMIT 300;
END;
$$;
