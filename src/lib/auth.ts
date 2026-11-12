// Auth: Django JWT when VITE_API_URL is set; otherwise hardcoded demo login.
import { apiEnabled, apiFetch, getTokens, setTokens, tryRefresh } from "./api";

export const DEMO_CREDENTIALS = { email: "admin@cubesites.in", password: "Admin@123" };
const KEY = "cubesites-admin-session";

export interface Session {
  email: string;
  name: string;
  loginAt: string;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export async function demoLogin(email: string, password: string): Promise<Session> {
  if (apiEnabled) {
    const data = await apiFetch<{
      user: { email: string; name: string; is_platform_admin?: boolean };
      tokens: { access: string; refresh: string };
    }>("/api/auth/login/", {
      method: "POST",
      json: { identifier: email, password },
      auth: false,
    });
    if (!data.user.is_platform_admin) {
      throw new Error("This account is not a platform administrator.");
    }
    setTokens(data.tokens);
    const s = {
      email: data.user.email,
      name: data.user.name || "Platform Admin",
      loginAt: new Date().toISOString(),
    };
    writeSession(s);
    return s;
  }

  await new Promise((r) => setTimeout(r, 600));
  if (
    email.trim().toLowerCase() !== DEMO_CREDENTIALS.email ||
    password !== DEMO_CREDENTIALS.password
  ) {
    throw new Error("Invalid email or password.");
  }
  const s = {
    email: DEMO_CREDENTIALS.email,
    name: "Platform Admin",
    loginAt: new Date().toISOString(),
  };
  writeSession(s);
  return s;
}

export function demoLogout() {
  setTokens(null);
  writeSession(null);
}

export async function restoreAdminSession(): Promise<boolean> {
  if (!apiEnabled) return Boolean(getSession());
  const s = getSession();
  const tokens = getTokens();
  if (!s || !tokens?.refresh) {
    demoLogout();
    return false;
  }
  await tryRefresh();
  try {
    const me = await apiFetch<{
      user: { is_platform_admin?: boolean; email: string; name: string };
    }>("/api/auth/me/");
    if (!me.user.is_platform_admin) {
      demoLogout();
      return false;
    }
    writeSession({ ...s, email: me.user.email, name: me.user.name || s.name });
    return true;
  } catch {
    demoLogout();
    return false;
  }
}
