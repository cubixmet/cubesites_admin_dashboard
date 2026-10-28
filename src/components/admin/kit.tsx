import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { label as fmtLabel } from "@/lib/format";

const TONES: Record<string, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/10 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: "success", enabled: "success", success: "success", approved: "success", paid: "success", connected: "success", passed: "success", resolved: "success", sent: "success",
  suspended: "danger", failed: "danger", rejected: "danger", overdue: "danger", token_expired: "danger", urgent: "danger", expired: "danger",
  pending: "warning", pending_review: "warning", grace: "warning", in_progress: "info", waiting: "warning", high: "warning", running: "info",
  inactive: "neutral", archived: "neutral", disabled: "neutral", disconnected: "neutral", not_tested: "neutral", free: "neutral", low: "neutral", medium: "info", open: "info",
  paid_plan: "success",
};
export function StatusBadge({ status, text }: { status: string; text?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium", TONES[STATUS_TONE[status] ?? "neutral"])}>
      {text ?? fmtLabel(status)}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-xs", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning" | "success" }) {
  return (
    <div className="rounded-lg border bg-card px-3.5 py-3 shadow-xs">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-lg font-semibold", tone === "danger" && "text-destructive", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Toolbar({ search, onSearch, placeholder, children }: { search: string; onSearch: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder ?? "Search…"} className="h-9 pl-8" />
      </div>
      {children}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-36" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{fmtLabel(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
}
export function DataTable<T>({ rows, columns, rowKey, pageSize = 12, onRowClick, empty = "No records match your filters." }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; pageSize?: number; onRowClick?: (r: T) => void; empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a), y = col.sort!(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const view = sorted.slice(p * pageSize, p * pageSize + pageSize);
  return (
    <div className="rounded-lg border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-3 py-2 text-left font-medium", c.className)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("border-t", onRowClick && "cursor-pointer hover:bg-accent/50")}>
                {columns.map((c) => <td key={c.key} className={cn("whitespace-nowrap px-3 py-2", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground"><Inbox className="h-6 w-6" />{empty}</div>
        )}
      </div>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{p * pageSize + 1}–{Math.min(sorted.length, (p + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" className="h-7 w-7" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Confirmation dialog that requires a written reason (logged to the audit trail). */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, destructive, requireReason = true, onConfirm, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; destructive?: boolean; requireReason?: boolean;
  onConfirm: (reason: string) => void; children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const tooShort = requireReason && reason.trim().length < 5;
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason {requireReason ? "(required, recorded in audit log)" : "(optional)"}</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          {requireReason && reason.length > 0 && tooShort && <p className="text-xs text-destructive">Please give at least 5 characters.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={tooShort} onClick={() => { onConfirm(reason.trim()); setReason(""); onOpenChange(false); }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useFilter<T>(rows: T[], text: (r: T) => string, search: string) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => text(r).toLowerCase().includes(q)) : rows;
  }, [rows, search, text]);
}
