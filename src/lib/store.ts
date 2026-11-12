// Admin data store. With VITE_API_URL set, reads/writes go through Django;
// otherwise the localStorage demo seed is used.
import { useSyncExternalStore } from "react";
import { createSeed } from "./mock/seed";
import type {
  AuditEvent,
  DataState,
  PricingVersion,
  SupportCase,
  TaxRule,
  AdminSettings,
  WalletFunding,
} from "./types";
import { getSession } from "./auth";
import { apiEnabled, apiFetch } from "./api";
import { hydrateAdminFromApi } from "./sync";

const KEY = "cubesites-admin-demo-v1";
const seed = createSeed();
let state: DataState = seed;
let loaded = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  if (apiEnabled) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DataState;
      state = {
        ...seed,
        ...parsed,
        wallets: parsed.wallets ?? seed.wallets,
        walletTransactions: parsed.walletTransactions ?? seed.walletTransactions,
      };
    }
  } catch {
    state = seed;
  }
}

function commit(next: DataState) {
  state = next;
  if (!apiEnabled) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota */
    }
  }
  listeners.forEach((l) => l());
}

const actor = () => getSession()?.email ?? "unknown";
const nowIso = () => new Date().toISOString();
const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function withAudit(next: DataState, e: Omit<AuditEvent, "id" | "at" | "actor">): DataState {
  return { ...next, audit: [{ ...e, id: uid("a"), at: nowIso(), actor: actor() }, ...next.audit] };
}

export function getState() {
  load();
  return state;
}
export function useData<T>(sel: (s: DataState) => T): T {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getState(),
    () => seed,
  );
  return sel(snap);
}

const cname = (id: string) => state.contractors.find((c) => c.id === id)?.name ?? id;

export async function hydrateAdminStore(): Promise<void> {
  if (!apiEnabled) {
    load();
    return;
  }
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const next = await hydrateAdminFromApi();
    commit(next);
  })().finally(() => {
    hydrating = null;
  });
  return hydrating;
}

