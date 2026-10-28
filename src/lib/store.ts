// Mock service layer: a single locally-persisted store. Every admin action goes
// through here and appends an audit event. Replace these functions with API calls
// to the real backend (which must enforce super-admin permissions + auditing).
import { useSyncExternalStore } from "react";
import { createSeed } from "./mock/seed";
import type { AuditEvent, DataState, PricingVersion, SupportCase, TaxRule, AdminSettings } from "./types";
import { getSession } from "./auth";

const KEY = "cubesites-admin-demo-v1";
const seed = createSeed();
let state: DataState = seed;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    state = seed;
  }
}
function commit(next: DataState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}
const actor = () => getSession()?.email ?? "unknown";
const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function withAudit(next: DataState, e: Omit<AuditEvent, "id" | "at" | "actor">): DataState {
  return { ...next, audit: [{ ...e, id: uid("a"), at: nowIso(), actor: actor() }, ...next.audit] };
}

export function getState() { load(); return state; }
export function useData<T>(sel: (s: DataState) => T): T {
  const snap = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => getState(),
    () => seed,
  );
  return sel(snap);
}

const cname = (id: string) => state.contractors.find((c) => c.id === id)?.name ?? id;

export const actions = {
  resetDemo() {
    const fresh = createSeed();
    commit(withAudit(fresh, { action: "demo.reset", target: "All demo data" }));
  },
  logAuth(action: "auth.login" | "auth.logout") {
    load();
    commit(withAudit(state, { action, target: "Admin session" }));
  },
  setContractorStatus(id: string, status: "active" | "suspended", reason: string) {
    const c = state.contractors.find((x) => x.id === id)!;
    commit(withAudit(
      { ...state, contractors: state.contractors.map((x) => (x.id === id ? { ...x, status } : x)) },
      { action: status === "suspended" ? "contractor.suspend" : "contractor.activate", contractorId: id, target: c.name, before: c.status, after: status, reason },
    ));
  },
  reviewPayment(id: string, decision: "approved" | "rejected", reason: string) {
    const p = state.payments.find((x) => x.id === id)!;
    if (p.status !== "pending_review") return;
    const payments = state.payments.map((x) => x.id === id ? { ...x, status: decision, reviewedBy: actor(), reviewedAt: nowIso(), reviewReason: reason || undefined } : x);
    const invoices = decision === "approved" ? state.invoices.map((i) => (i.id === p.invoiceId ? { ...i, status: "paid" as const } : i)) : state.invoices;
    commit(withAudit({ ...state, payments, invoices }, { action: `payment.${decision === "approved" ? "approve" : "reject"}`, contractorId: p.contractorId, target: p.reference, before: "pending_review", after: decision, reason: reason || undefined }));
  },
  correctSnapshot(id: string, mb: number, reason: string) {
    const s = state.snapshots.find((x) => x.id === id)!;
    const snapshots = state.snapshots.map((x) => x.id === id ? { ...x, mb, corrected: { from: x.mb, reason, by: actor(), at: nowIso() } } : x);
    commit(withAudit({ ...state, snapshots }, { action: "storage.correct", contractorId: s.contractorId, target: `Snapshot ${s.date}`, before: s.mb === null ? "missing" : `${s.mb} MB`, after: `${mb} MB`, reason }));
  },
  addPricingVersion(v: Omit<PricingVersion, "id" | "createdBy" | "createdAt">) {
    const pv: PricingVersion = { ...v, id: uid("pv"), createdBy: actor(), createdAt: nowIso() };
    commit(withAudit({ ...state, pricing: [...state.pricing, pv] }, { action: "pricing.version_create", target: `Effective ${v.effectiveFrom}`, after: `Site ₹${v.siteRate}, Staff ₹${v.staffRate}, Storage ₹${v.storageBlockRate}/${v.storageBlockMb}MB`, reason: v.note }));
  },
  addTaxRule(t: Omit<TaxRule, "id">, reason: string) {
    // Close the currently-open rule the day before the new one starts.
    const dayBefore = new Date(new Date(t.effectiveFrom).getTime() - 86400000).toISOString().slice(0, 10);
    const taxRules = state.taxRules.map((r) => (!r.effectiveTo && r.effectiveFrom < t.effectiveFrom ? { ...r, effectiveTo: dayBefore } : r));
    commit(withAudit({ ...state, taxRules: [...taxRules, { ...t, id: uid("tax") }] }, { action: "tax.create", target: t.name, after: `${t.rate}% ${t.inclusive ? "inclusive" : "exclusive"} from ${t.effectiveFrom}`, reason }));
  },
  retryBackup(id: string) {
    const b = state.backups.find((x) => x.id === id)!;
    const d = state.drive.find((x) => x.contractorId === b.contractorId);
    const ok = d?.status === "connected";
    const t = nowIso();
    const backups = state.backups.map((x) => x.id === id ? {
      ...x, status: ok ? ("success" as const) : ("failed" as const), attemptedAt: t, completedAt: ok ? t : undefined, failure: ok ? undefined : "Demo retry: Drive still not authorized",
      logs: [...x.logs, { at: t, level: ok ? ("info" as const) : ("error" as const), message: ok ? "Demo retry succeeded (simulated, no real backup)" : "Demo retry failed (simulated)" }],
    } : x);
    commit(withAudit({ ...state, backups }, { action: "backup.retry_demo", contractorId: b.contractorId, target: b.id, before: b.status, after: ok ? "success" : "failed" }));
  },
  reviewRestore(id: string, result: "passed" | "failed") {
    const b = state.backups.find((x) => x.id === id)!;
    const t = nowIso();
    const backups = state.backups.map((x) => x.id === id ? { ...x, restoreTest: result, logs: [...x.logs, { at: t, level: "info" as const, message: `Demo restore review marked ${result} (simulated)` }] } : x);
    commit(withAudit({ ...state, backups }, { action: "backup.restore_review_demo", contractorId: b.contractorId, target: b.id, before: b.restoreTest, after: result }));
  },
  markRead(id: string | "all") {
    commit({ ...state, notifications: state.notifications.map((n) => (id === "all" || n.id === id ? { ...n, read: true } : n)) });
  },
  updateCase(id: string, patch: Partial<Pick<SupportCase, "status" | "priority">>) {
    const c = state.support.find((x) => x.id === id)!;
    const key = Object.keys(patch)[0] as "status" | "priority";
    commit(withAudit({ ...state, support: state.support.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x)) }, { action: `support.${key}`, contractorId: c.contractorId, target: c.subject, before: c[key], after: patch[key] }));
  },
  addNote(id: string, text: string) {
    const c = state.support.find((x) => x.id === id)!;
    commit(withAudit({ ...state, support: state.support.map((x) => x.id === id ? { ...x, updatedAt: nowIso(), notes: [...x.notes, { id: uid("sn"), by: actor(), at: nowIso(), text }] } : x) }, { action: "support.note", contractorId: c.contractorId, target: c.subject }));
  },
  updateSettings(s: AdminSettings) {
    commit(withAudit({ ...state, settings: s }, { action: "settings.update", target: "Admin settings" }));
  },
  sendRetentionReminder(contractorId: string, daysBefore: number) {
    commit(withAudit({ ...state, retention: [...state.retention, { id: uid("rn"), contractorId, sentAt: nowIso(), channel: "email", daysBefore, delivery: "sent" }] }, { action: "retention.reminder_demo", contractorId, target: cname(contractorId), after: `Mock reminder (${daysBefore} days before)` }));
  },
};
