import debugFactory from "debug";

const debug = debugFactory("ladle:asset-404");

/**
 * Check if the HTTP Accept header represents an HTML document request (e.g. browser navigation).
 * @param {string | undefined} accept
 * @returns {boolean}
 */
export const isHtmlAccept = (accept) => {
  if (!accept) return false;
  // Browser navigation requests usually have `text/html,application/xhtml+xml,...`
  return accept.includes("text/html");
};

/**
 * Vite plugin that intercepts non-HTML requests that would otherwise be rewritten to /index.html
 * by Vite's SPA fallback middleware, and returns a clean 404 response instead.
 * @returns {import('vite').Plugin}
 */
export const asset404Plugin = () => {
  /** @type {WeakMap<import('http').IncomingMessage, string>} */
  const originalUrlMap = new WeakMap();

  return {
    name: "ladle:asset-404-fallback",
    configureServer(server) {
      // 1. Capture original request URL before any Vite middleware rewrites it
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          originalUrlMap.set(req, req.url);
        }
        next();
      });

      // 2. Return post-hook running after htmlFallbackMiddleware
      return () => {
        server.middlewares.use((req, res, next) => {
          if (!req.url || res.writableEnded) {
            return next();
          }

          const originalUrl = originalUrlMap.get(req) || req.url;
          // Check if Vite's SPA fallback rewrote this request to /index.html
          const isRewrittenToIndex =
            req.url === "/index.html" &&
            originalUrl !== "/index.html" &&
            originalUrl !== "/" &&
            originalUrl !== "";

          if (isRewrittenToIndex) {
            const acceptHeader = req.headers.accept;
            if (!isHtmlAccept(acceptHeader)) {
              debug(
                "Blocked SPA fallback for non-HTML request: %s (Accept: %s)",
                originalUrl,
                acceptHeader,
              );
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/plain");
              res.end(`404 Not Found: ${originalUrl}`);
              return;
            }
          }

          next();
        });
      };
    },
  };
};

export default asset404Plugin;
