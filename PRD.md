# StyleMe - AI-Powered Personal Wardrobe Stylist

## Product Requirements Document (PRD)

---

## 1. Executive Summary

**StyleMe** is an AI-powered personal wardrobe assistant that turns your actual closet into a smart, searchable, and style-aware database. Users upload photos of their clothes, and our AI scraper extracts every detail — garment type, color, pattern, material, season, formality level — and stores it as rich, semantically searchable context in **HydraDB**. Garment descriptions are embedded into vectors using **Gemini's text-embedding-004 model** and stored as raw embeddings in HydraDB, enabling powerful vector similarity search alongside HydraDB's built-in hybrid recall. When the user describes an event (e.g., "outdoor summer wedding," "casual Friday at a tech startup," "first date at an Italian restaurant"), StyleMe recalls the most relevant items from their wardrobe using both HydraDB's hybrid semantic + lexical recall AND custom Gemini-powered embedding search, then uses **Gemini** to generate complete outfit recommendations with visual mockups and styling explanations.

**Why this wins a hackathon:**
- Solves a real, universal, everyday problem everyone relates to
- Showcases HydraDB's core strengths (semantic memory, hybrid recall, context personalization, raw embedding storage + search)
- Demonstrates bring-your-own-embedding (BYOE) with Gemini text-embedding-004 into HydraDB
- Visually stunning demo with real outfit photos and AI-generated styling cards
- Full-stack — clean Next.js frontend + FastAPI backend + AI pipeline
- Multi-user ready — each user gets isolated data via HydraDB's multi-tenant architecture
- "Wow factor" in the live demo: upload a photo, get instant wardrobe intelligence

---

## 2. Problem Statement

Everyone has experienced the "I have nothing to wear" moment — staring at a full closet, paralyzed by choice, unsure what goes together, what fits the occasion, or what they even own. Current solutions are either:

- **Manual inventory apps** — tedious data entry, no intelligence, users abandon them
- **AI fashion apps** — use generic stock suggestions, ignore what you actually own
- **Pinterest/Instagram** — inspiration without action, not personalized to your wardrobe

**StyleMe bridges the gap**: it knows exactly what's in YOUR closet, understands the semantic nuance of events and occasions, and delivers actionable outfit picks from YOUR clothes.

---

## 3. Target Users

| Persona | Description | Key Need |
|---------|-------------|----------|
| **Busy Professional** | Limited morning time, needs quick event-appropriate outfits | "What do I wear to the client dinner tonight?" |
| **Fashion-Curious Student** | Wants to experiment with style on a budget using what they have | "How can I make these 20 items work for different vibes?" |
| **Travel Packer** | Needs to plan versatile outfits from limited items | "Pack 7 days of outfits from 10 items" |
| **Event Planner** | Has multiple events with different dress codes in a week | "Monday: board meeting. Tuesday: art gallery. Wednesday: hiking." |
| **Couples / Roommates** | Shared household wanting coordinated or non-clashing outfits | "We're both going to the same event — make sure we match" |

---

## 4. Core Features & User Flows

### 4.1 User Onboarding & Authentication

**Flow:** User signs up / logs in → gets a unique identity → all data is scoped to them

#### 4.1.1 Authentication Strategy (Hackathon-Lean)
For the hackathon, we use a **simple session-based identity** — no OAuth or passwords:

- User enters a **display name** on first visit
- Backend generates a unique `user_id` (UUID v4) and returns it as a cookie/token
- All subsequent API calls include this `user_id`
- HydraDB sub-tenant is created as `user_{user_id}` — data is fully isolated
- Returning users are identified by the stored token in `localStorage`

```python
# Backend: POST /api/auth/register
@router.post("/api/auth/register")
async def register(name: str):
    user_id = str(uuid.uuid4())
    # Create HydraDB sub-tenants for this user (auto-created on first write)
    return {
        "user_id": user_id,
        "display_name": name,
        "token": generate_jwt(user_id)  # simple JWT for API auth
    }
```

#### 4.1.2 Multi-User Data Isolation via HydraDB

HydraDB's multi-tenant architecture provides **zero-configuration user isolation**:

```
Tenant: "styleme" (the app)
├── Sub-tenant: "user_abc123"        ← User A's data
│   ├── wardrobe memories
│   ├── style preferences
│   └── embedding vectors
├── Sub-tenant: "user_def456"        ← User B's data
│   ├── wardrobe memories
│   ├── style preferences
│   └── embedding vectors
└── Sub-tenant: "user_ghi789"        ← User C's data
    └── ...
```

**Key guarantee from HydraDB docs:** "No data can ever cross tenant boundaries" — all searches are automatically scoped to the specified tenant/sub-tenant. Sub-tenants are created automatically on first write (no explicit creation API call needed).

---

### 4.2 Wardrobe Ingestion (The "Closet Scraper")

**Flow:** User uploads photos of clothing items → AI extracts metadata → embeddings generated → stored in HydraDB

#### 4.2.1 Photo Upload
- Drag-and-drop zone supporting single and bulk uploads (up to 20 images at once)
- Support JPEG, PNG, WEBP, HEIC (iPhone photos)
- Show upload progress with thumbnail previews
- Camera capture button for mobile — snap a photo directly
- Client-side image compression before upload (max 1MB per image, resize to 1024px longest edge)
- Duplicate detection: hash the image and warn if a similar garment photo already exists

#### 4.2.2 AI Clothing Scraper (Gemini Vision)
For each uploaded image, **Gemini 2.5 Flash** (vision-capable) extracts structured metadata:

```json
{
  "garment_type": "blazer",
  "sub_type": "structured single-breasted",
  "primary_color": "navy blue",
  "secondary_colors": ["white pinstripe"],
  "pattern": "pinstripe",
  "material_estimate": "wool blend",
  "season": ["fall", "winter", "spring"],
  "formality_level": 8,
  "style_tags": ["professional", "classic", "preppy"],
  "layering_role": "outer",
  "care_notes": "dry clean recommended",
  "versatility_score": 7,
  "gender_expression": "neutral",
  "color_hex": "#1B2A4A",
  "occasion_fit": ["business meeting", "smart dinner", "cocktail party", "date night"],
  "pairs_well_with": ["white dress shirt", "gray trousers", "dark jeans", "brown loafers"],
  "description": "A navy pinstripe structured blazer with notch lapels, suitable for business meetings, smart-casual events, and can be dressed down with jeans for a polished weekend look."
}
```

**Gemini Vision call:**
```python
import google.generativeai as genai

model = genai.GenerativeModel("gemini-2.5-flash")

response = model.generate_content([
    SCRAPER_PROMPT,  # detailed extraction prompt (see Section 9.1)
    {"mime_type": "image/jpeg", "data": image_base64}
])

garment_data = json.loads(response.text)
```

#### 4.2.3 Embedding Generation (Gemini text-embedding-004)

**HydraDB does NOT provide a built-in embedding model.** It supports bring-your-own-embeddings (BYOE) via the `insert_raw_embeddings` and `search_raw_embeddings` endpoints. We use **Gemini's text-embedding-004** model to generate embeddings for garment descriptions.

```python
from google import genai

# Initialize Gemini client
gemini_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def embed_garment(description: str, metadata_text: str) -> list[float]:
    """
    Generate a 768-dim embedding for a garment using Gemini text-embedding-004.
    
    We combine the natural language description with structured metadata
    to create a rich embedding that captures both semantic meaning and
    concrete attributes.
    """
    # Combine description + metadata into a single rich text for embedding
    embed_text = (
        f"{description} "
        f"Type: {metadata_text}. "
        f"Good for: {', '.join(garment['occasion_fit'])}. "
        f"Pairs well with: {', '.join(garment['pairs_well_with'])}."
    )
    
    result = gemini_client.models.embed_content(
        model="text-embedding-004",
        contents=embed_text,
        config={
            "task_type": "SEMANTIC_SIMILARITY",
            "output_dimensionality": 768  # text-embedding-004 supports up to 768
        }
    )
    
    return result.embeddings[0].values  # list[float] of length 768


def embed_query(event_description: str) -> list[float]:
    """
    Generate a 768-dim embedding for an event/search query.
    Uses RETRIEVAL_QUERY task type for asymmetric search.
    """
    result = gemini_client.models.embed_content(
        model="text-embedding-004",
        contents=event_description,
        config={
            "task_type": "RETRIEVAL_QUERY",
            "output_dimensionality": 768
        }
    )
    
    return result.embeddings[0].values
```

**Why Gemini text-embedding-004?**
- Free tier: 1,500 requests/minute — more than enough for a hackathon
- 768 dimensions — well within HydraDB's 3024 column limit
- Supports `task_type` parameter for asymmetric search (document vs. query)
- Same API key as Gemini Vision — no extra credentials needed
- State-of-the-art performance on MTEB benchmarks

#### 4.2.4 Dual Storage in HydraDB

Each garment is stored in **two ways** for maximum recall quality:

