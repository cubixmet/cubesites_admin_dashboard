import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, PageHeader, Panel, ReasonDialog, Stat, StatusBadge, Toolbar } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { currentBill } from "@/lib/selectors";
import { fmtDate, fmtDateTime, inr, mb } from "@/lib/format";
import { exportCsv } from "@/lib/exporters";
import type { StorageSnapshot } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/storage")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  head: () => ({ meta: [{ title: "Storage Billing — CubeSites Super Admin" }, { name: "description", content: "Daily storage snapshots, monthly averages and storage charges." }, { property: "og:title", content: "Storage Billing — CubeSites Super Admin" }, { property: "og:description", content: "Daily storage snapshots, monthly averages and storage charges." }] }),
  component: Storage,
});

function Storage() {
  const { c } = Route.useSearch();
  const s = useData((x) => x);
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | undefined>(c);
  const [fix, setFix] = useState<StorageSnapshot | null>(null);
  const [val, setVal] = useState("");
  const rows = useMemo(() => s.contractors.map((ct) => ({ ct, bill: currentBill(s, ct.id) })), [s]);
  const filtered = rows.filter((r) => !search || r.ct.name.toLowerCase().includes(search.toLowerCase()));
  const total = rows.reduce((a, r) => a + r.bill.usage.current, 0);
  const charges = rows.reduce((a, r) => a + r.bill.storage.amount, 0);
  const missing = s.snapshots.filter((x) => x.mb === null).length;
  const sel = rows.find((r) => r.ct.id === selId);
  const p = rows[0]?.bill.pricing;
  const history = s.invoices.filter((i) => !selId || i.contractorId === selId).map((i) => ({ i, line: i.lines.find((l) => l.type === "storage")! }));

  return (
    <>
      <PageHeader title="Storage billing" description="Only CubeSites-managed storage is counted — never unrelated files in a contractor's Google Drive." actions={
        <Button variant="outline" size="sm" onClick={() => exportCsv("storage.csv", rows.map((r) => ({ contractor: r.ct.name, current_mb: r.bill.usage.current, average_mb: r.bill.usage.avg.average, measured_days: r.bill.usage.avg.measured, missing_days: r.bill.usage.avg.missing, billable_blocks: r.bill.storage.blocks, charge: r.bill.storage.amount })))}><Download className="h-4 w-4" />Export CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Current managed storage" value={mb(total)} hint="latest snapshot, all contractors" />
        <Stat label="Projected storage charges" value={inr(charges)} hint="current period, before tax" />
        <Stat label="Free allowance" value={`${p?.storageFreeMb ?? 250} MB`} hint={`then ${inr(p?.storageBlockRate ?? 5)} per started ${p?.storageBlockMb ?? 250} MB`} />
        <Stat label="Missing measurements" value={missing} tone={missing ? "warning" : undefined} hint="excluded from averages" />
      </div>
      <Toolbar search={search} onSearch={setSearch} placeholder="Contractor" />
      <DataTable rows={filtered} rowKey={(r) => r.ct.id} onRowClick={(r) => setSelId(r.ct.id)} columns={[
        { key: "c", header: "Contractor", sort: (r) => r.ct.name, cell: (r) => <span className={r.ct.id === selId ? "font-semibold text-primary" : "font-medium"}>{r.ct.name}</span> },
        { key: "cur", header: "Current", className: "num text-right", sort: (r) => r.bill.usage.current, cell: (r) => mb(r.bill.usage.current) },
        { key: "avg", header: "Monthly avg", className: "num text-right", sort: (r) => r.bill.usage.avg.average, cell: (r) => mb(r.bill.usage.avg.average) },
        { key: "d", header: "Measured / missing", className: "num text-right", cell: (r) => <span>{r.bill.usage.avg.measured} / <span className={r.bill.usage.avg.missing ? "text-destructive" : ""}>{r.bill.usage.avg.missing}</span></span> },
        { key: "b", header: "Blocks", className: "num text-right", cell: (r) => r.bill.storage.blocks },
        { key: "ch", header: "Charge", className: "num text-right", sort: (r) => r.bill.storage.amount, cell: (r) => inr(r.bill.storage.amount) },
      ]} />

      {sel && (
        <Panel title={`Calculation inputs — ${sel.ct.name}`} className="mt-4">
          <div className="mb-3 rounded-md bg-muted p-3 text-sm num">
            Average = Σ {sel.bill.usage.avg.measured} measured snapshots / {sel.bill.usage.avg.measured} = {sel.bill.usage.avg.average} MB<br />
            Charge = {inr(sel.bill.pricing.storageBlockRate)} × ceil(max(0, {sel.bill.usage.avg.average} − {sel.bill.pricing.storageFreeMb}) / {sel.bill.pricing.storageBlockMb}) = {inr(sel.bill.pricing.storageBlockRate)} × {sel.bill.storage.blocks} = <b>{inr(sel.bill.storage.amount)}</b>
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs sm:grid-cols-6 lg:grid-cols-9">
            {sel.bill.usage.snaps.map((sn) => (
              <button key={sn.id} onClick={() => { setFix(sn); setVal(sn.mb?.toString() ?? ""); }} title="Record a correction"
                className={`rounded border px-1.5 py-1 text-left hover:border-primary ${sn.mb === null ? "border-destructive/40 bg-destructive/10" : sn.corrected ? "border-warning/50 bg-warning/10" : ""}`}>
                <div className="text-muted-foreground">{fmtDate(sn.date).slice(0, 6)}</div>
                <div className="num">{sn.mb === null ? "missing" : sn.mb}</div>
                {sn.corrected && <div className="text-[10px] text-warning">corrected</div>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Click a day to record a correction. Corrections require a reason and are audit-logged; there is no silent override.</p>
          {sel.bill.usage.snaps.some((x) => x.corrected) && (
            <ul className="mt-2 space-y-1 text-xs">{sel.bill.usage.snaps.filter((x) => x.corrected).map((x) => <li key={x.id}>{x.date}: {x.corrected!.from ?? "missing"} → {x.mb} MB by {x.corrected!.by} at {fmtDateTime(x.corrected!.at)} — "{x.corrected!.reason}"</li>)}</ul>
          )}
        </Panel>
      )}

      <Panel title={`Storage billing history${sel ? ` — ${sel.ct.name}` : ""}`} className="mt-4">
        <DataTable rows={history} rowKey={(r) => r.i.id} pageSize={8} columns={[
          { key: "c", header: "Contractor", cell: (r) => s.contractors.find((x) => x.id === r.i.contractorId)?.name },
          { key: "p", header: "Period", sort: (r) => r.i.periodStart, cell: (r) => `${fmtDate(r.i.periodStart)} – ${fmtDate(r.i.periodEnd)}` },
          { key: "d", header: "Basis", cell: (r) => <span className="text-xs">{r.line.description}</span> },
          { key: "b", header: "Blocks", className: "num text-right", cell: (r) => r.line.qty },
          { key: "a", header: "Charge", className: "num text-right", cell: (r) => inr(r.line.amount) },
          { key: "s", header: "Invoice", cell: (r) => <StatusBadge status={r.i.status} /> },
        ]} />
      </Panel>

      <ReasonDialog open={!!fix} onOpenChange={(o) => !o && setFix(null)} title={`Correct snapshot ${fix?.date ?? ""}`} description="Records a corrected measurement with your reason. The original value is preserved in the audit log." confirmLabel="Record correction"
        onConfirm={(r) => { const n = Number(val); if (!(n >= 0) || val === "") { toast.error("Enter a valid MB value"); return; } actions.correctSnapshot(fix!.id, Math.round(n * 10) / 10, r); toast.success("Correction recorded and logged"); setFix(null); }}>
        <div className="space-y-1"><Label htmlFor="mbv">Corrected value (MB) — was {fix?.mb ?? "missing"}</Label><Input id="mbv" type="number" min={0} step="0.1" value={val} onChange={(e) => setVal(e.target.value)} /></div>
      </ReasonDialog>
    </>
  );
}
