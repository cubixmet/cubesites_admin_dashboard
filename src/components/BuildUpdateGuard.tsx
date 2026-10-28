import { useEffect } from "react";
import { forceUpdateIfStale } from "@/lib/build-info";

const CHECK_MS = 60_000;

/** Polls /build.json and force-reloads when the deployed build number changes. */
export function BuildUpdateGuard() {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    let cancelled = false;
    const run = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void forceUpdateIfStale();
    };

    run();
    const id = window.setInterval(run, CHECK_MS);
    const onFocus = () => run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
