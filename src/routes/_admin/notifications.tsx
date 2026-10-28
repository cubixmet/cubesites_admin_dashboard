import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, FilterSelect, PageHeader, StatusBadge } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { daysFromToday, fmtDate, fmtDateTime, label } from "@/lib/format";
import { retentionDeadline, RETENTION_DAYS } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications & Retention — CubeSites Super Admin" }, { name: "description", content: "Operational alerts and the 90-day data retention queue." }, { property: "og:title", content: "Notifications & Retention — CubeSites Super Admin" }, { property: "og:description", content: "Operational alerts and the 90-day data retention queue." }] }),
  component: Notifications,
});

function Notifications() {
  const s = useData((x) => x);
  const name = useContractorNames();
  const [type, setType] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = s.notifications.filter((n) => (type === "all" || n.type === type) && (!unreadOnly || !n.read)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const queue = s.subscriptions.filter((x) => x.expiredAt).map((x) => {
    const deadline = retentionDeadline(x.expiredAt!);
    return { sub: x, deadline, days: daysFromToday(deadline), notices: s.retention.filter((r) => r.contractorId === x.contractorId) };
  }).sort((a, b) => a.days - b.days);

  return (
    <>
      <PageHeader title="Notifications" description={`${s.notifications.filter((n) => !n.read).length} unread`} actions={<Button size="sm" variant="outline" onClick={() => actions.markRead("all")}>Mark all read</Button>} />
      <Tabs defaultValue="inbox">
        <TabsList><TabsTrigger value="inbox">Alerts</TabsTrigger><TabsTrigger value="retention">Retention queue ({queue.length})</TabsTrigger></TabsList>
        <TabsContent value="inbox" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FilterSelect label="Types" value={type} onChange={setType} options={["subscription_expiry", "manual_payment", "backup_failed", "storage_anomaly", "retention_deadline", "delivery_failed"]} />
            <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(!unreadOnly)}>Unread only</Button>
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {list.map((n) => (
              <div key={n.id} className={cn("flex flex-wrap items-start gap-3 px-4 py-3", !n.read && "bg-accent/40")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{n.title}<StatusBadge status="medium" text={label(n.type)} /></div>
                  <div className="text-sm text-muted-foreground">{n.message}</div>
                  <div className="num mt-0.5 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</div>
                </div>
                <div className="flex gap-1">
                  {n.contractorId && <Button size="sm" variant="ghost" asChild><Link to="/contractors/$id" params={{ id: n.contractorId }}>Open</Link></Button>}
                  {!n.read && <Button size="sm" variant="ghost" onClick={() => actions.markRead(n.id)}>Mark read</Button>}
                </div>
              </div>
            ))}
            {!list.length && <p className="p-8 text-center text-sm text-muted-foreground">No notifications.</p>}
          </div>
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">Data is retained for {RETENTION_DAYS} days after subscription expiry with advance notices. Deletion is not available from this demo; the backend must apply the published policy, legal requirements and multi-step authorization.</p>
          <DataTable rows={queue} rowKey={(r) => r.sub.id} columns={[
            { key: "c", header: "Contractor", cell: (r) => <Link to="/contractors/$id" params={{ id: r.sub.contractorId }} className="font-medium hover:underline">{name(r.sub.contractorId)}</Link> },
            { key: "e", header: "Expired", cell: (r) => fmtDate(r.sub.expiredAt) },
            { key: "d", header: "Retention deadline", sort: (r) => r.days, cell: (r) => <span>{fmtDate(r.deadline)} <span className={cn("num text-xs", r.days <= 14 ? "text-destructive" : "text-muted-foreground")}>({r.days} days)</span></span> },
            { key: "n", header: "Notices sent", cell: (r) => <div className="space-y-0.5 text-xs">{r.notices.map((x) => <div key={x.id}>{x.daysBefore}d · {x.channel} · {fmtDate(x.sentAt)} <StatusBadge status={x.delivery} /></div>)}{!r.notices.length && "—"}</div> },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.days <= 14 ? "urgent" : "pending"} text={r.days <= 14 ? "Final notice window" : "Retained"} /> },
            { key: "a", header: "", cell: (r) => <Button size="sm" variant="outline" onClick={() => { actions.sendRetentionReminder(r.sub.contractorId, Math.max(0, r.days)); toast.success("Mock reminder recorded — no message was sent"); }}>Send mock reminder</Button> },
          ]} />
        </TabsContent>
      </Tabs>
    </>
  );
}
