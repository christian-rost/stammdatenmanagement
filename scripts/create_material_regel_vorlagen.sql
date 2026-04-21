-- Material-Regel-Vorlagen (Regel-Assistent für Materialien)
CREATE TABLE IF NOT EXISTS material_regel_vorlagen (
    id                        BIGSERIAL PRIMARY KEY,
    name                      TEXT NOT NULL,
    regel                     TEXT NOT NULL,
    sql_text                  TEXT NOT NULL,
    erklaerung                TEXT DEFAULT '',
    aktion                    TEXT DEFAULT 'ignorieren',
    aktion_erklaerung         TEXT DEFAULT '',
    erstellt_von              TEXT,
    erstellt_am               TIMESTAMPTZ DEFAULT NOW(),
    letzte_ausfuehrung        TIMESTAMPTZ,
    letztes_ergebnis_anzahl   INTEGER,
    letztes_ergebnis_offen    INTEGER
);
