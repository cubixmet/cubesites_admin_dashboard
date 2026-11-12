import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeader, Panel, Stat, StatusBadge, Toolbar } from "@/components/admin/kit";
import { useData } from "@/lib/store";
import { fmtDateTime, inr, label } from "@/lib/format";
import { useContractorNames } from "@/lib/hooks";
import { exportCsv } from "@/lib/exporters";

export const Route = createFileRoute("/_admin/wallets")({
  head: () => ({
    meta: [
      { title: "Wallets — CuboSites Super Admin" },
      {
        name: "description",
        content: "Contractor prepaid wallets. Paid recharges count as income; free credits do not.",
      },
      { property: "og:title", content: "Wallets — CuboSites Super Admin" },
    ],
  }),
  component: WalletsPage,
});

function WalletsPage() {
  const s = useData((x) => x);
  const name = useContractorNames();
  const [search, setSearch] = useState("");
  const [funding, setFunding] = useState("all");

  const wallets = s.wallets || [];
  const txs = s.walletTransactions || [];

  const totals = useMemo(
    () => ({
      balance: wallets.reduce((a, w) => a + w.balance, 0),
      paid: txs.filter((t) => t.countsAsIncome).reduce((a, t) => a + t.amount, 0),
      free: txs
        .filter((t) => t.kind === "recharge" && t.funding === "free" && t.amount > 0)
        .reduce((a, t) => a + t.amount, 0),
    }),
    [wallets, txs],
  );

  const walletRows = wallets
    .filter((w) => !search || name(w.contractorId).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.balance - a.balance);

  const txRows = txs.filter((t) => {
    if (funding !== "all" && t.funding !== funding) return false;
    if (
      search &&
      !`${name(t.contractorId)} ${t.note} ${t.reference}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Prepaid balances per contractor. Mark each admin recharge as free or paid — only paid credits count as income. Razorpay will credit paid recharges later."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                "wallet-transactions.csv",
                txRows.map((t) => ({
                  contractor: name(t.contractorId),
                  amount: t.amount,
                  funding: t.funding,
                  income: t.countsAsIncome ? "yes" : "no",
                  kind: t.kind,
                  source: t.source,
                  note: t.note,
                  reference: t.reference,
                  at: t.createdAt,
                })),
              )
            }
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat
          label="Total wallet balances"
          value={inr(totals.balance)}
          hint="Available credit across contractors"
        />
        <Stat
          label="Paid recharge income"
          value={inr(totals.paid)}
          tone="success"
          hint="Counts toward platform income"
        />
        <Stat
          label="Free credits issued"
          value={inr(totals.free)}
          hint="Promos / comps — excluded from income"
        />
      </div>

      <Panel title="Balances" className="mb-4">
        <Toolbar search={search} onSearch={setSearch} placeholder="Contractor">
          <select
            aria-label="Funding filter"
            value={funding}
            onChange={(e) => setFunding(e.target.value)}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            <option value="all">All transaction types</option>
            <option value="paid">Paid only</option>
            <option value="free">Free only</option>
          </select>
        </Toolbar>
        <DataTable
          rows={walletRows}
          rowKey={(r) => r.contractorId}
          empty="No wallets yet."
          columns={[
            {
              key: "c",
              header: "Contractor",
              sort: (r) => name(r.contractorId),
              cell: (r) => (
                <Link
                  to="/contractors/$id"
                  params={{ id: r.contractorId }}
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {name(r.contractorId)}
                </Link>
              ),
            },
            {
              key: "b",
              header: "Balance",
              className: "num text-right",
              sort: (r) => r.balance,
              cell: (r) => inr(r.balance),
            },
            {
              key: "p",
              header: "Paid recharged",
              className: "num text-right",
              cell: (r) => inr(r.paidRecharged),
            },
            {
              key: "f",
              header: "Free recharged",
              className: "num text-right",
              cell: (r) => inr(r.freeRecharged),
            },
            { key: "u", header: "Updated", cell: (r) => fmtDateTime(r.updatedAt) },
          ]}
        />
      </Panel>

      <Panel title="Ledger">
        <DataTable
          rows={txRows}
          rowKey={(r) => r.id}
          empty="No wallet transactions yet. Recharge from a contractor's Wallet tab."
          columns={[
            {
              key: "c",
              header: "Contractor",
              cell: (r) => (
                <Link
                  to="/contractors/$id"
                  params={{ id: r.contractorId }}
                  className="hover:underline"
                >
                  {name(r.contractorId)}
                </Link>
              ),
            },
            {
              key: "a",
              header: "Amount",
              className: "num text-right",
              cell: (r) => (
                <span className={r.amount < 0 ? "text-destructive" : ""}>{inr(r.amount)}</span>
              ),
            },
            { key: "fund", header: "Funding", cell: (r) => <StatusBadge status={r.funding} /> },
            {
              key: "inc",
              header: "Income",
              cell: (r) =>
                r.countsAsIncome ? (
                  <StatusBadge status="paid" text="Counts" />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                ),
            },
            { key: "k", header: "Kind", cell: (r) => label(r.kind) },
            { key: "s", header: "Source", cell: (r) => label(r.source) },
            {
              key: "n",
              header: "Note",
              cell: (r) => <span className="text-xs">{r.note || r.reference || "—"}</span>,
            },
            { key: "d", header: "When", cell: (r) => fmtDateTime(r.createdAt) },
          ]}
        />
      </Panel>
    </>
  );
}
