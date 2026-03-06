"""Main FastAPI application for Stammdatenmanagement / Dubletten-Bereinigung."""
import csv
import io
import json
import logging
import re
from typing import Optional

import anthropic
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client

from .config import (
    CORS_ORIGINS, PORT, supabase_url, supabase_key, admin_user, admin_pw,
    ANTHROPIC_API_KEY, SUPABASE_DB_URL,
)
from .auth import create_access_token, authenticate_user, get_current_user
from .user_storage import create_user, get_user_by_username

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Stammdatenmanagement API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

supabase: Optional[Client] = None
if supabase_url and supabase_key:
    supabase = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized")
else:
    logger.warning("Supabase credentials not set - database features disabled")


@app.on_event("startup")
async def bootstrap_admin():
    """Admin-User aus Env-Variablen anlegen falls noch nicht vorhanden."""
    if not admin_user or not admin_pw:
        logger.warning("admin_user/admin_pw not set - skipping admin bootstrap")
        return
    if get_user_by_username(admin_user):
        logger.info(f"Admin user '{admin_user}' already exists")
        return
    result = create_user(admin_user, f"{admin_user}@local", admin_pw, is_admin=True)
    if result:
        logger.info(f"Admin user '{admin_user}' created")
    else:
        logger.error("Failed to create admin user")


# --- Pydantic models ---

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be between 3 and 32 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_admin: bool = False


class DubletteRecord(BaseModel):
    # Kernfelder (seit v1)
    mandt: Optional[str] = None
    lifnr: Optional[str] = None
    land1: Optional[str] = None
    name1: Optional[str] = None
    name2: Optional[str] = None
    name3: Optional[str] = None
    name4: Optional[str] = None
    ort01: Optional[str] = None
    ort02: Optional[str] = None
    # Adresse
    stras: Optional[str] = None
    pstlz: Optional[str] = None
    pstl2: Optional[str] = None
    pfach: Optional[str] = None
    regio: Optional[str] = None
    pfort: Optional[str] = None
    # Matchcodes / Suche
    sortl: Optional[str] = None
    adrnr: Optional[str] = None
    mcod1: Optional[str] = None
    mcod2: Optional[str] = None
    mcod3: Optional[str] = None
    # Kontakt
    anred: Optional[str] = None
    telf1: Optional[str] = None
    telf2: Optional[str] = None
    telfx: Optional[str] = None
    teltx: Optional[str] = None
    telx1: Optional[str] = None
    telbx: Optional[str] = None
    # Steuer / Rechtliches
    stceg: Optional[str] = None
    stcd1: Optional[str] = None
    stcd2: Optional[str] = None
    stcd3: Optional[str] = None
    stcd4: Optional[str] = None
    stcd5: Optional[str] = None
    stcd6: Optional[str] = None
    stcdt: Optional[str] = None
    stenr: Optional[str] = None
    taxbs: Optional[str] = None
    # Sperren / Status
    loevm: Optional[str] = None
    sperr: Optional[str] = None
    sperm: Optional[str] = None
    sperq: Optional[str] = None
    sperz: Optional[str] = None
    nodel: Optional[str] = None
    # Klassifikation
    brsch: Optional[str] = None
    ktokk: Optional[str] = None
    spras: Optional[str] = None
    lzone: Optional[str] = None
    dlgrp: Optional[str] = None
    fityp: Optional[str] = None
    indtyp: Optional[str] = None
    legalnat: Optional[str] = None
    comsize: Optional[str] = None
    # Bankverbindung / Finanzen
    bahns: Optional[str] = None
    bbbnr: Optional[str] = None
    bbsnr: Optional[str] = None
    bubkz: Optional[str] = None
    vbund: Optional[str] = None
    fiskn: Optional[str] = None
    fisku: Optional[str] = None
    ktock: Optional[str] = None
    kunnr: Optional[str] = None
    lnrza: Optional[str] = None
    xcpdk: Optional[str] = None
    xzemp: Optional[str] = None
    xlfza: Optional[str] = None
    duefl: Optional[str] = None
    # Erstellung / Änderung
    erdat: Optional[str] = None
    ernam: Optional[str] = None
    updat: Optional[str] = None
    uptim: Optional[str] = None
    # Sonstiges SAP
    begru: Optional[str] = None
    datlt: Optional[str] = None
    dtams: Optional[str] = None
    dtaws: Optional[str] = None
    esrnr: Optional[str] = None
    konzs: Optional[str] = None
    stkza: Optional[str] = None
    stkzu: Optional[str] = None
    stkzn: Optional[str] = None
    txjcd: Optional[str] = None
    scacd: Optional[str] = None
    sfrgr: Optional[str] = None
    regss: Optional[str] = None
    actss: Optional[str] = None
    ipisp: Optional[str] = None
    profs: Optional[str] = None
    stgdl: Optional[str] = None
    emnfr: Optional[str] = None
    lfurl: Optional[str] = None
    confs: Optional[str] = None
    podkzb: Optional[str] = None
    qssys: Optional[str] = None
    qssysdat: Optional[str] = None
    revdb: Optional[str] = None
    kraus: Optional[str] = None
    werkr: Optional[str] = None
    werks: Optional[str] = None
    ltsna: Optional[str] = None
    plkal: Optional[str] = None
    # Personal (selten gefüllt)
    gbort: Optional[str] = None
    gbdat: Optional[str] = None
    sexkz: Optional[str] = None
    # Brasilien / Regional
    j_1kfrepre: Optional[str] = None
    j_1kftbus: Optional[str] = None
    j_1kftind: Optional[str] = None
    rg: Optional[str] = None
    exp: Optional[str] = None
    uf: Optional[str] = None
    rgdate: Optional[str] = None
    ric: Optional[str] = None
    rne: Optional[str] = None
    rnedate: Optional[str] = None
    cnae: Optional[str] = None
    crtn: Optional[str] = None
    icmstaxpay: Optional[str] = None
    tdt: Optional[str] = None
    decregpc: Optional[str] = None
    j_sc_capital: Optional[float] = None
    j_sc_currency: Optional[str] = None
    # Transport / Logistik
    carrier_conf: Optional[str] = None
    min_comp: Optional[str] = None
    term_li: Optional[str] = None
    crc_num: Optional[str] = None
    cvp_xblck: Optional[str] = None
    transport_chain: Optional[str] = None
    staging_time: Optional[int] = None
    scheduling_type: Optional[str] = None
    submi_relevant: Optional[str] = None
    # Personen-Kontakt
    psofg: Optional[str] = None
    psois: Optional[str] = None
    pson1: Optional[str] = None
    pson2: Optional[str] = None
    pson3: Optional[str] = None
    psovn: Optional[str] = None
    psotl: Optional[str] = None
    psohs: Optional[str] = None
    psost: Optional[str] = None
    alc: Optional[str] = None
    pmt_office: Optional[str] = None


