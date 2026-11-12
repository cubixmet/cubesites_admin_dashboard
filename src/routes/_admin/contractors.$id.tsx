import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, KV, Panel, ReasonDialog, Stat, StatusBadge } from "@/components/admin/kit";
import { BillBreakdown } from "@/components/admin/billing-views";
import { actions, useData } from "@/lib/store";
import { currentBill, retentionDeadline } from "@/lib/selectors";
import { fmtDate, fmtDateTime, inr, label, mb } from "@/lib/format";
import { exportInvoicePdf } from "@/lib/exporters";
import type { WalletFunding } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/contractors/$id")({
  head: () => ({
    meta: [
      { title: "Contractor details — CuboSites Super Admin" },
      { name: "description", content: "Contractor account, billing, storage and backup details." },
      { property: "og:title", content: "Contractor details — CuboSites Super Admin" },
      {
        property: "og:description",
        content: "Contractor account, billing, storage and backup details.",
      },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const s = useData((x) => x);
  const c = s.contractors.find((x) => x.id === id);
  const [dlg, setDlg] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [funding, setFunding] = useState<WalletFunding>("paid");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [recharging, setRecharging] = useState(false);
  if (!c)
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Contractor not found.{" "}
        <Link to="/contractors" className="text-primary underline">
          Back to list
        </Link>
      </div>
    );
  const bill = currentBill(s, id);
  const u = bill.usage;
  const sub = s.subscriptions.find((x) => x.contractorId === id)!;
  const invoices = s.invoices.filter((x) => x.contractorId === id);
  const payments = s.payments.filter((x) => x.contractorId === id);
  const backups = s.backups.filter((x) => x.contractorId === id);
  const drive = s.drive.find((x) => x.contractorId === id);
  const audit = s.audit.filter((x) => x.contractorId === id);
  const wallet = (s.wallets || []).find((x) => x.contractorId === id) || {
    contractorId: id,
    balance: 0,
    paidRecharged: 0,
    freeRecharged: 0,
    updatedAt: "",
  };
  const walletTx = (s.walletTransactions || []).filter((x) => x.contractorId === id);
  const suspend = c.status !== "suspended";

  const submitRecharge = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) {
      toast.error("Enter a positive amount in ₹");
      return;
    }
    setRecharging(true);
    try {
      await actions.rechargeWallet(id, amt, funding, note.trim(), reference.trim());
      toast.success(`Added ${inr(amt)} (${funding}) to wallet`);
      setRechargeOpen(false);
      setAmount("");
      setNote("");
      setReference("");
      setFunding("paid");
    } catch (e) {
      toast.error((e as Error).message || "Recharge failed");
    } finally {
      setRecharging(false);
    }
  };

  return (
    <>
      <Link
        to="/contractors"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Contractors
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {c.ownerName} · {c.email} · {c.phone} · {c.city}
          </p>
        </div>
        <Button
          variant={suspend ? "destructive" : "default"}
          size="sm"
          onClick={() => setDlg(true)}
        >
          {suspend ? "Suspend account" : "Reactivate account"}
        </Button>
      </div>
      <ReasonDialog
        open={dlg}
        onOpenChange={setDlg}
        destructive={suspend}
        title={suspend ? `Suspend ${c.name}?` : `Reactivate ${c.name}?`}
        description={
          suspend
            ? "Users of this workspace lose access in this demo. No records are deleted. In production the backend must enforce this."
            : "Restores access for this workspace in the demo."
        }
        confirmLabel={suspend ? "Suspend" : "Reactivate"}
        onConfirm={(r) => {
          actions.setContractorStatus(id, suspend ? "suspended" : "active", r);
          toast.success(`Account ${suspend ? "suspended" : "reactivated"} (demo) and logged`);
        }}
      />

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recharge wallet</DialogTitle>
            <DialogDescription>
              Mark as <b>paid</b> when money was actually received (counts as income). Use{" "}
              <b>free</b> for promos/comps (excluded from income).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="amt">Amount (₹)</Label>
              <Input
                id="amt"
                type="number"
                min={1}
                step="0.01"
                className="mt-1.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="funding">Funding</Label>
              <select
                id="funding"
                className="mt-1.5 flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={funding}
                onChange={(e) => setFunding(e.target.value as WalletFunding)}
              >
                <option value="paid">Paid — counts as income</option>
                <option value="free">Free — promo / complimentary</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ref">
                Reference <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ref"
                className="mt-1.5"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UPI / NEFT ref"
              />
            </div>
            <div>
              <Label htmlFor="note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="note"
                className="mt-1.5"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this credit was added"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRecharge} disabled={recharging}>
              {recharging ? "Saving…" : "Add credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            {[
              "overview",
              "sites",
              "staff",
              "subscription",
              "wallet",
              "payments",
              "storage",
              "backups",
              "activity",
            ].map((t) => (
              <TabsTrigger key={t} value={t}>
                {label(t)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Active sites" value={u.activeSites} hint={`${u.sites.length} total`} />
            <Stat label="Enabled staff" value={u.enabledStaff} hint="excl. owner" />
            <Stat
              label="Avg storage"
              value={mb(u.avg.average)}
              hint={`${u.avg.missing} missing days`}
            />
            <Stat label="Projected bill" value={inr(bill.total)} hint="current period" />
            <Stat
              label="Wallet balance"
              value={inr(wallet.balance)}
              hint={`${inr(wallet.paidRecharged)} paid · ${inr(wallet.freeRecharged)} free`}
            />
          </div>
          <Panel title="Account">
            <KV
              items={[
                ["Workspace ID", c.id],
                ["Registered", fmtDate(c.registeredAt)],
                ["GSTIN", c.gstin ?? "—"],
                ["Last activity", fmtDateTime(c.lastActivityAt)],
                ["Plan", label(sub.plan)],
                ["Subscription", label(sub.status)],
                ["Drive", label(drive?.status ?? "—")],
                ["Open invoices", invoices.filter((i) => i.status !== "paid").length],
              ]}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <DataTable
            rows={u.sites}
            rowKey={(r) => r.id}
            columns={[
              { key: "n", header: "Site", sort: (r) => r.name, cell: (r) => r.name },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "c",
                header: "Created",
                sort: (r) => r.createdAt,
                cell: (r) => fmtDate(r.createdAt),
              },
              { key: "r", header: "Reactivated", cell: (r) => fmtDate(r.reactivatedAt) },
              { key: "l", header: "Last activity", cell: (r) => fmtDateTime(r.lastActivityAt) },
            ]}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <DataTable
            rows={u.staff}
            rowKey={(r) => r.id}
            columns={[
              { key: "n", header: "Name", cell: (r) => r.name },
              { key: "r", header: "Role", cell: (r) => r.role },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "b",
                header: "Billing",
                cell: (r) =>
                  r.isOwner
                    ? "Owner — excluded"
                    : r.status === "enabled"
                      ? "Counts toward billing"
                      : "Not billed",
              },
              {
                key: "a",
                header: "Sites",
                className: "num text-right",
                cell: (r) => r.siteIds.length,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 space-y-4">
          <Panel title="Subscription">
            <KV
              items={[
                ["Plan", label(sub.plan)],
                ["Status", label(sub.status)],
                ["Billing period", `${fmtDate(sub.periodStart)} – ${fmtDate(sub.periodEnd)}`],
                ["Renewal", fmtDate(sub.renewalDate)],
                ["Expired on", fmtDate(sub.expiredAt)],
                [
                  "Retention deadline",
                  sub.expiredAt ? fmtDate(retentionDeadline(sub.expiredAt)) : "—",
                ],
              ]}
            />
          </Panel>
          <Panel title="Current period estimate">
            <BillBreakdown bill={bill} />
          </Panel>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Balance" value={inr(wallet.balance)} />
            <Stat
              label="Paid recharged"
              value={inr(wallet.paidRecharged)}
              tone="success"
              hint="Counts as income"
            />
            <Stat
              label="Free recharged"
              value={inr(wallet.freeRecharged)}
              hint="Excluded from income"
            />
            <Stat label="Updated" value={wallet.updatedAt ? fmtDateTime(wallet.updatedAt) : "—"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setRechargeOpen(true)}>
              Recharge wallet
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/wallets">Open wallets</Link>
            </Button>
          </div>
          <DataTable
            rows={walletTx}
            rowKey={(r) => r.id}
            empty="No wallet transactions yet."
            columns={[
              {
                key: "a",
                header: "Amount",
                className: "num text-right",
                cell: (r) => (
                  <span className={r.amount < 0 ? "text-destructive" : ""}>{inr(r.amount)}</span>
                ),
              },
              { key: "f", header: "Funding", cell: (r) => <StatusBadge status={r.funding} /> },
              { key: "i", header: "Income", cell: (r) => (r.countsAsIncome ? "Yes" : "—") },
              { key: "k", header: "Kind", cell: (r) => label(r.kind) },
              {
                key: "n",
                header: "Note",
                cell: (r) => <span className="text-xs">{r.note || r.reference || "—"}</span>,
              },
              { key: "d", header: "When", cell: (r) => fmtDateTime(r.createdAt) },
              {
                key: "u",
                header: "By",
                cell: (r) => <span className="text-xs">{r.createdBy || "—"}</span>,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          <DataTable
            rows={invoices}
            rowKey={(r) => r.id}
            empty="No invoices yet."
            columns={[
              { key: "n", header: "Invoice", cell: (r) => <span className="num">{r.number}</span> },
              {
                key: "p",
                header: "Period",
                cell: (r) => `${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}`,
              },
              { key: "t", header: "Total", className: "num text-right", cell: (r) => inr(r.total) },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "pdf",
                header: "",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      exportInvoicePdf(r, c).then(() => toast.success("Invoice PDF downloaded"))
                    }
                  >
                    <FileDown className="h-4 w-4" />
                    PDF
                  </Button>
                ),
              },
            ]}
          />
          <DataTable
            rows={payments}
            rowKey={(r) => r.id}
            empty="No payments."
            columns={[
              {
                key: "r",
                header: "Reference",
                cell: (r) => <span className="num text-xs">{r.reference}</span>,
              },
              { key: "m", header: "Method", cell: (r) => label(r.method) },
              {
                key: "a",
                header: "Amount",
                className: "num text-right",
                cell: (r) => inr(r.amount),
              },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "d", header: "Date", cell: (r) => fmtDateTime(r.paidAt) },
            ]}
          />
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Panel
            title="Daily snapshots — current period"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => nav({ to: "/storage", search: { c: id } })}
              >
                Open in Storage Billing
              </Button>
            }
          >
            <p className="mb-3 text-sm">
              Average <b className="num">{mb(u.avg.average)}</b> over {u.avg.measured} measured days
              → {bill.storage.blocks} billable block(s) ={" "}
              <b className="num">{inr(bill.storage.amount)}</b>
            </p>
            <div className="grid grid-cols-3 gap-1 text-xs sm:grid-cols-6 lg:grid-cols-9">
              {u.snaps.map((sn) => (
                <div
                  key={sn.id}
                  className={`rounded border px-1.5 py-1 ${sn.mb === null ? "border-destructive/40 bg-destructive/10" : ""}`}
                >
                  <div className="text-muted-foreground">{sn.date.slice(5)}</div>
                  <div className="num">{sn.mb === null ? "missing" : sn.mb}</div>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="backups" className="mt-4">
          <p className="mb-2 text-sm">
            Drive: <StatusBadge status={drive?.status ?? "disconnected"} />{" "}
            <span className="text-muted-foreground">{drive?.email}</span>
          </p>
          <DataTable
            rows={backups}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav({ to: "/backups/$id", params: { id: r.id } })}
            columns={[
              { key: "t", header: "Attempted", cell: (r) => fmtDateTime(r.attemptedAt) },
              { key: "y", header: "Type", cell: (r) => label(r.type) },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "f",
                header: "Failure",
                cell: (r) => <span className="text-xs text-destructive">{r.failure ?? ""}</span>,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <DataTable
            rows={audit}
            rowKey={(r) => r.id}
            empty="No admin activity recorded for this contractor."
            columns={[
              { key: "t", header: "When", cell: (r) => fmtDateTime(r.at) },
              { key: "a", header: "Action", cell: (r) => label(r.action) },
              {
                key: "x",
                header: "Change",
                cell: (r) => (
                  <span className="text-xs">
                    {r.before ?? ""}
                    {r.after ? ` → ${r.after}` : ""}
                  </span>
                ),
              },
              {
                key: "r",
                header: "Reason",
                cell: (r) => <span className="text-xs">{r.reason ?? "—"}</span>,
              },
              {
                key: "u",
                header: "Actor",
                cell: (r) => <span className="text-xs">{r.actor}</span>,
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
