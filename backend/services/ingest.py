"""
Production-ready ingest pipeline.

Upload → SAM 3 segment → Gemini label → Gemini embed → cluster → HydraDB + local cache.

Each segment becomes a wardrobe item with:
  - RGBA cutout image (cropped to bbox, transparent BG)
  - Rich Gemini labels (garment_type, color, material, body_region, occasions, details)
  - Cluster assignment (upper_body, lower_body, footwear, outerwear, accessory, full_body)
  - 768-dim Gemini embedding for semantic retrieval
  - Stored in HydraDB (memory + raw embedding) AND local JSON cache
"""

from __future__ import annotations

import base64
import io
import json
import logging
import uuid
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

# ── Cluster definitions ──────────────────────────────────────────────

CLUSTERS = {
    "upper_body": {
        "keywords": [
            "shirt", "t-shirt", "tee", "blouse", "top", "polo", "henley",
            "tank", "camisole", "crop", "button-down", "oxford",
        ],
        "label": "Tops & Shirts",
    },
    "lower_body": {
        "keywords": [
            "pants", "trousers", "jeans", "chinos", "shorts", "skirt",
            "jogger", "legging", "cargo", "slacks",
        ],
        "label": "Bottoms & Pants",
    },
    "outerwear": {
        "keywords": [
            "jacket", "coat", "blazer", "hoodie", "sweatshirt", "cardigan",
            "sweater", "puffer", "bomber", "windbreaker", "trench", "vest",
            "raincoat", "parka", "fleece", "pullover",
        ],
        "label": "Outerwear & Layers",
    },
    "footwear": {
        "keywords": [
            "shoe", "sneaker", "boot", "sandal", "loafer", "slipper",
            "heel", "oxford", "mule", "flat", "trainer",
        ],
        "label": "Footwear",
    },
    "full_body": {
        "keywords": [
            "dress", "jumpsuit", "romper", "overalls", "suit", "onesie",
            "gown", "uniform",
        ],
        "label": "Full Body",
    },
    "accessory": {
        "keywords": [
            "hat", "cap", "beanie", "scarf", "belt", "tie", "watch",
            "bag", "backpack", "purse", "wallet", "sunglasses", "glasses",
            "glove", "jewel", "necklace", "bracelet", "ring", "earring",
        ],
        "label": "Accessories",
    },
}


def assign_cluster(garment_type: str, body_region: str) -> str:
    """Assign a garment to the best cluster based on type and body region."""
    text = f"{garment_type} {body_region}".lower()
    for cluster_id, info in CLUSTERS.items():
        for kw in info["keywords"]:
            if kw in text:
                return cluster_id
    # Fallback heuristics from body_region
    region = body_region.lower()
    if "upper" in region or "torso" in region:
        return "upper_body"
    if "lower" in region or "leg" in region:
        return "lower_body"
    if "feet" in region or "foot" in region:
        return "footwear"
    if "full" in region:
        return "full_body"
    if "head" in region or "neck" in region or "wrist" in region:
        return "accessory"
    return "upper_body"  # default


# ── Color extraction ─────────────────────────────────────────────────

KNOWN_COLORS = [
    "black", "white", "red", "blue", "navy", "green", "gray", "grey",
    "brown", "beige", "khaki", "olive", "pink", "purple", "orange",
    "yellow", "cream", "tan", "denim", "indigo", "charcoal", "burgundy",
    "maroon", "teal", "coral", "lavender", "mint", "rust", "gold",
    "silver", "ivory", "peach", "mauve", "sage", "camel", "taupe",
]

KNOWN_PATTERNS = [
    "striped", "plaid", "floral", "checkered", "geometric", "polka dot",
    "abstract", "animal print", "camouflage", "tie-dye", "paisley",
    "houndstooth", "herringbone", "solid",
]

KNOWN_MATERIALS = [
    "cotton", "linen", "wool", "silk", "denim", "leather", "suede",
    "polyester", "nylon", "cashmere", "velvet", "corduroy", "satin",
    "chiffon", "tweed", "jersey", "fleece", "canvas",
]


def _extract_from_text(text: str, options: list[str]) -> str:
    """Find the first matching term from options in text."""
    lower = text.lower()
    for opt in options:
        if opt in lower:
            return opt
    return ""


# ── Cutout creation ──────────────────────────────────────────────────

