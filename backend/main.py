"""Main FastAPI application for Stammdatenmanagement / Dubletten-Bereinigung."""
import asyncio
import csv
import io
import logging
from datetime import datetime, date, time as dt_time
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client

from .config import CORS_ORIGINS, PORT, supabase_url, supabase_key, admin_user, admin_pw
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

_IMPORT_DATE_COLS = {"erdat", "gbdat", "updat", "qssysdat", "rgdate", "rnedate"}
_IMPORT_TIME_COLS = {"uptim"}
_IMPORT_NUMERIC_COLS = {"j_sc_capital"}
_IMPORT_INT_COLS = {"staging_time"}


def _parse_xlsx_bytes(content: bytes) -> list[dict]:
    """Parst XLSX-Bytes und gibt bereinigte Datensätze zurück (synchron, für Thread)."""
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    db_headers = [h.lower() for h in next(rows_iter)]

    records = []
    for raw_row in rows_iter:
        rec = {}
        for col, val in zip(db_headers, raw_row):
            if val is None or val == "":
                continue
            if col in _IMPORT_DATE_COLS:
                if isinstance(val, (datetime, date)):
                    rec[col] = val.date().isoformat() if isinstance(val, datetime) else val.isoformat()
                else:
                    s = str(val).strip()
                    if s:
                        rec[col] = s
            elif col in _IMPORT_TIME_COLS:
                if isinstance(val, dt_time):
                    rec[col] = val.strftime("%H:%M:%S")
                else:
                    s = str(val).strip()
                    if s:
                        rec[col] = s
            elif col in _IMPORT_NUMERIC_COLS:
                try:
                    rec[col] = float(val)
                except (ValueError, TypeError):
                    pass
            elif col in _IMPORT_INT_COLS:
                try:
                    rec[col] = int(val)
                except (ValueError, TypeError):
                    pass
            else:
                s = str(val).strip()
                if s:
                    rec[col] = s
        records.append(rec)

    wb.close()
    return records


@app.get("/api/admin/check-schema")
async def check_schema(current_user: dict = Depends(get_current_user)):
    """Prüft ob die lfa1-Migration (neue Spalten) bereits ausgeführt wurde."""
    _require_db()
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admins")
    try:
        # Wenn stras existiert, ist die Migration gelaufen
        supabase.table("lfa1").select("stras").limit(1).execute()
        return {"migrated": True}
    except Exception:
        return {"migrated": False}


@app.post("/api/admin/import-lfa1")
async def import_lfa1(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """XLSX-Datei hochladen und in lfa1 importieren (nur Admins)."""
    _require_db()
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Nur Admins können Daten importieren")

    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Nur XLSX-Dateien werden unterstützt")

    content = await file.read()
    logger.info(f"Import gestartet: {filename} ({len(content)} Bytes) von {current_user['username']}")

    try:
        records = await asyncio.to_thread(_parse_xlsx_bytes, content)
    except Exception as e:
        logger.error(f"XLSX-Parse-Fehler: {e}")
        raise HTTPException(status_code=422, detail=f"Fehler beim Lesen der Datei: {e}")

    total = len(records)
    batch_size = 500
    imported = 0
    batch_errors = []

    for i in range(0, total, batch_size):
        batch = records[i: i + batch_size]
        try:
            supabase.table("lfa1").upsert(batch, on_conflict="lifnr").execute()
            imported += len(batch)
        except Exception as e:
            msg = f"Batch {i // batch_size + 1}: {e}"
            logger.error(msg)
            batch_errors.append(msg)

    logger.info(f"Import abgeschlossen: {imported}/{total} Datensätze")
    return {
        "imported": imported,
        "total": total,
        "errors": batch_errors,
    }


@app.get("/")
async def root():
    return {"status": "healthy", "service": "Stammdatenmanagement API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": supabase is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
