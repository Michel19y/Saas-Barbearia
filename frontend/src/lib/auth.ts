import { apiFetch } from "./api";

const TOKEN_KEY = "barbearia_token";

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type TokenPayload = {
  sub: string;
  barbeariaId: string;
  papel: string;
  exp: number;
};

export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  return apiFetch(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
