import { test, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  scanWasmPackages,
  findWasmFile,
  wasmPlugin,
} from "../lib/cli/vite-plugin/wasm-plugin.js";
import getBaseViteConfig from "../lib/cli/vite-base.js";
import defaultLadleConfig from "../lib/shared/default-config.js";

test("scanWasmPackages discovers packages containing .wasm files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ladle-wasm-test-"));
  try {
    const nmDir = path.join(tmpDir, "node_modules");
    // Standard package with wasm
    const pkgA = path.join(nmDir, "pkg-a", "dist");
    fs.mkdirSync(pkgA, { recursive: true });
    fs.writeFileSync(path.join(pkgA, "module.wasm"), "fake-wasm-bytes");

    // Scoped package with wasm
    const pkgB = path.join(nmDir, "@scope", "pkg-b", "wasm");
    fs.mkdirSync(pkgB, { recursive: true });
    fs.writeFileSync(path.join(pkgB, "engine.wasm"), "fake-wasm-bytes-2");

    // Package without wasm
    const pkgC = path.join(nmDir, "pkg-c", "lib");
    fs.mkdirSync(pkgC, { recursive: true });
    fs.writeFileSync(path.join(pkgC, "index.js"), "console.log('hi')");

    const { wasmPackages, wasmFiles } = scanWasmPackages([nmDir]);
    expect(wasmPackages.sort()).toEqual(["@scope/pkg-b", "pkg-a"].sort());
    expect(wasmFiles.get("module.wasm")).toBe(path.join(pkgA, "module.wasm"));
    expect(wasmFiles.get("engine.wasm")).toBe(path.join(pkgB, "engine.wasm"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("findWasmFile searches across node_modules including nested paths", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ladle-wasm-find-"));
  try {
    const nmDir = path.join(tmpDir, "node_modules");
    const nested = path.join(
      nmDir,
      ".pnpm",
      "deep",
      "node_modules",
      "target-pkg",
    );
    fs.mkdirSync(nested, { recursive: true });
    const targetFile = path.join(nested, "sample.wasm");
    fs.writeFileSync(targetFile, "wasm-content");

    const found = findWasmFile([nmDir], "sample.wasm");
    expect(found).toBe(targetFile);

    const notFound = findWasmFile([nmDir], "non-existent.wasm");
    expect(notFound).toBeNull();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("wasmPlugin middleware serves WASM files requested from .vite/deps", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ladle-wasm-plugin-"));
  try {
    const nmDir = path.join(tmpDir, "node_modules");
    const pkgDir = path.join(nmDir, "demo-pkg");
    fs.mkdirSync(pkgDir, { recursive: true });
    const wasmPath = path.join(pkgDir, "test.wasm");
    const wasmBytes = Buffer.from([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ]);
    fs.writeFileSync(wasmPath, wasmBytes);

    const plugin = wasmPlugin([nmDir]);
    let middleware: any;
    const fakeServer = {
      middlewares: {
        use(fn: any) {
          middleware = fn;
        },
      },
    };

    // @ts-ignore
    plugin.configureServer(fakeServer);
    expect(middleware).toBeDefined();

    // 1. Unrelated request passes through
    let nextCalled = false;
    middleware({ url: "/src/main.ts", method: "GET" }, {}, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    // 2. WASM request from .vite/deps is handled with application/wasm header
    const headers: Record<string, any> = {};
    let statusCode = 0;
    let ended = false;
    const chunks: Buffer[] = [];

    const fakeRes: any = {
      setHeader(name: string, value: any) {
        headers[name] = value;
      },
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      write(chunk: any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      },
      end() {
        ended = true;
      },
      emit(event: string) {
        return true;
      },
      on() {
        return this;
      },
      once() {
        return this;
      },
    };

    let nextCalledForWasm = false;
    await new Promise<void>((resolve) => {
      fakeRes.end = () => {
        ended = true;
        resolve();
      };
      middleware(
        { url: "/node_modules/.vite/deps/test.wasm?v=123", method: "GET" },
        fakeRes,
        () => {
          nextCalledForWasm = true;
          resolve();
        },
      );
    });

    expect(nextCalledForWasm).toBe(false);
    expect(headers["Content-Type"]).toBe("application/wasm");
    expect(headers["Content-Length"]).toBe(wasmBytes.length);
    expect(statusCode).toBe(200);
    expect(ended).toBe(true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("getBaseViteConfig sets worker format to 'es' and configures wasm plugin", async () => {
  const config = await getBaseViteConfig(defaultLadleConfig, process.cwd(), {});

  expect(config.worker?.format).toBe("es");
  expect(Array.isArray(config.optimizeDeps?.exclude)).toBe(true);
  const hasWasmPlugin = config.plugins?.some(
    // @ts-ignore
    (p: any) => p && p.name === "ladle:wasm-resolver",
  );
  expect(hasWasmPlugin).toBe(true);
});
