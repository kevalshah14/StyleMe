import type { User } from "./types";

const TOKEN_KEY = "styleme_token";
const USER_KEY = "styleme_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("styleme_user_id");
  localStorage.removeItem("styleme_onboarded");
}

export function setOnboarded() {
  localStorage.setItem("styleme_onboarded", "true");
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("styleme_onboarded") === "true";
}

export function clearOnboarded() {
  localStorage.removeItem("styleme_onboarded");
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setToken(user.token);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
