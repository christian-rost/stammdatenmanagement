-- Tabelle LFA1 (SAP Lieferantenstamm) in Supabase anlegen
-- Feldlängen entsprechen SAP-Standard

-- Bestehende Tabelle löschen (falls vorhanden) und neu anlegen
DROP TABLE IF EXISTS lfa1;

CREATE TABLE lfa1 (
    mandt  varchar(3),
    lifnr  varchar(10),
    land1  varchar(3),
    name1  varchar(35),
    name2  varchar(35),
    name3  varchar(35),
    name4  varchar(35),
    ort01  varchar(35),
    ort02  varchar(35)
);