**1. User Memory (for HydraDB's built-in hybrid recall):**
```python
hydra_client.user_memory.add(
    memories=[{
        "text": garment["description"],
        "infer": True,
        "metadata": {
            "garment_id": garment_id,
            "garment_type": garment["garment_type"],
            "sub_type": garment["sub_type"],
            "primary_color": garment["primary_color"],
            "secondary_colors": garment["secondary_colors"],
            "pattern": garment["pattern"],
            "material_estimate": garment["material_estimate"],
            "season": garment["season"],
            "formality_level": garment["formality_level"],
            "style_tags": garment["style_tags"],
            "layering_role": garment["layering_role"],
            "versatility_score": garment["versatility_score"],
            "occasion_fit": garment["occasion_fit"],
            "pairs_well_with": garment["pairs_well_with"],
            "color_hex": garment["color_hex"],
            "image_base64": image_base64_thumbnail,  # compressed thumbnail
        }
    }],
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}"
)
```

**2. Raw Embeddings (for Gemini-powered vector search):**
```python
embedding_vector = embed_garment(garment["description"], metadata_text)

hydra_client.upload.upload_embeddings(
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}",
    id=garment_id,
    embeddings=[embedding_vector],
    metadata={
        "garment_id": garment_id,
        "garment_type": garment["garment_type"],
        "primary_color": garment["primary_color"],
        "formality_level": garment["formality_level"],
        "season": garment["season"],
        "description": garment["description"],
    }
)
```

**Why dual storage?**
- **User Memory** enables HydraDB's native hybrid recall (semantic + lexical) with `infer: True` for context graph building
- **Raw Embeddings** enable precise vector similarity search using our Gemini-tuned embeddings, with metadata filtering via `filter_expr`
- We query both and merge results for the best outfit recommendations

#### 4.2.5 User Review & Edit
- After AI extraction, show the user an editable card for each item
- Pre-filled fields from Gemini — user can correct any misidentifications
- Color picker to adjust the detected `color_hex`
- Toggle season badges on/off
- Adjust formality slider
- Edit description text
- "Confirm & Save" pushes final (user-corrected) data to HydraDB
- "Confirm All" button for quick bulk approval

---

### 4.3 Event-Based Outfit Recommendations

**Flow:** User describes an event → dual-path HydraDB recall (memory + embedding search) → Gemini assembles outfits → displayed as styled cards

#### 4.3.1 Event Input
The user can describe their event in **natural language**:

```
"Outdoor summer wedding in Napa Valley, semi-formal, daytime ceremony"
"Job interview at a law firm downtown, conservative dress code"
"Sunday brunch with friends, casual but cute"
"First date at a rooftop bar, evening, want to look effortlessly cool"
"Zoom call with investors, need to look polished from the waist up"
```

Alternatively, structured input with optional fields:
- **Event name** (free text) — required
- **Dress code** — dropdown: black tie, formal, semi-formal, business casual, smart casual, casual, outdoor/active, athleisure
- **Weather/season** — auto-detected from location or manual select
- **Time of day** — morning, afternoon, evening, night
- **Vibe keywords** — tag chips: "confident," "relaxed," "edgy," "romantic," "powerful," "playful"
- **Specific constraints** — "no heels," "must include the new jacket," "nothing too flashy"

#### 4.3.2 Dual-Path HydraDB Recall

```python
async def recall_wardrobe_for_event(
    user_id: str, 
    event_description: str,
    dress_code: str | None = None,
    season: str | None = None
) -> list[dict]:
    """
    Two-path recall for maximum coverage:
    Path 1: HydraDB's native hybrid recall (semantic + lexical)
    Path 2: Gemini embedding vector search with metadata filtering
    
    Results are merged, deduplicated, and ranked.
    """
    sub_tenant = f"user_{user_id}"
    
    # PATH 1: HydraDB native hybrid recall
    memory_results = await hydra_client.recall.full_recall(
        query=f"Outfit items suitable for: {event_description}",
        tenant_id="styleme",
        sub_tenant_id=sub_tenant,
        alpha=0.6,           # 60% semantic, 40% lexical
        recency_bias=0.2     # slight preference for recently added items
    )
    
    # PATH 2: Gemini embedding vector search
    query_embedding = embed_query(event_description)
    
    # Build metadata filter if structured input provided
    filter_expr = None
    if dress_code and season:
        formality_range = DRESS_CODE_TO_FORMALITY[dress_code]  # e.g., "semi-formal" → (6, 8)
        filter_expr = (
            f"formality_level >= {formality_range[0]} and "
            f"formality_level <= {formality_range[1]} and "
            f"season == '{season}'"
        )
    
    embedding_results = await hydra_client.recall.search_raw_embeddings(
        tenant_id="styleme",
        sub_tenant_id=sub_tenant,
        query_embedding=query_embedding,
        limit=20,
        filter_expr=filter_expr,
        output_fields=["garment_id", "garment_type", "description", "metadata"]
    )
    
    # PATH 3: Recall user style preferences (learned over time)
    style_prefs = await hydra_client.recall.recall_preferences(
        query="preferred style and past outfit choices",
        tenant_id="styleme",
        sub_tenant_id=sub_tenant
    )
    
    # Merge, deduplicate by garment_id, rank by combined score
    merged = merge_and_rank(memory_results, embedding_results)
    
    return merged, style_prefs
```

**Formality mapping for metadata filtering:**
```python
DRESS_CODE_TO_FORMALITY = {
    "black_tie":        (9, 10),
    "formal":           (8, 10),
    "semi_formal":      (6, 8),
    "business_casual":  (5, 7),
    "smart_casual":     (4, 6),
    "casual":           (2, 5),
    "outdoor_active":   (1, 4),
    "athleisure":       (1, 3),
}
```

#### 4.3.3 Gemini Outfit Assembly
Feed recalled items + event context + style preferences to Gemini 2.5 Flash:

```python
prompt = f"""
You are a professional fashion stylist. Given the user's wardrobe items 
and event details, create {num_outfits} complete outfit recommendations.

EVENT: {event_description}
DRESS CODE: {dress_code}
WEATHER: {weather}
TIME: {time_of_day}
VIBE: {vibe_keywords}
CONSTRAINTS: {constraints}
USER STYLE PREFERENCES: {style_prefs}

AVAILABLE WARDROBE ITEMS:
{wardrobe_items_json}

For each outfit, provide:
1. Outfit name (catchy, fun)
2. Which items to use (by garment_id)
3. Styling notes (how to wear it, tucked/untucked, sleeves rolled, etc.)
4. Accessory suggestions (from wardrobe or general recommendations)
5. Confidence rating (1-10, how well this matches the event)
6. Why this works (1-2 sentence explanation)
7. Color harmony analysis (why these colors work together)
"""
```

#### 4.3.4 Outfit Display
Each recommendation rendered as a **styled card**:
- Grid layout showing the individual garment photos composited together
- Outfit name as a header
- Color harmony strip (visual bar showing the outfit's color palette)
- Styling notes in a collapsible section
- Confidence meter (visual animated bar)
- "Wear This" button → saves to outfit history + records preference in HydraDB
- "Swap Item" → click any garment in the outfit to see alternatives from wardrobe
- "Regenerate" → get fresh suggestions with same event input
- Share button → copy outfit card as an image

---

### 4.4 Style Memory & Learning

**Flow:** As user interacts, HydraDB accumulates style intelligence across sessions

#### 4.4.1 Preference Learning
- When user selects "Wear This," store the event-outfit pair as a preference memory
- When user rejects an outfit, store negative signal
- When user swaps an item, learn the replacement preference
- HydraDB's `infer: True` builds a context graph of style patterns over time

```python
async def record_outfit_choice(
    user_id: str,
    outfit_name: str,
    event_desc: str,
    item_ids: list[str],
    reaction: str,  # "positive", "negative", "swap"
    swap_details: dict | None = None
):
    sub_tenant = f"user_{user_id}"
    
    memory_text = (
        f"User chose outfit '{outfit_name}' for event '{event_desc}'. "
        f"Items used: {item_ids}. Reaction: {reaction}."
    )
    
    if swap_details:
        memory_text += (
            f" Swapped {swap_details['original_id']} for {swap_details['replacement_id']} "
            f"because: {swap_details.get('reason', 'preferred alternative')}."
        )
    
    await hydra_client.user_memory.add(
        memories=[{
            "text": memory_text,
            "infer": True,
        }],
        tenant_id="styleme",
        sub_tenant_id=sub_tenant
    )
```

#### 4.4.2 Style Profile Generation
- After 5+ interactions, generate a "Style DNA" card using combined data:
  - Dominant colors in wardrobe (computed from `color_hex` values)
  - Preferred formality range (from garment `formality_level` distribution)
  - Most-used items (wardrobe MVPs — items selected in most outfits)
  - Style archetypes (minimalist, maximalist, classic, streetwear, etc.)
  - Gaps in wardrobe ("You have no formal shoes — consider adding some")
  - Color harmony suggestions ("Your wardrobe is navy-heavy — earth tones would expand your combos")

---

### 4.5 Smart Wardrobe Dashboard

#### 4.5.1 Wardrobe Grid View
- All garments displayed as photo cards in a responsive masonry grid
- Filter by: type, color, season, formality, style tags, layering role
- Sort by: recently added, most worn, versatility score, formality
- **Natural language search** powered by dual recall:
  - "show me my warm cozy items" → HydraDB hybrid recall
  - "something for a beach party" → Gemini embedding search
- Click a card to expand details, edit metadata, or delete

#### 4.5.2 Wardrobe Analytics
- **Total items**: count by category (tops, bottoms, outerwear, shoes, accessories)
- **Color palette**: visual color wheel of your wardrobe (using extracted `color_hex`)
- **Season coverage**: radar chart showing seasonal readiness
- **Formality distribution**: histogram showing formality levels across wardrobe
- **Versatility chart**: which items appear in the most outfit combinations
- **Wardrobe gaps**: AI-identified missing pieces that would unlock more outfit combos
- **Usage stats**: most/least worn items, outfit repeat frequency

#### 4.5.3 Outfit History
- Timeline of past outfit selections with event context
- "Rewear" button to quickly re-select a past outfit
- Rating/notes on past outfits ("loved this," "was too warm")
- Calendar view concept (shows outfits mapped to dates)

---

## 5. Technical Architecture

### 5.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                     │
│                                                             │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐│
│  │ Auth/  │ │  Upload  │ │  Event   │ │ Wardrobe │ │Style││
│  │ Onboard│ │  Page    │ │  Input   │ │ Dashboard│ │ DNA ││
│  └───┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──┬──┘│
│      │           │            │             │          │    │
│      └───────────┼────────────┼─────────────┼──────────┘    │
│                  │       REST API (JSON)                     │
│                  │    Authorization: Bearer <token>          │
└──────────────────┼──────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────────┐
│           BACKEND (FastAPI + Python 3.12+)                   │
│                  │                                           │
│  ┌───────────────┼─────────────────────────────────────────┐│
│  │         API Router Layer (auth middleware)               ││
│  │  /auth  /upload  /recommend  /wardrobe  /preferences    ││
│  └──┬──────┬────────┬───────────┬──────────┬───────────────┘│
│     │      │        │           │          │                 │
│  ┌──▼──┐┌──▼─────┐┌─▼──────┐┌──▼───┐┌────▼─────┐          │
│  │Auth ││Scraper ││Stylist ││ CRUD ││Learning  │          │
│  │ Svc ││Service ││Service ││ Svc  ││ Service  │          │
│  │     ││(Gemini ││(Gemini ││      ││          │          │
│  │     ││Vision) ││ Text)  ││      ││          │          │
│  └──┬──┘└──┬─────┘└──┬─────┘└──┬───┘└────┬────┘          │
│     │      │         │          │          │                │
│     │  ┌───▼─────────▼──────────▼──────────▼────────────┐  │
│     │  │           Embedding Service                     │  │
│     │  │     Gemini text-embedding-004 (768-dim)         │  │
│     │  │  embed_garment() | embed_query() | batch_embed()│  │
│     │  └────────────────────┬────────────────────────────┘  │
│     │                       │                               │
│  ┌──▼───────────────────────▼────────────────────────────┐  │
│  │              HydraDB Client Layer                      │  │
│  │                                                        │  │
│  │  Memory Path:              Embedding Path:             │  │
│  │  user_memory.add()         upload.upload_embeddings()  │  │
│  │  recall.full_recall()      recall.search_raw_embed..() │  │
│  │  recall.recall_prefs()     recall.filter_embeddings()  │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │     HydraDB       │
                    │     (Cloud)       │
                    │                   │
                    │  Tenant: styleme  │
                    │  ┌──────────────┐ │
                    │  │ Sub-tenant:  │ │
                    │  │ user_{id_A}  │ │
                    │  │ ├─memories   │ │
                    │  │ ├─prefs      │ │
                    │  │ └─embeddings │ │
                    │  ├──────────────┤ │
                    │  │ Sub-tenant:  │ │
                    │  │ user_{id_B}  │ │
                    │  │ ├─memories   │ │
                    │  │ ├─prefs      │ │
                    │  │ └─embeddings │ │
                    │  ├──────────────┤ │
                    │  │ Sub-tenant:  │ │
                    │  │ user_{id_C}  │ │
                    │  │ └─...        │ │
                    │  └──────────────┘ │
                    └───────────────────┘
```

### 5.2 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Modern, fast, beautiful UI with App Router |
| **Backend** | Python 3.12+, FastAPI, uvicorn | Async-first, fast, clean API design |
| **AI / Vision** | Gemini 2.5 Flash (vision + text generation) | Vision + text generation in one model, fast |
| **AI / Embeddings** | Gemini text-embedding-004 (768-dim) | Free-tier, high quality, same API key as vision |
| **Database** | HydraDB (cloud) via `hydra-db-python` SDK | Semantic memory, hybrid recall, raw embedding storage + search, context graphs |
| **Auth** | Simple JWT + localStorage (hackathon) | Fast to implement, per-user data isolation |
| **Image Storage** | Base64 in HydraDB metadata (hackathon) / S3-compatible (production) | Keep it simple for demo |
| **Package Mgmt** | uv (backend), npm (frontend) | Fast, modern tooling |

### 5.3 Embedding Pipeline Detail

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Garment Photo   │────▶│  Gemini 2.5 Flash    │────▶│  Structured JSON │
│  (user upload)   │     │  (Vision extraction) │     │  + description   │
└──────────────────┘     └──────────────────────┘     └────────┬─────────┘
                                                               │
                         ┌──────────────────────┐              │
                         │  Gemini              │◀─────────────┘
                         │  text-embedding-004  │
                         │  task: SEMANTIC_SIM   │
                         └──────────┬───────────┘
                                    │
                              768-dim vector
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │ HydraDB         │             │ HydraDB         │
          │ user_memory.add │             │ upload_embeddings│
          │ (text + meta)   │             │ (vector + meta) │
          └─────────────────┘             └─────────────────┘
                 │                               │
                 │  At query time:               │
                 ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │ full_recall()   │             │ search_raw_emb() │
          │ (hybrid search) │             │ (vector cosine)  │
          └────────┬────────┘             └────────┬────────┘
                   │                               │
                   └───────────┬───────────────────┘
                               ▼
                    ┌──────────────────┐
                    │  Merge & Rank    │
                    │  (dedupe by ID,  │
                    │   weighted score)│
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │  Gemini 2.5 Flash│
                    │  (Outfit assembly│
                    │   + styling)     │
                    └──────────────────┘
```

---

## 6. Backend Specification (FastAPI)

### 6.1 Project Structure

```
backend/
├── main.py                  # FastAPI app entrypoint, CORS, lifespan
├── config.py                # Settings via pydantic-settings (env vars)
├── dependencies.py          # Shared deps (HydraDB client, Gemini client, auth)
├── auth.py                  # JWT token generation, validation, user_id extraction
├── routers/
│   ├── __init__.py
│   ├── auth.py              # POST /api/auth/register, POST /api/auth/login
│   ├── upload.py            # POST /api/upload — clothing photo upload + scraping
│   ├── wardrobe.py          # GET /api/wardrobe, POST /api/wardrobe/confirm, DELETE
│   ├── recommend.py         # POST /api/recommend — event → outfit recommendations
│   ├── preferences.py       # GET/POST /api/preferences — style memory + DNA
│   └── health.py            # GET /api/health — healthcheck
├── services/
│   ├── __init__.py
│   ├── scraper.py           # Gemini Vision clothing extraction logic
│   ├── embedder.py          # Gemini text-embedding-004 embedding generation
│   ├── stylist.py           # Gemini outfit recommendation logic
│   ├── wardrobe.py          # HydraDB wardrobe CRUD (memory + embeddings)
│   └── learning.py          # Style preference tracking + Style DNA computation
├── models/
│   ├── __init__.py
│   ├── garment.py           # Pydantic models for garment data
│   ├── outfit.py            # Pydantic models for outfit recommendations
│   ├── event.py             # Pydantic models for event input
│   └── user.py              # Pydantic models for user/auth
├── prompts/
│   ├── scraper_prompt.txt   # Gemini prompt for clothing extraction
│   └── stylist_prompt.txt   # Gemini prompt for outfit generation
├── pyproject.toml
├── uv.lock
├── .env.example
└── .gitignore
```

### 6.2 API Endpoints

#### `POST /api/auth/register`
Create a new user identity.

**Request:**
```json
{
  "display_name": "Rudra"
}
```

**Response:** `201 Created`
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "display_name": "Rudra",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Logic:**
1. Generate UUID v4 for `user_id`
2. Sign a JWT with `user_id` as payload
3. HydraDB sub-tenant `user_{user_id}` will be auto-created on first data write

---

#### `POST /api/auth/login`
Re-authenticate with existing user_id (for returning users).

**Request:**
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response:** `200 OK`
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "wardrobe_count": 42
}
```

---

#### `POST /api/upload`
Upload clothing photos and extract metadata. **Requires auth.**

**Request:** `multipart/form-data`
```
Authorization: Bearer <token>
files: File[]          # Up to 20 image files
```

**Response:** `200 OK`
```json
{
  "items": [
    {
      "garment_id": "uuid-v4",
      "image_base64": "data:image/jpeg;base64,...",
      "extracted": {
        "garment_type": "blazer",
        "sub_type": "structured single-breasted",
        "primary_color": "navy blue",
        "secondary_colors": ["white pinstripe"],
        "pattern": "pinstripe",
        "material_estimate": "wool blend",
        "season": ["fall", "winter", "spring"],
        "formality_level": 8,
        "style_tags": ["professional", "classic"],
        "layering_role": "outer",
        "versatility_score": 7,
        "color_hex": "#1B2A4A",
        "occasion_fit": ["business meeting", "smart dinner"],
        "pairs_well_with": ["white dress shirt", "dark jeans"],
        "description": "A navy pinstripe structured blazer..."
      },
      "status": "extracted"
    }
  ],
  "count": 1
}
```

**Logic:**
1. Validate auth token, extract `user_id`
2. Receive image files, compress to max 1024px
3. For each image, call Gemini Vision → extract garment metadata
4. Return extracted data for user review (NOT yet saved to HydraDB)

---

#### `POST /api/wardrobe/confirm`
Confirm and save reviewed garments to HydraDB (dual storage). **Requires auth.**

**Request:**
```json
{
  "items": [
    {
      "garment_id": "uuid",
      "image_base64": "...",
      "garment_type": "blazer",
      "sub_type": "structured single-breasted",
      "primary_color": "navy blue",
      "secondary_colors": ["white pinstripe"],
      "pattern": "pinstripe",
      "material_estimate": "wool blend",
      "season": ["fall", "winter", "spring"],
      "formality_level": 8,
      "style_tags": ["professional", "classic"],
      "layering_role": "outer",
      "versatility_score": 7,
      "color_hex": "#1B2A4A",
      "occasion_fit": ["business meeting", "smart dinner"],
      "pairs_well_with": ["white dress shirt", "dark jeans"],
      "description": "A navy pinstripe structured blazer..."
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "saved": 1,
  "garment_ids": ["uuid"],
  "embeddings_status": "processing"
}
```

**Logic:**
1. Validate auth token, extract `user_id`
2. For each confirmed item:
   a. Generate embedding via `embed_garment()` using Gemini text-embedding-004
   b. Store as user memory in HydraDB (`user_memory.add` with `infer: True`)
   c. Store raw embedding in HydraDB (`upload.upload_embeddings`)
   d. Store image as base64 in metadata
3. Return confirmation with garment IDs

---

#### `GET /api/wardrobe`
Retrieve all wardrobe items with optional filtering. **Requires auth.**

**Query Params:**
```
?search=warm cozy         # natural language search via dual recall
?type=blazer              # filter by garment type
?color=navy               # filter by color
?season=winter            # filter by season
?formality_min=5          # minimum formality
?formality_max=9          # maximum formality
?layering=outer           # filter by layering role
?sort=recent|versatile|formality    # sort order
?limit=20&offset=0        # pagination
```

**Response:** `200 OK`
```json
{
  "items": [
    {
      "garment_id": "uuid",
      "garment_type": "blazer",
      "sub_type": "structured single-breasted",
      "primary_color": "navy blue",
      "color_hex": "#1B2A4A",
      "pattern": "pinstripe",
      "formality_level": 8,
      "season": ["fall", "winter", "spring"],
      "style_tags": ["professional", "classic"],
      "description": "A navy pinstripe structured blazer...",
      "image_base64": "...",
      "added_at": "2026-04-04T14:30:00Z",
      "times_worn": 3,
      "last_worn": "2026-04-02T09:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Logic (when `search` param is present):**
1. Embed the search query via `embed_query()`
2. Run dual-path recall (memory + embedding search)
3. Merge results, apply any additional filters
4. Return paginated results

---

#### `DELETE /api/wardrobe/{garment_id}`
Remove a garment from wardrobe. **Requires auth.**

**Response:** `200 OK`
```json
{
  "deleted": true,
  "garment_id": "uuid"
}
```

**Logic:**
1. Delete from HydraDB user memory
2. Delete from HydraDB embeddings (`delete_embeddings`)
3. Confirm deletion

---

#### `POST /api/recommend`
Get outfit recommendations for an event. **Requires auth.**

**Request:**
```json
{
  "event_description": "Outdoor summer wedding in Napa Valley",
  "dress_code": "semi-formal",
  "time_of_day": "afternoon",
  "weather": "warm and sunny",
  "vibe": ["elegant", "relaxed"],
  "constraints": "no heels, must include the new linen shirt",
  "num_outfits": 3
}
```

**Response:** `200 OK`
```json
{
  "event": "Outdoor summer wedding in Napa Valley",
  "outfits": [
    {
      "outfit_id": "uuid",
      "name": "Vineyard Elegance",
      "items": [
        {
          "garment_id": "uuid",
          "garment_type": "shirt",
          "description": "Light blue linen button-down",
          "image_base64": "...",
          "styling_note": "Sleeves rolled to mid-forearm, top button undone"
        },
        {
          "garment_id": "uuid",
          "garment_type": "trousers",
          "description": "Tan chinos",
          "image_base64": "...",
          "styling_note": "Cuffed at the ankle"
        }
      ],
      "accessory_suggestions": ["Brown leather belt", "Sunglasses", "Linen pocket square"],
      "color_harmony": {
        "palette": ["#87CEEB", "#D2B48C", "#8B4513"],
        "analysis": "Cool blue and warm tan create a complementary palette perfect for outdoor settings"
      },
      "confidence": 9,
      "explanation": "The linen shirt keeps you cool in Napa sun while the chinos hit the semi-formal mark. The earth tones complement the vineyard setting beautifully.",
      "overall_styling": "Tuck the shirt in, add a braided leather belt. Skip the tie — it's a daytime outdoor wedding, not a boardroom."
    }
  ],
  "recall_stats": {
    "memory_results": 15,
    "embedding_results": 18,
    "merged_unique": 22,
    "passed_to_stylist": 22
  }
}
```

**Logic:**
1. Validate auth, extract `user_id`
2. Run dual-path recall (see Section 4.3.2)
3. Recall style preferences
4. Feed merged items + event context + preferences to Gemini 2.5 Flash
5. Parse structured JSON response
6. Attach garment images to response
7. Return with recall stats (shows HydraDB integration depth to judges)

---

#### `POST /api/recommend/accept`
Record that user selected an outfit (for learning). **Requires auth.**

**Request:**
```json
{
  "outfit_id": "uuid",
  "event_description": "Outdoor summer wedding in Napa Valley",
  "outfit_name": "Vineyard Elegance",
  "selected_item_ids": ["uuid1", "uuid2", "uuid3"],
  "reaction": "positive"
}
```

**Response:** `200 OK`
```json
{
  "recorded": true,
  "total_preferences": 8
}
```

---

#### `POST /api/recommend/swap`
Swap one item in a recommendation and get updated styling. **Requires auth.**

**Request:**
```json
{
  "outfit_id": "uuid",
  "original_garment_id": "uuid-old",
  "replacement_garment_id": "uuid-new",
  "event_description": "Outdoor summer wedding in Napa Valley"
}
```

**Response:** `200 OK`
```json
{
  "updated_outfit": { "..." },
  "swap_analysis": "Swapping the linen shirt for the cotton henley shifts the vibe from polished to relaxed..."
}
```

---

#### `GET /api/preferences/style-dna`
Get user's computed style profile. **Requires auth.**

**Response:** `200 OK`
```json
{
  "style_archetypes": ["Classic", "Smart Casual"],
  "dominant_colors": [
    {"color": "Navy", "hex": "#1B2A4A", "percentage": 25},
    {"color": "White", "hex": "#FFFFFF", "percentage": 18},
    {"color": "Black", "hex": "#000000", "percentage": 15}
  ],
  "formality_range": {"min": 3, "max": 8, "average": 5.5},
  "formality_distribution": {
    "1-2": 3, "3-4": 8, "5-6": 15, "7-8": 12, "9-10": 4
  },
  "season_coverage": {
    "spring": 0.8,
    "summer": 0.6,
    "fall": 0.9,
    "winter": 0.7
  },
  "wardrobe_mvps": [
    {"garment_id": "uuid1", "times_used": 12, "description": "Navy blazer"},
    {"garment_id": "uuid2", "times_used": 9, "description": "White oxford shirt"},
    {"garment_id": "uuid3", "times_used": 8, "description": "Dark wash jeans"}
  ],
  "wardrobe_gaps": [
    "You're missing casual summer shoes — sandals or loafers would expand your warm-weather options",
    "No formal accessories — a watch or tie would level up your dressy outfits",
    "Your wardrobe is heavily cool-toned — adding warm earth tones (terracotta, olive) would add versatility"
  ],
  "total_items": 42,
  "category_breakdown": {
    "tops": 15,
    "bottoms": 10,
    "outerwear": 5,
    "shoes": 7,
    "accessories": 5
  },
  "outfit_history_count": 23,
  "most_common_event_types": ["work", "casual weekend", "date night"]
}
```

---

#### `GET /api/health`
```json
{
  "status": "healthy",
  "hydradb": "connected",
  "gemini_vision": "connected",
  "gemini_embeddings": "connected",
  "active_users": 5
}
```

### 6.3 Key Backend Dependencies

```toml
[project]
name = "styleme-backend"
version = "0.1.0"
description = "StyleMe - AI Wardrobe Stylist Backend"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "hydra-db-python>=0.1.5",
    "google-genai>=1.70.0",
    "python-multipart>=0.0.18",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "python-dotenv>=1.0.0",
    "python-jose[cryptography]>=3.3.0",   # JWT auth
    "pillow>=11.0.0",                      # Image compression/resizing
]
```

### 6.4 Environment Variables

```env
# Google Gemini (Vision + Embeddings + Text Generation)
GEMINI_API_KEY=your_gemini_key

# HydraDB
HYDRADB_API_KEY=your_hydradb_key
HYDRADB_TENANT_ID=styleme

# Auth
JWT_SECRET=your_random_secret_key_here

# CORS
CORS_ORIGINS=http://localhost:3000

# Optional
EMBEDDING_DIMENSIONS=768
MAX_UPLOAD_IMAGES=20
IMAGE_MAX_SIZE_PX=1024
```

### 6.5 Pydantic Models (Key Schemas)

```python
# models/garment.py
from pydantic import BaseModel, Field

class GarmentExtracted(BaseModel):
    garment_type: str
    sub_type: str
    primary_color: str
    secondary_colors: list[str] = []
    pattern: str
    material_estimate: str
    season: list[str]
    formality_level: int = Field(ge=1, le=10)
    style_tags: list[str]
    layering_role: str  # "inner", "mid", "outer"
    versatility_score: int = Field(ge=1, le=10)
    color_hex: str
    occasion_fit: list[str]
    pairs_well_with: list[str]
    description: str
    care_notes: str | None = None
    gender_expression: str | None = None

class GarmentConfirm(BaseModel):
    garment_id: str
    image_base64: str
    garment_type: str
    sub_type: str
    primary_color: str
    secondary_colors: list[str] = []
    pattern: str
    material_estimate: str
    season: list[str]
    formality_level: int = Field(ge=1, le=10)
    style_tags: list[str]
    layering_role: str
    versatility_score: int = Field(ge=1, le=10)
    color_hex: str
    occasion_fit: list[str]
    pairs_well_with: list[str]
    description: str

class GarmentResponse(BaseModel):
    garment_id: str
    garment_type: str
    sub_type: str
    primary_color: str
    color_hex: str
    pattern: str
    formality_level: int
    season: list[str]
    style_tags: list[str]
    description: str
    image_base64: str
    added_at: str
    times_worn: int = 0
    last_worn: str | None = None


# models/event.py
class EventInput(BaseModel):
    event_description: str
    dress_code: str | None = None
    time_of_day: str | None = None
    weather: str | None = None
    vibe: list[str] = []
    constraints: str | None = None
    num_outfits: int = Field(default=3, ge=1, le=5)


# models/outfit.py
class OutfitItem(BaseModel):
    garment_id: str
    garment_type: str
    description: str
    image_base64: str
    styling_note: str

class ColorHarmony(BaseModel):
    palette: list[str]  # hex colors
    analysis: str

class OutfitRecommendation(BaseModel):
    outfit_id: str
    name: str
    items: list[OutfitItem]
    accessory_suggestions: list[str]
    color_harmony: ColorHarmony
    confidence: int = Field(ge=1, le=10)
    explanation: str
    overall_styling: str


# models/user.py
class UserRegister(BaseModel):
    display_name: str = Field(min_length=1, max_length=50)

class UserResponse(BaseModel):
    user_id: str
    display_name: str
    token: str
    wardrobe_count: int = 0
```

---

## 7. Frontend Specification (Next.js 16)

### 7.1 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with global nav, fonts, theme, AuthProvider
│   │   ├── page.tsx                # Landing / hero page
│   │   ├── globals.css             # Tailwind base + custom theme tokens
│   │   ├── favicon.ico
│   │   ├── onboard/
│   │   │   └── page.tsx            # Name input + onboarding flow
│   │   ├── upload/
│   │   │   └── page.tsx            # Upload & scrape flow
│   │   ├── wardrobe/
│   │   │   └── page.tsx            # Wardrobe dashboard
│   │   ├── recommend/
│   │   │   └── page.tsx            # Event input + outfit results
│   │   └── style-dna/
│   │       └── page.tsx            # Style profile / analytics
│   ├── components/
│   │   ├── ui/                     # Reusable primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Slider.tsx          # Formality slider
│   │   │   ├── TagInput.tsx        # Vibe keyword tag input
│   │   │   ├── ColorSwatch.tsx     # Color display/picker
│   │   │   └── Dropdown.tsx
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx    # React context for auth state
│   │   │   ├── AuthGuard.tsx       # Redirect to /onboard if not authenticated
│   │   │   └── OnboardForm.tsx     # Name input + "Get Started" form
│   │   ├── upload/
│   │   │   ├── DropZone.tsx        # Drag-and-drop file upload area
│   │   │   ├── UploadPreview.tsx   # Thumbnail grid of uploaded images
│   │   │   ├── GarmentCard.tsx     # Editable extracted garment card
│   │   │   ├── GarmentEditor.tsx   # Inline editing for garment fields
│   │   │   └── ScrapeProgress.tsx  # Progress indicator during AI processing
│   │   ├── wardrobe/
│   │   │   ├── WardrobeGrid.tsx    # Masonry grid of garment cards
│   │   │   ├── FilterBar.tsx       # Type/color/season/formality filters
│   │   │   ├── SearchBar.tsx       # Natural language wardrobe search
│   │   │   └── GarmentDetail.tsx   # Expanded garment view modal
│   │   ├── recommend/
│   │   │   ├── EventForm.tsx       # Event description input form
│   │   │   ├── OutfitCard.tsx      # Single outfit recommendation card
│   │   │   ├── OutfitGrid.tsx      # Grid of outfit recommendations
│   │   │   ├── ItemSwapper.tsx     # Swap individual items in an outfit
│   │   │   ├── ConfidenceMeter.tsx # Visual confidence rating (animated)
│   │   │   └── ColorHarmonyBar.tsx # Visual color palette strip
│   │   ├── style-dna/
│   │   │   ├── ColorPalette.tsx    # Visual color wheel/breakdown
│   │   │   ├── SeasonRadar.tsx     # Radar chart for season coverage
│   │   │   ├── StyleArchetype.tsx  # Style DNA badge cards
│   │   │   ├── WardrobeGaps.tsx    # AI-identified missing pieces
│   │   │   ├── FormalityHisto.tsx  # Formality distribution histogram
│   │   │   ├── WardrobeMVPs.tsx    # Most-worn items showcase
│   │   │   └── CategoryBreakdown.tsx # Pie/bar chart of item categories
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Top navigation bar with user greeting
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── GarmentImage.tsx    # Image component with fallback
│   │       └── LoadingState.tsx    # Full-page loading skeleton
│   ├── lib/
│   │   ├── api.ts                  # API client (fetch wrapper + auth header injection)
│   │   ├── types.ts                # Shared TypeScript interfaces (mirrors backend models)
│   │   ├── auth.ts                 # Token storage, isAuthenticated, getUser
│   │   └── utils.ts                # Helpers (color mapping, formatters, image compress)
│   └── hooks/
│       ├── useAuth.ts              # Auth context hook
│       ├── useWardrobe.ts          # Wardrobe data fetching + caching
│       ├── useUpload.ts            # Upload state management
│       └── useRecommendations.ts   # Recommendation fetching
├── public/
│   ├── hero-image.png              # Landing page hero
│   └── placeholder-garment.svg     # Fallback garment image
├── package.json
├── tsconfig.json
└── next.config.ts
```

### 7.2 Frontend Auth Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ User hits │────▶│ Check        │────▶│ Has token in │
│ any page  │     │ AuthGuard    │     │ localStorage?│
└──────────┘     └──────────────┘     └──────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │ NO                            │ YES
                              ▼                               ▼
                    ┌──────────────────┐            ┌──────────────────┐
                    │ Redirect to      │            │ Inject token in  │
                    │ /onboard         │            │ API headers      │
                    │                  │            │ Render page      │
                    │ "Hi! What's your │            └──────────────────┘
                    │  name?"          │
                    │ [___________]    │
                    │ [Get Started]    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ POST /api/auth/  │
                    │ register         │
                    │                  │
                    │ Store token +    │
                    │ user_id in       │
                    │ localStorage     │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Redirect to      │
                    │ /upload          │
                    └──────────────────┘
```

### 7.3 Pages & Screens

#### 7.3.1 Landing Page (`/`)
**Purpose:** Hook the user in 3 seconds.

```
┌──────────────────────────────────────────────────────┐
│  [StyleMe Logo]            [Upload] [Wardrobe] [DNA] │
├──────────────────────────────────────────────────────┤
│                                                      │
│     Your closet, but smarter.                        │
│                                                      │
│     Upload your clothes. Describe your event.        │
│     Get the perfect outfit — from what you           │
│     already own.                                     │
│                                                      │
│     ┌──────────────────────────────┐                 │
│     │   Get Started — Upload       │                 │
│     └──────────────────────────────┘                 │
│                                                      │
│     ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│     │  Snap & │ │ Event   │ │  Style  │             │
│     │  Scrape │ │ Match   │ │ Memory  │             │
│     │         │ │         │ │         │             │
│     │Upload   │ │Describe │ │Gets     │             │
│     │photos,  │ │your     │ │smarter  │             │
│     │AI does  │ │event,   │ │with     │             │
│     │the rest │ │get fits │ │every    │             │
│     │         │ │from YOUR│ │outfit   │             │
│     │         │ │closet   │ │you pick │             │
│     └─────────┘ └─────────┘ └─────────┘             │
│                                                      │
│     Powered by HydraDB + Gemini Embeddings           │
│                 + Next.js                             │
└──────────────────────────────────────────────────────┘
```

**Design:**
- Full-viewport hero with subtle gradient background (warm tones — blush pink to cream)
- Large heading with typing animation effect
- Three feature cards with icons and brief descriptions
- Prominent CTA button with hover glow effect
- "Powered by" footer showing HydraDB + Gemini Embeddings (important for hackathon judges)

---

#### 7.3.2 Onboarding Page (`/onboard`)
**Purpose:** Quick name entry to create user identity.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│           Welcome to StyleMe                         │
│                                                      │
│     Let's get to know you.                           │
│                                                      │
│     What should we call you?                         │
│     ┌──────────────────────────────┐                 │
│     │  Rudra                       │                 │
│     └──────────────────────────────┘                 │
│                                                      │
│     ┌──────────────────────────────┐                 │
│     │   Let's Style You            │                 │
│     └──────────────────────────────┘                 │
│                                                      │
│     Your wardrobe data is private and only           │
│     visible to you.                                  │
└──────────────────────────────────────────────────────┘
```

---

#### 7.3.3 Upload Page (`/upload`)
**Purpose:** Upload photos → see AI extraction → review → confirm → store with embeddings.

**States:**
1. **Empty state** — Large drop zone with dashed border, "Drag photos of your clothes here" + file picker + camera button
2. **Uploading** — Thumbnail grid with upload progress bars per image
3. **Scraping** — "AI is analyzing your clothes..." with animated shimmer on each card
4. **Review** — Grid of editable `GarmentCard` components with extracted data
5. **Saving** — "Generating embeddings and saving to your wardrobe..." progress bar

**GarmentCard Layout:**
```
┌──────────────────────────────────────┐
│  ┌──────────┐  Garment Type: [Blazer ▾]
│  │          │  Color: [Navy Blue     ] [#]
│  │  (photo) │  Pattern: [Pinstripe   ]
│  │          │  Material: [Wool Blend  ]
│  │          │  Season: [F] [W] [Sp] [ ]
│  └──────────┘  Formality: ●●●●●●●●○○
│                Tags: [professional] [classic] [+]
│                Occasions: [business] [dinner] [+]
│                ─────────────────────────
│                AI Description:
│                "A navy pinstripe structured..."
│                [Edit]
│                ─────────────────────────
│                [Confirm]  [Remove]
└──────────────────────────────────────┘
```

---

#### 7.3.4 Recommend Page (`/recommend`)
**Purpose:** The star of the show. Describe event → get outfits.

**Layout — Two sections:**

**Top: Event Input**
```
┌──────────────────────────────────────────────────────┐
│  What are you dressing for?                          │
│  ┌──────────────────────────────────────────────┐    │
│  │ "Summer wedding in Napa Valley, semi-formal" │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Optional Details]──────────────────────────────    │
│  │ Dress Code: [Semi-formal ▾]                  │    │
│  │ Time: [Afternoon ▾]  Weather: [Warm ▾]       │    │
│  │ Vibe: [elegant] [relaxed] [+add]             │    │
│  │ Constraints: [no heels, include new jacket]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Style Me]                                          │
└──────────────────────────────────────────────────────┘
```

**Bottom: Outfit Results (after submission)**
```
┌──────────────────────────────────────────────────────┐
│  3 outfits for "Summer wedding in Napa Valley"       │
│  Found 22 items via HydraDB recall (15 memory +      │
│  18 embedding, 11 overlap)                           │
│                                                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────┐ │
│  │ Vineyard        │ │ Golden Hour     │ │ Napa   │ │
│  │ Elegance   9/10 │ │ Charm      8/10 │ │ Cool   │ │
│  │                 │ │                 │ │    7/10│ │
│  │ [==color bar==] │ │ [==color bar==] │ │ [====] │ │
│  │                 │ │                 │ │        │ │
│  │ ┌───┐ ┌───┐    │ │ ┌───┐ ┌───┐    │ │ ...    │ │
│  │ │top│ │bot│    │ │ │top│ │bot│    │ │        │ │
│  │ └───┘ └───┘    │ │ └───┘ └───┘    │ │        │ │
│  │ ┌───┐ ┌───┐    │ │ ┌───┐ ┌───┐    │ │        │ │
│  │ │sho│ │acc│    │ │ │sho│ │acc│    │ │        │ │
│  │ └───┘ └───┘    │ │ └───┘ └───┘    │ │        │ │
│  │                 │ │                 │ │        │ │
│  │ "The linen      │ │ "Go bold with   │ │        │ │
│  │  shirt keeps..." │ │  the floral..." │ │        │ │
│  │                 │ │                 │ │        │ │
│  │ [Wear This]     │ │ [Wear This]     │ │[Wear]  │ │
│  │ [Swap Items]    │ │ [Swap Items]    │ │[Swap]  │ │
│  └─────────────────┘ └─────────────────┘ └────────┘ │
│                                                      │
│  [Regenerate]                                        │
└──────────────────────────────────────────────────────┘
```

**Animations:**
- Outfit cards slide in from bottom with staggered delay
- Confidence meter fills up animatedly
- Color harmony bar renders as gradient strip
- Item photos have subtle hover zoom
- "Wear This" button has satisfying click animation (pulse + checkmark)

---

#### 7.3.5 Wardrobe Dashboard (`/wardrobe`)
**Purpose:** Browse, search, and manage your digital closet.

```
┌──────────────────────────────────────────────────────┐
│  Hi Rudra! Your Wardrobe (42 items)       [+ Upload] │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  "Show me my warm cozy items..."              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Type: [All▾] Color: [All▾] Season: [All▾]          │
│  Formality: [───●────────] Sort: [Recent▾]           │
│                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │      │ │      │ │      │ │      │ │      │      │
│  │(img) │ │(img) │ │(img) │ │(img) │ │(img) │      │
│  │      │ │      │ │      │ │      │ │      │      │
│  │Blazer│ │Shirt │ │Jeans │ │Dress │ │Snkrs │      │
│  │Navy  │ │White │ │Blue  │ │Red   │ │White │      │
│  │●●●●●●│ │●●●○○○│ │●●○○○○│ │●●●●●●│ │●●○○○○│      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│  ... (infinite scroll or pagination)                 │
└──────────────────────────────────────────────────────┘
```

---

#### 7.3.6 Style DNA Page (`/style-dna`)
**Purpose:** The "wow" analytics page that makes judges go "oooh."

```
┌──────────────────────────────────────────────────────┐
│  Rudra's Style DNA                                   │
│                                                      │
│  ┌─────────────┐  ┌──────────────────────────────┐   │
│  │ Style       │  │ Your Color Palette            │   │
│  │ Archetypes  │  │                               │   │
│  │             │  │  [██] Navy 25%                 │   │
│  │ [Classic]   │  │  [██] White 18%               │   │
│  │ [Smart      │  │  [██] Black 15%               │   │
│  │  Casual]    │  │  [██] Gray 12%                │   │
│  │             │  │  [██] Blue 10%                │   │
│  └─────────────┘  │  [██] Other 20%               │   │
│                    └──────────────────────────────┘   │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Season Readiness  │  │ Formality Distribution   │  │
│  │                   │  │                          │  │
│  │    Spring 80%     │  │  1-2: ██           3     │  │
│  │   /          \    │  │  3-4: ████████     8     │  │
│  │ Winter        Sum │  │  5-6: ████████████ 15    │  │
│  │  70%          60% │  │  7-8: ██████████   12    │  │
│  │   \          /    │  │  9-10:████         4     │  │
│  │    Fall 90%       │  │                          │  │
│  └──────────────────┘  └──────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Wardrobe MVPs (most outfit appearances)           ││
│  │ 1. Navy Blazer — 12 outfits                       ││
│  │ 2. White Oxford — 9 outfits                       ││
│  │ 3. Dark Wash Jeans — 8 outfits                    ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Wardrobe Gaps (AI recommendations)                ││
│  │                                                   ││
│  │ "You're missing casual summer shoes..."           ││
│  │ "No formal accessories — a watch or tie..."       ││
│  │ "Your wardrobe is heavily cool-toned..."          ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 7.4 Design System

#### Color Palette (Tailwind CSS tokens)
```
Primary:        #1E1E2E (deep navy-charcoal)
Primary Light:  #2D2D44
Accent:         #E8A87C (warm peach/terracotta)
Accent Light:   #F7D6C1
Success:        #85E89D
Warning:        #FFAB70
Error:          #F97583
Background:     #FAFAF9 (warm off-white)
Surface:        #FFFFFF
Text Primary:   #1E1E2E
Text Secondary: #6B7280
Border:         #E5E7EB
```

#### Typography
- **Headings:** Inter or Satoshi (modern, clean, fashion-forward)
- **Body:** Inter
- **Sizes:** text-sm (14px), text-base (16px), text-lg (18px), text-2xl (24px), text-4xl (36px)

#### Design Principles
1. **Warm minimalism** — Clean layouts with warm accent tones, not sterile
2. **Photography first** — Let clothing photos be the hero, not UI chrome
3. **Generous whitespace** — Fashion/lifestyle feel, not enterprise SaaS
4. **Micro-interactions** — Hover effects, loading shimmers, button animations
5. **Mobile-first** — Core flows (upload, recommend) must work on phone
6. **Personalized** — Show user's name throughout, "Hi Rudra!" not "Hi User"

---

## 8. HydraDB Integration Deep Dive

### 8.1 Data Architecture

**Tenant:** `styleme` (the application — single tenant)

**Sub-tenants (one per user, auto-created on first write):**
| Sub-tenant Pattern | Purpose | Data |
|-------------------|---------|------|
| `user_{user_id}` | All user data | Wardrobe memories, style preferences, raw embeddings |

**Note:** HydraDB sub-tenants are created automatically when you first write data to them. No explicit API call needed. This means user registration is instant — no HydraDB setup step required.

### 8.2 Naming Convention
```python
# Sub-tenant ID format
sub_tenant_id = f"user_{user_id}"

# Example:
# user_a1b2c3d4-e5f6-7890-abcd-ef1234567890

# All API calls for a specific user use this sub_tenant_id
# HydraDB guarantees: "No data can ever cross tenant boundaries"
# Searches are automatically scoped to the specified sub-tenant
```

### 8.3 Why HydraDB is Perfect for This

| Feature | How StyleMe Uses It |
|---------|-------------------|
| **Semantic Memory** | "Show me items for a beach party" searches by vibe, not just keywords |
| **Hybrid Recall** | Combines semantic understanding ("warm and cozy") with exact filters (season=winter) |
| **BYOE Raw Embeddings** | Store Gemini text-embedding-004 vectors for precision vector search alongside native recall |
| **Embedding Metadata Filter** | `filter_expr` enables "find similar items BUT only formal + winter" queries |
| **Context Graph** | `infer: True` learns relationships: "user always pairs navy blazer with brown shoes" |
| **Preference Learning** | `recall_preferences()` retrieves learned taste profile from outfit selections |
| **Multi-tenancy** | Each user gets isolated sub-tenant — zero data leakage, auto-created |
| **Sub-tenants** | Clean per-user isolation with no explicit creation step |
| **Recency Bias** | Prioritize recently added items ("I just bought this, use it!") |
| **Alpha Tuning** | Adjustable semantic vs. lexical balance per query type |

### 8.4 HydraDB API Methods Used

| Method | Where Used | Purpose |
|--------|-----------|---------|
| `user_memory.add()` | Wardrobe confirm, preference recording | Store garment descriptions + outfit choices |
| `recall.full_recall()` | Wardrobe search, outfit recommendation | Hybrid semantic + lexical search over memories |
| `recall.recall_preferences()` | Outfit recommendation | Retrieve learned style preferences |
| `upload.upload_embeddings()` | Wardrobe confirm | Store Gemini-generated garment embedding vectors |
| `recall.search_raw_embeddings()` | Wardrobe search, outfit recommendation | Vector similarity search with metadata filtering |
| `recall.filter_embeddings()` | Wardrobe dashboard filters | Deterministic metadata filtering on embeddings |
| `tenant.create()` | App initialization (one-time) | Create the `styleme` tenant |

### 8.5 Query Examples

```python
# "Show me something for a rainy day" — dual path
# Path 1: Native hybrid recall
memory_hits = client.recall.full_recall(
    query="waterproof or weather-resistant items suitable for rain",
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}",
    alpha=0.7
)

# Path 2: Embedding vector search
query_vec = embed_query("waterproof or weather-resistant items suitable for rain")
embedding_hits = client.recall.search_raw_embeddings(
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}",
    query_embedding=query_vec,
    limit=15,
    filter_expr="season == 'fall' or season == 'winter'"
)

# "What's my go-to style?" — preferences
style_prefs = client.recall.recall_preferences(
    query="most frequently chosen outfit style and color preferences",
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}"
)

# "Show me all my formal outerwear" — metadata filter on embeddings
formal_outer = client.recall.filter_embeddings(
    tenant_id="styleme",
    sub_tenant_id=f"user_{user_id}",
    filter_expr="formality_level >= 7 and garment_type == 'jacket'"
)
```

---

## 9. Gemini Integration Deep Dive

### 9.1 Scraper Prompt (Clothing Extraction via Gemini Vision)

```
You are an expert fashion analyst with deep knowledge of garment construction, 
textiles, color theory, and styling. Analyze this clothing item photo and extract 
detailed metadata.

For the given image, extract:

1. garment_type: (shirt, pants, blazer, dress, jacket, sweater, skirt, shorts, 
   shoes, sneakers, boots, sandals, hat, scarf, belt, watch, bag, accessory, etc.)
2. sub_type: specific style (e.g., "crew neck pullover", "slim-fit chinos", 
   "block-heel ankle boot", "oversized boyfriend blazer")
3. primary_color: dominant color name
4. secondary_colors: list of accent/trim colors
5. pattern: (solid, striped, plaid, floral, geometric, abstract, animal print, 
   tie-dye, color-block, etc.)
6. material_estimate: best guess (cotton, linen, wool, silk, denim, leather, 
   suede, synthetic, polyester blend, cashmere, etc.)
7. season: array of appropriate seasons ["spring", "summer", "fall", "winter"]
8. formality_level: 1-10 (1=loungewear/gym, 3=casual weekend, 5=smart casual, 
   7=business, 8=business formal, 9=cocktail, 10=black tie)
9. style_tags: array of 3-5 style descriptors (e.g., "minimalist", "bohemian", 
   "streetwear", "preppy", "edgy", "romantic", "athleisure")
10. layering_role: "inner" (worn closest to body), "mid" (middle layer), 
    or "outer" (outerwear/jackets)
11. versatility_score: 1-10 (how many different outfit types could use this item; 
    a white tee = 9, a sequin gown = 2)
12. color_hex: approximate hex code of the primary color (e.g., "#1B2A4A")
13. occasion_fit: array of 3-5 events/occasions this item suits 
    (e.g., "business meeting", "beach day", "date night", "wedding guest")
14. pairs_well_with: array of 3-5 complementary items this would look great with 
    (e.g., "dark slim jeans", "white sneakers", "gold hoop earrings")
15. care_notes: brief care recommendation
16. gender_expression: "masculine", "feminine", "neutral", or "any"
17. description: 2-3 sentence natural language description that captures the item's 
    character, best use cases, and styling potential. Write as if describing to a 
    personal stylist who needs to match it with other pieces.

Return as valid JSON only (no markdown, no explanation). Be specific and opinionated 
— generic answers aren't helpful for styling. If you can see brand labels, include 
the brand in the description but not as a separate field.
```

### 9.2 Embedding Strategy (Gemini text-embedding-004)

```python
# The embedding text is carefully constructed to maximize retrieval quality.
# We combine the natural description with structured attributes so that:
# - Semantic queries ("something for a beach party") match via description
# - Attribute queries ("blue formal jacket") match via structured text

def build_embedding_text(garment: dict) -> str:
    """
    Construct the text that will be embedded for this garment.
    Combines natural description with structured attributes for 
    rich, multi-faceted embeddings.
    """
    parts = [
        garment["description"],
        f"Type: {garment['garment_type']} ({garment['sub_type']}).",
        f"Color: {garment['primary_color']}.",
        f"Pattern: {garment['pattern']}.",
        f"Material: {garment['material_estimate']}.",
        f"Formality: {garment['formality_level']}/10.",
        f"Seasons: {', '.join(garment['season'])}.",
        f"Style: {', '.join(garment['style_tags'])}.",
        f"Good for: {', '.join(garment['occasion_fit'])}.",
        f"Pairs well with: {', '.join(garment['pairs_well_with'])}.",
    ]
    return " ".join(parts)


# Embedding configuration
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIMENSIONS = 768

# Task types:
# - SEMANTIC_SIMILARITY: for garment documents (symmetric)
# - RETRIEVAL_QUERY: for user event/search queries (asymmetric)
# - RETRIEVAL_DOCUMENT: alternative for garment documents

# Batch embedding for bulk uploads (up to 20 garments)
def batch_embed_garments(garments: list[dict]) -> list[list[float]]:
    texts = [build_embedding_text(g) for g in garments]
    
    result = gemini_client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config={
            "task_type": "SEMANTIC_SIMILARITY",
            "output_dimensionality": EMBEDDING_DIMENSIONS
        }
    )
    
    return [e.values for e in result.embeddings]
```

### 9.3 Stylist Prompt (Outfit Assembly)

```
You are a world-class personal stylist with deep knowledge of fashion, color theory, 
and occasion-appropriate dressing. You have access to the user's actual wardrobe.

EVENT: {event_description}
DRESS CODE: {dress_code}
TIME: {time_of_day}
WEATHER: {weather}  
VIBE: {vibe_keywords}
CONSTRAINTS: {constraints}

USER'S STYLE PREFERENCES (learned from past choices):
{style_preferences}

AVAILABLE WARDROBE ITEMS:
{items_json}

Create exactly {num_outfits} complete outfit recommendations. For each:

1. "name": A catchy, memorable outfit name (2-3 words, fun and evocative)
2. "item_ids": Array of garment_ids to use (MUST be from the available items list!)
3. "styling_notes": Object mapping each garment_id to specific styling instructions
   (e.g., "tuck in loosely", "roll sleeves to mid-forearm", "layer under the blazer",
   "leave unbuttoned over the tee")
4. "accessory_suggestions": Items to add (from wardrobe if matching IDs exist, 
   or general recommendations)
5. "color_harmony": Object with:
   - "palette": array of hex codes from the outfit items
   - "analysis": 1 sentence on why these colors work together
6. "confidence": 1-10 rating for how well this outfit matches the event
7. "explanation": 2-3 sentences explaining WHY this outfit works for this 
   specific event, referencing the dress code, weather, and vibe

RULES:
- Every outfit must include at minimum a top and bottom (or a single-piece like a dress)
- Don't repeat the same item across outfits unless the wardrobe is very small (<10 items)
- Consider: color harmony, formality matching, seasonal appropriateness, layering logic
- Higher confidence = better match. Only rate 9-10 if it's genuinely perfect.
- Be creative but practical — this person has to actually wear this.
- If the user specified constraints, RESPECT them absolutely.
- If the user's wardrobe is lacking for this event, say so in the explanation and 
  suggest what they could add.

Return as valid JSON array only. No markdown wrapping.
```

---

## 10. Demo Script (Hackathon Presentation)

### 2-Minute Demo Flow

1. **Hook (10 sec):** "Everyone has a closet full of clothes and nothing to wear. StyleMe fixes that — using HydraDB's context memory and Gemini's vision + embeddings."

2. **Onboard (5 sec):** 
   - Enter name "Rudra"
   - Show how a unique sub-tenant is created for data isolation

3. **Upload (30 sec):** 
   - Drag 5-6 clothing photos into the upload zone
   - Show AI extracting metadata in real-time ("Watch — it identified this as a navy wool blazer, formality 8, perfect for fall and winter")
   - Briefly show the editable card — "Users can correct anything the AI got wrong"
   - Hit "Confirm All"
   - Mention: "Each item gets a Gemini text-embedding-004 vector stored in HydraDB alongside the semantic memory"

4. **Recommend (40 sec):**
   - Type: "First date at a rooftop bar, evening, want to look effortlessly cool"
   - Hit "Style Me"
   - Show 3 outfit cards appearing with photos, styling notes, confidence scores, color harmony bars
   - Point out: "We queried HydraDB two ways — hybrid recall AND vector embedding search — then merged results"
   - Click "Wear This" — "This preference is stored back in HydraDB, making future recommendations better"

5. **Wardrobe (15 sec):**
   - Quick flash of the wardrobe grid
   - Type "cozy winter layers" in search — show semantic search working
   - Show the filter bar in action

6. **Style DNA (10 sec):**
   - Flash the analytics page — color palette, season radar, formality distribution, wardrobe gaps
   - "Gets smarter with every outfit you pick"

7. **Close (10 sec):**
   - "StyleMe: Your AI stylist that knows YOUR closet. HydraDB for semantic memory + BYOE vector search. Gemini for vision, embeddings, and styling. Next.js for the frontend. Works for every user with full data isolation."

---

## 11. MVP Scope vs. Future Features

### MVP (Hackathon Build)
- [ ] User onboarding with name + simple JWT auth
- [ ] Photo upload with Gemini 2.5 Flash vision scraping
- [ ] Editable garment cards with confirm/save
- [ ] Dual HydraDB storage (user memory + Gemini raw embeddings)
- [ ] Event-based outfit recommendations with dual-path recall
- [ ] Color harmony analysis in recommendations
- [ ] "Wear This" preference tracking
- [ ] Wardrobe grid view with natural language search
- [ ] Basic Style DNA page (colors, categories, gaps)
- [ ] Responsive design (desktop + mobile)
- [ ] Landing page with clear value prop + tech stack callout
- [ ] Health endpoint showing all service connections

### Post-Hackathon
- OAuth login (Google, Apple) for persistent accounts
- Calendar integration (Google Calendar → auto-suggest outfits for upcoming events)
- Weather API integration (auto-detect weather for location-aware recommendations)
- Outfit sharing / social feed between users
- Shopping recommendations (identify gaps → suggest purchases with affiliate links)
- Multi-user household support (family wardrobe with individual sub-tenants)
- Outfit photo capture (selfie → AI verifies outfit looks good on you)
- Donation/declutter suggestions for unused items
- Image segmentation (detect multiple garments in one photo)
- Try-on visualization (virtual overlay of outfit on user photo)

---

## 12. Success Metrics (For Judges)

| Criteria | How StyleMe Wins |
|----------|-----------------|
| **Innovation** | First wardrobe app using semantic context memory + BYOE vector embeddings (HydraDB + Gemini) |
| **Technical Depth** | Full-stack: Vision AI scraping + Gemini embeddings + dual-path HydraDB recall + LLM styling + modern frontend |
| **HydraDB Usage** | Deep integration: user_memory, full_recall, recall_preferences, upload_embeddings, search_raw_embeddings, filter_embeddings, infer, multi-tenant sub-tenants, alpha tuning, recency_bias, metadata filtering |
| **Embedding Strategy** | BYOE with Gemini text-embedding-004, careful text construction, task_type differentiation for asymmetric search |
| **Design & UX** | Fashion-forward UI, warm minimal aesthetic, smooth micro-interactions, personalized (user's name throughout) |
| **Multi-User** | Every user gets isolated HydraDB sub-tenant — production-ready data isolation out of the box |
| **Completeness** | Onboard → Upload → Recommend → Wardrobe → Analytics — full user journey |
| **Demo Impact** | Relatable problem + live demo with real photos = memorable presentation |
| **Practicality** | This is genuinely useful — people would actually use this app |

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Gemini Vision misidentifies clothes | User review/edit step before saving. Detailed prompt with 17 fields. |
| HydraDB API latency | Show loading states with shimmer animations. Cache wardrobe in React state after first fetch. |
| Embedding dimension mismatch | Lock to 768-dim everywhere. Validate vector length before HydraDB insert. All vectors in a tenant must match dimensions. |
| Large image uploads slow | Compress client-side (Pillow backend, canvas frontend) before upload. Limit 20 images. |
| Outfit recommendations feel generic | Dual-path recall provides richer context. Include user preference history. Specific styling notes in prompt. |
| HydraDB embedding processing delay | Embeddings take 30s-2min to process. Show "processing" status. Poll or use optimistic UI. |
| Running out of hackathon time | Priority order: Auth → Upload → Recommend → Wardrobe grid. Style DNA is polish, not core. |
| User uploads non-clothing images | Gemini Vision prompt asks specifically for clothing. If extraction fails, show error + "Is this a clothing item?" |
| Rate limits on Gemini free tier | text-embedding-004: 1,500 req/min. Batch embed up to 20 garments per call. Vision: 15 req/min on free tier — queue uploads if needed. |

---

## 14. Sequence Diagrams

### 14.1 Upload & Save Flow

```
User          Frontend         Backend          Gemini Vision    Gemini Embed     HydraDB
 │               │                │                  │               │              │
 │──drag photos──▶                │                  │               │              │
 │               │──POST /upload──▶                  │               │              │
 │               │                │──send image──────▶               │              │
 │               │                │◀──garment JSON────               │              │
 │               │◀──extracted────│                  │               │              │
 │               │                │                  │               │              │
 │──review/edit──▶                │                  │               │              │
 │──confirm──────▶                │                  │               │              │
 │               │──POST /confirm─▶                  │               │              │
 │               │                │──embed text──────────────────────▶              │
 │               │                │◀──768-dim vector─────────────────│              │
 │               │                │                  │               │              │
 │               │                │──user_memory.add────────────────────────────────▶
 │               │                │──upload_embeddings──────────────────────────────▶
 │               │                │◀──success──────────────────────────────────────│
 │               │◀──saved────────│                  │               │              │
 │◀──confirmed───│                │                  │               │              │
```

### 14.2 Recommendation Flow

```
User          Frontend         Backend          Gemini Embed     HydraDB          Gemini LLM
 │               │                │                  │              │                │
 │──describe     │                │                  │              │                │
 │  event────────▶                │                  │              │                │
 │               │──POST          │                  │              │                │
 │               │  /recommend───▶│                  │              │                │
 │               │                │                  │              │                │
 │               │                │──embed query─────▶              │                │
 │               │                │◀──query vector───│              │                │
 │               │                │                  │              │                │
 │               │                │──full_recall()────────────────▶│                │
 │               │                │──search_raw_embeddings()──────▶│                │
 │               │                │──recall_preferences()─────────▶│                │
 │               │                │◀──memory results──────────────│                │
 │               │                │◀──embedding results───────────│                │
 │               │                │◀──style preferences───────────│                │
 │               │                │                  │              │                │
 │               │                │──merge & rank────│              │                │
 │               │                │                  │              │                │
 │               │                │──items + event + prefs──────────────────────────▶
 │               │                │◀──outfit recommendations───────────────────────│
 │               │                │                  │              │                │
 │               │◀──outfits──────│                  │              │                │
 │◀──display─────│                │                  │              │                │
```

---

*Built with [HydraDB](https://hydradb.com) (semantic memory, hybrid recall, BYOE vector search) + [Gemini](https://ai.google.dev) (vision extraction, text-embedding-004, outfit generation) + [Next.js 16](https://nextjs.org) (frontend) + [FastAPI](https://fastapi.tiangolo.com) (backend)*
