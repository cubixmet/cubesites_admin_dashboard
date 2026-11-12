// Centralized, deterministic mock dataset. Components never import this directly —
// they read through the store (src/lib/store.ts), which the backend API will replace.
import { buildLines, computeTax, pricingAt, taxRuleAt, averageStorageMb } from "../billing";
import type {
  AppNotification,
  AuditEvent,
  BackupJob,
  Contractor,
  DataState,
  DriveConnection,
  Invoice,
  Payment,
  PaymentMethod,
  PricingVersion,
  RetentionNotice,
  Site,
  Staff,
  StorageSnapshot,
  Subscription,
  SupportCase,
  TaxRule,
  Wallet,
  WalletTransaction,
} from "../types";

/** Fixed demo "today" so the dataset is reproducible. */
export const DEMO_TODAY = "2026-10-28";
export const CURRENT_PERIOD = { start: "2026-10-01", end: "2026-10-30" };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20261028);
const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const at = (iso: string, h = int(8, 19), m = int(0, 59)) =>
  `${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`;

const BUSINESSES: [string, string, string][] = [
  ["Malabar Constructions", "Abdul Rasheed K", "Kozhikode"],
  ["Periyar Builders", "Joseph Mathew", "Aluva"],
  ["Thrissur Infra Works", "Suresh Menon", "Thrissur"],
  ["Kochi Coastal Developers", "Anil Kumar P", "Kochi"],
  ["Ananthapuri Projects", "Lakshmi Nair", "Thiruvananthapuram"],
  ["Kottayam Homes & Interiors", "Thomas Kurian", "Kottayam"],
  ["Palakkad Civil Contractors", "Ramesh Varma", "Palakkad"],
  ["Kannur Structurals", "Mohammed Shafi", "Kannur"],
  ["Alleppey Waterfront Builders", "Biju George", "Alappuzha"],
  ["Idukki Hillside Constructions", "Sajan Varghese", "Thodupuzha"],
  ["Kollam Cashew Coast Infra", "Divya Pillai", "Kollam"],
  ["Wayanad Green Builders", "Vinod Kumar C", "Kalpetta"],
  ["Pathanamthitta Estates", "Reji Abraham", "Pathanamthitta"],
  ["Kasaragod Bay Contractors", "Ibrahim Badusha", "Kasaragod"],
];
const SITE_WORDS = [
  "Villa",
  "Apartment Block",
  "Commercial Complex",
  "Bungalow",
  "School Annex",
  "Warehouse",
  "Church Hall",
  "Clinic",
  "Bridge Repair",
  "Road Widening",
  "Mall Fitout",
  "Resort Cottages",
];
const AREAS = [
  "Edappally",
  "Kakkanad",
  "Vyttila",
  "Panampilly Nagar",
  "Pattom",
  "Kowdiar",
  "Chalakudy",
  "Guruvayur",
  "Mavoor Road",
  "Ottapalam",
  "Changanassery",
  "Kumarakom",
  "Munnar",
  "Vadakara",
  "Thalassery",
];
const FIRST = [
  "Arun",
  "Sreejith",
  "Nikhil",
  "Jibin",
  "Anoop",
  "Rahul",
  "Shibu",
  "Akhil",
  "Midhun",
  "Fathima",
  "Neethu",
  "Aswathy",
  "Jomon",
  "Prasanth",
  "Sneha",
  "Vishnu",
  "Libin",
  "Sanju",
];
const LAST = ["K", "P", "Thomas", "Nair", "Menon", "Jose", "Babu", "Raj", "Pillai", "Kurian"];
const ROLES = ["Site Supervisor", "Accountant", "Store Keeper", "Site Engineer", "Foreman"];

