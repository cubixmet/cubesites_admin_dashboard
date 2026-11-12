/**
 * Hydrate admin DataState from Django /api/admin/* when VITE_API_URL is set.
 * Maps API (paise / snake) → UI shapes (rupees / camel) used by existing screens.
 */
import { apiFetch } from "./api";
import type {
  AdminSettings,
  AuditEvent,
  BackupJob,
  Contractor,
  DataState,
  DriveConnection,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PricingVersion,
  Site,
  SiteStatus,
  Staff,
  StorageSnapshot,
  Subscription,
  SupportCase,
  TaxRule,
  Wallet,
  WalletTransaction,
} from "./types";

type AnyRec = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : Number(v) || fallback);
const paiseToInr = (paise: unknown) => Math.round(num(paise)) / 100;

function mapSiteStatus(raw: string): SiteStatus {
  if (raw === "active") return "active";
  if (raw === "inactive") return "inactive";
  return "archived";
}

function mapPaymentStatus(raw: string): PaymentStatus {
  if (raw === "pending_approval") return "pending_review";
  if (raw === "approved" || raw === "rejected" || raw === "failed" || raw === "success") return raw;
  return "pending_review";
}

function mapPaymentMethod(raw: string): PaymentMethod {
  const m: Record<string, PaymentMethod> = {
    online: "upi_gateway",
    upi: "upi_gateway",
    card: "card_gateway",
    bank_transfer: "bank_transfer",
    cash: "cash",
    cheque: "cheque",
  };
  return m[raw] ?? "bank_transfer";
}

function mapInvoiceStatus(raw: string): Invoice["status"] {
  if (raw === "paid") return "paid";
  if (raw === "overdue") return "overdue";
  return "pending";
}

function mapInvoiceLines(lines: unknown): InvoiceLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((l) => {
    const row = l as AnyRec;
    const amountPaise = num(row.amountPaise ?? row.amount_paise ?? row.amount);
    const amount = amountPaise > 1000 ? paiseToInr(amountPaise) : num(row.amount);
    return {
      type: (str(row.type, "site") as InvoiceLine["type"]) || "site",
      description: str(row.description ?? row.label ?? row.detail, "Line"),
      qty: num(row.qty, 1),
      unitPrice: num(row.unitPrice ?? row.unit_price, amount),
      amount,
    };
  });
}

function mapContractor(w: AnyRec): Contractor {
  const status = str(w.status, "active");
  return {
    id: str(w.id),
    name: str(w.business_name ?? w.name),
    ownerName: str(w.owner_name ?? w.ownerName),
    email: str(w.email),
    phone: str(w.phone),
    city: str(w.district ?? w.city),
    gstin: str(w.gstin) || undefined,
    registeredAt: str(w.created_at ?? w.registeredAt).slice(0, 10),
    status: (status === "suspended" || status === "expired"
      ? status
      : "active") as Contractor["status"],
    lastActivityAt: str(w.last_activity_at ?? w.lastActivityAt, new Date().toISOString()),
  };
}

function emptySettings(): AdminSettings {
  return {
    adminName: "Platform Admin",
    adminEmail: "admin@cubesites.in",
    prefs: {
      subscription_expiry: true,
      manual_payment: true,
      backup_failed: true,
      storage_anomaly: true,
      retention_deadline: true,
      delivery_failed: true,
    },
    ops: { backupHourIst: 2, reminderDays: [60, 30, 14, 7], maintenanceBanner: "" },
  };
}

