// Derived figures — every dashboard number is computed here from the dataset.
import { averageStorageMb, buildLines, computeTax, pricingAt, storageCharge, taxRuleAt } from "./billing";
import { CURRENT_PERIOD, DEMO_TODAY } from "./mock/seed";
import type { DataState } from "./types";
import { addDaysIso, daysFromToday } from "./format";

export const RETENTION_DAYS = 90;

export function contractorUsage(s: DataState, cid: string) {
  const sites = s.sites.filter((x) => x.contractorId === cid);
  const staff = s.staff.filter((x) => x.contractorId === cid);
  const snaps = s.snapshots.filter((x) => x.contractorId === cid).sort((a, b) => a.date.localeCompare(b.date));
  const activeSites = sites.filter((x) => x.status === "active").length;
  const enabledStaff = staff.filter((x) => !x.isOwner && x.status === "enabled").length;
  const avg = averageStorageMb(snaps);
  const current = [...snaps].reverse().find((x) => x.mb !== null)?.mb ?? 0;
  return { sites, staff, snaps, activeSites, enabledStaff, avg, current };
}

export function currentBill(s: DataState, cid: string) {
  const u = contractorUsage(s, cid);
  const pv = pricingAt(s.pricing, CURRENT_PERIOD.start);
  const reactivations = u.sites
    .filter((x) => x.status === "active" && x.reactivatedAt && x.reactivatedAt >= CURRENT_PERIOD.start)
    .map((x) => ({ siteName: x.name, activeDays: daysBetween(x.reactivatedAt!, CURRENT_PERIOD.end) + 1 }));
  // Reactivated sites are billed by proration, not as full-month sites.
  const lines = buildLines({ activeSites: u.activeSites - reactivations.length, enabledNonOwnerStaff: u.enabledStaff, averageMb: u.avg.average, reactivations }, pv);
  const rule = taxRuleAt(s.taxRules, CURRENT_PERIOD.end);
  const totals = computeTax(lines, rule);
  return { pricing: pv, rule, lines, ...totals, usage: u, storage: storageCharge(u.avg.average, pv), reactivations };
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
}

export function retentionDeadline(expiredAt: string) { return addDaysIso(expiredAt, RETENTION_DAYS); }

export function overview(s: DataState, rangeDays: number) {
  const from = addDaysIso(DEMO_TODAY, -rangeDays);
  const inRange = (iso: string) => iso.slice(0, 10) >= from;
  const collected = s.payments.filter((p) => (p.status === "success" || p.status === "approved") && inRange(p.paidAt)).reduce((a, p) => a + p.amount, 0);
  const pending = s.invoices.filter((i) => i.status !== "paid").reduce((a, i) => a + i.total, 0);
  const activeContractors = s.contractors.filter((c) => c.status === "active");
  const projected = activeContractors.reduce((a, c) => a + currentBill(s, c.id).total, 0);
  const storageCharges = activeContractors.reduce((a, c) => a + currentBill(s, c.id).storage.amount, 0);
  const lastByContractor = new Map<string, string>();
  const failedBackups = s.backups.filter((b) => {
    if (lastByContractor.has(b.contractorId)) return false;
    lastByContractor.set(b.contractorId, b.id);
    return b.status === "failed" || b.status === "overdue";
  }).length;
  const months: { key: string; collected: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(DEMO_TODAY); d.setUTCMonth(d.getUTCMonth() - m);
    const key = d.toISOString().slice(0, 7);
    months.push({ key, collected: s.payments.filter((p) => (p.status === "success" || p.status === "approved") && p.paidAt.startsWith(key)).reduce((a, p) => a + p.amount, 0) });
  }
  const upcoming = [
    ...s.subscriptions.filter((x) => x.status !== "expired").map((x) => ({ kind: "Renewal", contractorId: x.contractorId, date: x.renewalDate })),
    ...s.subscriptions.filter((x) => x.expiredAt).map((x) => ({ kind: "Retention deadline", contractorId: x.contractorId, date: retentionDeadline(x.expiredAt!) })),
  ].filter((x) => daysFromToday(x.date) >= 0 && daysFromToday(x.date) <= 30).sort((a, b) => a.date.localeCompare(b.date));
  return {
    total: s.contractors.length,
    active: activeContractors.length,
    expired: s.contractors.filter((c) => c.status === "expired").length,
    suspended: s.contractors.filter((c) => c.status === "suspended").length,
    activeSites: s.sites.filter((x) => x.status === "active").length,
    enabledStaff: s.staff.filter((x) => x.status === "enabled" && !x.isOwner).length,
    paidSubs: s.subscriptions.filter((x) => x.plan === "paid" && x.status !== "expired").length,
    freeSubs: s.subscriptions.filter((x) => x.plan === "free" && x.status !== "expired").length,
    collected, pending, projected, storageCharges, failedBackups, months, upcoming,
    pendingReviews: s.payments.filter((p) => p.status === "pending_review").length,
  };
}
