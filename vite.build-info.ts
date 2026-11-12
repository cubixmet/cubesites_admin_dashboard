import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Plugin } from "vite";

type BuildInfo = {
  app: string;
  version: string;
  buildNumber: string;
  builtAt: string;
};

function packageVersion(rootDir: string) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function resolveBuildNumber(command: "build" | "serve") {
  const fromEnv =
    process.env.VITE_BUILD_NUMBER?.trim() ||
    process.env.BUILD_NUMBER?.trim() ||
    process.env.GITHUB_RUN_NUMBER?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim()?.slice(0, 12) ||
    process.env.COMMIT_REF?.trim()?.slice(0, 12);
  if (fromEnv) return fromEnv;
  if (command === "serve") return "dev";
  // Production builds without an explicit stamp still get a unique id so
  // deployed /build.json never matches an older cached bundle.
  return `${Date.now()}`;
}

/** Emits matching VITE_BUILD_NUMBER + /build.json so clients can force-refresh stale caches. */
export function buildInfoPlugin(app: string): Plugin {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  let info: BuildInfo = {
    app,
    version: packageVersion(rootDir),
    buildNumber: "dev",
    builtAt: new Date().toISOString(),
  };

  const payload = () => JSON.stringify(info, null, 2);

  return {
    name: "cubesites-build-info",
    config(_cfg, { command }) {
      info = {
        app,
        version: packageVersion(rootDir),
        buildNumber: resolveBuildNumber(command),
        builtAt: new Date().toISOString(),
      };
      return {
        define: {
          "import.meta.env.VITE_APP_NAME": JSON.stringify(info.app),
          "import.meta.env.VITE_APP_VERSION": JSON.stringify(info.version),
          "import.meta.env.VITE_BUILD_NUMBER": JSON.stringify(info.buildNumber),
          "import.meta.env.VITE_BUILT_AT": JSON.stringify(info.builtAt),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/build.json") return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.end(payload());
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build.json",
        source: payload(),
      });
    },
  };
}
