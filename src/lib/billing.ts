// Pure billing calculations — the single source of pricing math in the frontend.
// The backend must re-implement and own these; the UI only previews them.
import type { InvoiceLine, PricingVersion, StorageSnapshot, TaxRule } from "./types";

/** Round to paise (2 decimals) avoiding binary float drift. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function siteCharge(activeSites: number, p: PricingVersion) {
  const billable = Math.max(0, activeSites - p.freeSites);
  return { billable, amount: round2(billable * p.siteRate) };
}

/** enabledStaff must EXCLUDE the owner account. */
export function staffCharge(enabledNonOwnerStaff: number, p: PricingVersion) {
  const billable = Math.max(0, enabledNonOwnerStaff - p.freeStaff);
  return { billable, amount: round2(billable * p.staffRate) };
}

export function averageStorageMb(snaps: Pick<StorageSnapshot, "mb">[]) {
  const vals = snaps.map((s) => s.mb).filter((v): v is number => v !== null);
  if (!vals.length) return { average: 0, measured: 0, missing: snaps.length };
  const sum = vals.reduce((a, b) => a + b, 0);
  return { average: round2(sum / vals.length), measured: vals.length, missing: snaps.length - vals.length };
}

/** ₹rate × ceil(max(0, avg − free) / block) */
export function storageCharge(averageMb: number, p: PricingVersion) {
  const excess = round2(Math.max(0, averageMb - p.storageFreeMb));
  const blocks = excess === 0 ? 0 : Math.ceil(excess / p.storageBlockMb);
  return { excess, blocks, amount: round2(blocks * p.storageBlockRate) };
}

/** Prorated charge for a site reactivated with `activeDays` left in the billing month. */
export function prorationCharge(activeDays: number, p: PricingVersion) {
  const days = Math.min(Math.max(0, activeDays), p.billingDays);
  return { days, amount: round2((p.siteRate * days) / p.billingDays) };
}

export function pricingAt(versions: PricingVersion[], isoDate: string) {
  const sorted = [...versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return sorted.find((v) => v.effectiveFrom <= isoDate) ?? sorted[sorted.length - 1];
}

export function taxRuleAt(rules: TaxRule[], isoDate: string) {
  return rules
    .filter((r) => r.effectiveFrom <= isoDate && (!r.effectiveTo || r.effectiveTo >= isoDate))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function computeTax(lines: InvoiceLine[], rule: TaxRule | undefined) {
  const subtotalRaw = round2(lines.reduce((a, l) => a + l.amount, 0));
  if (!rule) return { subtotal: subtotalRaw, tax: 0, total: subtotalRaw };
  const taxable = round2(lines.filter((l) => rule.appliesTo.includes(l.type)).reduce((a, l) => a + l.amount, 0));
  if (rule.inclusive) {
    const tax = round2(taxable - taxable / (1 + rule.rate / 100));
    return { subtotal: round2(subtotalRaw - tax), tax, total: subtotalRaw };
  }
  const tax = round2((taxable * rule.rate) / 100);
  return { subtotal: subtotalRaw, tax, total: round2(subtotalRaw + tax) };
}

export interface BillInput {
  activeSites: number;
  enabledNonOwnerStaff: number;
  averageMb: number;
  reactivations: { siteName: string; activeDays: number }[];
}

export function buildLines(input: BillInput, p: PricingVersion): InvoiceLine[] {
  const s = siteCharge(input.activeSites, p);
  const st = staffCharge(input.enabledNonOwnerStaff, p);
  const sg = storageCharge(input.averageMb, p);
  const lines: InvoiceLine[] = [
    { type: "site", description: `Active sites (${input.activeSites}, first ${p.freeSites} free)`, qty: s.billable, unitPrice: p.siteRate, amount: s.amount },
    { type: "staff", description: `Additional staff (${input.enabledNonOwnerStaff}, first ${p.freeStaff} free)`, qty: st.billable, unitPrice: p.staffRate, amount: st.amount },
    { type: "storage", description: `Storage avg ${input.averageMb} MB (first ${p.storageFreeMb} MB free)`, qty: sg.blocks, unitPrice: p.storageBlockRate, amount: sg.amount },
  ];
  for (const r of input.reactivations) {
    const pr = prorationCharge(r.activeDays, p);
    lines.push({ type: "proration", description: `Reactivation: ${r.siteName} (${pr.days}/${p.billingDays} days)`, qty: 1, unitPrice: pr.amount, amount: pr.amount });
  }
  return lines;
}