class DubletteGroup(BaseModel):
    name1: str
    ort01: str
    anzahl: int
    lifnr_liste: list[str]
    status: str = "offen"
    lifnr_behalten: Optional[str] = None
    notiz: Optional[str] = None
    bearbeitet_von: Optional[str] = None


class EntscheidungRequest(BaseModel):
    name1: str
    ort01: str
    lifnr_behalten: Optional[str] = None
    lifnr_loeschen: list[str] = []
    notiz: Optional[str] = None
    status: str = "bearbeitet"


class StatsResponse(BaseModel):
    gesamt: int
    offen: int
    bearbeitet: int
    ignoriert: int


# --- Auth endpoints ---

@app.post("/api/auth/register", response_model=UserResponse)
@limiter.limit("3/minute")
async def register(request: Request, body: UserRegister):
    user = create_user(body.username, body.email, body.password)
    if not user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    return user


@app.post("/api/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: UserLogin):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# --- Dubletten endpoints ---

def _require_db():
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")


@app.get("/api/duplicates", response_model=list[DubletteGroup])
async def list_duplicates(current_user: dict = Depends(get_current_user)):
    """Alle Dubletten-Gruppen mit Status."""
    _require_db()
    try:
        # Alle Gruppen per RPC-fähigem Raw-Query via PostgREST rpc
        # Supabase Python SDK unterstützt kein GROUP BY direkt → RPC nutzen
        response = supabase.rpc("get_duplicate_groups").execute()
        groups_raw = response.data or []

        # Entscheidungen laden
        decisions_resp = supabase.table("dubletten_entscheidungen").select("*").execute()
        decisions = {
            (d["name1"], d["ort01"]): d
            for d in (decisions_resp.data or [])
        }

        result = []
        for g in groups_raw:
            name1 = g["name1"] or ""
            ort01 = g["ort01"] or ""
            decision = decisions.get((name1, ort01), {})
            result.append(DubletteGroup(
                name1=name1,
                ort01=ort01,
                anzahl=g["anzahl"],
                lifnr_liste=g["lifnr_liste"] or [],
                status=decision.get("status", "offen"),
                lifnr_behalten=decision.get("lifnr_behalten"),
                notiz=decision.get("notiz"),
                bearbeitet_von=decision.get("bearbeitet_von"),
            ))

        return result
    except Exception as e:
        logger.error(f"Error fetching duplicates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch duplicates")


@app.get("/api/duplicates/records", response_model=list[DubletteRecord])
async def get_duplicate_records(
    name1: str,
    ort01: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Alle LFA1-Datensätze für eine Dubletten-Gruppe."""
    _require_db()
    try:
        query = supabase.table("lfa1").select("*").eq("name1", name1)
        if ort01:
            query = query.eq("ort01", ort01)
        else:
            query = query.is_("ort01", "null")
        response = query.order("lifnr").execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error fetching records for {name1}/{ort01}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch records")


@app.post("/api/decisions")
async def save_decision(
    body: EntscheidungRequest,
    current_user: dict = Depends(get_current_user)
):
    """Entscheidung für eine Dubletten-Gruppe speichern (upsert)."""
    _require_db()
    try:
        data = {
            "name1": body.name1,
            "ort01": body.ort01,
            "lifnr_behalten": body.lifnr_behalten,
            "lifnr_loeschen": body.lifnr_loeschen,
            "notiz": body.notiz,
            "bearbeitet_von": current_user["username"],
            "status": body.status,
        }
        supabase.table("dubletten_entscheidungen").upsert(
            data,
            on_conflict="name1,ort01"
        ).execute()
        return {"message": "Entscheidung gespeichert"}
    except Exception as e:
        logger.error(f"Error saving decision: {e}")
        raise HTTPException(status_code=500, detail="Failed to save decision")


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Statistik: Gesamt / Offen / Bearbeitet / Ignoriert."""
    _require_db()
    try:
        groups_resp = supabase.rpc("get_duplicate_groups").execute()
        total = len(groups_resp.data or [])

        decisions_resp = supabase.table("dubletten_entscheidungen").select("status").execute()
        counts = {"bearbeitet": 0, "ignoriert": 0}
        for d in (decisions_resp.data or []):
            s = d.get("status", "offen")
            if s in counts:
                counts[s] += 1

        offen = total - counts["bearbeitet"] - counts["ignoriert"]
        return StatsResponse(
            gesamt=total,
            offen=max(offen, 0),
            bearbeitet=counts["bearbeitet"],
            ignoriert=counts["ignoriert"],
        )
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@app.get("/api/export")
async def export_decisions(current_user: dict = Depends(get_current_user)):
    """CSV-Export aller Entscheidungen."""
    _require_db()
    try:
        response = supabase.table("dubletten_entscheidungen").select("*").order("name1").execute()
        rows = response.data or []

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "name1", "ort01", "status", "lifnr_behalten",
            "lifnr_loeschen", "notiz", "bearbeitet_von", "bearbeitet_am"
        ])
        for row in rows:
            loeschen = " | ".join(row.get("lifnr_loeschen") or [])
            writer.writerow([
                row.get("name1", ""),
                row.get("ort01", ""),
                row.get("status", ""),
                row.get("lifnr_behalten", ""),
                loeschen,
                row.get("notiz", ""),
                row.get("bearbeitet_von", ""),
                row.get("bearbeitet_am", ""),
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=dubletten_entscheidungen.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting: {e}")
        raise HTTPException(status_code=500, detail="Failed to export")


# --- Fuzzy endpoints ---

class FuzzyPair(BaseModel):
    lifnr_a: str
    name1_a: Optional[str] = None
    ort01_a: Optional[str] = None
    lifnr_b: str
    name1_b: Optional[str] = None
    ort01_b: Optional[str] = None
    aehnlichkeit: float
    status: str = "offen"
    lifnr_behalten: Optional[str] = None
    notiz: Optional[str] = None


class FuzzyEntscheidungRequest(BaseModel):
    lifnr_a: str
    lifnr_b: str
    lifnr_behalten: Optional[str] = None
    notiz: Optional[str] = None
    status: str = "bearbeitet"


@app.get("/api/fuzzy", response_model=list[FuzzyPair])
async def list_fuzzy(
    threshold: float = 0.6,
    current_user: dict = Depends(get_current_user)
):
    """Ähnliche Paare via Trigram-Ähnlichkeit."""
    _require_db()
    try:
        pairs_resp = supabase.rpc("get_fuzzy_duplicates", {"threshold": threshold}).execute()
        pairs_raw = pairs_resp.data or []

        decisions_resp = supabase.table("fuzzy_entscheidungen").select("*").execute()
        decisions = {
            (d["lifnr_a"], d["lifnr_b"]): d
            for d in (decisions_resp.data or [])
        }

        result = []
        for p in pairs_raw:
            la, lb = p["lifnr_a"], p["lifnr_b"]
            dec = decisions.get((la, lb), {})
            result.append(FuzzyPair(
                lifnr_a=la,
                name1_a=p.get("name1_a"),
                ort01_a=p.get("ort01_a", ""),
                lifnr_b=lb,
                name1_b=p.get("name1_b"),
                ort01_b=p.get("ort01_b", ""),
                aehnlichkeit=round(p.get("aehnlichkeit", 0), 2),
                status=dec.get("status", "offen"),
                lifnr_behalten=dec.get("lifnr_behalten"),
                notiz=dec.get("notiz"),
            ))
        return result
    except Exception as e:
        logger.error(f"Error fetching fuzzy duplicates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch fuzzy duplicates")


@app.post("/api/fuzzy/decision")
async def save_fuzzy_decision(
    body: FuzzyEntscheidungRequest,
    current_user: dict = Depends(get_current_user)
):
    """Entscheidung für ein Fuzzy-Paar speichern (upsert)."""
    _require_db()
    try:
        supabase.table("fuzzy_entscheidungen").upsert(
            {
                "lifnr_a": body.lifnr_a,
                "lifnr_b": body.lifnr_b,
                "lifnr_behalten": body.lifnr_behalten,
                "notiz": body.notiz,
                "bearbeitet_von": current_user["username"],
                "status": body.status,
            },
            on_conflict="lifnr_a,lifnr_b"
        ).execute()
        return {"message": "Entscheidung gespeichert"}
    except Exception as e:
        logger.error(f"Error saving fuzzy decision: {e}")
        raise HTTPException(status_code=500, detail="Failed to save fuzzy decision")


# --- Import endpoint ---

_SEARCH_FIELDS = [
    "lifnr", "name1", "name2", "name3", "name4",
    "ort01", "ort02", "stras", "pstlz", "regio",
    "land1", "telf1", "telf2", "telfx",
    "stceg", "stcd1", "stcd2", "stenr",
    "brsch", "sortl", "mcod1", "ernam",
    "adrnr", "ktokk", "spras",
]


@app.get("/api/search", response_model=list[DubletteRecord])
async def search_records(
    q: str,
    current_user: dict = Depends(get_current_user),
):
    """Freitextsuche über alle relevanten LFA1-Felder."""
    _require_db()
    q = q.strip()
    if len(q) < 1:
        return []
    try:
        or_filter = ",".join(f"{f}.ilike.%{q}%" for f in _SEARCH_FIELDS)
        resp = supabase.table("lfa1").select("*").or_(or_filter).limit(500).execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Suche fehlgeschlagen")


@app.get("/api/admin/check-schema")
async def check_schema(current_user: dict = Depends(get_current_user)):
    """Prüft ob die lfa1-Migration (neue Spalten) bereits ausgeführt wurde."""
    _require_db()
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admins")
    try:
        supabase.table("lfa1").select("stras").limit(1).execute()
        return {"migrated": True}
    except Exception:
        return {"migrated": False}


class ImportBatchRequest(BaseModel):
    records: list[dict]


@app.post("/api/admin/import-lfa1-batch")
async def import_lfa1_batch(
    body: ImportBatchRequest,
    current_user: dict = Depends(get_current_user),
):
    """Batch von LFA1-Datensätzen (JSON) in Supabase speichern (nur Admins).
    Das XLSX wird client-seitig im Browser geparst und in Batches gesendet."""
    _require_db()
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admins können Daten importieren")

    if not body.records:
        return {"imported": 0, "total": 0}

    try:
        supabase.table("lfa1").upsert(body.records, on_conflict="lifnr").execute()
        logger.info(f"Import-Batch: {len(body.records)} Datensätze von {current_user['username']}")
        return {"imported": len(body.records)}
    except Exception as e:
        logger.error(f"Import-Batch-Fehler: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Regel-Assistent (LLM + SQL) ---

_LFA1_SCHEMA_CONTEXT = """
Die Tabelle `lfa1` enthält SAP-Kreditoren-Stammdaten mit folgenden Schlüsselspalten:
- lifnr TEXT: Kreditornummer (eindeutige ID, Primary Key)
- name1 TEXT: Kreditorname 1 (Hauptname)
- name2 TEXT: Kreditorname 2 (Zusatz)
- name3 TEXT: Kreditorname 3
- name4 TEXT: Kreditorname 4
- ort01 TEXT: Ort/Stadt
- stras TEXT: Straße + Hausnummer
- pstlz TEXT: Postleitzahl
- land1 TEXT: Länderkennzeichen (z.B. 'DE', 'AT', 'CH')
- stceg TEXT: USt-IdNr (Umsatzsteuer-Identifikationsnummer)
- stcd1 TEXT: Steuernummer 1
- stcd2 TEXT: Steuernummer 2
- telf1 TEXT: Telefon 1
- telf2 TEXT: Telefon 2
- telfx TEXT: Telefax
- brsch TEXT: Branchenschlüssel
- ktokk TEXT: Kontengruppe des Kreditors
- loevm TEXT: Löschvormerkung ('X' = zum Löschen vorgemerkt, NULL = aktiv)
- erdat DATE: Anlagedatum
- ernam TEXT: Angelegt von (Benutzername)
- sortl TEXT: Suchbegriff
- mandt TEXT: Mandant (immer '100')

Eine "Dubletten-Gruppe" besteht aus allen Datensätzen mit identischem name1 UND COALESCE(ort01,'')
bei denen COUNT(*) > 1 ist.
"""

_SYSTEM_PROMPT = """Du bist ein SQL-Experte für SAP-Stammdaten und Dubletten-Bereinigung.
Analysiere die vom Anwender beschriebene Regel und erzeuge ein PostgreSQL-SELECT-Statement.

""" + _LFA1_SCHEMA_CONTEXT + """
WICHTIG — Einschränkungen:
- Es existiert NUR die Tabelle `lfa1`. Keine anderen Tabellen (kein lfbk, lfa3, lfm1, knb1 o. ä.).
- Bankverbindungen, Einkaufsorganisationen, Buchungskreisdaten etc. sind NICHT verfügbar.
- Falls eine Regel Daten erfordert, die nicht in lfa1 vorhanden sind (z. B. Bankverbindung),
  erkläre das in "erklaerung" und erstelle das SQL auf Basis der verfügbaren lfa1-Felder
  so gut wie möglich — oder gib eine leere Treffermenge zurück mit einem klaren Hinweis.

Das SQL muss folgende Anforderungen erfüllen:
1. Reines SELECT-Statement (kein INSERT/UPDATE/DELETE/DDL)
2. Verwendet NUR die Tabelle `lfa1` — keine JOINs auf andere Tabellen
3. Gibt mindestens die Spalten zurück: lifnr, name1, ort01
4. Enthält NUR Datensätze, die zu Dubletten-Gruppen gehören (Unterabfrage mit HAVING COUNT(*) > 1)
5. Setzt die beschriebene Regel als WHERE-Bedingung um
6. Sortiert nach name1, ort01, lifnr
7. Hat LIMIT 1000

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein anderer Text):
{
  "sql": "SELECT ... FROM lfa1 ...",
  "erklaerung": "Kurze deutsche Erklärung was das SQL macht",
  "aktion": "ignorieren",
  "aktion_erklaerung": "Kurze deutsche Erklärung der vorgeschlagenen Aktion"
}

Für "aktion" wähle:
- "ignorieren": Alle Kreditoren der Gruppe bleiben bestehen (keine Löschung nötig)
- "pruefen": Manuelle Einzelprüfung empfohlen
"""


def _validate_sql(sql: str) -> None:
    """Sicherheitsprüfung: nur SELECT erlaubt."""
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Nur SELECT-Statements sind erlaubt")
    forbidden = re.compile(
        r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|CALL)\b",
        re.IGNORECASE,
    )
    if forbidden.search(sql):
        raise HTTPException(status_code=400, detail="SQL enthält unerlaubte Operationen")


class RuleGenerateRequest(BaseModel):
    regel: str


class RuleGenerateResponse(BaseModel):
    sql: str
    erklaerung: str
    aktion: str
    aktion_erklaerung: str


class RuleExecuteRequest(BaseModel):
    sql: str


class RuleApplyRequest(BaseModel):
    groups: list[dict]   # [{name1, ort01}, ...]
    status: str = "ignoriert"
    notiz: Optional[str] = None


@app.post("/api/rules/generate-sql", response_model=RuleGenerateResponse)
async def generate_rule_sql(
    body: RuleGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Erzeugt ein SQL-Statement aus einer Klartextregel via Claude API."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY nicht konfiguriert")

    regel = body.regel.strip()
    if len(regel) < 5:
        raise HTTPException(status_code=400, detail="Regel zu kurz")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Erstelle ein SQL-Statement für folgende Regel:\n\n{regel}",
                }
            ],
        )
        raw = response.content[0].text.strip()

        # JSON aus der Antwort extrahieren
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("`").strip()
        data = json.loads(raw)

        sql = data.get("sql", "").strip()
        if not sql:
            raise HTTPException(status_code=500, detail="LLM hat kein SQL zurückgegeben")

        _validate_sql(sql)

        return RuleGenerateResponse(
            sql=sql,
            erklaerung=data.get("erklaerung", ""),
            aktion=data.get("aktion", "ignorieren"),
            aktion_erklaerung=data.get("aktion_erklaerung", ""),
        )
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"LLM JSON parse error: {e} | raw: {raw[:500]}")
        raise HTTPException(status_code=500, detail="LLM-Antwort konnte nicht verarbeitet werden")
    except Exception as e:
        logger.error(f"Rule generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rules/execute")