def create_cutout(rgb: Image.Image, mask_png_b64: str, bbox: list[int], pad_frac: float = 0.08) -> str:
    """Create cropped RGBA cutout from full image + mask, return as data:image/png;base64,... URL."""
    mask = Image.open(io.BytesIO(base64.b64decode(mask_png_b64))).convert("L")
    if mask.size != rgb.size:
        mask = mask.resize(rgb.size, Image.Resampling.NEAREST)

    r, g, b = rgb.split()
    rgba = Image.merge("RGBA", (r, g, b, mask))

    x1, y1, x2, y2 = bbox
    w, h = rgba.size
    bw, bh = max(1, x2 - x1), max(1, y2 - y1)
    pad_x = int(bw * pad_frac)
    pad_y = int(bh * pad_frac)
    crop = rgba.crop((
        max(0, x1 - pad_x),
        max(0, y1 - pad_y),
        min(w, x2 + pad_x),
        min(h, y2 + pad_y),
    ))

    # Resize for storage efficiency (max 512px)
    crop.thumbnail((512, 512), Image.LANCZOS)

    buf = io.BytesIO()
    crop.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


# ── Garment builder ──────────────────────────────────────────────────

def build_garment(segment: dict[str, Any], cutout_b64: str) -> dict[str, Any]:
    """Build a rich garment dict from a SAM segment with Gemini annotations."""
    clothing = segment.get("clothing") or {}

    garment_type = clothing.get("garment_type", segment.get("category", "clothing item"))
    short_label = clothing.get("short_label", garment_type)
    body_region = clothing.get("body_region", "")
    details = clothing.get("notable_details", "")

    color = _extract_from_text(details + " " + short_label, KNOWN_COLORS)
    pattern = _extract_from_text(details, KNOWN_PATTERNS) or "solid"
    material = _extract_from_text(details, KNOWN_MATERIALS)
    cluster = assign_cluster(garment_type, body_region)

    # Layering role from cluster
    if cluster == "outerwear":
        layer = "outer"
    elif cluster in ("upper_body", "lower_body", "full_body"):
        layer = "inner"
    else:
        layer = "accessory"

    # Rich description for embedding
    desc_parts = [garment_type]
    if color:
        desc_parts.append(f"in {color}")
    if material:
        desc_parts.append(f"made of {material}")
    if pattern != "solid":
        desc_parts.append(f"with {pattern} pattern")
    desc_parts.append(f"for {body_region}" if body_region else "")
    if details:
        desc_parts.append(f"— {details}")
    description = " ".join(p for p in desc_parts if p).strip()

    return {
        "garment_id": str(uuid.uuid4()),
        "garment_type": garment_type,
        "sub_type": short_label,
        "primary_color": color,
        "pattern": pattern,
        "material_estimate": material,
        "body_region": body_region,
        "notable_details": details,
        "cluster": cluster,
        "cluster_label": CLUSTERS.get(cluster, {}).get("label", cluster),
        "layering_role": layer,
        "description": description,
        "image_base64": cutout_b64,
        "confidence": round(segment.get("confidence", 0), 4),
        "bbox": segment.get("bbox", []),
        "style_tags": [t.strip() for t in short_label.lower().split() if len(t.strip()) > 2][:5],
        "season": ["spring", "summer", "fall", "winter"],
        "formality_level": 5,
        "versatility_score": 5,
    }


# ── Embedding text builder ───────────────────────────────────────────

def build_embedding_text(garment: dict) -> str:
    """Build a rich text representation for embedding that captures all retrievable attributes."""
    parts = [
        garment.get("description", ""),
        f"Category: {garment.get('cluster_label', '')}.",
        f"Type: {garment.get('garment_type', '')}.",
    ]
    if garment.get("primary_color"):
        parts.append(f"Color: {garment['primary_color']}.")
    if garment.get("pattern") and garment["pattern"] != "solid":
        parts.append(f"Pattern: {garment['pattern']}.")
    if garment.get("material_estimate"):
        parts.append(f"Material: {garment['material_estimate']}.")
    if garment.get("body_region"):
        parts.append(f"Worn on: {garment['body_region']}.")
    if garment.get("layering_role"):
        parts.append(f"Layer: {garment['layering_role']}.")
    if garment.get("notable_details"):
        parts.append(garment["notable_details"])
    return " ".join(parts)


# ── HydraDB storage ─────────────────────────────────────────────────