export const actions = {
  resetDemo() {
    if (apiEnabled) {
      // Re-pull live data instead of wiping the server.
      void hydrateAdminStore();
      return;
    }
    const fresh = createSeed();
    commit(withAudit(fresh, { action: "demo.reset", target: "All demo data" }));
  },
  logAuth(action: "auth.login" | "auth.logout") {
    load();
    if (!apiEnabled) {
      commit(withAudit(state, { action, target: "Admin session" }));
    }
  },
  async setContractorStatus(id: string, status: "active" | "suspended", reason: string) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/contractors/${id}/status/`, {
        method: "POST",
        json: { status, reason },
      });
      await hydrateAdminStore();
      return;
    }
    const c = state.contractors.find((x) => x.id === id)!;
    commit(
      withAudit(
        {
          ...state,
          contractors: state.contractors.map((x) => (x.id === id ? { ...x, status } : x)),
        },
        {
          action: status === "suspended" ? "contractor.suspend" : "contractor.activate",
          contractorId: id,
          target: c.name,
          before: c.status,
          after: status,
          reason,
        },
      ),
    );
  },
  async reviewPayment(id: string, decision: "approved" | "rejected", reason: string) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/payments/${id}/review/`, {
        method: "POST",
        json: { decision, reason },
      });
      await hydrateAdminStore();
      return;
    }
    const p = state.payments.find((x) => x.id === id)!;
    if (p.status !== "pending_review") return;
    const payments = state.payments.map((x) =>
      x.id === id
        ? {
            ...x,
            status: decision,
            reviewedBy: actor(),
            reviewedAt: nowIso(),
            reviewReason: reason || undefined,
          }
        : x,
    );
    const invoices =
      decision === "approved"
        ? state.invoices.map((i) => (i.id === p.invoiceId ? { ...i, status: "paid" as const } : i))
        : state.invoices;
    commit(
      withAudit(
        { ...state, payments, invoices },
        {
          action: `payment.${decision === "approved" ? "approve" : "reject"}`,
          contractorId: p.contractorId,
          target: p.reference,
          before: "pending_review",
          after: decision,
          reason: reason || undefined,
        },
      ),
    );
  },
  async correctSnapshot(id: string, mb: number, reason: string) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/storage/snapshots/${id}/corrections/`, {
        method: "POST",
        json: { mb, reason },
      });
      await hydrateAdminStore();
      return;
    }
    const s = state.snapshots.find((x) => x.id === id)!;
    const snapshots = state.snapshots.map((x) =>
      x.id === id ? { ...x, mb, corrected: { from: x.mb, reason, by: actor(), at: nowIso() } } : x,
    );
    commit(
      withAudit(
        { ...state, snapshots },
        {
          action: "storage.correct",
          contractorId: s.contractorId,
          target: `Snapshot ${s.date}`,
          before: s.mb === null ? "missing" : `${s.mb} MB`,
          after: `${mb} MB`,
          reason,
        },
      ),
    );
  },
  async addPricingVersion(v: Omit<PricingVersion, "id" | "createdBy" | "createdAt">) {
    if (apiEnabled) {
      await apiFetch("/api/admin/pricing-versions/", {
        method: "POST",
        json: {
          label: v.note || "Pricing",
          effectiveFrom: v.effectiveFrom,
          sitePerMonth: Math.round(v.siteRate * 100),
          freeSites: v.freeSites,
          staffPerMonth: Math.round(v.staffRate * 100),
          freeStaff: v.freeStaff,
          freeStorageMB: v.storageFreeMb,
          storageBlockMB: v.storageBlockMb,
          storageBlockPrice: Math.round(v.storageBlockRate * 100),
          daysPerMonth: v.billingDays,
        },
      });
      await hydrateAdminStore();
      return;
    }
    const pv: PricingVersion = { ...v, id: uid("pv"), createdBy: actor(), createdAt: nowIso() };
    commit(
      withAudit(
        { ...state, pricing: [...state.pricing, pv] },
        {
          action: "pricing.version_create",
          target: `Effective ${v.effectiveFrom}`,
          after: `Site ₹${v.siteRate}, Staff ₹${v.staffRate}, Storage ₹${v.storageBlockRate}/${v.storageBlockMb}MB`,
          reason: v.note,
        },
      ),
    );
  },
  async addTaxRule(t: Omit<TaxRule, "id">, reason: string) {
    if (apiEnabled) {
      await apiFetch("/api/admin/tax-rules/", {
        method: "POST",
        json: {
          label: t.name,
          ratePct: t.rate,
          inclusive: t.inclusive,
          appliesTo: t.appliesTo,
          effectiveFrom: t.effectiveFrom,
          gstin: t.registration,
        },
      });
      await hydrateAdminStore();
      return;
    }
    const dayBefore = new Date(new Date(t.effectiveFrom).getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    const taxRules = state.taxRules.map((r) =>
      !r.effectiveTo && r.effectiveFrom < t.effectiveFrom ? { ...r, effectiveTo: dayBefore } : r,
    );
    commit(
      withAudit(
        { ...state, taxRules: [...taxRules, { ...t, id: uid("tax") }] },
        {
          action: "tax.create",
          target: t.name,
          after: `${t.rate}% ${t.inclusive ? "inclusive" : "exclusive"} from ${t.effectiveFrom}`,
          reason,
        },
      ),
    );
  },
  async retryBackup(id: string) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/backups/${id}/retry/`, { method: "POST", json: {} });
      await hydrateAdminStore();
      return;
    }
    const b = state.backups.find((x) => x.id === id)!;
    const d = state.drive.find((x) => x.contractorId === b.contractorId);
    const ok = d?.status === "connected";
    const t = nowIso();
    const backups = state.backups.map((x) =>
      x.id === id
        ? {
            ...x,
            status: ok ? ("success" as const) : ("failed" as const),
            attemptedAt: t,
            completedAt: ok ? t : undefined,
            failure: ok ? undefined : "Demo retry: Drive still not authorized",
            logs: [
              ...x.logs,
              {
                at: t,
                level: ok ? ("info" as const) : ("error" as const),
                message: ok
                  ? "Demo retry succeeded (simulated, no real backup)"
                  : "Demo retry failed (simulated)",
              },
            ],
          }
        : x,
    );
    commit(
      withAudit(
        { ...state, backups },
        {
          action: "backup.retry_demo",
          contractorId: b.contractorId,
          target: b.id,
          before: b.status,
          after: ok ? "success" : "failed",
        },
      ),
    );
  },
  reviewRestore(id: string, result: "passed" | "failed") {
    const b = state.backups.find((x) => x.id === id)!;
    const t = nowIso();
    const backups = state.backups.map((x) =>
      x.id === id
        ? {
            ...x,
            restoreTest: result,
            logs: [
              ...x.logs,
              {
                at: t,
                level: "info" as const,
                message: `Demo restore review marked ${result} (simulated)`,
              },
            ],
          }
        : x,
    );
    commit(
      withAudit(
        { ...state, backups },
        {
          action: "backup.restore_review_demo",
          contractorId: b.contractorId,
          target: b.id,
          before: b.restoreTest,
          after: result,
        },
      ),
    );
  },
  markRead(id: string | "all") {
    commit({
      ...state,
      notifications: state.notifications.map((n) =>
        id === "all" || n.id === id ? { ...n, read: true } : n,
      ),
    });
  },
  async updateCase(id: string, patch: Partial<Pick<SupportCase, "status" | "priority">>) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/support/cases/${id}/`, { method: "PATCH", json: patch });
      await hydrateAdminStore();
      return;
    }
    const c = state.support.find((x) => x.id === id)!;
    const key = Object.keys(patch)[0] as "status" | "priority";
    commit(
      withAudit(
        {
          ...state,
          support: state.support.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x,
          ),
        },
        {
          action: `support.${key}`,
          contractorId: c.contractorId,
          target: c.subject,
          before: c[key],
          after: patch[key],
        },
      ),
    );
  },
  async addNote(id: string, text: string) {
    if (apiEnabled) {
      await apiFetch(`/api/admin/support/cases/${id}/notes/`, {
        method: "POST",
        json: { body: text, internal: true },
      });
      await hydrateAdminStore();
      return;
    }
    const c = state.support.find((x) => x.id === id)!;
    commit(
      withAudit(
        {
          ...state,
          support: state.support.map((x) =>
            x.id === id
              ? {
                  ...x,
                  updatedAt: nowIso(),
                  notes: [...x.notes, { id: uid("sn"), by: actor(), at: nowIso(), text }],
                }
              : x,
          ),
        },
        { action: "support.note", contractorId: c.contractorId, target: c.subject },
      ),
    );
  },
  async updateSettings(s: AdminSettings) {
    if (apiEnabled) {
      await apiFetch("/api/admin/settings/", {
        method: "PUT",
        json: {
          displayName: s.adminName,
          contactEmail: s.adminEmail,
          backupHourIst: s.ops.backupHourIst,
          reminderDays: s.ops.reminderDays,
          maintenanceBanner: s.ops.maintenanceBanner,
          notifyPaymentReview: s.prefs.manual_payment,
          notifyBackupFailure: s.prefs.backup_failed,
        },
      });
      await hydrateAdminStore();
      return;
    }
    commit(
      withAudit({ ...state, settings: s }, { action: "settings.update", target: "Admin settings" }),
    );
  },
  sendRetentionReminder(contractorId: string, daysBefore: number) {
    commit(
      withAudit(
        {
          ...state,
          retention: [
            ...state.retention,
            {
              id: uid("rn"),
              contractorId,
              sentAt: nowIso(),
              channel: "email",
              daysBefore,
              delivery: "sent",
            },
          ],
        },
        {
          action: "retention.reminder_demo",
          contractorId,
          target: cname(contractorId),
          after: `Mock reminder (${daysBefore} days before)`,
        },
      ),
    );
  },
  async rechargeWallet(
    contractorId: string,
    amountInr: number,
    funding: WalletFunding,
    note: string,
    reference = "",
  ) {
    if (!(amountInr > 0)) throw new Error("Enter a positive amount.");
    if (funding !== "free" && funding !== "paid") throw new Error("Choose free or paid.");
    if (apiEnabled) {
      await apiFetch(`/api/admin/contractors/${contractorId}/wallet/`, {
        method: "POST",
        json: { amountInr, funding, note, reference },
      });
      await hydrateAdminStore();
      return;
    }
    load();
    const wallets = [...(state.wallets || [])];
    let w = wallets.find((x) => x.contractorId === contractorId);
    if (!w) {
      w = { contractorId, balance: 0, paidRecharged: 0, freeRecharged: 0, updatedAt: nowIso() };
      wallets.push(w);
    }
    const next = {
      ...w,
      balance: Math.round((w.balance + amountInr) * 100) / 100,
      paidRecharged:
        funding === "paid"
          ? Math.round((w.paidRecharged + amountInr) * 100) / 100
          : w.paidRecharged,
      freeRecharged:
        funding === "free"
          ? Math.round((w.freeRecharged + amountInr) * 100) / 100
          : w.freeRecharged,
      updatedAt: nowIso(),
    };
    const walletTransactions = [
      {
        id: uid("wt"),
        contractorId,
        amount: amountInr,
        kind: "recharge" as const,
        funding,
        source: "admin" as const,
        note,
        reference,
        balanceAfter: next.balance,
        countsAsIncome: funding === "paid",
        createdBy: actor(),
        createdAt: nowIso(),
      },
      ...(state.walletTransactions || []),
    ];
    commit(
      withAudit(
        {
          ...state,
          wallets: wallets.map((x) => (x.contractorId === contractorId ? next : x)),
          walletTransactions,
        },
        {
          action: "wallet.recharge",
          contractorId,
          target: cname(contractorId),
          after: `₹${amountInr} (${funding})`,
          reason: note || undefined,
        },
      ),
    );
  },
};
