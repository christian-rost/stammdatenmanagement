"""
Import LFA1_komplett.XLSX → Supabase lfa1 Tabelle.

Voraussetzungen:
    pip install openpyxl supabase python-dotenv

Aufruf:
    python scripts/import_lfa1_xlsx.py [--file LFA1_komplett.XLSX] [--batch 500] [--truncate]

Flags:
    --truncate   Tabelle vor dem Import leeren (Standard: upsert auf lifnr)
    --batch N    Datensätze pro Insert-Batch (Standard: 500)
    --file PATH  Pfad zur XLSX-Datei (Standard: LFA1_komplett.XLSX)
"""

import argparse
import os
import sys
from datetime import datetime, date, time

import openpyxl
from dotenv import load_dotenv
from supabase import create_client

# ---------------------------------------------------------------------------
# Spalten, die in der Datenbank als DATE gespeichert werden
DATE_COLS = {"erdat", "gbdat", "updat", "qssysdat", "rgdate", "rnedate"}
# Spalten als TIME
TIME_COLS = {"uptim"}
# Spalten als NUMERIC
NUMERIC_COLS = {"j_sc_capital"}
# Spalten als INTEGER
INT_COLS = {"staging_time"}


def coerce(col: str, val):
    """Konvertiert Excel-Wert in den passenden Python-Typ für Supabase."""
    if val is None or val == "":
        return None

    col_l = col.lower()

    # Datum
    if col_l in DATE_COLS:
        if isinstance(val, (datetime, date)):
            return val.date().isoformat() if isinstance(val, datetime) else val.isoformat()
        s = str(val).strip()
        return s if s else None

    # Zeit
    if col_l in TIME_COLS:
        if isinstance(val, time):
            return val.strftime("%H:%M:%S")
        s = str(val).strip()
        return s if s else None

    # Zahl
    if col_l in NUMERIC_COLS or col_l in INT_COLS:
        try:
            return int(val) if col_l in INT_COLS else float(val)
        except (ValueError, TypeError):
            return None

    # Alles andere → String, leere Strings → None
    s = str(val).strip()
    return s if s else None


def map_header(xlsx_col: str) -> str:
    """Excel-Spaltennamen → DB-Spaltenname (lowercase, Sonderzeichen)."""
    # Excel liefert Großbuchstaben; DB-Spalten sind lowercase
    return xlsx_col.lower()


def load_xlsx(path: str):
    """Liest XLSX und gibt (headers_db, rows) zurück."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    raw_headers = [c for c in next(rows_iter)]
    db_headers = [map_header(h) for h in raw_headers]

    rows = []
    for raw_row in rows_iter:
        record = {}
        for col, val in zip(db_headers, raw_row):
            converted = coerce(col, val)
            if converted is not None:
                record[col] = converted
        rows.append(record)

    wb.close()
    return db_headers, rows


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Import LFA1_komplett.XLSX in Supabase")
    parser.add_argument("--file", default="LFA1_komplett.XLSX")
    parser.add_argument("--batch", type=int, default=500)
    parser.add_argument("--truncate", action="store_true",
                        help="Tabelle vor Import leeren (TRUNCATE lfa1)")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("Fehler: SUPABASE_URL und SUPABASE_SERVICE_KEY/.env müssen gesetzt sein.")
        sys.exit(1)

    supabase = create_client(url, key)

    print(f"Lese {args.file} ...")
    _, rows = load_xlsx(args.file)
    total = len(rows)
    print(f"  {total} Datensätze gelesen.")

    if args.truncate:
        print("Leere Tabelle lfa1 ...")
        supabase.table("lfa1").delete().neq("lifnr", "").execute()
        print("  Fertig.")

    print(f"Importiere in Batches à {args.batch} ...")
    errors = 0
    for i in range(0, total, args.batch):
        batch = rows[i: i + args.batch]
        try:
            supabase.table("lfa1").upsert(batch, on_conflict="lifnr").execute()
            print(f"  Batch {i // args.batch + 1}: {i + len(batch)}/{total} ✓")
        except Exception as e:
            print(f"  Batch {i // args.batch + 1} FEHLER: {e}")
            errors += 1

    if errors:
        print(f"\nImport abgeschlossen mit {errors} Fehler(n).")
        sys.exit(1)
    else:
        print(f"\nImport erfolgreich: {total} Datensätze.")


if __name__ == "__main__":
    main()
