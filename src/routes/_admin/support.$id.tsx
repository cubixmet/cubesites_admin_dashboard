import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KV, Panel, StatusBadge } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { contractorUsage } from "@/lib/selectors";
import { fmtDateTime, label } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/support/$id")({
  head: () => ({ meta: [{ title: "Support case — CubeSites Super Admin" }, { name: "description", content: "Support case details and internal notes." }, { property: "og:title", content: "Support case — CubeSites Super Admin" }, { property: "og:description", content: "Support case details and internal notes." }] }),
  component: Case,
});

function Case() {
  const { id } = Route.useParams();
  const s = useData((x) => x);
  const [note, setNote] = useState("");
  const c = s.support.find((x) => x.id === id);
  if (!c) return <p className="p-8 text-center text-sm text-muted-foreground">Case not found. <Link to="/support" className="text-primary underline">Back</Link></p>;
  const ct = s.contractors.find((x) => x.id === c.contractorId)!;
  const u = contractorUsage(s, ct.id);
  const sub = s.subscriptions.find((x) => x.contractorId === ct.id)!;
  return (
    <>
      <Link to="/support" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Support</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{c.subject}</h1>
        <div className="flex gap-2">
          <Select value={c.status} onValueChange={(v) => { actions.updateCase(c.id, { status: v as typeof c.status }); toast.success("Status updated"); }}>
            <SelectTrigger className="h-9 w-36" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>{["open", "in_progress", "waiting", "resolved"].map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={c.priority} onValueChange={(v) => { actions.updateCase(c.id, { priority: v as typeof c.priority }); toast.success("Priority updated"); }}>
            <SelectTrigger className="h-9 w-32" aria-label="Priority"><SelectValue /></SelectTrigger>
            <SelectContent>{["low", "medium", "high", "urgent"].map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Request"><p className="text-sm">{c.description}</p><p className="num mt-2 text-xs text-muted-foreground">Opened {fmtDateTime(c.createdAt)} · updated {fmtDateTime(c.updatedAt)}</p></Panel>
          <Panel title="Internal notes (admin only — never shown to contractors)">
            <ul className="mb-3 space-y-2">{c.notes.map((n) => <li key={n.id} className="rounded-md bg-muted p-2 text-sm">{n.text}<div className="num mt-1 text-xs text-muted-foreground">{n.by} · {fmtDateTime(n.at)}</div></li>)}{!c.notes.length && <li className="text-sm text-muted-foreground">No notes yet.</li>}</ul>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" />
            <Button size="sm" className="mt-2" disabled={!note.trim()} onClick={() => { actions.addNote(c.id, note.trim()); setNote(""); toast.success("Note added"); }}>Add note</Button>
          </Panel>
        </div>
        <Panel title="Contractor context">
          <KV items={[["Workspace", <Link key="l" to="/contractors/$id" params={{ id: ct.id }} className="text-primary hover:underline">{ct.name}</Link>], ["Status", <StatusBadge key="s" status={ct.status} />], ["Subscription", `${label(sub.plan)} · ${label(sub.status)}`], ["Active sites", u.activeSites], ["Enabled staff", u.enabledStaff], ["Owner", ct.ownerName], ["Phone", ct.phone]]} />
        </Panel>
      </div>
    </>
  );
}
