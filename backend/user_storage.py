"""JSON-based user storage module."""
import json
import uuid
import logging
from pathlib import Path
from typing import Optional
from passlib.context import CryptContext

from .config import USER_DATA_DIR

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USER_DATA_PATH = Path(USER_DATA_DIR)
USER_DATA_PATH.mkdir(parents=True, exist_ok=True)


def _get_user_file(user_id: str) -> Path:
    return USER_DATA_PATH / f"{user_id}.json"


def _load_all_users() -> list[dict]:
    users = []
    for file in USER_DATA_PATH.glob("*.json"):
        try:
            with open(file, "r") as f:
                users.append(json.load(f))
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading user file {file}: {e}")
    return users


def create_user(username: str, email: str, password: str, is_admin: bool = False) -> Optional[dict]:
    if get_user_by_username(username):
        return None
    if get_user_by_email(email):
        return None

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": pwd_context.hash(password),
        "is_admin": is_admin
    }

    try:
        with open(_get_user_file(user_id), "w") as f:
            json.dump(user, f, indent=2)
        return {k: v for k, v in user.items() if k != "password_hash"}
    except IOError as e:
        logger.error(f"Error creating user: {e}")
        return None


def get_user_by_username(username: str) -> Optional[dict]:
    for user in _load_all_users():
        if user.get("username") == username:
            return user
    return None


def get_user_by_email(email: str) -> Optional[dict]:
    for user in _load_all_users():
        if user.get("email") == email:
            return user
    return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    user_file = _get_user_file(user_id)
    if user_file.exists():
        try:
            with open(user_file, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading user {user_id}: {e}")
    return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_all_users() -> list[dict]:
    users = _load_all_users()
    return [{k: v for k, v in user.items() if k != "password_hash"} for user in users]


def delete_user(user_id: str) -> bool:
    user_file = _get_user_file(user_id)
    if user_file.exists():
        try:
            user_file.unlink()
            return True
        except IOError as e:
            logger.error(f"Error deleting user {user_id}: {e}")
    return False
