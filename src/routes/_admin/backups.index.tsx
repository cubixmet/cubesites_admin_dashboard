import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable, FilterSelect, PageHeader, StatusBadge, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDateTime, label } from "@/lib/format";

export const Route = createFileRoute("/_admin/backups/")({
  head: () => ({
    meta: [
      { title: "Google Drive & Backups — CuboSites Super Admin" },
      {
        name: "description",
        content: "Monitor contractor Google Drive connections and backup jobs (demo).",
      },
      { property: "og:title", content: "Google Drive & Backups — CuboSites Super Admin" },
      {
        property: "og:description",
        content: "Monitor contractor Google Drive connections and backup jobs (demo).",
      },
    ],
  }),
  component: Backups,
});

function Backups() {
  const s = useData((x) => x);
  const name = useContractorNames();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const rows = s.contractors
    .map((c) => {
      const jobs = s.backups
        .filter((b) => b.contractorId === c.id)
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
      return {
        c,
        drive: s.drive.find((d) => d.contractorId === c.id)!,
        last: jobs[0],
        lastOk: jobs.find((j) => j.status === "success"),
        restore: jobs.find((j) => j.restoreTest !== "not_tested")?.restoreTest ?? "not_tested",
      };
    })
    .filter(
      (r) =>
        (!search || r.c.name.toLowerCase().includes(search.toLowerCase())) &&
        (status === "all" || r.last?.status === status),
    );
  return (
    <>
      <PageHeader
        title="Google Drive & backups"
        description="Monitor contractor Drive backup jobs, failures and overdue runs."
      />
      <Toolbar search={search} onSearch={setSearch} placeholder="Contractor">
        <FilterSelect
          label="Statuses"
          value={status}
          onChange={setStatus}
          options={["success", "failed", "overdue"]}
        />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(r) => r.c.id}
        onRowClick={(r) => r.last && nav({ to: "/backups/$id", params: { id: r.last.id } })}
        columns={[
          {
            key: "c",
            header: "Contractor",
            sort: (r) => name(r.c.id),
            cell: (r) => <span className="font-medium">{r.c.name}</span>,
          },
          { key: "d", header: "Drive", cell: (r) => <StatusBadge status={r.drive.status} /> },
          {
            key: "ok",
            header: "Last successful",
            sort: (r) => r.lastOk?.completedAt ?? "",
            cell: (r) => fmtDateTime(r.lastOk?.completedAt),
          },
          { key: "at", header: "Last attempted", cell: (r) => fmtDateTime(r.last?.attemptedAt) },
          { key: "t", header: "Type", cell: (r) => (r.last ? label(r.last.type) : "—") },
          {
            key: "s",
            header: "Status",
            sort: (r) => r.last?.status ?? "",
            cell: (r) => (r.last ? <StatusBadge status={r.last.status} /> : "—"),
          },
          {
            key: "f",
            header: "Failure",
            cell: (r) => <span className="text-xs text-destructive">{r.last?.failure ?? ""}</span>,
          },
          { key: "r", header: "Restore test", cell: (r) => <StatusBadge status={r.restore} /> },
        ]}
      />
    </>
  );
}
