#!/usr/bin/env python3
"""
Seed script: Scrape ~50 men's clothing images from H&M and Zara,
process through Gemini Vision, generate embeddings, and load into HydraDB.

Usage:
    cd backend
    uv run python scripts/seed_wardrobe.py --user-id <UUID>

If --user-id is omitted, creates a new demo user "DemoUser".
"""

import argparse
import asyncio
import base64
import io
import json
import logging
import os
import re
import sys
import time
import uuid
from pathlib import Path

import httpx
from PIL import Image

# Add backend root to path so we can import our services
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import settings  # noqa: E402
from services.scraper import scrape_clothing  # noqa: E402
from services.embedder import embed_garment  # noqa: E402

from hydra_db import HydraDB  # noqa: E402
from hydra_db.types.memory_item import MemoryItem  # noqa: E402
from hydra_db.types.raw_embedding_document import RawEmbeddingDocument  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("seed")

# ──────────────────────────────────────────────────────────────────────
# Browser-like headers to avoid basic bot blocks
# ────────��────────────────────────���────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

# ──────────────────────────────────────────────────────────────────────
# H&M scraping — uses their internal product listing API
# ─────────────────��────────────────────────────────────────────────────

HM_CATEGORY_URLS = [
    # Men's categories via their search/listing API
    "https://www2.hm.com/en_us/men/products/t-shirts-tank-tops.html",
    "https://www2.hm.com/en_us/men/products/shirts.html",
    "https://www2.hm.com/en_us/men/products/pants.html",
    "https://www2.hm.com/en_us/men/products/jeans.html",
    "https://www2.hm.com/en_us/men/products/hoodies-sweatshirts.html",
    "https://www2.hm.com/en_us/men/products/jackets-coats.html",
    "https://www2.hm.com/en_us/men/products/blazers-suits.html",
    "https://www2.hm.com/en_us/men/products/shorts.html",
    "https://www2.hm.com/en_us/men/products/sweaters-cardigans.html",
    "https://www2.hm.com/en_us/men/products/shoes.html",
]

# H&M product listing JSON endpoint pattern
HM_API_PATTERN = (
    "https://www2.hm.com/en_us/men/products/{category}.html"
    "?sort=stock&image-size=small&image=model&offset={offset}&page-size=10"
)

HM_CATEGORIES = [
    "t-shirts-tank-tops",
    "shirts",
    "pants",
    "jeans",
    "hoodies-sweatshirts",
    "jackets-coats",
    "blazers-suits",
    "shorts",
    "sweaters-cardigans",
    "shoes",
]


async def scrape_hm_images(client: httpx.AsyncClient, target: int = 25) -> list[dict]:
    """Scrape product images from H&M category pages."""
    images = []

    for category in HM_CATEGORIES:
        if len(images) >= target:
            break

        url = f"https://www2.hm.com/en_us/men/products/{category}.html"
        log.info(f"[H&M] Fetching category: {category}")

        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
            if resp.status_code != 200:
                log.warning(f"[H&M] {category} returned {resp.status_code}")
                continue

            html = resp.text

            # Try to find __NEXT_DATA__ JSON (Next.js SSR)
            next_data_match = re.search(
                r'<script\s+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL
            )
            if next_data_match:
                try:
                    data = json.loads(next_data_match.group(1))
                    products = _extract_hm_products_from_next_data(data)
                    for p in products:
                        if len(images) >= target:
                            break
                        images.append(p)
                    log.info(f"[H&M] Got {len(products)} from __NEXT_DATA__ in {category}")
                    continue
                except json.JSONDecodeError:
                    pass

            # Fallback: extract image URLs from HTML with regex
            img_urls = re.findall(
                r'(https?://(?:lp2?\.hm\.com|image\.hm\.com)/[^\s"\']+\.jpe?g[^\s"\']*)',
                html,
            )
            # Deduplicate and filter for product images
            seen = set()
            for img_url in img_urls:
                clean_url = img_url.split("?")[0]
                if clean_url in seen:
                    continue
                seen.add(clean_url)
                if any(kw in clean_url.lower() for kw in ["product", "model", "main"]):
                    images.append({
                        "url": img_url,
                        "source": "H&M",
                        "category": category.replace("-", " ").title(),
                    })
                    if len(images) >= target:
                        break

            if not img_urls:
                # Last resort: grab any reasonable image URLs
                all_imgs = re.findall(r'src="(https://[^"]+\.jpe?g[^"]*)"', html)
                for img_url in all_imgs[:5]:
                    if "hm.com" in img_url and len(images) < target:
                        images.append({
                            "url": img_url,
                            "source": "H&M",
                            "category": category.replace("-", " ").title(),
                        })

            log.info(f"[H&M] Total so far: {len(images)}")

        except Exception as e:
            log.error(f"[H&M] Error fetching {category}: {e}")

        await asyncio.sleep(1.5)  # polite delay

    return images[:target]


