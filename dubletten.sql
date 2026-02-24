-- ============================================================
-- DUBLETTEN-ANALYSE LFA1
-- Supabase / PostgreSQL
-- ============================================================


-- ------------------------------------------------------------
-- STUFE 1: Exakte Dubletten auf NAME1 + ORT01
-- ------------------------------------------------------------
SELECT
    name1,
    ort01,
    COUNT(*)            AS anzahl,
    array_agg(lifnr)    AS lifnr_liste
FROM lfa1
WHERE name1 IS NOT NULL AND name1 <> ''
GROUP BY name1, ort01
HAVING COUNT(*) > 1
ORDER BY anzahl DESC, name1;


-- ------------------------------------------------------------
-- STUFE 2: Gleicher NAME1, verschiedene Städte
-- (selbe Firma, ggf. mehrere Standorte oder Dopplungen)
-- ------------------------------------------------------------
SELECT
    name1,
    COUNT(*)            AS anzahl,
    array_agg(lifnr)    AS lifnr_liste,
    array_agg(ort01)    AS städte
FROM lfa1
WHERE name1 IS NOT NULL AND name1 <> ''
GROUP BY name1
HAVING COUNT(*) > 1
ORDER BY anzahl DESC, name1;


-- ------------------------------------------------------------
-- STUFE 3: Normalisiert (Leerzeichen + Groß/Kleinschreibung)
-- Findet z.B. "Müller GmbH" vs "MÜLLER GMBH" vs " Müller GmbH"
-- ------------------------------------------------------------
SELECT
    lower(trim(name1))  AS name1_norm,
    COUNT(*)            AS anzahl,
    array_agg(lifnr)    AS lifnr_liste,
    array_agg(name1)    AS name1_varianten
FROM lfa1
WHERE name1 IS NOT NULL AND name1 <> ''
GROUP BY lower(trim(name1))
HAVING COUNT(*) > 1
ORDER BY anzahl DESC, name1_norm;


-- ------------------------------------------------------------
-- STUFE 4: NAME1 + NAME2 kombiniert (vollständiger Firmenname)
-- z.B. "AVS Autovermietung" | "Schulz GmbH und Co.KG"
-- ------------------------------------------------------------
SELECT
    trim(name1 || ' ' || coalesce(name2, '')) AS vollname,
    COUNT(*)                                   AS anzahl,
    array_agg(lifnr)                           AS lifnr_liste,
    array_agg(ort01)                           AS städte
FROM lfa1
WHERE name1 IS NOT NULL AND name1 <> ''
GROUP BY trim(name1 || ' ' || coalesce(name2, ''))
HAVING COUNT(*) > 1
ORDER BY anzahl DESC;


-- ------------------------------------------------------------
-- STUFE 5: Fuzzy-Matching mit Trigram-Ähnlichkeit
-- Erfordert: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Findet ähnliche Namen (Tippfehler, Abkürzungen)
-- Schwellwert 0.6 = 60% Ähnlichkeit (anpassbar)
-- ACHTUNG: Kann bei 5000+ Zeilen etwas dauern
-- ------------------------------------------------------------

-- Zuerst Extension aktivieren (einmalig):
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Dann Ähnlichkeitssuche:
SELECT
    a.lifnr        AS lifnr_a,
    a.name1        AS name1_a,
    a.ort01        AS ort01_a,
    b.lifnr        AS lifnr_b,
    b.name1        AS name1_b,
    b.ort01        AS ort01_b,
    round(similarity(a.name1, b.name1)::numeric, 2) AS ähnlichkeit
FROM lfa1 a
JOIN lfa1 b
    ON a.lifnr < b.lifnr
    AND similarity(a.name1, b.name1) > 0.6
ORDER BY ähnlichkeit DESC, a.name1;
