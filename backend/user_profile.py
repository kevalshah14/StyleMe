"""Persist per-user reference photos (e.g. full-body) under ``data/user_profiles/``."""

from __future__ import annotations

import os
import re
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent
PROFILE_ROOT = Path(
    os.environ.get("USER_PROFILE_PHOTOS_DIR", str(_BACKEND_ROOT / "data" / "user_profiles")),
).expanduser()


def _safe_user_segment(user_id: str) -> str:
    return re.sub(r"[^\w\-]+", "_", str(user_id).strip())[:128] or "unknown"


def save_full_body_photo(user_id: str, image_bytes: bytes, content_type: str | None) -> Path:
    """Write ``full_body.{jpg|png|webp}`` for this user."""
    PROFILE_ROOT.mkdir(parents=True, exist_ok=True)
    ext = ".jpg"
    if content_type and "png" in content_type.lower():
        ext = ".png"
    elif content_type and "webp" in content_type.lower():
        ext = ".webp"
    uid = _safe_user_segment(user_id)
    user_dir = PROFILE_ROOT / uid
    user_dir.mkdir(parents=True, exist_ok=True)
    path = user_dir / f"full_body{ext}"
    path.write_bytes(image_bytes)
    return path
