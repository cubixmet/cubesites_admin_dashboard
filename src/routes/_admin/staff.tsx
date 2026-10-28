import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, FilterSelect, PageHeader, StatusBadge, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { exportCsv } from "@/lib/exporters";
import type { Staff } from "@/lib/types";

export const Route = createFileRoute("/_admin/staff")({
  head: () => ({ meta: [{ title: "Staff — CubeSites Super Admin" }, { name: "description", content: "Platform-wide staff account oversight and billing status." }, { property: "og:title", content: "Staff — CubeSites Super Admin" }, { property: "og:description", content: "Platform-wide staff account oversight and billing status." }] }),
  component: StaffPage,
});

function StaffPage() {
  const staff = useData((s) => s.staff);
  const name = useContractorNames();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [bill, setBill] = useState("all");

  // Owner excluded; first enabled non-owner (by creation) is free.
  const billOf = (u: Staff) => {
    if (u.isOwner) return "owner_excluded";
    if (u.status !== "enabled") return "not_billed";
    const en = staff.filter((x) => x.contractorId === u.contractorId && !x.isOwner && x.status === "enabled").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return en[0]?.id === u.id ? "free_allowance" : "billable";
  };
  const rows = staff.filter((u) => (!search || `${u.name} ${u.role} ${name(u.contractorId)}`.toLowerCase().includes(search.toLowerCase())) && (status === "all" || u.status === status) && (bill === "all" || billOf(u) === bill));

  return (
    <>
      <PageHeader title="Staff" description={`${rows.length} of ${staff.length} accounts · read-only oversight`} actions={
        <Button variant="outline" size="sm" onClick={() => exportCsv("staff.csv", rows.map((u) => ({ contractor: name(u.contractorId), name: u.name, role: u.role, status: u.status, sites: u.siteIds.length, created: u.createdAt, billing: billOf(u) })))}><Download className="h-4 w-4" />Export CSV</Button>} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Name, role, contractor">
        <FilterSelect label="Statuses" value={status} onChange={setStatus} options={["enabled", "disabled"]} />
        <FilterSelect label="Billing" value={bill} onChange={setBill} options={["billable", "free_allowance", "owner_excluded", "not_billed"]} />
      </Toolbar>
      <DataTable rows={rows} rowKey={(r) => r.id} columns={[
        { key: "c", header: "Contractor", sort: (r) => name(r.contractorId), cell: (r) => <Link to="/contractors/$id" params={{ id: r.contractorId }} className="hover:underline">{name(r.contractorId)}</Link> },
        { key: "n", header: "Name", sort: (r) => r.name, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.role}</div></div> },
        { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { key: "a", header: "Sites", className: "num text-right", sort: (r) => r.siteIds.length, cell: (r) => r.siteIds.length },
        { key: "d", header: "Created", sort: (r) => r.createdAt, cell: (r) => fmtDate(r.createdAt) },
        { key: "l", header: "Last activity", sort: (r) => r.lastActivityAt, cell: (r) => fmtDateTime(r.lastActivityAt) },
        { key: "b", header: "Billable", cell: (r) => { const b = billOf(r); return <StatusBadge status={b === "billable" ? "active" : "inactive"} text={b.replace("_", " ")} />; } },
      ]} />
    </>
  );
}
