import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, Bell, Building2, CreditCard, Database, FileText, HardDrive, Headphones, LayoutDashboard, LogOut, Menu,
  Percent, RotateCcw, Search, Settings, ShieldCheck, Users, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { demoLogout, getSession, type Session } from "@/lib/auth";
import { actions, useData } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin")({ component: AdminLayout });

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/contractors", label: "Contractors", icon: Building2 },
  { to: "/sites", label: "Sites", icon: MapPin },
  { to: "/staff", label: "Staff", icon: Users },
  { to: "/subscriptions", label: "Subscriptions", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/storage", label: "Storage Billing", icon: Database },
  { to: "/tax", label: "Tax Configuration", icon: Percent },
  { to: "/backups", label: "Google Drive & Backups", icon: HardDrive },
  { to: "/activity", label: "Activity Logs", icon: Activity },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: Headphones },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useData((s) => s.notifications.filter((n) => !n.read).length);
  return (
    <nav className="space-y-0.5 p-2">
      {NAV.map((n) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
        return (
          <Link key={n.to} to={n.to} onClick={onNavigate}
            className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent", active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground")}>
            <n.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
            <span className="flex-1 truncate">{n.label}</span>
            {n.to === "/notifications" && unread > 0 && <span className="num rounded bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <div className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" /></div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">CubeSites</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Super Admin</div>
      </div>
    </div>
  );
}

function AdminLayout() {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useData((s) => s.notifications.filter((n) => !n.read).length);

  useEffect(() => {
    const s = getSession();
    if (!s) nav({ to: "/login" });
    setSession(s);
  }, [nav]);

  if (!session) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking admin session…</div>;
  }
  const title = [...NAV].reverse().find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)))?.label ?? "Admin";

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto"><NavList /></div>
        <div className="border-t p-3 text-[11px] text-muted-foreground">Demo build · mock data only</div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
          <div className="truncate text-sm font-semibold">{title}</div>
          <span className="hidden rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning sm:inline">Demo mode</span>
          <form className="ml-auto hidden md:block" onSubmit={(e) => { e.preventDefault(); nav({ to: "/contractors", search: { q } }); }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contractors…" className="h-9 w-64 pl-8" />
            </div>
          </form>
          <Button variant="ghost" size="icon" className="relative ml-auto md:ml-0" asChild>
            <Link to="/notifications" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">PA</span>
                <span className="hidden text-sm sm:inline">{session.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="text-sm">{session.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{session.email}</div>
                <div className="mt-1 text-[11px] font-normal text-muted-foreground">Session since {fmtDateTime(session.loginAt)}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => nav({ to: "/settings" })}><Settings className="h-4 w-4" />Profile & settings</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" />Reset demo data</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { actions.logAuth("auth.logout"); demoLogout(); nav({ to: "/login" }); }}><LogOut className="h-4 w-4" />Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-5"><Outlet /></main>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>All demo changes saved in this browser will be replaced with the original sample data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { actions.resetDemo(); toast.success("Demo data reset"); }}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