async def execute_rule_sql(
    body: RuleExecuteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Führt ein validiertes SELECT-Statement direkt gegen die Datenbank aus."""
    if not SUPABASE_DB_URL:
        raise HTTPException(status_code=503, detail="SUPABASE_DB_URL nicht konfiguriert")

    _validate_sql(body.sql)

    try:
        conn = psycopg2.connect(SUPABASE_DB_URL)
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(body.sql)
                rows = cur.fetchall()
                return {"rows": [dict(r) for r in rows], "count": len(rows)}
        finally:
            conn.close()
    except psycopg2.Error as e:
        logger.error(f"SQL execution error: {e}")
        raise HTTPException(status_code=400, detail=f"SQL-Fehler: {e.pgerror or str(e)}")
    except Exception as e:
        logger.error(f"Execute error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rules/apply")
async def apply_rule(
    body: RuleApplyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Wendet eine Entscheidung auf mehrere Dubletten-Gruppen an (Batch-Upsert)."""
    _require_db()
    if not body.groups:
        return {"applied": 0}

    records = [
        {
            "name1": g["name1"],
            "ort01": g.get("ort01", ""),
            "status": body.status,
            "notiz": body.notiz,
            "bearbeitet_von": current_user["username"],
            "lifnr_behalten": None,
            "lifnr_loeschen": [],
        }
        for g in body.groups
    ]

    try:
        supabase.table("dubletten_entscheidungen").upsert(
            records, on_conflict="name1,ort01"
        ).execute()
        logger.info(f"Rule applied to {len(records)} groups by {current_user['username']}")
        return {"applied": len(records)}
    except Exception as e:
        logger.error(f"Rule apply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "healthy", "service": "Stammdatenmanagement API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": supabase is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