def _extract_hm_products_from_next_data(data: dict) -> list[dict]:
    """Walk the __NEXT_DATA__ JSON to find product image URLs."""
    products = []

    def walk(obj, depth=0):
        if depth > 10:
            return
        if isinstance(obj, dict):
            # Look for product-like structures with image URLs
            if "image" in obj and isinstance(obj["image"], str) and "hm.com" in obj["image"]:
                products.append({
                    "url": obj["image"] if obj["image"].startswith("http") else f"https:{obj['image']}",
                    "source": "H&M",
                    "name": obj.get("title", obj.get("name", "")),
                    "category": obj.get("category", ""),
                })
            if "images" in obj and isinstance(obj["images"], list):
                for img in obj["images"][:1]:  # first image only
                    url = img.get("url", img.get("src", "")) if isinstance(img, dict) else str(img)
                    if url and "hm.com" in url:
                        products.append({
                            "url": url if url.startswith("http") else f"https:{url}",
                            "source": "H&M",
                            "name": obj.get("title", obj.get("name", "")),
                        })
            for v in obj.values():
                walk(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, depth + 1)

    walk(data)
    return products


# ─���───────────────────────────��────────────────────────────────────────
# Zara scraping
# ──────────────────────────────────────────────────────────────────────

ZARA_CATEGORY_URLS = [
    "https://www.zara.com/us/en/man-tshirts-l855.html",
    "https://www.zara.com/us/en/man-shirts-l737.html",
    "https://www.zara.com/us/en/man-trousers-l838.html",
    "https://www.zara.com/us/en/man-jeans-l659.html",
    "https://www.zara.com/us/en/man-jackets-l640.html",
    "https://www.zara.com/us/en/man-blazers-l608.html",
    "https://www.zara.com/us/en/man-sweatshirts-l821.html",
    "https://www.zara.com/us/en/man-shorts-l814.html",
    "https://www.zara.com/us/en/man-knitwear-l691.html",
    "https://www.zara.com/us/en/man-shoes-l769.html",
]


