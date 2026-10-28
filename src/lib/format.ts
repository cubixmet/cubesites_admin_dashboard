import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { DEMO_TODAY } from "./mock/seed";

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
export const inr = (n: number) => inrFmt.format(n);
export const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export const fmtDate = (iso?: string) => (iso ? format(parseISO(iso), "dd MMM yyyy") : "—");
export const fmtDateTime = (iso?: string) => (iso ? format(parseISO(iso), "dd MMM yyyy, HH:mm") : "—");
export const mb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} GB` : `${n.toFixed(1)} MB`);
export const daysFromToday = (iso: string) => differenceInCalendarDays(parseISO(iso.slice(0, 10)), parseISO(DEMO_TODAY));
export const addDaysIso = (iso: string, d: number) => {
  const t = new Date(iso.slice(0, 10) + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10);
};
export const label = (s: string) => s.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
