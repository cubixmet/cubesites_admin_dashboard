import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, FilterSelect, PageHeader, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDateTime, label } from "@/lib/format";
import { exportCsv } from "@/lib/exporters";

export const Route = createFileRoute("/_admin/activity")({
  head: () => ({
    meta: [
      { title: "Activity Logs — CuboSites Super Admin" },
      { name: "description", content: "Append-only audit log of administrative actions." },
      { property: "og:title", content: "Activity Logs — CuboSites Super Admin" },
      { property: "og:description", content: "Append-only audit log of administrative actions." },
    ],
  }),
  component: Activity,
});

function Activity() {
  const audit = useData((s) => s.audit);
  const contractors = useData((s) => s.contractors);
  const name = useContractorNames();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [actor, setActor] = useState("all");
  const [cid, setCid] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const types = [...new Set(audit.map((a) => a.action.split(".")[0]))];
  const actors = [...new Set(audit.map((a) => a.actor))];
  const rows = audit.filter((a) => {
    const d = a.at.slice(0, 10);
    return (
      (!search ||
        `${a.action} ${a.target} ${a.reason ?? ""}`.toLowerCase().includes(search.toLowerCase())) &&
      (type === "all" || a.action.startsWith(type + ".")) &&
      (actor === "all" || a.actor === actor) &&
      (cid === "all" || a.contractorId === cid) &&
      (!from || d >= from) &&
      (!to || d <= to)
    );
  });
  return (
    <>
      <PageHeader
        title="Activity logs"
        description="Append-only. Log entries cannot be edited or deleted from this portal."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                "audit-log.csv",
                rows.map((a) => ({
                  at: a.at,
                  actor: a.actor,
                  contractor: a.contractorId ? name(a.contractorId) : "",
                  action: a.action,
                  target: a.target,
                  before: a.before,
                  after: a.after,
                  reason: a.reason,
                })),
              )
            }
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <Toolbar search={search} onSearch={setSearch} placeholder="Action, target, reason">
        <FilterSelect label="Action types" value={type} onChange={setType} options={types} />
        <select
          aria-label="Actor"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="all">All actors</option>
          {actors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select
          aria-label="Contractor"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="all">All contractors</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          aria-label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 w-auto"
        />
        <Input
          type="date"
          aria-label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 w-auto"
        />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        pageSize={20}
        columns={[
          {
            key: "t",
            header: "Timestamp",
            sort: (r) => r.at,
            cell: (r) => <span className="num text-xs">{fmtDateTime(r.at)}</span>,
          },
          { key: "u", header: "Actor", cell: (r) => <span className="text-xs">{r.actor}</span> },
          {
            key: "c",
            header: "Workspace",
            cell: (r) => (r.contractorId ? name(r.contractorId) : "Platform"),
          },
          {
            key: "a",
            header: "Action",
            sort: (r) => r.action,
            cell: (r) => <span className="font-medium">{label(r.action)}</span>,
          },
          { key: "x", header: "Target", cell: (r) => r.target },
          {
            key: "ba",
            header: "Before → after",
            cell: (r) => (
              <span className="text-xs">
                {r.before || r.after ? `${r.before ?? "—"} → ${r.after ?? "—"}` : ""}
              </span>
            ),
          },
          {
            key: "r",
            header: "Reason",
            cell: (r) => <span className="text-xs">{r.reason ?? ""}</span>,
          },
        ]}
      />
    </>
  );
}
