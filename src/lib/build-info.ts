export type BuildInfo = {
  app: string;
  version: string;
  buildNumber: string;
  builtAt: string;
};

/** Build stamp baked into the JS bundle at compile time. */
export const CLIENT_BUILD: BuildInfo = {
  app: import.meta.env.VITE_APP_NAME || "cubesites-admin",
  version: import.meta.env.VITE_APP_VERSION || "0.0.0",
  buildNumber: import.meta.env.VITE_BUILD_NUMBER || "dev",
  builtAt: import.meta.env.VITE_BUILT_AT || "",
};

const RELOAD_FLAG = "cubesites-admin:build-reload";

export async function fetchRemoteBuild(): Promise<BuildInfo | null> {
  try {
    const res = await fetch(`/build.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<BuildInfo>;
    if (!data.buildNumber || typeof data.buildNumber !== "string") return null;
    return {
      app: data.app ?? CLIENT_BUILD.app,
      version: data.version ?? CLIENT_BUILD.version,
      buildNumber: data.buildNumber,
      builtAt: data.builtAt ?? "",
    };
  } catch {
    return null;
  }
}

/** Clears Cache Storage and hard-reloads when the deployed build.json differs from this bundle. */
export async function forceUpdateIfStale(): Promise<boolean> {
  if (import.meta.env.DEV) return false;

  const remote = await fetchRemoteBuild();
  if (!remote?.buildNumber) return false;
  if (remote.buildNumber === CLIENT_BUILD.buildNumber) {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* ignore */
    }
    return false;
  }

  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === remote.buildNumber) return false;
    sessionStorage.setItem(RELOAD_FLAG, remote.buildNumber);
  } catch {
    /* ignore */
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_bn", remote.buildNumber);
  window.location.replace(url.toString());
  return true;
}
