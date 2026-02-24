"""
Parst die SAP-LFA1-Exportdatei (Pipe-Format) und schreibt eine saubere CSV-Datei.
"""
import csv

INPUT_FILE = "LFA1.txt"
OUTPUT_FILE = "LFA1.csv"
ENCODING = "latin-1"

SEPARATOR = "---"  # Trennlinien überspringen


def is_data_line(line: str) -> bool:
    """Nur echte Datenzeilen (beginnen mit '| |', aber keine Kopfzeile)."""
    return line.startswith("| |") and "MANDT" not in line


def parse_line(line: str) -> list[str]:
    """Spalten aus Pipe-Format extrahieren und trimmen."""
    parts = line.split("|")
    # Index 2..10 = MANDT, LIFNR, LAND1, NAME1-4, ORT01, ORT02
    return [p.strip() for p in parts[2:11]]


COLUMNS = ["mandt", "lifnr", "land1", "name1", "name2", "name3", "name4", "ort01", "ort02"]

with open(INPUT_FILE, encoding=ENCODING) as infile, \
     open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as outfile:

    writer = csv.writer(outfile)
    writer.writerow(COLUMNS)

    count = 0
    for line in infile:
        if is_data_line(line):
            writer.writerow(parse_line(line))
            count += 1

print(f"{count} Datensätze nach {OUTPUT_FILE} exportiert.")
