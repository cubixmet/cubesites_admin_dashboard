import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable, FilterSelect, PageHeader, StatusBadge, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_admin/support/")({
  head: () => ({
    meta: [
      { title: "Support — CuboSites Super Admin" },
      { name: "description", content: "Contractor support cases with internal notes." },
      { property: "og:title", content: "Support — CuboSites Super Admin" },
      { property: "og:description", content: "Contractor support cases with internal notes." },
    ],
  }),
  component: Support,
});

function Support() {
  const cases = useData((s) => s.support);
  const name = useContractorNames();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [prio, setPrio] = useState("all");
  const rows = cases.filter(
    (c) =>
      (!search ||
        `${c.subject} ${name(c.contractorId)}`.toLowerCase().includes(search.toLowerCase())) &&
      (status === "all" || c.status === status) &&
      (prio === "all" || c.priority === prio),
  );
  return (
    <>
      <PageHeader
        title="Support"
        description={`${cases.filter((c) => c.status !== "resolved").length} open cases`}
      />
      <Toolbar search={search} onSearch={setSearch} placeholder="Subject, contractor">
        <FilterSelect
          label="Statuses"
          value={status}
          onChange={setStatus}
          options={["open", "in_progress", "waiting", "resolved"]}
        />
        <FilterSelect
          label="Priorities"
          value={prio}
          onChange={setPrio}
          options={["urgent", "high", "medium", "low"]}
        />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => nav({ to: "/support/$id", params: { id: r.id } })}
        columns={[
          {
            key: "s",
            header: "Subject",
            cell: (r) => <span className="font-medium">{r.subject}</span>,
          },
          {
            key: "c",
            header: "Contractor",
            sort: (r) => name(r.contractorId),
            cell: (r) => name(r.contractorId),
          },
          { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "p", header: "Priority", cell: (r) => <StatusBadge status={r.priority} /> },
          {
            key: "u",
            header: "Updated",
            sort: (r) => r.updatedAt,
            cell: (r) => fmtDateTime(r.updatedAt),
          },
        ]}
      />
    </>
  );
}
