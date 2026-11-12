import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  FilterSelect,
  KV,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Toolbar,
} from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { useContractorNames } from "@/lib/hooks";
import { fmtDate, fmtDateTime, inr, label } from "@/lib/format";
import { exportCsv, exportInvoicePdf, exportTablePdf } from "@/lib/exporters";
import type { Payment } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Invoices — CuboSites Super Admin" },
      { name: "description", content: "Review online and manual payments and export invoices." },
      { property: "og:title", content: "Payments & Invoices — CuboSites Super Admin" },
      {
        property: "og:description",
        content: "Review online and manual payments and export invoices.",
      },
    ],
  }),
  component: Payments,
});

function Payments() {
  const s = useData((x) => x);
  const name = useContractorNames();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<Payment | null>(null);
  const [reject, setReject] = useState(false);
  const [approve, setApprove] = useState(false);

  const inv = (p: Payment) => s.invoices.find((i) => i.id === p.invoiceId)!;
  const rows = s.payments
    .filter((p) => {
      const d = p.paidAt.slice(0, 10);
      return (
        (!search ||
          `${name(p.contractorId)} ${p.reference} ${inv(p).number}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (status === "all" || p.status === status) &&
        (method === "all" || p.method === method) &&
        (!from || d >= from) &&
        (!to || d <= to)
      );
    })
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const current = sel ? s.payments.find((p) => p.id === sel.id)! : null;
  const exportRows = rows.map((p) => ({
    contractor: name(p.contractorId),
    invoice: inv(p).number,
    method: p.method,
    amount: p.amount,
    tax: p.tax,
    status: p.status,
    reference: p.reference,
    date: p.paidAt,
  }));

  return (
    <>
      <PageHeader
        title="Payments & invoices"
        description={`${rows.length} payments · ${s.payments.filter((p) => p.status === "pending_review").length} awaiting review`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCsv("payments.csv", exportRows)
                  ? toast.success("Exported payments.csv")
                  : toast.error("Nothing to export")
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!rows.length}
              onClick={() =>
                exportTablePdf(
                  "Payments report",
                  Object.keys(exportRows[0]),
                  exportRows.map((r) => Object.values(r) as (string | number)[]),
                ).then(() => toast.success("PDF report downloaded"))
              }
            >
              <FileDown className="h-4 w-4" />
              PDF report
            </Button>
          </>
        }
      />
      <Toolbar search={search} onSearch={setSearch} placeholder="Contractor, invoice, reference">
        <FilterSelect
          label="Statuses"
          value={status}
          onChange={setStatus}
          options={["success", "pending_review", "approved", "rejected", "failed"]}
        />
        <FilterSelect
          label="Methods"
          value={method}
          onChange={setMethod}
          options={["upi_gateway", "card_gateway", "bank_transfer", "cash", "cheque"]}
        />
        <Input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 w-auto"
        />
        <Input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 w-auto"
        />
      </Toolbar>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={setSel}
        columns={[
          {
            key: "c",
            header: "Contractor",
            sort: (r) => name(r.contractorId),
            cell: (r) => name(r.contractorId),
          },
          {
            key: "i",
            header: "Invoice",
            cell: (r) => <span className="num text-xs">{inv(r).number}</span>,
          },
          {
            key: "m",
            header: "Method",
            cell: (r) => (
              <span>
                {label(r.method)}{" "}
                <span className="text-xs text-muted-foreground">({r.channel})</span>
              </span>
            ),
          },
          {
            key: "a",
            header: "Amount",
            className: "num text-right",
            sort: (r) => r.amount,
            cell: (r) => inr(r.amount),
          },
          { key: "t", header: "Tax", className: "num text-right", cell: (r) => inr(r.tax) },
          {
            key: "s",
            header: "Status",
            sort: (r) => r.status,
            cell: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "r",
            header: "Reference",
            cell: (r) => <span className="num text-xs">{r.reference}</span>,
          },
          { key: "d", header: "Date", sort: (r) => r.paidAt, cell: (r) => fmtDateTime(r.paidAt) },
        ]}
      />

      <Dialog open={!!current} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          {current &&
            (() => {
              const i = inv(current);
              const c = s.contractors.find((x) => x.id === current.contractorId)!;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Payment {current.reference}</DialogTitle>
                    <DialogDescription>
                      {c.name} · {label(current.channel)} payment
                    </DialogDescription>
                  </DialogHeader>
                  <KV
                    items={[
                      ["Status", <StatusBadge key="s" status={current.status} />],
                      ["Method", label(current.method)],
                      ["Amount", inr(current.amount)],
                      ["Tax", inr(current.tax)],
                      ["Paid at", fmtDateTime(current.paidAt)],
                      ...(current.channel === "online"
                        ? [["Gateway status", current.gatewayStatus ?? "—"] as [string, string]]
                        : []),
                      ["Reviewed by", current.reviewedBy ?? "—"],
                      ["Reviewed at", fmtDateTime(current.reviewedAt)],
                      ["Review reason", current.reviewReason ?? "—"],
                    ]}
                  />
                  {current.proofName && (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-xs">
                      <Paperclip className="h-4 w-4" />
                      Attached proof: <b>{current.proofName}</b>{" "}
                      <span className="text-muted-foreground">
                        (mock attachment — no file stored)
                      </span>
                    </div>
                  )}
                  {current.channel === "online" && (
                    <p className="text-xs text-muted-foreground">
                      Mock gateway status only. The real backend must verify gateway webhooks and
                      prevent duplicate processing.
                    </p>
                  )}
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <b>Invoice {i.number}</b>
                      <StatusBadge status={i.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Period {fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)} · Tax at issue:{" "}
                      {i.taxSnapshot?.label ?? "none"}
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {i.lines.map((l, k) => (
                        <li key={k} className="flex justify-between">
                          <span>{l.description}</span>
                          <span className="num">{inr(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between border-t pt-1 text-sm font-semibold">
                      <span>Total</span>
                      <span className="num">{inr(i.total)}</span>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        exportInvoicePdf(i, c).then(() => toast.success("Invoice PDF downloaded"))
                      }
                    >
                      <FileDown className="h-4 w-4" />
                      Invoice PDF
                    </Button>
                    {current.status === "pending_review" && (
                      <>
                        <Button variant="destructive" onClick={() => setReject(true)}>
                          Reject
                        </Button>
                        <Button onClick={() => setApprove(true)}>Approve</Button>
                      </>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
      <ReasonDialog
        open={reject}
        onOpenChange={setReject}
        destructive
        title="Reject manual payment?"
        description="The invoice stays unpaid. The contractor would be notified by the real backend."
        confirmLabel="Reject payment"
        onConfirm={(r) => {
          actions.reviewPayment(current!.id, "rejected", r);
          toast.success("Payment rejected (demo) and logged");
        }}
      />
      <ReasonDialog
        open={approve}
        onOpenChange={setApprove}
        requireReason={false}
        title="Approve manual payment?"
        description="Marks the linked invoice as paid in this demo. No real funds are verified."
        confirmLabel="Approve payment"
        onConfirm={(r) => {
          actions.reviewPayment(current!.id, "approved", r);
          toast.success("Payment approved (demo) and logged");
        }}
      />
    </>
  );
}