export function createSeed(): DataState {
  const pricing: PricingVersion[] = [
    {
      id: "pv-1",
      effectiveFrom: "2025-04-01",
      siteRate: 109,
      freeSites: 3,
      staffRate: 29,
      freeStaff: 1,
      storageFreeMb: 250,
      storageBlockMb: 250,
      storageBlockRate: 5,
      billingDays: 30,
      createdBy: "system@cubesites.in",
      createdAt: "2025-03-20T10:00:00+05:30",
      note: "Launch pricing (confirmed rules)",
    },
  ];
  const taxRules: TaxRule[] = [
    {
      id: "tax-1",
      name: "GST",
      rate: 18,
      inclusive: false,
      appliesTo: ["site", "staff", "storage", "proration"],
      effectiveFrom: "2025-04-01",
      effectiveTo: "2026-06-30",
      invoiceLabel: "GST @ 18%",
      registration: "32AABCC1234F1Z5",
    },
    {
      id: "tax-2",
      name: "GST (CGST + SGST)",
      rate: 18,
      inclusive: false,
      appliesTo: ["site", "staff", "storage", "proration"],
      effectiveFrom: "2026-07-01",
      invoiceLabel: "CGST 9% + SGST 9%",
      registration: "32AABCC1234F1Z5",
    },
  ];

  const contractors: Contractor[] = [];
  const sites: Site[] = [];
  const staff: Staff[] = [];
  const subscriptions: Subscription[] = [];
  const snapshots: StorageSnapshot[] = [];
  const drive: DriveConnection[] = [];
  const backups: BackupJob[] = [];

  BUSINESSES.forEach(([name, owner, city], i) => {
    const id = `c-${101 + i}`;
    const status: Contractor["status"] =
      i === 6 ? "suspended" : i === 10 || i === 13 ? "expired" : "active";
    const reg = addDays("2025-04-15", int(0, 420));
    const slug = name.toLowerCase().split(" ")[0];
    contractors.push({
      id,
      name,
      ownerName: owner,
      city,
      email: `${owner.split(" ")[0].toLowerCase()}@${slug}.in`,
      phone: `+91 9${int(400000000, 999999999)}`,
      gstin:
        r() > 0.3 ? `32${String.fromCharCode(65 + i)}ABCD${int(1000, 9999)}E1Z${i % 9}` : undefined,
      registeredAt: reg,
      status,
      lastActivityAt: at(
        status === "active" ? addDays(DEMO_TODAY, -int(0, 4)) : addDays(DEMO_TODAY, -int(20, 70)),
      ),
    });
    const nSites = i < 2 ? int(5, 8) : int(1, 6);
    const siteIds: string[] = [];
    for (let s = 0; s < nSites; s++) {
      const sid = `${id}-s${s + 1}`;
      siteIds.push(sid);
      const sStatus: Site["status"] =
        s === nSites - 1 && nSites > 3 && r() > 0.5 ? "inactive" : s > 5 ? "archived" : "active";
      sites.push({
        id: sid,
        contractorId: id,
        name: `${pick(AREAS)} ${pick(SITE_WORDS)}`,
        location: city,
        status: status === "active" ? sStatus : "inactive",
        createdAt: addDays(reg, int(1, 60)),
        lastActivityAt: at(addDays(DEMO_TODAY, -int(0, 25))),
        reactivatedAt:
          sStatus === "active" && s === 3 && status === "active"
            ? addDays(CURRENT_PERIOD.start, int(8, 20))
            : undefined,
      });
    }
    staff.push({
      id: `${id}-u0`,
      contractorId: id,
      name: owner,
      role: "Owner",
      isOwner: true,
      status: "enabled",
      siteIds,
      createdAt: reg,
      lastActivityAt: at(addDays(DEMO_TODAY, -int(0, 3))),
    });
    const nStaff = int(0, 6);
    for (let u = 1; u <= nStaff; u++) {
      staff.push({
        id: `${id}-u${u}`,
        contractorId: id,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        role: pick(ROLES),
        isOwner: false,
        status: r() > 0.2 ? "enabled" : "disabled",
        siteIds: siteIds.filter(() => r() > 0.5).slice(0, 3),
        createdAt: addDays(reg, int(5, 100)),
        lastActivityAt: at(addDays(DEMO_TODAY, -int(0, 30))),
      });
    }
    const paid = nSites > 3 || nStaff > 1 || i % 4 === 0;
    subscriptions.push({
      id: `sub-${id}`,
      contractorId: id,
      plan: paid ? "paid" : "free",
      status: status === "expired" ? "expired" : i === 5 ? "grace" : "active",
      periodStart: CURRENT_PERIOD.start,
      periodEnd: CURRENT_PERIOD.end,
      renewalDate: addDays(CURRENT_PERIOD.end, 1),
      expiredAt: status === "expired" ? addDays(DEMO_TODAY, -(i === 10 ? 78 : 31)) : undefined,
    });
    const base = i % 3 === 0 ? int(500, 1400) : int(60, 420);
    for (let d = 0; d < 27; d++) {
      const date = addDays(CURRENT_PERIOD.start, d);
      const missing = (i === 3 && d === 12) || (i === 8 && (d === 20 || d === 21));
      snapshots.push({
        id: `snap-${id}-${date}`,
        contractorId: id,
        date,
        mb: missing ? null : Math.round((base + d * (base / 120) + r() * 30) * 10) / 10,
      });
    }
    const dStatus: DriveConnection["status"] =
      i === 4 ? "token_expired" : i === 13 ? "disconnected" : "connected";
    drive.push({
      contractorId: id,
      status: dStatus,
      email: `backups.${slug}@gmail.com`,
      connectedAt: dStatus !== "disconnected" ? at(addDays(reg, 2)) : undefined,
    });
    for (let b = 0; b < 4; b++) {
      const day = addDays(DEMO_TODAY, -b);
      const failed = (dStatus === "token_expired" && b < 2) || (i === 2 && b === 0);
      const overdue = dStatus === "disconnected";
      const jid = `bk-${id}-${b}`;
      const st: BackupJob["status"] = overdue ? "overdue" : failed ? "failed" : "success";
      backups.push({
        id: jid,
        contractorId: id,
        type: b === 3 ? "weekly_full" : "scheduled_daily",
        status: st,
        attemptedAt: at(day, 2, int(0, 40)),
        completedAt: st === "success" ? at(day, 2, 50) : undefined,
        sizeMb: st === "success" ? Math.round(base * 0.8) : undefined,
        failure:
          st === "failed"
            ? dStatus === "token_expired"
              ? "Google Drive authorization expired (invalid_grant)"
              : "Upload timed out after 3 retries"
            : st === "overdue"
              ? "No Drive connection — job not started"
              : undefined,
        restoreTest: b === 3 ? (i === 9 ? "failed" : "passed") : "not_tested",
        logs: [
          { at: at(day, 2, 0), level: "info", message: "Mock job queued" },
          ...(st === "success"
            ? [
                { at: at(day, 2, 20), level: "info" as const, message: "Mock export packaged" },
                { at: at(day, 2, 50), level: "info" as const, message: "Mock upload complete" },
              ]
            : [
                {
                  at: at(day, 2, 30),
                  level: "error" as const,
                  message: st === "overdue" ? "Drive not connected" : "Mock upload failed",
                },
              ]),
        ],
      });
    }
  });

  // Historical invoices (Jul–Sep) with frozen tax snapshot
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const periods = [
    ["2026-07-01", "2026-07-30"],
    ["2026-08-01", "2026-08-30"],
    ["2026-09-01", "2026-09-30"],
  ];
  let seq = 1;
  periods.forEach(([ps, pe], pi) => {
    contractors.forEach((c, ci) => {
      if (c.registeredAt > ps) return;
      const cs =
        sites.filter((s) => s.contractorId === c.id && s.status === "active").length +
        (pi === 0 ? 0 : 0);
      const cst = staff.filter(
        (s) => s.contractorId === c.id && !s.isOwner && s.status === "enabled",
      ).length;
      const avg =
        averageStorageMb(snapshots.filter((s) => s.contractorId === c.id)).average *
        (0.75 + pi * 0.08);
      const pv = pricingAt(pricing, ps);
      const lines = buildLines(
        {
          activeSites: Math.max(1, cs),
          enabledNonOwnerStaff: cst,
          averageMb: Math.round(avg * 100) / 100,
          reactivations: [],
        },
        pv,
      );
      const rule = taxRuleAt(taxRules, pe);
      const t = computeTax(lines, rule);
      if (t.total === 0) return;
      const id = `inv-${seq}`;
      const status: Invoice["status"] =
        pi < 2 ? "paid" : ci % 5 === 1 ? "overdue" : ci % 3 === 0 ? "pending" : "paid";
      invoices.push({
        id,
        number: `CS/26-27/${String(seq).padStart(4, "0")}`,
        contractorId: c.id,
        periodStart: ps,
        periodEnd: pe,
        issuedAt: addDays(pe, 1),
        lines,
        ...t,
        pricingVersionId: pv.id,
        taxSnapshot: rule
          ? {
              name: rule.name,
              rate: rule.rate,
              inclusive: rule.inclusive,
              label: rule.invoiceLabel,
            }
          : null,
        status,
      });
      seq++;
      const manual = ci % 4 === 2;
      const method: PaymentMethod = manual
        ? pick(["bank_transfer", "cash", "cheque"] as PaymentMethod[])
        : pick(["upi_gateway", "card_gateway"] as PaymentMethod[]);
      const paidAt = at(addDays(pe, int(2, 9)));
      if (status === "paid") {
        payments.push({
          id: `pay-${id}`,
          invoiceId: id,
          contractorId: c.id,
          method,
          channel: manual ? "manual" : "online",
          amount: t.total,
          tax: t.tax,
          status: manual ? "approved" : "success",
          reference: manual
            ? `UTR${int(100000000, 999999999)}`
            : `pay_${Math.floor(r() * 1e12).toString(36)}`,
          paidAt,
          proofName: manual ? "transfer-receipt.jpg" : undefined,
          gatewayStatus: manual ? undefined : "captured (mock)",
          reviewedBy: manual ? "admin@cubesites.in" : undefined,
          reviewedAt: manual ? paidAt : undefined,
        });
      } else if (status === "pending") {
        payments.push({
          id: `pay-${id}`,
          invoiceId: id,
          contractorId: c.id,
          method: manual ? method : "bank_transfer",
          channel: "manual",
          amount: t.total,
          tax: t.tax,
          status: "pending_review",
          reference: `UTR${int(100000000, 999999999)}`,
          paidAt: at(addDays(DEMO_TODAY, -int(0, 3))),
          proofName: "neft-screenshot.png",
        });
      } else {
        payments.push({
          id: `pay-${id}-f`,
          invoiceId: id,
          contractorId: c.id,
          method: "upi_gateway",
          channel: "online",
          amount: t.total,
          tax: t.tax,
          status: "failed",
          reference: `pay_${Math.floor(r() * 1e12).toString(36)}`,
          paidAt: at(addDays(pe, 4)),
          gatewayStatus: "failed: bank declined (mock)",
        });
      }
    });
  });

  const cname = (id: string) => contractors.find((c) => c.id === id)!.name;
  const audit: AuditEvent[] = [
    {
      id: "a-1",
      at: at(addDays(DEMO_TODAY, -40)),
      actor: "admin@cubesites.in",
      contractorId: "c-107",
      action: "contractor.suspend",
      target: cname("c-107"),
      before: "active",
      after: "suspended",
      reason: "Repeated chargebacks on card payments",
    },
    {
      id: "a-2",
      at: at(addDays(DEMO_TODAY, -12)),
      actor: "admin@cubesites.in",
      action: "tax.create",
      target: "GST (CGST + SGST)",
      after: "18% exclusive from 2026-07-01",
    },
    ...payments
      .filter((p) => p.status === "approved")
      .slice(0, 8)
      .map((p, k) => ({
        id: `a-p${k}`,
        at: p.reviewedAt!,
        actor: "admin@cubesites.in",
        contractorId: p.contractorId,
        action: "payment.approve",
        target: p.reference,
        before: "pending_review",
        after: "approved",
      })),
    {
      id: "a-3",
      at: at(addDays(DEMO_TODAY, -2)),
      actor: "admin@cubesites.in",
      action: "auth.login",
      target: "Admin session",
    },
  ];

  const notifications: AppNotification[] = [];
  let nid = 1;
  const note = (n: Omit<AppNotification, "id" | "read">) =>
    notifications.push({ ...n, id: `n-${nid++}`, read: false });
  payments
    .filter((p) => p.status === "pending_review")
    .forEach((p) =>
      note({
        type: "manual_payment",
        title: "Manual payment awaiting review",
        message: `${cname(p.contractorId)} submitted ${p.reference}`,
        contractorId: p.contractorId,
        createdAt: p.paidAt,
      }),
    );
  backups
    .filter((b) => b.status === "failed" || b.status === "overdue")
    .filter((_, k) => k < 4)
    .forEach((b) =>
      note({
        type: "backup_failed",
        title: `Backup ${b.status}`,
        message: `${cname(b.contractorId)}: ${b.failure}`,
        contractorId: b.contractorId,
        createdAt: b.attemptedAt,
      }),
    );
  subscriptions
    .filter((s) => s.status !== "active")
    .forEach((s) =>
      note({
        type: s.status === "expired" ? "retention_deadline" : "subscription_expiry",
        title:
          s.status === "expired"
            ? "Approaching 90-day retention deadline"
            : "Subscription in grace period",
        message: cname(s.contractorId),
        contractorId: s.contractorId,
        createdAt: at(addDays(DEMO_TODAY, -1)),
      }),
    );
  note({
    type: "storage_anomaly",
    title: "Missing storage measurements",
    message: `${cname("c-109")}: 2 daily snapshots missing this period`,
    contractorId: "c-109",
    createdAt: at(addDays(DEMO_TODAY, -6)),
  });
  note({
    type: "delivery_failed",
    title: "Notification delivery failed",
    message: `SMS reminder to ${cname("c-111")} bounced`,
    contractorId: "c-111",
    createdAt: at(addDays(DEMO_TODAY, -3)),
  });

  const retention: RetentionNotice[] = [];
  subscriptions
    .filter((s) => s.expiredAt)
    .forEach((s) => {
      [60, 30, 14].forEach((before, k) => {
        const sent = addDays(s.expiredAt!, 90 - before);
        if (sent <= DEMO_TODAY)
          retention.push({
            id: `rn-${s.contractorId}-${k}`,
            contractorId: s.contractorId,
            sentAt: at(sent, 9, 0),
            channel: k === 2 ? "sms" : "email",
            daysBefore: before,
            delivery: s.contractorId === "c-111" && k === 2 ? "failed" : "sent",
          });
      });
    });

  const support: SupportCase[] = [
    {
      id: "sc-1",
      contractorId: "c-102",
      subject: "Invoice shows extra site charge",
      description: "We deactivated a site mid-month but still see the charge.",
      status: "open",
      priority: "high",
      createdAt: at(addDays(DEMO_TODAY, -2)),
      updatedAt: at(addDays(DEMO_TODAY, -2)),
      notes: [],
    },
    {
      id: "sc-2",
      contractorId: "c-105",
      subject: "Google Drive backup failing",
      description: "Getting an error that Drive is disconnected.",
      status: "in_progress",
      priority: "urgent",
      createdAt: at(addDays(DEMO_TODAY, -3)),
      updatedAt: at(addDays(DEMO_TODAY, -1)),
      notes: [
        {
          id: "sn-1",
          by: "admin@cubesites.in",
          at: at(addDays(DEMO_TODAY, -1)),
          text: "Token expired. Asked owner to reconnect Drive.",
        },
      ],
    },
    {
      id: "sc-3",
      contractorId: "c-111",
      subject: "Want to renew after expiry",
      description: "Can we still recover our data?",
      status: "waiting",
      priority: "medium",
      createdAt: at(addDays(DEMO_TODAY, -8)),
      updatedAt: at(addDays(DEMO_TODAY, -5)),
      notes: [],
    },
    {
      id: "sc-4",
      contractorId: "c-101",
      subject: "Add staff member access",
      description: "How do we add an accountant?",
      status: "resolved",
      priority: "low",
      createdAt: at(addDays(DEMO_TODAY, -20)),
      updatedAt: at(addDays(DEMO_TODAY, -19)),
      notes: [],
    },
  ];

  const wallets: Wallet[] = contractors.map((c, i) => ({
    contractorId: c.id,
    balance: i === 0 ? 1250 : i === 1 ? 500 : 0,
    paidRecharged: i === 0 ? 2000 : i === 1 ? 500 : 0,
    freeRecharged: i === 0 ? 250 : 0,
    updatedAt: at(addDays(DEMO_TODAY, -int(0, 10))),
  }));
  const walletTransactions: WalletTransaction[] = [
    {
      id: "wt-1",
      contractorId: "c-101",
      amount: 2000,
      kind: "recharge",
      funding: "paid",
      source: "admin",
      note: "Bank transfer received",
      reference: "NEFT/DEMO/1",
      balanceAfter: 2000,
      countsAsIncome: true,
      createdBy: "admin@cubesites.in",
      createdAt: at(addDays(DEMO_TODAY, -20)),
    },
    {
      id: "wt-2",
      contractorId: "c-101",
      amount: 250,
      kind: "recharge",
      funding: "free",
      source: "admin",
      note: "Launch promo credit",
      reference: "",
      balanceAfter: 2250,
      countsAsIncome: false,
      createdBy: "admin@cubesites.in",
      createdAt: at(addDays(DEMO_TODAY, -18)),
    },
    {
      id: "wt-3",
      contractorId: "c-101",
      amount: -1000,
      kind: "debit",
      funding: "paid",
      source: "system",
      note: "Subscription settlement (demo)",
      reference: "",
      balanceAfter: 1250,
      countsAsIncome: false,
      createdBy: "system",
      createdAt: at(addDays(DEMO_TODAY, -5)),
    },
    {
      id: "wt-4",
      contractorId: "c-102",
      amount: 500,
      kind: "recharge",
      funding: "paid",
      source: "admin",
      note: "UPI received",
      reference: "UPI/DEMO/2",
      balanceAfter: 500,
      countsAsIncome: true,
      createdBy: "admin@cubesites.in",
      createdAt: at(addDays(DEMO_TODAY, -8)),
    },
  ];

  return {
    contractors,
    sites,
    staff,
    subscriptions,
    pricing,
    taxRules,
    invoices,
    payments,
    snapshots,
    drive,
    backups,
    audit,
    notifications,
    retention,
    support,
    wallets,
    walletTransactions,
    settings: {
      adminName: "Platform Admin",
      adminEmail: "admin@cubesites.in",
      prefs: {
        subscription_expiry: true,
        manual_payment: true,
        backup_failed: true,
        storage_anomaly: true,
        retention_deadline: true,
        delivery_failed: false,
      },
      ops: { backupHourIst: 2, reminderDays: [60, 30, 14, 7], maintenanceBanner: "" },
    },
  };
}
