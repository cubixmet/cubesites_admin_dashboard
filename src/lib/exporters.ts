// Client-side exports built from the currently filtered mock records.
import type { Contractor, Invoice } from "./types";
import { fmtDate } from "./format";

export function exportCsv(
  filename: string,
  rows: Record<string, string | number | undefined | null>[],
) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
    "\n",
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// PDF core fonts lack the ₹ glyph, so amounts use "Rs." in exported PDFs.
const rs = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function exportInvoicePdf(inv: Invoice, c: Contractor) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("CuboSites — Tax Invoice", 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Generated from CuboSites Super Admin", 14, 24);
  doc.setTextColor(30);
  doc.setFontSize(10);
  doc.text(
    [
      `Invoice: ${inv.number}`,
      `Issued: ${fmtDate(inv.issuedAt)}`,
      `Period: ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`,
      `Status: ${inv.status}`,
    ],
    14,
    34,
  );
  doc.text([c.name, c.ownerName, c.city || "", c.gstin ? `GSTIN: ${c.gstin}` : ""], 120, 34);
  autoTable(doc, {
    startY: 58,
    head: [["Description", "Qty", "Unit", "Amount"]],
    body: inv.lines.map((l) => [l.description, String(l.qty), rs(l.unitPrice), rs(l.amount)]),
    foot: [
      ["", "", "Subtotal", rs(inv.subtotal)],
      ["", "", inv.taxSnapshot?.label ?? "Tax", rs(inv.tax)],
      ["", "", "Total", rs(inv.total)],
    ],
    headStyles: { fillColor: [46, 125, 80] },
    footStyles: { fillColor: [240, 245, 241], textColor: 30 },
  });
  doc.save(`${inv.number.replace(/\//g, "-")}.pdf`);
}

export async function exportTablePdf(title: string, head: string[], body: (string | number)[][]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`CuboSites Admin — ${title}`, 14, 16);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [head],
    body: body.map((r) => r.map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 125, 80] },
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
