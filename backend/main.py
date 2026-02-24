"""Main FastAPI application for Stammdatenmanagement / Dubletten-Bereinigung."""
import csv
import io
import logging
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request
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
    lifnr: Optional[str] = None
    name1: Optional[str] = None
    name2: Optional[str] = None
    name3: Optional[str] = None
    name4: Optional[str] = None
    ort01: Optional[str] = None
    ort02: Optional[str] = None
    land1: Optional[str] = None
    mandt: Optional[str] = None


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


@app.get("/")
async def root():
    return {"status": "healthy", "service": "Stammdatenmanagement API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": supabase is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
