import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, FilterSelect, PageHeader, StatusBadge, Toolbar, type Column } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { contractorUsage } from "@/lib/selectors";
import { fmtDate, fmtDateTime, mb } from "@/lib/format";
import { exportCsv } from "@/lib/exporters";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/contractors/")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({ meta: [{ title: "Contractors — CubeSites Super Admin" }, { name: "description", content: "Search and manage contractor accounts." }, { property: "og:title", content: "Contractors — CubeSites Super Admin" }, { property: "og:description", content: "Search and manage contractor accounts." }] }),
  component: Contractors,
});

function Contractors() {
  const { q } = Route.useSearch();
  const nav = useNavigate();
  const state = useData((s) => s);
  const [search, setSearch] = useState(q ?? "");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");

  const rows = useMemo(() => state.contractors.map((c) => {
    const u = contractorUsage(state, c.id);
    const sub = state.subscriptions.find((s) => s.contractorId === c.id)!;
    return { c, u, sub };
  }), [state]);
  const filtered = rows.filter(({ c, sub }) => {
    const t = `${c.name} ${c.ownerName} ${c.email} ${c.phone} ${c.city}`.toLowerCase();
    return (!search || t.includes(search.toLowerCase())) && (status === "all" || c.status === status) && (plan === "all" || sub.plan === plan || sub.status === plan);
  });
  type R = (typeof rows)[number];
  const cols: Column<R>[] = [
    { key: "name", header: "Workspace", sort: (r) => r.c.name, cell: (r) => <div><div className="font-medium">{r.c.name}</div><div className="text-xs text-muted-foreground">{r.c.city}</div></div> },
    { key: "owner", header: "Owner", cell: (r) => <div><div>{r.c.ownerName}</div><div className="text-xs text-muted-foreground">{r.c.email} · {r.c.phone}</div></div> },
    { key: "reg", header: "Registered", sort: (r) => r.c.registeredAt, cell: (r) => fmtDate(r.c.registeredAt) },
    { key: "status", header: "Status", sort: (r) => r.c.status, cell: (r) => <StatusBadge status={r.c.status} /> },
    { key: "sites", header: "Active sites", sort: (r) => r.u.activeSites, className: "text-right num", cell: (r) => r.u.activeSites },
    { key: "staff", header: "Staff", sort: (r) => r.u.enabledStaff, className: "text-right num", cell: (r) => r.u.enabledStaff },
    { key: "storage", header: "Storage avg", sort: (r) => r.u.avg.average, className: "text-right num", cell: (r) => mb(r.u.avg.average) },
    { key: "sub", header: "Subscription", cell: (r) => <div className="flex gap-1"><StatusBadge status={r.sub.plan} text={r.sub.plan === "paid" ? "Paid" : "Free"} /><StatusBadge status={r.sub.status} /></div> },
    { key: "last", header: "Last activity", sort: (r) => r.c.lastActivityAt, cell: (r) => <span className="text-xs">{fmtDateTime(r.c.lastActivityAt)}</span> },
  ];
  return (
    <>
      <PageHeader title="Contractors" description={`${filtered.length} of ${rows.length} workspaces`}
        actions={<Button variant="outline" size="sm" onClick={() => {
          const ok = exportCsv("contractors.csv", filtered.map(({ c, u, sub }) => ({ id: c.id, name: c.name, owner: c.ownerName, email: c.email, phone: c.phone, city: c.city, registered: c.registeredAt, status: c.status, active_sites: u.activeSites, enabled_staff: u.enabledStaff, avg_storage_mb: u.avg.average, plan: sub.plan, subscription: sub.status })));
          ok ? toast.success("Exported contractors.csv") : toast.error("Nothing to export");
        }}><Download className="h-4 w-4" />Export CSV</Button>} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Name, owner, email, phone, city">
        <FilterSelect label="Statuses" value={status} onChange={setStatus} options={["active", "suspended", "expired"]} />
        <FilterSelect label="Subscriptions" value={plan} onChange={setPlan} options={["paid", "free", "grace", "expired"]} />
      </Toolbar>
      <DataTable rows={filtered} columns={cols} rowKey={(r) => r.c.id} onRowClick={(r) => nav({ to: "/contractors/$id", params: { id: r.c.id } })} />
    </>
  );
}