export async function hydrateAdminFromApi(): Promise<DataState> {
  const [
    contractorsRaw,
    sitesRaw,
    staffRaw,
    paymentsRaw,
    pricingRaw,
    taxRaw,
    subsRaw,
    invoicesRaw,
    snapsRaw,
    backupsRaw,
    supportRaw,
    activityRaw,
    settingsRaw,
    notificationsRaw,
    walletsRaw,
    walletTxRaw,
  ] = await Promise.all([
    apiFetch<AnyRec[]>("/api/admin/contractors/"),
    apiFetch<AnyRec[]>("/api/admin/sites/"),
    apiFetch<AnyRec[]>("/api/admin/staff/"),
    apiFetch<AnyRec[]>("/api/admin/payments/"),
    apiFetch<AnyRec[]>("/api/admin/pricing-versions/"),
    apiFetch<AnyRec[]>("/api/admin/tax-rules/"),
    apiFetch<AnyRec[]>("/api/admin/subscriptions/"),
    apiFetch<AnyRec[]>("/api/admin/invoices/"),
    apiFetch<AnyRec[]>("/api/admin/storage/snapshots/"),
    apiFetch<AnyRec[]>("/api/admin/backups/"),
    apiFetch<AnyRec[]>("/api/admin/support/cases/"),
    apiFetch<AnyRec[]>("/api/admin/activity/"),
    apiFetch<AnyRec>("/api/admin/settings/"),
    apiFetch<AnyRec[]>("/api/admin/notifications/").catch(() => [] as AnyRec[]),
    apiFetch<{ wallets?: AnyRec[] }>("/api/admin/wallets/").catch(() => ({ wallets: [] })),
    apiFetch<AnyRec[]>("/api/admin/wallets/transactions/").catch(() => [] as AnyRec[]),
  ]);

  const contractors = contractorsRaw.map(mapContractor);

  const sites: Site[] = sitesRaw.map((s) => ({
    id: str(s.id),
    contractorId: str(s.contractorId),
    name: str(s.name),
    location: str(s.address, "—"),
    status: mapSiteStatus(str(s.status)),
    createdAt: str(s.startDate ?? s.createdAt, new Date().toISOString().slice(0, 10)),
    lastActivityAt: str(s.startDate ?? s.createdAt, new Date().toISOString()),
  }));

  const staff: Staff[] = staffRaw.map((u) => ({
    id: str(u.id),
    contractorId: str(u.contractorId),
    name: str(u.name),
    role: str(u.role),
    isOwner: Boolean(u.isOwner) || str(u.role) === "owner",
    status: u.active === false ? "disabled" : "enabled",
    siteIds: ((u.site_ids as string[]) || (u.siteIds as string[]) || []).map(String),
    createdAt: str(u.date_joined ?? u.createdAt, new Date().toISOString()),
    lastActivityAt: str(u.date_joined ?? u.createdAt, new Date().toISOString()),
  }));

  const subscriptions: Subscription[] = subsRaw.map((s) => {
    const periodEnd = str(s.periodEnd);
    return {
      id: str(s.id),
      contractorId: str(s.contractorId),
      plan: (str(s.plan, "paid") as Subscription["plan"]) || "paid",
      status: (str(s.status, "active") as Subscription["status"]) || "active",
      periodStart: str(s.periodStart),
      periodEnd,
      renewalDate: periodEnd,
      expiredAt: s.expiredAt ? str(s.expiredAt) : undefined,
    };
  });

  // Ensure every contractor has a subscription row for screens that assume it.
  for (const c of contractors) {
    if (!subscriptions.some((s) => s.contractorId === c.id)) {
      const today = new Date().toISOString().slice(0, 10);
      subscriptions.push({
        id: `sub-missing-${c.id}`,
        contractorId: c.id,
        plan: "free",
        status: c.status === "expired" ? "expired" : "active",
        periodStart: today,
        periodEnd: today,
        renewalDate: today,
      });
    }
  }

  const pricing: PricingVersion[] = pricingRaw.map((p) => ({
    id: str(p.id),
    effectiveFrom: str(p.effectiveFrom),
    siteRate: paiseToInr(p.sitePerMonth),
    freeSites: num(p.freeSites, 3),
    staffRate: paiseToInr(p.staffPerMonth),
    freeStaff: num(p.freeStaff, 1),
    storageFreeMb: num(p.freeStorageMB, 250),
    storageBlockMb: num(p.storageBlockMB, 250),
    storageBlockRate: paiseToInr(p.storageBlockPrice),
    billingDays: num(p.daysPerMonth, 30),
    createdBy: "platform",
    createdAt: str(p.effectiveFrom),
    note: str(p.label, "Pricing"),
  }));

  const taxRules: TaxRule[] = taxRaw.map((t) => ({
    id: str(t.id),
    name: str(t.label, "GST"),
    rate: num(t.ratePct, 18),
    inclusive: Boolean(t.inclusive),
    appliesTo: (Array.isArray(t.appliesTo)
      ? t.appliesTo
      : ["site", "staff", "storage", "proration"]) as TaxRule["appliesTo"],
    effectiveFrom: str(t.effectiveFrom),
    effectiveTo: t.effectiveTo ? str(t.effectiveTo) : undefined,
    invoiceLabel: str(t.label, "GST"),
    registration: str(t.gstin, ""),
  }));

  const invoices: Invoice[] = invoicesRaw.map((i) => {
    const snap = (i.taxSnapshot as AnyRec) || {};
    return {
      id: str(i.id),
      number: str(i.number),
      contractorId: str(i.contractorId),
      periodStart: str(i.periodStart),
      periodEnd: str(i.periodEnd),
      issuedAt: str(i.issuedAt),
      lines: mapInvoiceLines(i.lines),
      subtotal: paiseToInr(i.subtotalPaise),
      tax: paiseToInr(i.taxPaise),
      total: paiseToInr(i.totalPaise),
      taxSnapshot:
        snap && Object.keys(snap).length
          ? {
              name: str(snap.name ?? snap.label, "GST"),
              rate: num(snap.rate ?? snap.ratePct, 18),
              inclusive: Boolean(snap.inclusive),
              label: str(snap.label ?? snap.name, "GST"),
            }
          : null,
      pricingVersionId: str(snap.pricingVersionId, pricing[0]?.id ?? ""),
      status: mapInvoiceStatus(str(i.status)),
    };
  });

  const payments: Payment[] = paymentsRaw.map((p) => ({
    id: str(p.id),
    invoiceId: str(p.invoiceId),
    contractorId: str(p.contractorId),
    method: mapPaymentMethod(str(p.method)),
    channel:
      str(p.method) === "online" || str(p.method) === "card" || str(p.method) === "upi"
        ? "online"
        : "manual",
    amount: paiseToInr(p.amountPaise),
    tax: 0,
    status: mapPaymentStatus(str(p.status)),
    reference: str(p.reference) || str(p.invoiceNumber),
    paidAt: str(p.at),
    proofName: str(p.proofFilename) || undefined,
  }));

  const snapshots: StorageSnapshot[] = snapsRaw.map((s) => {
    const bytes = s.bytes == null ? null : num(s.bytes);
    const mb = bytes == null ? null : Math.round((bytes / (1024 * 1024)) * 100) / 100;
    return {
      id: str(s.id),
      contractorId: str(s.contractorId),
      date: str(s.date),
      mb,
      corrected: s.corrected
        ? { from: null, reason: str(s.correctionReason), by: "admin", at: str(s.date) }
        : undefined,
    };
  });

  const drive: DriveConnection[] = contractorsRaw.map((w) => ({
    contractorId: str(w.id),
    status: (str(w.drive_status, "disconnected") as DriveConnection["status"]) || "disconnected",
    email: str(w.email),
    connectedAt: undefined,
  }));

  const backups: BackupJob[] = backupsRaw.map((b) => {
    const statusRaw = str(b.status);
    const status: BackupJob["status"] =
      statusRaw === "success" ||
      statusRaw === "failed" ||
      statusRaw === "running" ||
      statusRaw === "overdue"
        ? statusRaw
        : statusRaw === "pending"
          ? "running"
          : "failed";
    const restore = str(b.restoreTestResult);
    return {
      id: str(b.id),
      contractorId: str(b.contractorId),
      type:
        str(b.jobType) === "manual"
          ? "manual"
          : str(b.jobType) === "weekly"
            ? "weekly_full"
            : "scheduled_daily",
      status,
      attemptedAt: str(b.createdAt),
      completedAt: str(b.createdAt),
      failure: status === "failed" ? str(b.note) : undefined,
      restoreTest: restore === "passed" || restore === "failed" ? restore : "not_tested",
      logs: [
        {
          at: str(b.createdAt),
          level: status === "failed" ? "error" : "info",
          message: str(b.note, status),
        },
      ],
    };
  });

  const audit: AuditEvent[] = activityRaw.map((a) => ({
    id: str(a.id),
    at: str(a.at),
    actor: str(a.actor, "system"),
    contractorId: a.contractorId ? str(a.contractorId) : undefined,
    action: str(a.action),
    target: str(a.summary),
  }));

  const support: SupportCase[] = supportRaw.map((c) => {
    const st = str(c.status, "open");
    return {
      id: str(c.id),
      contractorId: str(c.contractorId),
      subject: str(c.subject),
      description: "",
      status: (st === "closed"
        ? "resolved"
        : st === "waiting"
          ? "waiting"
          : st) as SupportCase["status"],
      priority: (str(c.priority, "medium") as SupportCase["priority"]) || "medium",
      createdAt: str(c.updatedAt),
      updatedAt: str(c.updatedAt),
      notes: [],
    };
  });

  const notifications = (notificationsRaw || []).map((n) => ({
    id: str(n.id),
    type:
      (str(n.type, "manual_payment") as DataState["notifications"][0]["type"]) || "manual_payment",
    title: str(n.title),
    message: str(n.message),
    contractorId: n.contractorId ? str(n.contractorId) : undefined,
    createdAt: str(n.createdAt),
    read: Boolean(n.read),
  }));

  const settings: AdminSettings = {
    ...emptySettings(),
    adminName: str(settingsRaw.displayName, "Platform Admin"),
    adminEmail: str(settingsRaw.contactEmail, "admin@cubesites.in"),
    prefs: {
      ...emptySettings().prefs,
      manual_payment: settingsRaw.notifyPaymentReview !== false,
      backup_failed: settingsRaw.notifyBackupFailure !== false,
    },
    ops: {
      backupHourIst: num(settingsRaw.backupHourIst, 2),
      reminderDays: Array.isArray(settingsRaw.reminderDays)
        ? (settingsRaw.reminderDays as number[])
        : [60, 30, 14, 7],
      maintenanceBanner: str(settingsRaw.maintenanceBanner),
    },
  };

  const wallets: Wallet[] = (walletsRaw.wallets || []).map((w) => ({
    contractorId: str(w.workspaceId ?? w.contractorId),
    balance: paiseToInr(w.balancePaise),
    paidRecharged: paiseToInr(w.paidRechargedPaise),
    freeRecharged: paiseToInr(w.freeRechargedPaise),
    updatedAt: str(w.updatedAt, new Date().toISOString()),
  }));

  // Ensure every contractor has a wallet row for UI lookups.
  for (const c of contractors) {
    if (!wallets.some((w) => w.contractorId === c.id)) {
      wallets.push({
        contractorId: c.id,
        balance: 0,
        paidRecharged: 0,
        freeRecharged: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const walletTransactions: WalletTransaction[] = (walletTxRaw || []).map((t) => ({
    id: str(t.id),
    contractorId: str(t.workspaceId ?? t.contractorId),
    amount: paiseToInr(t.amountPaise),
    kind: (str(t.kind, "recharge") as WalletTransaction["kind"]) || "recharge",
    funding: (str(t.funding, "paid") as WalletTransaction["funding"]) || "paid",
    source: (str(t.source, "admin") as WalletTransaction["source"]) || "admin",
    note: str(t.note),
    reference: str(t.reference),
    balanceAfter: paiseToInr(t.balanceAfterPaise),
    countsAsIncome: Boolean(t.countsAsIncome),
    createdBy: str(t.createdBy),
    createdAt: str(t.createdAt),
  }));

  return {
    contractors,
    sites,
    staff,
    subscriptions,
    pricing: pricing.length
      ? pricing
      : [
          {
            id: "pv-default",
            effectiveFrom: "2026-01-01",
            siteRate: 109,
            freeSites: 3,
            staffRate: 29,
            freeStaff: 1,
            storageFreeMb: 250,
            storageBlockMb: 250,
            storageBlockRate: 5,
            billingDays: 30,
            createdBy: "system",
            createdAt: "2026-01-01",
            note: "Default",
          },
        ],
    taxRules: taxRules.length
      ? taxRules
      : [
          {
            id: "tax-default",
            name: "GST",
            rate: 18,
            inclusive: false,
            appliesTo: ["site", "staff", "storage", "proration"],
            effectiveFrom: "2026-01-01",
            invoiceLabel: "GST @ 18%",
            registration: "",
          },
        ],
    invoices,
    payments,
    snapshots,
    drive,
    backups,
    audit,
    notifications,
    retention: [],
    support,
    settings,
    wallets,
    walletTransactions,
  };
}
