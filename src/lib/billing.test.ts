import { describe, expect, it } from "vitest";
import { averageStorageMb, computeTax, prorationCharge, siteCharge, staffCharge, storageCharge } from "./billing";
import type { PricingVersion, TaxRule } from "./types";

const p: PricingVersion = {
  id: "pv", effectiveFrom: "2026-01-01", siteRate: 109, freeSites: 3, staffRate: 29, freeStaff: 1,
  storageFreeMb: 250, storageBlockMb: 250, storageBlockRate: 5, billingDays: 30, createdBy: "t", createdAt: "", note: "",
};

describe("CubeSites pricing rules", () => {
  it("first 3 active sites are free, then ₹109 each", () => {
    expect(siteCharge(3, p).amount).toBe(0);
    expect(siteCharge(5, p).amount).toBe(218);
  });
  it("first additional staff is free, then ₹29 each (owner excluded by caller)", () => {
    expect(staffCharge(1, p).amount).toBe(0);
    expect(staffCharge(4, p).amount).toBe(87);
  });
  it("first 250 MB free, ₹5 per started 250 MB block", () => {
    expect(storageCharge(250, p).amount).toBe(0);
    expect(storageCharge(250.01, p).amount).toBe(5);
    expect(storageCharge(500, p).amount).toBe(5);
    expect(storageCharge(760, p).amount).toBe(15);
  });
  it("average is arithmetic mean of measured daily snapshots", () => {
    expect(averageStorageMb([{ mb: 100 }, { mb: 200 }, { mb: null }]).average).toBe(150);
  });
  it("prorates site reactivation by active days over 30", () => {
    expect(prorationCharge(15, p).amount).toBe(54.5);
    expect(prorationCharge(10, p).amount).toBe(36.33);
  });
  it("applies exclusive and inclusive tax", () => {
    const rule: TaxRule = { id: "t", name: "GST", rate: 18, inclusive: false, appliesTo: ["site"], effectiveFrom: "2026-01-01", invoiceLabel: "", registration: "" };
    const lines = [{ type: "site" as const, description: "", qty: 1, unitPrice: 100, amount: 100 }];
    expect(computeTax(lines, rule).total).toBe(118);
    expect(computeTax(lines, { ...rule, inclusive: true }).tax).toBe(15.25);
  });
});
