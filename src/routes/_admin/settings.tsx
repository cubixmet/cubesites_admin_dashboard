import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { label } from "@/lib/format";
import { RETENTION_DAYS } from "@/lib/selectors";
import type { NotificationType } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/settings")({
  head: () => ({ meta: [{ title: "Settings — CubeSites Super Admin" }, { name: "description", content: "Admin profile, notification preferences and operational settings." }, { property: "og:title", content: "Settings — CubeSites Super Admin" }, { property: "og:description", content: "Admin profile, notification preferences and operational settings." }] }),
  component: Settings,
});

function Settings() {
  const saved = useData((s) => s.settings);
  const [f, setF] = useState(saved);
  const [days, setDays] = useState(saved.ops.reminderDays.join(", "));
  const parsed = days.split(",").map((d) => Number(d.trim())).filter((n) => Number.isInteger(n) && n > 0 && n < RETENTION_DAYS);
  const err = !f.adminName.trim() ? "Name is required." : !/^\S+@\S+\.\S+$/.test(f.adminEmail) ? "Valid email required." : !parsed.length ? `Enter reminder days between 1 and ${RETENTION_DAYS - 1}.` : f.ops.backupHourIst < 0 || f.ops.backupHourIst > 23 ? "Backup hour must be 0–23." : "";
  return (
    <>
      <PageHeader title="Settings" description="Mock settings stored in this browser only." actions={<Button size="sm" disabled={!!err} onClick={() => { actions.updateSettings({ ...f, ops: { ...f.ops, reminderDays: [...new Set(parsed)].sort((a, b) => b - a) } }); toast.success("Settings saved (demo) and logged"); }}>Save changes</Button>} />
      {err && <p className="mb-3 text-xs text-destructive">{err}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Admin profile">
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="n">Display name</Label><Input id="n" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="e">Email</Label><Input id="e" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Password, MFA and role management belong to the real backend and are not available in demo mode.</p>
          </div>
        </Panel>
        <Panel title="Notification preferences">
          <div className="space-y-2">{(Object.keys(f.prefs) as NotificationType[]).map((k) => (
            <div key={k} className="flex items-center justify-between text-sm"><Label htmlFor={k}>{label(k)}</Label><Switch id={k} checked={f.prefs[k]} onCheckedChange={(v) => setF({ ...f, prefs: { ...f.prefs, [k]: v } })} /></div>
          ))}</div>
        </Panel>
        <Panel title="Operational settings (mock)">
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="bh">Scheduled backup hour (IST, 0–23)</Label><Input id="bh" type="number" min={0} max={23} value={f.ops.backupHourIst} onChange={(e) => setF({ ...f, ops: { ...f.ops, backupHourIst: Number(e.target.value) } })} /></div>
            <div className="space-y-1"><Label htmlFor="rd">Retention reminder days before deletion</Label><Input id="rd" value={days} onChange={(e) => setDays(e.target.value)} /></div>
            <div className="space-y-1"><Label>Retention period</Label><Input value={`${RETENTION_DAYS} days after expiry (confirmed policy, read-only)`} disabled /></div>
            <div className="space-y-1"><Label htmlFor="mb">Maintenance banner text</Label><Input id="mb" value={f.ops.maintenanceBanner} onChange={(e) => setF({ ...f, ops: { ...f.ops, maintenanceBanner: e.target.value } })} placeholder="Leave empty for none" /></div>
          </div>
        </Panel>
      </div>
    </>
  );
}