async def scrape_zara_images(client: httpx.AsyncClient, target: int = 25) -> list[dict]:
    """Scrape product images from Zara category pages."""
    images = []

    for url in ZARA_CATEGORY_URLS:
        if len(images) >= target:
            break

        category = url.split("/")[-1].replace("man-", "").split("-l")[0].replace("-", " ").title()
        log.info(f"[Zara] Fetching: {category}")

        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
            if resp.status_code != 200:
                log.warning(f"[Zara] {category} returned {resp.status_code}")
                continue

            html = resp.text

            # Zara embeds product data in window.__PRELOADED_STATE__ or similar
            state_match = re.search(
                r'window\.__PRELOADED_STATE__\s*=\s*({.*?});?\s*</script>',
                html,
                re.DOTALL,
            )
            if state_match:
                try:
                    state = json.loads(state_match.group(1))
                    zara_products = _extract_zara_products(state)
                    for p in zara_products:
                        if len(images) >= target:
                            break
                        images.append(p)
                    log.info(f"[Zara] Got {len(zara_products)} from preloaded state")
                    continue
                except json.JSONDecodeError:
                    pass

            # Fallback: extract image URLs from static.zara.net
            img_urls = re.findall(
                r'(https://static\.zara\.net/photos/[^\s"\']+\.jpe?g[^\s"\']*)',
                html,
            )
            seen = set()
            for img_url in img_urls:
                clean = img_url.split("?")[0]
                if clean in seen:
                    continue
                seen.add(clean)
                images.append({
                    "url": img_url,
                    "source": "Zara",
                    "category": category,
                })
                if len(images) >= target:
                    break

            # Also try srcset patterns
            if not img_urls:
                all_imgs = re.findall(r'(?:src|srcset)="(https://static\.zara\.net[^"\s]+)"', html)
                for img_url in all_imgs[:5]:
                    if len(images) < target:
                        images.append({
                            "url": img_url.split(" ")[0],
                            "source": "Zara",
                            "category": category,
                        })

            log.info(f"[Zara] Total so far: {len(images)}")

        except Exception as e:
            log.error(f"[Zara] Error fetching {category}: {e}")

        await asyncio.sleep(1.5)

    return images[:target]


def _extract_zara_products(state: dict) -> list[dict]:
    """Extract product image URLs from Zara's preloaded state."""
    products = []

    def walk(obj, depth=0):
        if depth > 12:
            return
        if isinstance(obj, dict):
            # Zara product nodes often have 'xmedia' with image data
            if "xmedia" in obj and isinstance(obj["xmedia"], list):
                for media in obj["xmedia"][:1]:
                    if isinstance(media, dict):
                        path = media.get("path", "")
                        name = media.get("name", "")
                        if path:
                            url = f"https://static.zara.net/photos/{path}/{name}"
                            products.append({
                                "url": url,
                                "source": "Zara",
                                "name": obj.get("name", ""),
                                "category": obj.get("familyName", ""),
                            })
            # Also check for direct image URLs
            if "src" in obj and isinstance(obj["src"], str) and "zara.net" in obj["src"]:
                products.append({
                    "url": obj["src"],
                    "source": "Zara",
                    "name": obj.get("alt", obj.get("name", "")),
                })
            for v in obj.values():
                walk(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, depth + 1)

    walk(state)
    return products


# ────────────────────────────────────────────────��─────────────────────
# Fallback: curated men's clothing image URLs (guaranteed to work)
# These are publicly accessible product images / stock photos
# ──────────────────────────────────────────────────────────────────────

