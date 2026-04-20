-- ============================================================
-- Stammdatenmanagement: Tabellen & Funktionen für Material-Dubletten
-- In Supabase SQL-Editor ausführen (nach create_tables.sql)
-- ============================================================

-- 1. MARA-Tabelle (alle 247 Felder, alles TEXT)
CREATE TABLE IF NOT EXISTS mara (
    mandt TEXT,
    matnr TEXT NOT NULL,
    ersda TEXT, ernam TEXT, laeda TEXT, aenam TEXT, vpsta TEXT, pstat TEXT, lvorm TEXT,
    mtart TEXT, mbrsh TEXT, matkl TEXT, bismt TEXT, meins TEXT, bstme TEXT,
    zeinr TEXT, zeiar TEXT, zeivr TEXT, zeifo TEXT, aeszn TEXT, blatt TEXT, blanz TEXT,
    ferth TEXT, formt TEXT, groes TEXT, wrkst TEXT, normt TEXT, labor TEXT, ekwsl TEXT,
    brgew TEXT, ntgew TEXT, gewei TEXT, volum TEXT, voleh TEXT, behvo TEXT,
    raube TEXT, tempb TEXT, disst TEXT, tragr TEXT, stoff TEXT, spart TEXT,
    kunnr TEXT, eannr TEXT, wesch TEXT, bwvor TEXT, bwscl TEXT,
    saiso TEXT, etiar TEXT, etifo TEXT, entar TEXT, ean11 TEXT, numtp TEXT,
    laeng TEXT, breit TEXT, hoehe TEXT, meabm TEXT, prdha TEXT,
    aeklk TEXT, cadkz TEXT, qmpur TEXT,
    ergew TEXT, ergei TEXT, ervol TEXT, ervoe TEXT, gewto TEXT, volto TEXT, vabme TEXT,
    kzrev TEXT, kzkfg TEXT, xchpf TEXT, vhart TEXT, fuelg TEXT, stfak TEXT, magrv TEXT,
    begru TEXT, datab TEXT, liqdt TEXT, saisj TEXT, plgtp TEXT, mlgut TEXT, extwg TEXT,
    satnr TEXT, attyp TEXT, kzkup TEXT, kznfm TEXT, pmata TEXT,
    mstae TEXT, mstav TEXT, mstde TEXT, mstdv TEXT, taklv TEXT, rbnrm TEXT,
    mhdrz TEXT, mhdhb TEXT, mhdlp TEXT, inhme TEXT, inhal TEXT, vpreh TEXT,
    etiag TEXT, inhbr TEXT, cmeth TEXT, cuobf TEXT, kzumw TEXT, kosch TEXT,
    sprof TEXT, nrfhg TEXT, mfrpn TEXT, mfrnr TEXT, bmatn TEXT, mprof TEXT,
    kzwsm TEXT, saity TEXT, profl TEXT, ihivi TEXT, iloos TEXT, serlv TEXT,
    kzgvh TEXT, xgchp TEXT, kzeff TEXT, compl TEXT, iprkz TEXT, rdmhd TEXT, przus TEXT,
    mtpos_mara TEXT, bflme TEXT, matfi TEXT, cmrel TEXT, bbtyp TEXT, sled_bbd TEXT,
    gtin_variant TEXT, gennr TEXT, rmatp TEXT, gds_relevant TEXT, weora TEXT,
    hutyp_dflt TEXT, pilferable TEXT, whstc TEXT, whmatgr TEXT, hndlcode TEXT,
    hazmat TEXT, hutyp TEXT, tare_var TEXT,
    maxc TEXT, maxc_tol TEXT, maxl TEXT, maxb TEXT, maxh TEXT, maxdim_uom TEXT,
    herkl TEXT, mfrgr TEXT, qqtime TEXT, qqtimeuom TEXT, qgrp TEXT, serial TEXT,
    ps_smartform TEXT, logunit TEXT, cwqrel TEXT, cwqproc TEXT, cwqtolgr TEXT,
    adprof TEXT, ipmipproduct TEXT, allow_pmat_igno TEXT, medium TEXT, commodity TEXT,
    animal_origin TEXT, textile_comp_ind TEXT,
    sgt_csgr TEXT, sgt_covsa TEXT, sgt_stat TEXT, sgt_scope TEXT, sgt_rel TEXT, anp TEXT,
    fsh_mg_at1 TEXT, fsh_mg_at2 TEXT, fsh_mg_at3 TEXT,
    fsh_sealv TEXT, fsh_seaim TEXT, fsh_sc_mid TEXT, psm_code TEXT,
    bev1_luleinh TEXT, bev1_luldegrp TEXT, bev1_nestruccat TEXT, dsd_vc_group TEXT,
    vso_r_tilt_ind TEXT, vso_r_stack_ind TEXT, vso_r_bot_ind TEXT, vso_r_top_ind TEXT,
    vso_r_stack_no TEXT, vso_r_pal_ind TEXT,
    vso_r_pal_ovr_d TEXT, vso_r_pal_ovr_w TEXT, vso_r_pal_b_ht TEXT,
    vso_r_pal_min_h TEXT, vso_r_tol_b_ht TEXT, vso_r_no_p_gvh TEXT,
    vso_r_quan_unit TEXT, vso_r_kzgvh_ind TEXT,
    packcode TEXT, dg_pack_status TEXT, mcond TEXT, retdelc TEXT, loglev_reto TEXT,
    nsnid TEXT, imatn TEXT, picnum TEXT, bstat TEXT,
    color_atinn TEXT, size1_atinn TEXT, size2_atinn TEXT,
    color TEXT, size1 TEXT, size2 TEXT, free_char TEXT, care_code TEXT, brand_id TEXT,
    fiber_code1 TEXT, fiber_part1 TEXT, fiber_code2 TEXT, fiber_part2 TEXT,
    fiber_code3 TEXT, fiber_part3 TEXT, fiber_code4 TEXT, fiber_part4 TEXT,
    fiber_code5 TEXT, fiber_part5 TEXT, fashgrd TEXT,
    ish_agent1 TEXT, ish_ag1quant TEXT, ish_ag1unit TEXT,
    ish_agent2 TEXT, ish_ag2quant TEXT, ish_ag2unit TEXT,
    ish_agent3 TEXT, ish_ag3quant TEXT, ish_ag3unit TEXT,
    ish_kat1 TEXT, ish_kat2 TEXT, ish_kat3 TEXT,
    ish_btm TEXT, ish_imp TEXT, ish_gef TEXT, ish_atc TEXT,
    ish_geart TEXT, ish_bilmod TEXT, ish_addinfo TEXT,
    maktx TEXT,
    maktg TEXT,
    UNIQUE (matnr)
);

