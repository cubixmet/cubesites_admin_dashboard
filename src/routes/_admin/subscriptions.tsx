import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, FilterSelect, PageHeader, Panel, StatusBadge, Toolbar } from "@/components/admin/kit";
import { BillBreakdown } from "@/components/admin/billing-views";
import { actions, useData } from "@/lib/store";
import { currentBill } from "@/lib/selectors";
import { pricingAt } from "@/lib/billing";
import { fmtDate, inr } from "@/lib/format";
import { CURRENT_PERIOD, DEMO_TODAY } from "@/lib/mock/seed";
import type { PricingVersion } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions & Pricing — CubeSites Super Admin" }, { name: "description", content: "Versioned pricing rules and subscription billing estimates." }, { property: "og:title", content: "Subscriptions & Pricing — CubeSites Super Admin" }, { property: "og:description", content: "Versioned pricing rules and subscription billing estimates." }] }),
  component: Subs,
});

function Subs() {
  const s = useData((x) => x);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const active = pricingAt(s.pricing, DEMO_TODAY);
  const rows = useMemo(() => s.subscriptions.map((sub) => ({ sub, c: s.contractors.find((c) => c.id === sub.contractorId)!, bill: currentBill(s, sub.contractorId) })), [s]);
  const filtered = rows.filter((r) => (!search || r.c.name.toLowerCase().includes(search.toLowerCase())) && (status === "all" || r.sub.status === status || r.sub.plan === status));
  const sel = rows.find((r) => r.sub.id === open);

  return (
    <>
      <PageHeader title="Subscriptions & pricing" description={`Billing period ${fmtDate(CURRENT_PERIOD.start)} – ${fmtDate(CURRENT_PERIOD.end)} (30 days)`} actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />Schedule pricing version</Button>} />

      <Panel title="Pricing versions" className="mb-4">
        <p className="mb-2 text-xs text-muted-foreground">Historical versions are read-only. Changes are new effective-dated versions recorded in the audit log.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr>{["Effective from", "Site / month", "Free sites", "Staff / month", "Free staff", "Storage", "Created by", "Note", ""].map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{[...s.pricing].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-2 py-1.5">{fmtDate(p.effectiveFrom)}</td><td className="num px-2">{inr(p.siteRate)}</td><td className="num px-2">{p.freeSites}</td>
              <td className="num px-2">{inr(p.staffRate)}</td><td className="num px-2">{p.freeStaff} (owner excluded)</td>
              <td className="px-2 text-xs">{p.storageFreeMb} MB free, {inr(p.storageBlockRate)} per started {p.storageBlockMb} MB</td>
              <td className="px-2 text-xs">{p.createdBy}</td><td className="px-2 text-xs">{p.note}</td>
              <td className="px-2">{p.id === active.id ? <StatusBadge status="active" text="Current" /> : p.effectiveFrom > DEMO_TODAY ? <StatusBadge status="pending" text="Scheduled" /> : <StatusBadge status="archived" text="Historical" />}</td>
            </tr>))}</tbody>
        </table></div>
      </Panel>

      <Toolbar search={search} onSearch={setSearch} placeholder="Contractor">
        <FilterSelect label="Statuses" value={status} onChange={setStatus} options={["paid", "free", "active", "grace", "expired"]} />
      </Toolbar>
      <DataTable rows={filtered} rowKey={(r) => r.sub.id} onRowClick={(r) => setOpen(r.sub.id)} columns={[
        { key: "c", header: "Contractor", sort: (r) => r.c.name, cell: (r) => <span className="font-medium">{r.c.name}</span> },
        { key: "p", header: "Plan", cell: (r) => <StatusBadge status={r.sub.plan} text={r.sub.plan === "paid" ? "Paid" : "Free"} /> },
        { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.sub.status} /> },
        { key: "si", header: "Sites (billable)", className: "num text-right", cell: (r) => `${r.bill.usage.activeSites} (${r.bill.lines[0].qty})` },
        { key: "st", header: "Staff (billable)", className: "num text-right", cell: (r) => `${r.bill.usage.enabledStaff} (${r.bill.lines[1].qty})` },
        { key: "sg", header: "Storage", className: "num text-right", cell: (r) => inr(r.bill.storage.amount) },
        { key: "pr", header: "Proration", className: "num text-right", cell: (r) => r.bill.reactivations.length ? inr(r.bill.lines.filter((l) => l.type === "proration").reduce((a, l) => a + l.amount, 0)) : "—" },
        { key: "t", header: "Est. total", className: "num text-right", sort: (r) => r.bill.total, cell: (r) => inr(r.bill.total) },
        { key: "r", header: "Renewal / expiry", cell: (r) => (r.sub.expiredAt ? `Expired ${fmtDate(r.sub.expiredAt)}` : fmtDate(r.sub.renewalDate)) },
      ]} />

      <Dialog open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {sel && <>
            <DialogHeader><DialogTitle>{sel.c.name}</DialogTitle><DialogDescription>Estimated invoice for the current period (preview, not issued).</DialogDescription></DialogHeader>
            <div className="text-xs text-muted-foreground">Free allowance used: {Math.min(sel.bill.usage.activeSites, sel.bill.pricing.freeSites)}/{sel.bill.pricing.freeSites} sites · {Math.min(sel.bill.usage.enabledStaff, sel.bill.pricing.freeStaff)}/{sel.bill.pricing.freeStaff} staff · {Math.min(sel.bill.usage.avg.average, 250).toFixed(1)}/250 MB storage</div>
            <BillBreakdown bill={sel.bill} />
            {sel.bill.reactivations.map((r) => (
              <div key={r.siteName} className="rounded-md bg-muted p-2 text-xs">Reactivation of <b>{r.siteName}</b>: {r.activeDays} billable active days → {inr(sel.bill.pricing.siteRate)} × {r.activeDays} / {sel.bill.pricing.billingDays} = <b className="num">{inr(Math.round(sel.bill.pricing.siteRate * r.activeDays / sel.bill.pricing.billingDays * 100) / 100)}</b></div>
            ))}
            <DialogFooter><Button variant="outline" asChild><Link to="/contractors/$id" params={{ id: sel.c.id }}>Open contractor</Link></Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
      <NewPricing open={newOpen} onOpenChange={setNewOpen} base={active} />
    </>
  );
}

