import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, FilterSelect, PageHeader, StatusBadge, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { exportCsv } from "@/lib/exporters";
import { CURRENT_PERIOD } from "@/lib/mock/seed";
import type { Site } from "@/lib/types";

export const Route = createFileRoute("/_admin/sites")({
  head: () => ({ meta: [{ title: "Sites — CubeSites Super Admin" }, { name: "description", content: "Platform-wide construction site oversight." }, { property: "og:title", content: "Sites — CubeSites Super Admin" }, { property: "og:description", content: "Platform-wide construction site oversight." }] }),
  component: Sites,
});

function Sites() {
  const sites = useData((s) => s.sites);
  const contractors = useData((s) => s.contractors);
  const name = useContractorNames();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [cid, setCid] = useState("all");
  const [billing, setBilling] = useState("all");

  // Billing status: first N active sites (by creation) per contractor are free.
  const billingOf = (s: Site) => {
    if (s.status !== "active") return "not_billed";
    if (s.reactivatedAt && s.reactivatedAt >= CURRENT_PERIOD.start) return "prorated";
    const active = sites.filter((x) => x.contractorId === s.contractorId && x.status === "active" && !x.reactivatedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return active.findIndex((x) => x.id === s.id) < 3 ? "free_allowance" : "billable";
  };
  const rows = sites.filter((s) => (!search || `${s.name} ${name(s.contractorId)} ${s.location}`.toLowerCase().includes(search.toLowerCase())) && (status === "all" || s.status === status) && (cid === "all" || s.contractorId === cid) && (billing === "all" || billingOf(s) === billing));

  return (
    <>
      <PageHeader title="Sites" description={`${rows.length} of ${sites.length} sites · read-only oversight`} actions={
        <Button variant="outline" size="sm" onClick={() => exportCsv("sites.csv", rows.map((s) => ({ contractor: name(s.contractorId), site: s.name, status: s.status, created: s.createdAt, last_activity: s.lastActivityAt, billing: billingOf(s) })))}><Download className="h-4 w-4" />Export CSV</Button>} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Site, contractor, location">
        <FilterSelect label="Statuses" value={status} onChange={setStatus} options={["active", "inactive", "archived"]} />
        <FilterSelect label="Billing" value={billing} onChange={setBilling} options={["billable", "free_allowance", "prorated", "not_billed"]} />
        <select aria-label="Contractor" value={cid} onChange={(e) => setCid(e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value="all">All contractors</option>
          {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Toolbar>
      <DataTable rows={rows} rowKey={(r) => r.id} columns={[
        { key: "c", header: "Contractor", sort: (r) => name(r.contractorId), cell: (r) => <Link to="/contractors/$id" params={{ id: r.contractorId }} className="hover:underline">{name(r.contractorId)}</Link> },
        { key: "n", header: "Site", sort: (r) => r.name, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.location}</div></div> },
        { key: "s", header: "Status", sort: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
        { key: "d", header: "Created", sort: (r) => r.createdAt, cell: (r) => fmtDate(r.createdAt) },
        { key: "l", header: "Last activity", sort: (r) => r.lastActivityAt, cell: (r) => fmtDateTime(r.lastActivityAt) },
        { key: "b", header: "Billing", cell: (r) => { const b = billingOf(r); return <StatusBadge status={b === "billable" ? "active" : b === "prorated" ? "pending" : "inactive"} text={b.replace("_", " ")} />; } },
      ]} />
    </>
  );
}
