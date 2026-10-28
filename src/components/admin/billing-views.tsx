import type { currentBill } from "@/lib/selectors";
import { inr } from "@/lib/format";

export function BillBreakdown({ bill }: { bill: ReturnType<typeof currentBill> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground"><tr><th className="py-1 text-left font-medium">Line</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Unit</th><th className="text-right font-medium">Amount</th></tr></thead>
        <tbody>
          {bill.lines.map((l, i) => (
            <tr key={i} className="border-t"><td className="py-1.5">{l.description}</td><td className="num text-right">{l.qty}</td><td className="num text-right">{inr(l.unitPrice)}</td><td className="num text-right">{inr(l.amount)}</td></tr>
          ))}
        </tbody>
        <tfoot className="border-t-2">
          <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Subtotal</td><td className="num text-right">{inr(bill.subtotal)}</td></tr>
          <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">{bill.rule ? `${bill.rule.invoiceLabel} (${bill.rule.inclusive ? "inclusive" : "exclusive"})` : "No tax rule"}</td><td className="num text-right">{inr(bill.tax)}</td></tr>
          <tr className="font-semibold"><td colSpan={3} className="py-1 text-right">Total</td><td className="num text-right">{inr(bill.total)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
