import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/kit";
import { actions, useData } from "@/lib/store";
import { taxRuleAt } from "@/lib/billing";
import { fmtDate, label } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/mock/seed";
import type { LineType } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/tax")({
  head: () => ({
    meta: [
      { title: "Tax Configuration — CuboSites Super Admin" },
      { name: "description", content: "Effective-dated, configurable tax rules for invoices." },
      { property: "og:title", content: "Tax Configuration — CuboSites Super Admin" },
      {
        property: "og:description",
        content: "Effective-dated, configurable tax rules for invoices.",
      },
    ],
  }),
  component: Tax,
});

const LINES: LineType[] = ["site", "staff", "storage", "proration"];

function Tax() {
  const rules = useData((s) => s.taxRules);
  const invoices = useData((s) => s.invoices);
  const current = taxRuleAt(rules, DEMO_TODAY);
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Tax configuration"
        description="No tax rate is hardcoded. Issued invoices keep a frozen copy of the rule used at issue."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New tax rule
          </Button>
        }
      />
      <Panel title="Tax rules">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {[
                  "Name",
                  "Rate",
                  "Treatment",
                  "Applies to",
                  "Effective",
                  "Invoice label",
                  "Registration",
                  "Invoices issued",
                  "",
                ].map((h) => (
                  <th key={h} className="px-2 py-1 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rules]
                .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                .map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1.5 font-medium">{r.name}</td>
                    <td className="num px-2">{r.rate}%</td>
                    <td className="px-2">{r.inclusive ? "Inclusive" : "Exclusive"}</td>
                    <td className="px-2 text-xs">{r.appliesTo.map(label).join(", ")}</td>
                    <td className="px-2 text-xs">
                      {fmtDate(r.effectiveFrom)} → {r.effectiveTo ? fmtDate(r.effectiveTo) : "open"}
                    </td>
                    <td className="px-2 text-xs">{r.invoiceLabel}</td>
                    <td className="num px-2 text-xs">{r.registration || "—"}</td>
                    <td className="num px-2 text-right">
                      {
                        invoices.filter(
                          (i) =>
                            i.issuedAt >= r.effectiveFrom &&
                            (!r.effectiveTo || i.periodEnd <= r.effectiveTo),
                        ).length
                      }
                    </td>
                    <td className="px-2">
                      {current?.id === r.id ? (
                        <StatusBadge status="active" text="In effect" />
                      ) : r.effectiveFrom > DEMO_TODAY ? (
                        <StatusBadge status="pending" text="Scheduled" />
                      ) : (
                        <StatusBadge status="archived" text="Ended" />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <NewRule open={open} onOpenChange={setOpen} />
    </>
  );
}

function NewRule({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState({
    name: "GST",
    rate: "",
    inclusive: false,
    appliesTo: [...LINES],
    effectiveFrom: "",
    invoiceLabel: "",
    registration: "",
    reason: "",
  });
  const rate = Number(f.rate);
  const err = !f.name.trim()
    ? "Name is required."
    : f.rate === "" || !(rate >= 0 && rate <= 100)
      ? "Rate must be 0–100."
      : !f.effectiveFrom
        ? "Choose an effective date."
        : f.effectiveFrom <= DEMO_TODAY
          ? "Effective date must be in the future so past periods are unaffected."
          : !f.appliesTo.length
            ? "Select at least one line type."
            : !f.invoiceLabel.trim()
              ? "Invoice label is required."
              : f.reason.trim().length < 5
                ? "Reason is required (5+ chars)."
                : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tax rule</DialogTitle>
          <DialogDescription>
            The current open rule will end the day before this one takes effect.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tax name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rate (%)</Label>
            <Input
              type="number"
              value={f.rate}
              onChange={(e) => setF({ ...f, rate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Effective from</Label>
            <Input
              type="date"
              value={f.effectiveFrom}
              onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Switch
              id="incl"
              checked={f.inclusive}
              onCheckedChange={(v) => setF({ ...f, inclusive: v })}
            />
            <Label htmlFor="incl" className="text-xs">
              Tax-inclusive pricing
            </Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invoice label</Label>
            <Input
              value={f.invoiceLabel}
              onChange={(e) => setF({ ...f, invoiceLabel: e.target.value })}
              placeholder="e.g. CGST 9% + SGST 9%"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Registration (GSTIN)</Label>
            <Input
              value={f.registration}
              onChange={(e) => setF({ ...f, registration: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-3">
            {LINES.map((l) => (
              <label key={l} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={f.appliesTo.includes(l)}
                  onCheckedChange={(v) =>
                    setF({
                      ...f,
                      appliesTo: v ? [...f.appliesTo, l] : f.appliesTo.filter((x) => x !== l),
                    })
                  }
                />
                {label(l)}
              </label>
            ))}
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Reason</Label>
            <Textarea
              rows={2}
              value={f.reason}
              onChange={(e) => setF({ ...f, reason: e.target.value })}
            />
          </div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!!err}
            onClick={() => {
              const { reason, rate: _r, ...rest } = f;
              actions.addTaxRule({ ...rest, rate }, reason);
              toast.success("Tax rule scheduled and logged");
              onOpenChange(false);
            }}
          >
            Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
