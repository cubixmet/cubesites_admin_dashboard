import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KV, Panel, StatusBadge } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { fmtDateTime, label } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/backups/$id")({
  head: () => ({ meta: [{ title: "Backup job — CubeSites Super Admin" }, { name: "description", content: "Backup job logs and demo actions." }, { property: "og:title", content: "Backup job — CubeSites Super Admin" }, { property: "og:description", content: "Backup job logs and demo actions." }] }),
  component: Job,
});

function Job() {
  const { id } = Route.useParams();
  const s = useData((x) => x);
  const b = s.backups.find((x) => x.id === id);
  if (!b) return <p className="p-8 text-center text-sm text-muted-foreground">Backup job not found. <Link to="/backups" className="text-primary underline">Back</Link></p>;
  const c = s.contractors.find((x) => x.id === b.contractorId)!;
  const d = s.drive.find((x) => x.contractorId === b.contractorId);
  return (
    <>
      <Link to="/backups" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Backups</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-semibold">Backup {b.id}</h1><p className="text-sm text-muted-foreground"><Link to="/contractors/$id" params={{ id: c.id }} className="hover:underline">{c.name}</Link></p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { actions.retryBackup(b.id); toast.message("Demo retry simulated — no real backup ran"); }}><RotateCcw className="h-4 w-4" />Retry mock job (demo)</Button>
          <Button size="sm" variant="outline" onClick={() => { actions.reviewRestore(b.id, "passed"); toast.success("Mock restore marked passed"); }}>Mark mock restore passed</Button>
          <Button size="sm" variant="outline" onClick={() => { actions.reviewRestore(b.id, "failed"); toast.message("Mock restore marked failed"); }}>Mark mock restore failed</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Job"><KV items={[["Status", <StatusBadge key="s" status={b.status} />], ["Type", label(b.type)], ["Attempted", fmtDateTime(b.attemptedAt)], ["Completed", fmtDateTime(b.completedAt)], ["Size", b.sizeMb ? `${b.sizeMb} MB` : "—"], ["Restore test", <StatusBadge key="r" status={b.restoreTest} />], ["Failure", b.failure ?? "—"], ["Drive", `${label(d?.status ?? "—")} · ${d?.email ?? ""}`]]} /></Panel>
        <Panel title="Logs">
          <ul className="num space-y-1 text-xs">{b.logs.map((l, i) => (
            <li key={i} className="flex gap-2"><span className="text-muted-foreground">{fmtDateTime(l.at)}</span><span className={cn("w-10 uppercase", l.level === "error" && "text-destructive", l.level === "warn" && "text-warning")}>{l.level}</span><span>{l.message}</span></li>
          ))}</ul>
        </Panel>
      </div>
    </>
  );
}