def _store_hydradb(user_id: str, garment: dict, embedding: list[float]) -> bool:
    """Store garment in HydraDB: memory + raw embedding. Returns True on success."""
    try:
        from hydra_db import HydraDB
        from hydra_db.types.memory_item import MemoryItem
        from hydra_db.types.raw_embedding_document import RawEmbeddingDocument
        from config import settings

        client = HydraDB(token=settings.hydradb_api_key)
        tenant = settings.hydradb_tenant_id
        sub_tenant = f"user_{user_id}"
        gid = garment["garment_id"]

        # Memory (for hybrid recall)
        metadata_str = json.dumps({
            "garment_id": gid,
            "garment_type": garment.get("garment_type", ""),
            "primary_color": garment.get("primary_color", ""),
            "cluster": garment.get("cluster", ""),
            "body_region": garment.get("body_region", ""),
            "pattern": garment.get("pattern", ""),
            "material_estimate": garment.get("material_estimate", ""),
            "layering_role": garment.get("layering_role", ""),
        })
        client.upload.add_memory(
            memories=[MemoryItem(
                source_id=gid,
                text=garment.get("description", ""),
                infer=True,
                tenant_metadata=metadata_str,
            )],
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
        )

        # Raw embedding (for vector search)
        client.embeddings.insert(
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            embeddings=[RawEmbeddingDocument(
                source_id=gid,
                metadata={
                    "garment_id": gid,
                    "garment_type": garment.get("garment_type", ""),
                    "primary_color": garment.get("primary_color", ""),
                    "cluster": garment.get("cluster", ""),
                    "description": garment.get("description", ""),
                },
                embeddings=[{"chunk_id": f"{gid}_0", "embedding": embedding}],
            )],
            upsert=True,
            request_options={"timeout_in_seconds": 15},
        )
        return True
    except Exception as e:
        logger.error(f"HydraDB store failed for {garment.get('garment_id', '?')}: {e}")
        return False


# ── Main ingest pipeline ─────────────────────────────────────────────

async def ingest_segments(
    user_id: str,
    rgb: Image.Image,
    segments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Full production pipeline:
    1. Create RGBA cutout per segment
    2. Build rich garment metadata from Gemini labels
    3. Assign cluster (upper_body, lower_body, outerwear, footwear, accessory, full_body)
    4. Generate 768-dim Gemini embedding
    5. Store in HydraDB (memory + raw embedding)
    6. Store in local JSON cache (instant fallback)

    Returns list of saved garment dicts.
    """
    from services.embedder import embed_garment
    from services.local_cache import save_to_cache

    saved: list[dict[str, Any]] = []
    hydra_ok = 0
    hydra_fail = 0

    for i, seg in enumerate(segments):
        if "mask_png" not in seg or "bbox" not in seg:
            logger.warning(f"Segment {i}: missing mask_png or bbox, skipping")
            continue

        # 1. Cutout
        try:
            cutout_b64 = create_cutout(rgb, seg["mask_png"], seg["bbox"])
        except Exception as e:
            logger.error(f"Segment {i}: cutout failed: {e}")
            continue

        # 2. Build garment with cluster
        garment = build_garment(seg, cutout_b64)
        logger.info(
            f"Segment {i}: {garment['garment_type']} | "
            f"{garment['primary_color'] or '?'} | "
            f"cluster={garment['cluster']} | "
            f"conf={garment['confidence']}"
        )

        # 3. Embed
        try:
            embedding = embed_garment(garment)
            garment["_embedding"] = embedding  # keep for local search
        except Exception as e:
            logger.error(f"Segment {i}: embedding failed: {e}")
            garment["_embedding"] = None

        # 4. HydraDB (non-blocking — don't fail the pipeline if HydraDB is down)
        if garment["_embedding"]:
            ok = _store_hydradb(user_id, garment, garment["_embedding"])
            if ok:
                hydra_ok += 1
            else:
                hydra_fail += 1

        # 5. Local cache (always works)
        cache_garment = {k: v for k, v in garment.items() if k != "_embedding"}
        save_to_cache(user_id, cache_garment)

        saved.append(cache_garment)

    logger.info(
        f"Ingest complete: {len(saved)}/{len(segments)} items | "
        f"HydraDB: {hydra_ok} ok, {hydra_fail} failed | "
        f"Cache: {len(saved)} saved"
    )
    return saved
