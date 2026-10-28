import { test, expect } from "vitest";
import {
  isHtmlAccept,
  asset404Plugin,
} from "../lib/cli/vite-plugin/asset-404-plugin.js";
import getBaseViteConfig from "../lib/cli/vite-base.js";
import defaultLadleConfig from "../lib/shared/default-config.js";

test("isHtmlAccept distinguishes between HTML navigation and asset requests", () => {
  expect(isHtmlAccept(undefined)).toBe(false);
  expect(isHtmlAccept("")).toBe(false);
  expect(isHtmlAccept("*/*")).toBe(false);
  expect(isHtmlAccept("application/json")).toBe(false);
  expect(isHtmlAccept("model/gltf-binary, application/octet-stream, */*")).toBe(
    false,
  );
  expect(
    isHtmlAccept(
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ),
  ).toBe(true);
  expect(isHtmlAccept("text/html")).toBe(true);
});

test("asset404Plugin blocks SPA fallback rewrite for non-HTML requests", async () => {
  const plugin = asset404Plugin();
  let preMiddleware: any;
  let postMiddleware: any;

  const fakeServer = {
    middlewares: {
      use(fn: any) {
        preMiddleware = fn;
      },
    },
  };

  // @ts-ignore
  const postHook = plugin.configureServer(fakeServer);
  expect(typeof postHook).toBe("function");

  // Vite calls postHook() without arguments and the post-hook registers on server.middlewares
  fakeServer.middlewares.use = (fn: any) => {
    postMiddleware = fn;
  };
  postHook();
  expect(postMiddleware).toBeDefined();

  // Test Case 1: Browser navigation with text/html rewritten to /index.html passes through
  const reqHtml = {
    url: "/my-story",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  };
  const resHtml: any = { writableEnded: false };
  let nextCalledHtml = false;
  preMiddleware(reqHtml, resHtml, () => {});
  // Simulate Vite's htmlFallbackMiddleware rewrite:
  reqHtml.url = "/index.html";
  postMiddleware(reqHtml, resHtml, () => {
    nextCalledHtml = true;
  });
  expect(nextCalledHtml).toBe(true);

  // Test Case 2: Asset request (e.g. .glb) rewritten to /index.html gets 404
  const reqAsset = {
    url: "/models/mesh.glb",
    headers: {
      accept: "*/*",
    },
  };
  let statusCode = 0;
  let contentType = "";
  let responseBody = "";
  const resAsset: any = {
    writableEnded: false,
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    setHeader(name: string, val: string) {
      if (name.toLowerCase() === "content-type") {
        contentType = val;
      }
    },
    end(body: string) {
      responseBody = body;
      this.writableEnded = true;
    },
  };

  let nextCalledAsset = false;
  preMiddleware(reqAsset, resAsset, () => {});
  // Simulate Vite's htmlFallbackMiddleware rewrite:
  reqAsset.url = "/index.html";
  postMiddleware(reqAsset, resAsset, () => {
    nextCalledAsset = true;
  });

  expect(nextCalledAsset).toBe(false);
  expect(statusCode).toBe(404);
  expect(contentType).toBe("text/plain");
  expect(responseBody).toBe("404 Not Found: /models/mesh.glb");

  // Test Case 3: Legitimate direct request for /index.html passes through
  const reqDirectIndex = {
    url: "/index.html",
    headers: {
      accept: "*/*",
    },
  };
  const resDirectIndex: any = { writableEnded: false };
  let nextCalledDirect = false;
  preMiddleware(reqDirectIndex, resDirectIndex, () => {});
  postMiddleware(reqDirectIndex, resDirectIndex, () => {
    nextCalledDirect = true;
  });
  expect(nextCalledDirect).toBe(true);
});

test("getBaseViteConfig registers asset-404 plugin", async () => {
  const config = await getBaseViteConfig(defaultLadleConfig, process.cwd(), {});
  const hasPlugin = config.plugins?.some(
    // @ts-ignore
    (p: any) => p && p.name === "ladle:asset-404-fallback",
  );
  expect(hasPlugin).toBe(true);
});
