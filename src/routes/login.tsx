import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_CREDENTIALS, demoLogin, getSession } from "@/lib/auth";
import { actions } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CubeSites Super Admin" },
      { name: "description", content: "Administrator sign-in for the CubeSites platform." },
      { property: "og:title", content: "Sign in — CubeSites Super Admin" },
      { property: "og:description", content: "Administrator sign-in for the CubeSites platform." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (getSession()) nav({ to: "/" }); }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address.";
    if (password.length < 6) errs.password = "Password must be at least 6 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await demoLogin(email, password);
      actions.logAuth("auth.login");
      nav({ to: "/" });
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold leading-tight">CubeSites</div>
            <div className="text-xs text-muted-foreground">Super Admin portal</div>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          {errors.form && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errors.form}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</Button>
        </form>
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
          <div className="font-semibold text-warning">Demo mode</div>
          Sign in with <span className="num">{DEMO_CREDENTIALS.email}</span> / <span className="num">{DEMO_CREDENTIALS.password}</span>. This login is for demonstration only and is not real security.
        </div>
      </div>
    </div>
  );
}
