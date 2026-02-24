-- ============================================================
-- DUBLETTEN DETAIL-ANSICHT
-- Zeigt alle Felder der Dubletten nebeneinander
-- ============================================================


-- ------------------------------------------------------------
-- 1. Alle Dubletten-Datensätze vollständig anzeigen
--    (sortiert nach Name + Stadt, Duplikate stehen zusammen)
-- ------------------------------------------------------------
SELECT
    lifnr,
    name1,
    name2,
    name3,
    ort01,
    land1,
    -- Markierung wie oft dieser Name+Ort vorkommt
    COUNT(*) OVER (PARTITION BY name1, ort01) AS gruppe_anzahl
FROM lfa1
WHERE (name1, ort01) IN (
    SELECT name1, ort01
    FROM lfa1
    WHERE name1 IS NOT NULL AND name1 <> ''
    GROUP BY name1, ort01
    HAVING COUNT(*) > 1
)
ORDER BY name1, ort01, lifnr;


-- ------------------------------------------------------------
-- 2. Dubletten-Übersicht als flache Tabelle (für Export/Excel)
--    Eine Zeile pro Dubletten-Gruppe mit allen LIFNRs
-- ------------------------------------------------------------
SELECT
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, name1) AS gruppe_nr,
    name1,
    ort01,
    COUNT(*)                     AS anzahl,
    MIN(lifnr)                   AS älteste_lifnr,
    string_agg(lifnr, ' | ' ORDER BY lifnr) AS alle_lifnr
FROM lfa1
WHERE name1 IS NOT NULL AND name1 <> ''
GROUP BY name1, ort01
HAVING COUNT(*) > 1
ORDER BY anzahl DESC, name1;


-- ------------------------------------------------------------
-- 3. Dubletten-Kandidaten mit unterschiedlichen NAME2-Feldern
--    (NAME2 kann Hinweis geben, ob bewusst getrennt angelegt)
-- ------------------------------------------------------------
SELECT
    a.lifnr        AS lifnr_1,
    b.lifnr        AS lifnr_2,
    a.name1,
    a.ort01,
    a.name2        AS name2_1,
    b.name2        AS name2_2,
    CASE
        WHEN trim(coalesce(a.name2,'')) = trim(coalesce(b.name2,''))
        THEN 'identisch'
        ELSE 'unterschiedlich'
    END            AS name2_vergleich
FROM lfa1 a
JOIN lfa1 b
    ON a.name1 = b.name1
    AND coalesce(a.ort01,'') = coalesce(b.ort01,'')
    AND a.lifnr < b.lifnr
ORDER BY a.name1, a.lifnr;


-- ------------------------------------------------------------
-- 4. Wahrscheinliche "echte" Dubletten
--    (identischer Name + Stadt + NAME2 → kein sachlicher Grund)
-- ------------------------------------------------------------
SELECT
    a.lifnr        AS lifnr_behalten,
    b.lifnr        AS lifnr_löschen,
    a.name1,
    a.ort01,
    a.name2
FROM lfa1 a
JOIN lfa1 b
    ON a.name1 = b.name1
    AND coalesce(a.ort01,'') = coalesce(b.ort01,'')
    AND coalesce(a.name2,'') = coalesce(b.name2,'')
    AND a.lifnr < b.lifnr
ORDER BY a.name1;