function NewPricing({ open, onOpenChange, base }: { open: boolean; onOpenChange: (o: boolean) => void; base: PricingVersion }) {
  const [f, setF] = useState({ effectiveFrom: "", siteRate: base.siteRate, freeSites: base.freeSites, staffRate: base.staffRate, freeStaff: base.freeStaff, storageFreeMb: base.storageFreeMb, storageBlockMb: base.storageBlockMb, storageBlockRate: base.storageBlockRate, note: "" });
  const err = !f.effectiveFrom ? "Choose an effective date." : f.effectiveFrom <= DEMO_TODAY ? "Effective date must be in the future — history can't be changed." : f.note.trim().length < 5 ? "Add a reason (5+ characters)." : [f.siteRate, f.staffRate, f.storageBlockRate, f.storageBlockMb].some((v) => !(v > 0)) ? "Rates must be positive." : "";
  const field = (k: keyof typeof f, l: string) => (
    <div className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" min={0} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule a new pricing version</DialogTitle><DialogDescription>Creates a new effective-dated version. Existing versions and issued invoices are unchanged.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label className="text-xs">Effective from</Label><Input type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></div>
          {field("siteRate", "Site rate (₹/month)")}{field("freeSites", "Free sites")}{field("staffRate", "Staff rate (₹/month)")}{field("freeStaff", "Free additional staff")}
          {field("storageFreeMb", "Free storage (MB)")}{field("storageBlockMb", "Block size (MB)")}{field("storageBlockRate", "Block rate (₹)")}
          <div className="col-span-2 space-y-1"><Label className="text-xs">Reason / note</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!!err} onClick={() => { actions.addPricingVersion({ ...f, billingDays: 30 }); toast.success("Pricing version scheduled and logged"); onOpenChange(false); }}>Schedule version</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
