"""Configuration module for Stammdatenmanagement backend."""
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Supabase Configuration
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_KEY", "")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is required. "
        "Generate one with: openssl rand -base64 32"
    )

# Admin Credentials
admin_user = os.getenv("admin_user", "")
admin_pw = os.getenv("admin_pw", "")

if not admin_pw:
    logger.warning("admin_pw not set - admin login disabled")

# CORS Configuration
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
CORS_ORIGINS = [origin.strip().strip('"').strip("'") for origin in _cors_env.split(",") if origin.strip()]
logger.info(f"CORS_ORIGINS configured: {CORS_ORIGINS}")

# Data directories
USER_DATA_DIR = "data/users"

# Server Configuration
PORT = 8002
