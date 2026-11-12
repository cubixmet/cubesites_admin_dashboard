/**
 * HTTP client for Django Super Admin APIs.
 * Enabled when VITE_API_URL is set.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const apiEnabled = Boolean(BASE);
export const apiBase = BASE;

const TOKEN_KEY = "cubesites-admin.api.tokens";

export type ApiTokens = { access: string; refresh: string };

export function getTokens(): ApiTokens | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}

export function setTokens(tokens: ApiTokens | null) {
  if (typeof window === "undefined") return;
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<T> {
  if (!BASE) throw new ApiError(0, "VITE_API_URL is not set");
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (init.auth !== false) {
    const t = getTokens();
    if (t?.access) headers.set("Authorization", `Bearer ${t.access}`);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (res.status === 401 && init.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch(path, { ...init, auth: true });
    }
    setTokens(null);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : res.statusText;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

let refreshInFlight: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const t = getTokens();
  if (!t?.refresh) return false;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: t.refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access: string; refresh?: string };
    setTokens({
      access: data.access,
      refresh: data.refresh || t.refresh,
    });
    return true;
  } catch {
    return false;
  }
}
