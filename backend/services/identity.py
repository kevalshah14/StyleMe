"""
Local face enrollment (InsightFace) and clothing-mask gating for group photos.

Stores one L2-normalized embedding per user; at segment time matches the best face
and keeps only SAM ``clothes`` masks overlapping the expanded person region.
"""

from __future__ import annotations

import base64
import io
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
MODEL_ROOT = Path(os.environ.get("INSIGHTFACE_ROOT", str(_BACKEND_ROOT / ".insightface"))).expanduser()
IDENTITY_DIR = Path(
    os.environ.get("IDENTITY_EMBED_DIR", str(_BACKEND_ROOT / "data" / "identity")),
).expanduser()
INSIGHTFACE_MODEL = os.environ.get("INSIGHTFACE_MODEL", "buffalo_l").strip() or "buffalo_l"
FACE_MATCH_MIN = float(os.environ.get("FACE_MATCH_MIN", "0.40"))
MASK_OVERLAP_MIN = float(os.environ.get("MASK_OVERLAP_MIN", "0.25"))

_face_app: Any = None
_face_lock = threading.Lock()


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    v = np.asarray(vec, dtype=np.float64).ravel()
    n = float(np.linalg.norm(v))
    if n < 1e-12:
        return v.astype(np.float32)
    return (v / n).astype(np.float32)


def _safe_user_path(user_id: str) -> Path:
    safe = re.sub(r"[^\w\-]+", "_", str(user_id).strip())[:128] or "unknown"
    return IDENTITY_DIR / f"{safe}.npz"


def _get_face_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    with _face_lock:
        if _face_app is not None:
            return _face_app
        try:
            from insightface.app import FaceAnalysis
        except (ImportError, Exception) as exc:
            raise RuntimeError(
                "insightface is not installed or failed to load. "
                "Face features are unavailable. "
                f"Original error: {exc}"
            ) from exc

        MODEL_ROOT.mkdir(parents=True, exist_ok=True)
        app = FaceAnalysis(name=INSIGHTFACE_MODEL, root=str(MODEL_ROOT))
        ctx = int(os.environ.get("INSIGHTFACE_CTX_ID", "-1"))
        app.prepare(ctx_id=ctx, det_size=(640, 640))
        _face_app = app
    return _face_app


def image_bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        rgb = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        bgr = cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)
    return bgr


@dataclass
class FaceGateResult:
    matched: bool
    score: float
    face_bbox_xyxy: list[float] | None
    faces_detected: int
    reason: str | None = None


def enroll_from_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Return L2-normalized embedding (float32). Uses largest face if multiple."""
    bgr = image_bytes_to_bgr(image_bytes)
    app = _get_face_app()
    faces = app.get(bgr)
    if not faces:
        raise ValueError("No face detected; use a clear single-person photo.")
    if len(faces) == 1:
        emb = faces[0].embedding
        return _l2_normalize(emb)

    def area(f) -> float:
        b = f.bbox
        return float((b[2] - b[0]) * (b[3] - b[1]))

    best = max(faces, key=area)
    return _l2_normalize(best.embedding)


def save_user_embedding(user_id: str, embedding: np.ndarray) -> Path:
    IDENTITY_DIR.mkdir(parents=True, exist_ok=True)
    path = _safe_user_path(user_id)
    emb = _l2_normalize(embedding)
    np.savez_compressed(path, embedding=emb.astype(np.float32), version=np.int32(1))
    return path


def load_user_embedding(user_id: str) -> np.ndarray | None:
    path = _safe_user_path(user_id)
    if not path.is_file():
        return None
    data = np.load(path)
    return _l2_normalize(np.asarray(data["embedding"], dtype=np.float32))


def find_best_face_match(bgr: np.ndarray, enrolled: np.ndarray) -> FaceGateResult:
    """Cosine similarity between L2-normalized vectors = dot product."""
    app = _get_face_app()
    faces = app.get(bgr)
    n = len(faces)
    if n == 0:
        return FaceGateResult(
            matched=False,
            score=-1.0,
            face_bbox_xyxy=None,
            faces_detected=0,
            reason="no_face_in_image",
        )

    enrolled_n = _l2_normalize(enrolled)
    best_i = 0
    best_s = -1.0
    for i, f in enumerate(faces):
        e = _l2_normalize(f.embedding)
        s = float(np.dot(e, enrolled_n))
        if s > best_s:
            best_s = s
            best_i = i

    fb = faces[best_i]
    bbox = [float(x) for x in fb.bbox.reshape(-1).tolist()[:4]]
    if best_s < FACE_MATCH_MIN:
        return FaceGateResult(
            matched=False,
            score=best_s,
            face_bbox_xyxy=bbox,
            faces_detected=n,
            reason="below_threshold",
        )

    return FaceGateResult(
        matched=True,
        score=best_s,
        face_bbox_xyxy=bbox,
        faces_detected=n,
        reason=None,
    )


def person_region_mask(
    height: int,
    width: int,
    face_bbox_xyxy: list[float],
    *,
    width_scale: float = 2.0,
    down_scale: float = 4.5,
    up_frac: float = 0.15,
) -> np.ndarray:
    """Binary mask: expanded rectangle from face (head-to-torso / full outfit heuristic)."""
    x1, y1, x2, y2 = face_bbox_xyxy
    fx1, fy1, fx2, fy2 = map(float, (x1, y1, x2, y2))
    face_w = max(1.0, fx2 - fx1)
    face_h = max(1.0, fy2 - fy1)
    cx = (fx1 + fx2) / 2.0
    half_w = (face_w * width_scale) / 2.0
    nx1 = max(0, int(cx - half_w))
    nx2 = min(width, int(cx + half_w))
    ny1 = max(0, int(fy1 - up_frac * face_h))
    ny2 = min(height, int(fy2 + down_scale * face_h))
    if nx2 <= nx1:
        nx1, nx2 = 0, width
    if ny2 <= ny1:
        ny1, ny2 = 0, height
    mask = np.zeros((height, width), dtype=bool)
    mask[ny1:ny2, nx1:nx2] = True
    return mask


def _mask_png_to_bool(mask_b64: str, width: int, height: int) -> np.ndarray:
    raw = base64.b64decode(mask_b64)
    im = Image.open(io.BytesIO(raw)).convert("L")
    if im.size != (width, height):
        im = im.resize((width, height), Image.Resampling.NEAREST)
    arr = np.asarray(im, dtype=np.uint8)
    return arr > 127


def filter_clothing_items_by_person(
    items: list[dict[str, Any]],
    person_mask: np.ndarray,
    width: int,
    height: int,
    *,
    overlap_min: float | None = None,
) -> list[dict[str, Any]]:
    """Keep items whose clothing mask overlaps person_mask enough."""
    thr = MASK_OVERLAP_MIN if overlap_min is None else overlap_min
    kept: list[dict[str, Any]] = []
    for it in items:
        mkey = "mask_png"
        if mkey not in it:
            continue
        cloth = _mask_png_to_bool(it[mkey], width, height)
        ccount = int(cloth.sum())
        if ccount < 1:
            continue
        inter = int(np.logical_and(cloth, person_mask).sum())
        ratio = inter / max(ccount, 1)
        if ratio >= thr:
            kept.append(it)
    return kept


def matcher_to_dict(r: FaceGateResult) -> dict[str, Any]:
    return {
        "matched": r.matched,
        "score": round(r.score, 4),
        "face_bbox": r.face_bbox_xyxy,
        "faces_detected": r.faces_detected,
        "reason": r.reason,
    }