FALLBACK_IMAGES = [
    # T-shirts
    {"url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600", "source": "stock", "category": "T-Shirts", "hint": "white crew neck t-shirt"},
    {"url": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600", "source": "stock", "category": "T-Shirts", "hint": "black t-shirt on hanger"},
    {"url": "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600", "source": "stock", "category": "T-Shirts", "hint": "colorful folded t-shirts"},
    {"url": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600", "source": "stock", "category": "T-Shirts", "hint": "olive green t-shirt"},
    {"url": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600", "source": "stock", "category": "T-Shirts", "hint": "navy blue t-shirt"},
    # Shirts
    {"url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600", "source": "stock", "category": "Shirts", "hint": "white dress shirt"},
    {"url": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600", "source": "stock", "category": "Shirts", "hint": "blue oxford shirt"},
    {"url": "https://images.unsplash.com/photo-1598033129183-c4f50c736c10?w=600", "source": "stock", "category": "Shirts", "hint": "plaid flannel shirt"},
    {"url": "https://images.unsplash.com/photo-1563630423918-b58f07336a9a?w=600", "source": "stock", "category": "Shirts", "hint": "linen shirt beige"},
    {"url": "https://images.unsplash.com/photo-1589310621235-221cfb69ea72?w=600", "source": "stock", "category": "Shirts", "hint": "denim shirt"},
    # Pants / Jeans
    {"url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600", "source": "stock", "category": "Pants", "hint": "blue jeans"},
    {"url": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600", "source": "stock", "category": "Pants", "hint": "khaki chinos"},
    {"url": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600", "source": "stock", "category": "Pants", "hint": "black slim jeans"},
    {"url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600", "source": "stock", "category": "Pants", "hint": "light wash jeans"},
    {"url": "https://images.unsplash.com/photo-1519568470290-c0c1fbfff16f?w=600", "source": "stock", "category": "Pants", "hint": "gray trousers"},
    # Jackets / Outerwear
    {"url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600", "source": "stock", "category": "Jackets", "hint": "brown leather jacket"},
    {"url": "https://images.unsplash.com/photo-1544923246-77307dd270cb?w=600", "source": "stock", "category": "Jackets", "hint": "denim jacket"},
    {"url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600", "source": "stock", "category": "Jackets", "hint": "puffer jacket black"},
    {"url": "https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=600", "source": "stock", "category": "Jackets", "hint": "bomber jacket green"},
    {"url": "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=600", "source": "stock", "category": "Jackets", "hint": "raincoat navy"},
    # Blazers / Suits
    {"url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600", "source": "stock", "category": "Blazers", "hint": "navy blazer suit"},
    {"url": "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=600", "source": "stock", "category": "Blazers", "hint": "charcoal blazer"},
    {"url": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600", "source": "stock", "category": "Blazers", "hint": "tan blazer casual"},
    # Sweaters / Hoodies
    {"url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600", "source": "stock", "category": "Hoodies", "hint": "gray hoodie"},
    {"url": "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600", "source": "stock", "category": "Sweaters", "hint": "cable knit sweater cream"},
    {"url": "https://images.unsplash.com/photo-1614975059251-992f11792571?w=600", "source": "stock", "category": "Hoodies", "hint": "black zip hoodie"},
    {"url": "https://images.unsplash.com/photo-1580657018950-c7f7d6a6d990?w=600", "source": "stock", "category": "Sweaters", "hint": "navy crewneck sweater"},
    {"url": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600", "source": "stock", "category": "Sweaters", "hint": "turtleneck black"},
    # Shorts
    {"url": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600", "source": "stock", "category": "Shorts", "hint": "khaki shorts"},
    {"url": "https://images.unsplash.com/photo-1560243563-062bfc001d68?w=600", "source": "stock", "category": "Shorts", "hint": "denim shorts blue"},
    {"url": "https://images.unsplash.com/photo-1565084888279-aca5ecc8f8e5?w=600", "source": "stock", "category": "Shorts", "hint": "athletic shorts black"},
    # Shoes
    {"url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600", "source": "stock", "category": "Shoes", "hint": "red nike sneakers"},
    {"url": "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600", "source": "stock", "category": "Shoes", "hint": "colorful sneakers"},
    {"url": "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=600", "source": "stock", "category": "Shoes", "hint": "white minimalist sneakers"},
    {"url": "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600", "source": "stock", "category": "Shoes", "hint": "brown leather boots"},
    {"url": "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600", "source": "stock", "category": "Shoes", "hint": "brown oxford dress shoes"},
    {"url": "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600", "source": "stock", "category": "Shoes", "hint": "vans old skool sneakers"},
    # Accessories
    {"url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600", "source": "stock", "category": "Accessories", "hint": "leather belt brown"},
    {"url": "https://images.unsplash.com/photo-1509941943102-10c232fc06e0?w=600", "source": "stock", "category": "Accessories", "hint": "wristwatch silver"},
    {"url": "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=600", "source": "stock", "category": "Accessories", "hint": "beanie hat gray"},
    {"url": "https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=600", "source": "stock", "category": "Accessories", "hint": "sunglasses aviator"},
    # More variety
    {"url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600", "source": "stock", "category": "Shirts", "hint": "polo shirt navy"},
    {"url": "https://images.unsplash.com/photo-1618517351616-38fb9c5210c6?w=600", "source": "stock", "category": "T-Shirts", "hint": "striped t-shirt"},
    {"url": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600", "source": "stock", "category": "Blazers", "hint": "linen blazer beige"},
    {"url": "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600", "source": "stock", "category": "Pants", "hint": "jogger pants olive"},
    {"url": "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=600", "source": "stock", "category": "Jackets", "hint": "windbreaker jacket"},
    {"url": "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=600", "source": "stock", "category": "Sweaters", "hint": "cardigan navy"},
    {"url": "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600", "source": "stock", "category": "Shorts", "hint": "swim trunks floral"},
    {"url": "https://images.unsplash.com/photo-1575537302964-96cd47c06b1b?w=600", "source": "stock", "category": "Shoes", "hint": "loafers tan suede"},
    {"url": "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=600", "source": "stock", "category": "Jackets", "hint": "trench coat beige"},
    {"url": "https://images.unsplash.com/photo-1611312449408-fcece27cdbb7?w=600", "source": "stock", "category": "T-Shirts", "hint": "henley shirt gray"},
]


# ───��─────────────────────────────��────────────────────────────────────
# Image download and processing
# ──────────────────────────────────────────────────────────────────────

async def download_image(client: httpx.AsyncClient, url: str) -> bytes | None:
    """Download an image and return raw bytes."""
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 1000:
            return resp.content
    except Exception as e:
        log.warning(f"Failed to download {url[:80]}...: {e}")
    return None


def process_image(raw_bytes: bytes, max_size: int = 1024) -> str:
    """Compress image and return base64 JPEG."""
    img = Image.open(io.BytesIO(raw_bytes))
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ─────���─────────��────────────────────────────────────���─────────────────
# HydraDB ingestion (reuses backend service logic)
# ──────────────────────────────────────────────────────────────────────

def save_to_hydradb(
    hydra_client: HydraDB,
    tenant: str,
    sub_tenant: str,
    garment_id: str,
    garment: dict,
    embedding: list[float],
) -> bool:
    """Store garment in HydraDB: memory + raw embedding."""
    description = garment.get("description", "A clothing item")

    # PATH 1: User memory (hybrid recall)
    try:
        metadata = json.dumps({
            "garment_id": garment_id,
            "garment_type": garment.get("garment_type", ""),
            "sub_type": garment.get("sub_type", ""),
            "primary_color": garment.get("primary_color", ""),
            "pattern": garment.get("pattern", ""),
            "formality_level": garment.get("formality_level", 5),
            "season": garment.get("season", []),
            "style_tags": garment.get("style_tags", []),
            "layering_role": garment.get("layering_role", ""),
            "versatility_score": garment.get("versatility_score", 5),
            "color_hex": garment.get("color_hex", ""),
            "occasion_fit": garment.get("occasion_fit", []),
            "description": description,
            "image_base64": garment.get("image_base64", ""),
        })
        memory = MemoryItem(
            source_id=garment_id,
            text=description,
            infer=True,
            tenant_metadata=metadata,
        )
        hydra_client.upload.add_memory(
            memories=[memory],
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
        )
    except Exception as e:
        log.error(f"  Memory save failed: {e}")
        return False

    # PATH 2: Raw embedding (vector search)
    try:
        doc = RawEmbeddingDocument(
            source_id=garment_id,
            metadata={
                "garment_id": garment_id,
                "garment_type": garment.get("garment_type", ""),
                "sub_type": garment.get("sub_type", ""),
                "primary_color": garment.get("primary_color", ""),
                "formality_level": garment.get("formality_level", 5),
                "description": description,
                "season": garment.get("season", []),
                "style_tags": garment.get("style_tags", []),
                "image_base64": garment.get("image_base64", ""),
            },
            embeddings=[{"chunk_id": f"{garment_id}_0", "embedding": embedding}],
        )
        hydra_client.embeddings.insert(
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            embeddings=[doc],
            upsert=True,
        )
    except Exception as e:
        log.error(f"  Embedding save failed: {e}")
        return False

    return True


# ───────────────────���──────────────────────────────────────────────────
# Main pipeline
# ───────────────────���──────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Seed StyleMe wardrobe with scraped clothing images")
    parser.add_argument("--user-id", default=None, help="Existing user UUID. Creates demo user if omitted.")
    parser.add_argument("--target", type=int, default=50, help="Target number of images (default 50)")
    parser.add_argument("--skip-scrape", action="store_true", help="Skip H&M/Zara scraping, use fallback images only")
    args = parser.parse_args()

    user_id = args.user_id or str(uuid.uuid4())
    target = args.target
    sub_tenant = f"user_{user_id}"
    tenant = settings.hydradb_tenant_id

    # Validate keys
    if not settings.gemini_api_key:
        log.error("GEMINI_API_KEY not set in .env")
        sys.exit(1)
    if not settings.hydradb_api_key:
        log.error("HYDRADB_API_KEY not set in .env")
        sys.exit(1)

    log.info(f"=== StyleMe Wardrobe Seeder ===")
    log.info(f"User ID:    {user_id}")
    log.info(f"Sub-tenant: {sub_tenant}")
    log.info(f"Target:     {target} items")
    log.info(f"Tenant:     {tenant}")
    log.info("")

    # ── Step 1: Collect image URLs ────────────────────────────────
    all_images: list[dict] = []

    async with httpx.AsyncClient() as http_client:
        if not args.skip_scrape:
            log.info("Step 1: Scraping H&M and Zara...")

            hm_target = target // 2
            zara_target = target - hm_target

            hm_images = await scrape_hm_images(http_client, target=hm_target)
            log.info(f"  H&M: {len(hm_images)} images found")

            zara_images = await scrape_zara_images(http_client, target=zara_target)
            log.info(f"  Zara: {len(zara_images)} images found")

            all_images = hm_images + zara_images
        else:
            log.info("Step 1: Skipping scraping (--skip-scrape)")

        # Fill remaining with fallback stock images
        remaining = target - len(all_images)
        if remaining > 0:
            log.info(f"  Adding {remaining} fallback stock images to reach target...")
            all_images.extend(FALLBACK_IMAGES[:remaining])

        all_images = all_images[:target]
        log.info(f"  Total images to process: {len(all_images)}")
        log.info("")

        # ── Step 2: Download images ──────────────────────────────
        log.info("Step 2: Downloading images...")
        downloaded = []

        for i, img_info in enumerate(all_images):
            url = img_info["url"]
            raw = await download_image(http_client, url)
            if raw:
                try:
                    b64 = process_image(raw)
                    downloaded.append({**img_info, "base64": b64})
                    log.info(f"  [{i+1}/{len(all_images)}] Downloaded: {url[:60]}...")
                except Exception as e:
                    log.warning(f"  [{i+1}/{len(all_images)}] Process failed: {e}")
            else:
                log.warning(f"  [{i+1}/{len(all_images)}] Download failed: {url[:60]}...")

            if i % 5 == 4:
                await asyncio.sleep(0.5)

    log.info(f"  Successfully downloaded: {len(downloaded)}")
    log.info("")

    # ── Step 3: Gemini Vision extraction ──────────────────────────
    log.info("Step 3: Extracting metadata with Gemini Vision...")
    processed = []

    for i, item in enumerate(downloaded):
        log.info(f"  [{i+1}/{len(downloaded)}] Analyzing {item.get('hint', item.get('category', 'image'))}...")
        try:
            extracted = await scrape_clothing(item["base64"])
            garment_dict = extracted.model_dump()
            garment_dict["garment_id"] = str(uuid.uuid4())
            garment_dict["image_base64"] = item["base64"]
            garment_dict["source_url"] = item["url"]
            garment_dict["source_brand"] = item.get("source", "unknown")
            processed.append(garment_dict)
            log.info(f"    -> {garment_dict['garment_type']} | {garment_dict['primary_color']} | formality {garment_dict['formality_level']}")
        except Exception as e:
            log.error(f"    -> Extraction failed: {e}")

        # Gemini rate limit: ~15 req/min on free tier
        if i % 10 == 9:
            log.info("    (pausing 10s for rate limits...)")
            await asyncio.sleep(10)
        else:
            await asyncio.sleep(2)

    log.info(f"  Successfully extracted: {len(processed)}")
    log.info("")

    # ── Step 4: Generate embeddings ─��────────────────────────────
    log.info("Step 4: Generating Gemini text-embedding-004 embeddings...")
    embeddings_map = {}

    for i, garment in enumerate(processed):
        try:
            vec = embed_garment(garment)
            embeddings_map[garment["garment_id"]] = vec
            log.info(f"  [{i+1}/{len(processed)}] Embedded: {garment['garment_type']} ({len(vec)} dims)")
        except Exception as e:
            log.error(f"  [{i+1}/{len(processed)}] Embedding failed: {e}")

        if i % 20 == 19:
            await asyncio.sleep(2)

    log.info(f"  Embeddings generated: {len(embeddings_map)}")
    log.info("")

    # ── Step 5: Save to local cache + HydraDB ──────────────────
    from services.local_cache import save_to_cache

    log.info("Step 5: Saving to local cache + HydraDB (dual: memory + embedding)...")
    hydra_client = HydraDB(token=settings.hydradb_api_key)
    success_count = 0
    cache_count = 0

    for i, garment in enumerate(processed):
        gid = garment["garment_id"]
        embedding = embeddings_map.get(gid)

        # Always save to local cache (instant, no network dependency)
        cache_item = {
            "garment_id": gid,
            "garment_type": garment.get("garment_type", ""),
            "sub_type": garment.get("sub_type", ""),
            "primary_color": garment.get("primary_color", ""),
            "color_hex": garment.get("color_hex", "#808080"),
            "pattern": garment.get("pattern", ""),
            "material_estimate": garment.get("material_estimate", ""),
            "formality_level": garment.get("formality_level", 5),
            "season": garment.get("season", []),
            "style_tags": garment.get("style_tags", []),
            "layering_role": garment.get("layering_role", ""),
            "versatility_score": garment.get("versatility_score", 5),
            "occasion_fit": garment.get("occasion_fit", []),
            "description": garment.get("description", ""),
            "image_base64": f"data:image/jpeg;base64,{garment.get('image_base64', '')}",
        }
        save_to_cache(user_id, cache_item)
        cache_count += 1

        if not embedding:
            log.warning(f"  [{i+1}] Skipping HydraDB for {gid} — no embedding")
            continue

        ok = save_to_hydradb(
            hydra_client=hydra_client,
            tenant=tenant,
            sub_tenant=sub_tenant,
            garment_id=gid,
            garment=garment,
            embedding=embedding,
        )
        if ok:
            success_count += 1
            log.info(f"  [{i+1}/{len(processed)}] Saved: {garment['garment_type']} — {garment['primary_color']}")
        else:
            log.error(f"  [{i+1}/{len(processed)}] HydraDB failed: {gid}")

        await asyncio.sleep(0.3)

    # ── Summary ──────────────────────────────────────────────────
    log.info("")
    log.info("=" * 55)
    log.info(f"  SEED COMPLETE")
    log.info(f"  User ID:         {user_id}")
    log.info(f"  Images scraped:  {len(all_images)}")
    log.info(f"  Downloaded:      {len(downloaded)}")
    log.info(f"  AI-processed:    {len(processed)}")
    log.info(f"  Embeddings:      {len(embeddings_map)}")
    log.info(f"  Local cache:     {cache_count}")
    log.info(f"  Saved to HydraDB:{success_count}")
    log.info(f"  Sub-tenant:      {sub_tenant}")
    log.info("=" * 55)
    log.info("")
    log.info(f"Use this user_id to log in: {user_id}")
    log.info(f"Or run the backend and POST /api/auth/login with this user_id")


if __name__ == "__main__":
    asyncio.run(main())
