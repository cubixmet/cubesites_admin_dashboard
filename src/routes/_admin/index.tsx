import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Panel, PageHeader, Stat, StatusBadge } from "@/components/admin/kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/lib/store";
import { overview } from "@/lib/selectors";
import { fmtDate, fmtDateTime, inr, label, num, daysFromToday } from "@/lib/format";
import { useContractorNames } from "@/lib/hooks";
import { DEMO_TODAY } from "@/lib/mock/seed";

export const Route = createFileRoute("/_admin/")({
  head: () => ({
    meta: [
      { title: "Overview — CubeSites Super Admin" },
      { name: "description", content: "Operational overview of CubeSites contractor accounts, revenue and backups." },
      { property: "og:title", content: "Overview — CubeSites Super Admin" },
      { property: "og:description", content: "Operational overview of CubeSites contractor accounts, revenue and backups." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const state = useData((s) => s);
  const [range, setRange] = useState("90");
  const o = useMemo(() => overview(state, Number(range)), [state, range]);
  const name = useContractorNames();
  const max = Math.max(1, ...o.months.map((m) => m.collected));

  const alerts = [
    o.pendingReviews > 0 && { text: `${o.pendingReviews} manual payment(s) awaiting review`, to: "/payments" as const },
    o.failedBackups > 0 && { text: `${o.failedBackups} contractor(s) with a failed or overdue latest backup`, to: "/backups" as const },
    state.snapshots.some((s) => s.mb === null) && { text: `${state.snapshots.filter((s) => s.mb === null).length} missing storage measurement(s) this period`, to: "/storage" as const },
    o.upcoming.some((u) => u.kind === "Retention deadline") && { text: "Accounts approaching the 90-day retention deadline", to: "/notifications" as const },
  ].filter(Boolean) as { text: string; to: "/payments" | "/backups" | "/storage" | "/notifications" }[];

  return (
    <>
      <PageHeader title="Overview" description={`Demo date ${fmtDate(DEMO_TODAY)} · all figures computed from the mock dataset`}
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-44" aria-label="Revenue range"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Collected: last 30 days</SelectItem>
              <SelectItem value="90">Collected: last 90 days</SelectItem>
              <SelectItem value="365">Collected: last 12 months</SelectItem>
            </SelectContent>
          </Select>
        } />

      {alerts.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {alerts.map((a) => (
            <Link key={a.text} to={a.to} className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-sm hover:bg-warning/15">
              <AlertTriangle className="h-4 w-4 text-warning" />{a.text}<span className="ml-auto text-xs text-muted-foreground">Review →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Contractor accounts" value={num(o.total)} hint={`${o.active} active · ${o.expired} expired · ${o.suspended} suspended`} />
        <Stat label="Active sites" value={num(o.activeSites)} hint="across all contractors" />
        <Stat label="Enabled staff" value={num(o.enabledStaff)} hint="excluding owners" />
        <Stat label="Paid subscriptions" value={num(o.paidSubs)} hint={`${o.freeSubs} on free tier`} />
        <Stat label="Failed backups" value={num(o.failedBackups)} tone={o.failedBackups ? "danger" : undefined} hint="latest job per contractor" />
        <Stat label="Pending reviews" value={num(o.pendingReviews)} tone={o.pendingReviews ? "warning" : undefined} hint="manual payments" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Stat label={`Collected revenue (${range}d)`} value={inr(o.collected)} tone="success" hint="Actual successful + approved payments" />
        <Stat label="Outstanding invoices" value={inr(o.pending)} tone="warning" hint="Pending + overdue, not yet collected" />
        <Stat label="Projected this period" value={inr(o.projected)} hint="Estimated recurring charges, incl. tax" />
        <Stat label="Storage charges (projected)" value={inr(o.storageCharges)} hint="Current period, before tax" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Collected revenue by month">
          <div className="space-y-2">
            {o.months.map((m) => (
              <div key={m.key} className="grid grid-cols-[56px_1fr_96px] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{m.key}</span>
                <div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${(m.collected / max) * 100}%` }} /></div>
                <span className="num text-right">{inr(m.collected)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Upcoming deadlines (30 days)">
          {o.upcoming.length ? (
            <ul className="divide-y text-sm">
              {o.upcoming.slice(0, 8).map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <Link to="/contractors/$id" params={{ id: u.contractorId }} className="truncate hover:underline">{name(u.contractorId)}</Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={u.kind === "Renewal" ? "info" : "overdue"} text={u.kind} />
                    <span className="num text-xs text-muted-foreground">{fmtDate(u.date)} ({daysFromToday(u.date)}d)</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No deadlines in the next 30 days.</p>}
        </Panel>
        <Panel title="Recent admin activity" actions={<Link to="/activity" className="text-xs text-primary hover:underline">View all</Link>}>
          <ul className="divide-y text-sm">
            {state.audit.slice(0, 8).map((a) => (
              <li key={a.id} className="py-1.5">
                <div className="flex justify-between gap-2"><span className="font-medium">{label(a.action)}</span><span className="num text-xs text-muted-foreground">{fmtDateTime(a.at)}</span></div>
                <div className="truncate text-xs text-muted-foreground">{a.target}{a.reason ? ` — ${a.reason}` : ""}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
