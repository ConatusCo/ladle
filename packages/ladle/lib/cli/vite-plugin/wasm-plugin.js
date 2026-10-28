import fs from "fs";
import path from "path";
import debugFactory from "debug";

const debug = debugFactory("ladle:wasm");

/**
 * Scan package directories in node_modules to find packages containing .wasm files.
 * @param {string[]} nmDirs
 * @returns {{ wasmPackages: string[], wasmFiles: Map<string, string> }}
 */
export const scanWasmPackages = (nmDirs) => {
  /** @type {Set<string>} */
  const wasmPackages = new Set();
  /** @type {Map<string, string>} */
  const wasmFiles = new Map();

  /**
   * @param {string} dir
   * @param {number} depth
   */
  const scanDir = (dir, depth = 0) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith("."))
          continue;
        const full = path.join(dir, entry.name);
        let isDir = false;
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {}
        if (isDir) {
          scanDir(full, depth + 1);
        } else if (entry.name.endsWith(".wasm")) {
          if (!wasmFiles.has(entry.name)) {
            wasmFiles.set(entry.name, full);
          }
        }
      }
    } catch {}
  };

  for (const nmDir of nmDirs) {
    if (!fs.existsSync(nmDir)) continue;
    try {
      const entries = fs.readdirSync(nmDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        if (entry.name.startsWith("@")) {
          const scopeDir = path.join(nmDir, entry.name);
          try {
            const subEntries = fs.readdirSync(scopeDir, {
              withFileTypes: true,
            });
            for (const sub of subEntries) {
              if (sub.name.startsWith(".")) continue;
              const pkgName = `${entry.name}/${sub.name}`;
              const pkgDir = path.join(scopeDir, sub.name);
              const countBefore = wasmFiles.size;
              scanDir(pkgDir);
              if (wasmFiles.size > countBefore) {
                wasmPackages.add(pkgName);
              }
            }
          } catch {}
        } else {
          const pkgName = entry.name;
          const pkgDir = path.join(nmDir, entry.name);
          const countBefore = wasmFiles.size;
          scanDir(pkgDir);
          if (wasmFiles.size > countBefore) {
            wasmPackages.add(pkgName);
          }
        }
      }
    } catch {}
  }

  debug("Detected WASM packages: %o", Array.from(wasmPackages));
  return { wasmPackages: Array.from(wasmPackages), wasmFiles };
};

/**
 * Fallback search for a specific .wasm file across node_modules (including .pnpm).
 * @param {string[]} nmDirs
 * @param {string} targetFileName
 * @returns {string | null}
 */
export const findWasmFile = (nmDirs, targetFileName) => {
  for (const nmDir of nmDirs) {
    if (!fs.existsSync(nmDir)) continue;

    /**
     * @param {string} dir
     * @param {number} depth
     * @returns {string | null}
     */
    const search = (dir, depth = 0) => {
      if (depth > 6) return null;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name === ".bin" ||
            entry.name === ".vite" ||
            entry.name === ".cache"
          )
            continue;
          const full = path.join(dir, entry.name);
          if (entry.name === targetFileName) {
            try {
              if (fs.statSync(full).isFile()) return full;
            } catch {}
          }
          let isDir = false;
          try {
            isDir = fs.statSync(full).isDirectory();
          } catch {}
          if (isDir) {
            const found = search(full, depth + 1);
            if (found) return found;
          }
        }
      } catch {}
      return null;
    };

    const found = search(nmDir);
    if (found) return found;
  }
  return null;
};

/**
 * Vite plugin that serves fallback WASM files requested from .vite/deps/.
 * @param {string[]} nmDirs
 * @param {Map<string, string>} [initialWasmFiles]
 * @returns {import('vite').Plugin}
 */
export const wasmPlugin = (nmDirs, initialWasmFiles = new Map()) => {
  /** @type {Map<string, string | null>} */
  const wasmCache = new Map(initialWasmFiles);

  return {
    name: "ladle:wasm-resolver",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || (req.method !== "GET" && req.method !== "HEAD")) {
          return next();
        }
        const cleanUrl = decodeURIComponent(
          req.url.split("?")[0].split("#")[0],
        );
        if (cleanUrl.endsWith(".wasm") && cleanUrl.includes(".vite/deps/")) {
          const fileName = path.basename(cleanUrl);
          let filePath = wasmCache.get(fileName);
          if (filePath === undefined) {
            filePath = findWasmFile(nmDirs, fileName);
            wasmCache.set(fileName, filePath);
          }
          if (filePath && fs.existsSync(filePath)) {
            debug("Serving WASM fallback for %s from %s", req.url, filePath);
            const stat = fs.statSync(filePath);
            res.setHeader("Content-Type", "application/wasm");
            res.setHeader("Content-Length", stat.size);
            res.statusCode = 200;
            if (req.method === "HEAD") {
              res.end();
            } else {
              fs.createReadStream(filePath).pipe(res);
            }
            return;
          }
        }
        next();
      });
    },
  };
};

export default wasmPlugin;