-- 2. MAKT-Tabelle (mehrsprachige Kurztexte)
CREATE TABLE IF NOT EXISTS makt (
    mandt TEXT,
    matnr TEXT NOT NULL,
    spras TEXT NOT NULL,
    maktx TEXT,
    maktg TEXT,
    UNIQUE (matnr, spras)
);

-- 3. Entscheidungstabelle für Material-Dubletten (Gruppenkey: maktg)
CREATE TABLE IF NOT EXISTS material_entscheidungen (
    id                SERIAL PRIMARY KEY,
    maktg             TEXT         NOT NULL,
    matnr_behalten    TEXT,
    matnr_loeschen    TEXT[]       DEFAULT '{}',
    notiz             TEXT,
    bearbeitet_von    VARCHAR(100),
    bearbeitet_am     TIMESTAMP    DEFAULT NOW(),
    status            VARCHAR(20)  NOT NULL DEFAULT 'offen',
    UNIQUE (maktg)
);

-- 4. Entscheidungstabelle für Material-Fuzzy-Paare
CREATE TABLE IF NOT EXISTS material_fuzzy_entscheidungen (
    id                SERIAL PRIMARY KEY,
    matnr_a           TEXT         NOT NULL,
    matnr_b           TEXT         NOT NULL,
    matnr_behalten    TEXT,
    notiz             TEXT,
    bearbeitet_von    VARCHAR(100),
    bearbeitet_am     TIMESTAMP    DEFAULT NOW(),
    status            VARCHAR(20)  NOT NULL DEFAULT 'offen',
    UNIQUE (matnr_a, matnr_b)
);

-- 5. Funktion: Material-Dubletten-Gruppen (gleiche MAKTG, unterschiedliche MATNR)
CREATE OR REPLACE FUNCTION get_material_duplicate_groups()
RETURNS TABLE (
    maktg        text,
    maktx        text,
    anzahl       bigint,
    matnr_liste  text[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        m.maktg,
        MIN(m.maktx)                               AS maktx,
        COUNT(*)                                   AS anzahl,
        array_agg(m.matnr ORDER BY m.matnr)        AS matnr_liste
    FROM mara m
    WHERE m.maktg IS NOT NULL AND m.maktg <> ''
    GROUP BY m.maktg
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, m.maktg;
$$;

-- 6. GiST-Index für Trigram-Ähnlichkeitssuche auf maktx
-- (pg_trgm Extension ist bereits aus create_tables.sql aktiv)
CREATE INDEX IF NOT EXISTS mara_maktx_trgm_idx ON mara USING GiST (maktx gist_trgm_ops);

-- 7. Funktion: Ähnliche Materialien via Trigram-Ähnlichkeit
CREATE OR REPLACE FUNCTION get_material_fuzzy_duplicates(threshold float DEFAULT 0.75)
RETURNS TABLE (
    matnr_a      text,
    maktx_a      text,
    maktg_a      text,
    matnr_b      text,
    maktx_b      text,
    maktg_b      text,
    aehnlichkeit float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    PERFORM set_limit(threshold::real);

    RETURN QUERY
    SELECT
        a.matnr,
        a.maktx,
        COALESCE(a.maktg, '')              AS maktg_a,
        b.matnr,
        b.maktx,
        COALESCE(b.maktg, '')              AS maktg_b,
        similarity(a.maktx, b.maktx)::float
    FROM mara a
    JOIN mara b
        ON a.matnr < b.matnr
        AND a.maktx % b.maktx
        AND NOT (
            COALESCE(a.maktg, '') = COALESCE(b.maktg, '')
            AND COALESCE(a.maktg, '') <> ''
        )
    ORDER BY similarity(a.maktx, b.maktx) DESC, a.maktx
    LIMIT 300;
END;
$$;
