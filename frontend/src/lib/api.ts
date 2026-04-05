import { getToken } from "./auth";
import type {
  EventInput,
  GarmentConfirmItem,
  GarmentUploadItem,
  OutfitRecommendation,
  StyleDNA,
  User,
  ChatResponse,
  WardrobeMatch,
  WardrobeMatchResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function register(displayName: string): Promise<User> {
  return request<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
  });
}

/** Name + full-body reference + selfie (face enrollment). Returns JWT user. */
export async function onboard(
  displayName: string,
  fullBody: File,
  selfie: File,
): Promise<User> {
  const form = new FormData();
  form.append("display_name", displayName.trim());
  form.append("full_body", fullBody);
  form.append("selfie", selfie);

  const res = await fetch(`${BASE}/api/auth/onboard`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { detail?: unknown };
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail) && j.detail[0] && typeof (j.detail[0] as { msg?: string }).msg === "string") {
        msg = (j.detail[0] as { msg: string }).msg;
      }
    } catch {
      /* use raw */
    }
    throw new Error(msg.length > 200 ? `${msg.slice(0, 200)}…` : msg);
  }
  return res.json() as Promise<User>;
}

export async function login(userId: string): Promise<User> {
  return request<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function uploadPhotos(files: File[]): Promise<GarmentUploadItem[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return request<GarmentUploadItem[]>("/api/upload", {
    method: "POST",
    body: form,
  });
}

export async function confirmGarments(items: GarmentConfirmItem[]): Promise<{
  saved: number;
  garment_ids: string[];
  failed?: number;
  failed_ids?: string[];
}> {
  return request("/api/wardrobe/confirm", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function getWardrobe(search?: string): Promise<{ items: WardrobeMatch[]; total: number }> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(`/api/wardrobe${params}`);
}

export async function deleteGarment(id: string): Promise<void> {
  return request(`/api/wardrobe/${id}`, { method: "DELETE" });
}

export async function getRecommendations(event: EventInput): Promise<OutfitRecommendation[]> {
  return request<OutfitRecommendation[]>("/api/recommend", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export async function searchWardrobeMatches(query: string, limit = 12): Promise<WardrobeMatchResponse> {
  return request<WardrobeMatchResponse>("/api/recommend/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

export async function acceptOutfit(data: {
  outfit_id: string;
  event_description: string;
  outfit_name: string;
  selected_item_ids: string[];
  reaction: string;
}): Promise<void> {
  return request("/api/recommend/accept", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStyleDNA(): Promise<StyleDNA> {
  return request<StyleDNA>("/api/preferences/style-dna");
}

export async function chat(
  message: string,
  history: { role: string; content: string }[] = []
): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function inspectStats(): Promise<Record<string, unknown>> {
  return request("/api/inspect/stats");
}

export async function inspectMemories(query = "all items"): Promise<Record<string, unknown>> {
  return request(`/api/inspect/memories?query=${encodeURIComponent(query)}`);
}

export async function inspectEmbeddings(query = "clothing"): Promise<Record<string, unknown>> {
  return request(`/api/inspect/embeddings?query=${encodeURIComponent(query)}`);
}

export async function healthCheck(): Promise<Record<string, string>> {
  return request("/api/health");
}
