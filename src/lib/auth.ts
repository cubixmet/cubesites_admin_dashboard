// DEMO authentication only — not security. The real backend must authenticate,
// enforce super-admin roles, and audit every sensitive action server-side.
export const DEMO_CREDENTIALS = { email: "admin@cubesites.in", password: "Admin@123" };
const KEY = "cubesites-admin-session";

export interface Session { email: string; name: string; loginAt: string }

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export async function demoLogin(email: string, password: string): Promise<Session> {
  await new Promise((r) => setTimeout(r, 600));
  if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
    throw new Error("Invalid email or password.");
  }
  const s = { email: DEMO_CREDENTIALS.email, name: "Platform Admin", loginAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function demoLogout() { localStorage.removeItem(KEY); }
