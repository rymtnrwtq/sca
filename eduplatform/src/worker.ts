/**
 * Cloudflare Worker entry point.
 *
 * - /api/* → proxies to VPS backend (BACKEND_URL env var)
 * - everything else → served from dist/ static assets (SPA mode)
 */

interface Env {
  BACKEND_URL: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (!env.BACKEND_URL) {
        return new Response(
          JSON.stringify({ error: "BACKEND_URL not configured" }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      const targetUrl = `${env.BACKEND_URL}${url.pathname}${url.search}`;

      const headers = new Headers(request.headers);
      // Set Host to the backend hostname so nginx can route correctly
      headers.set("Host", new URL(env.BACKEND_URL).host);
      headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") ?? "");

      try {
        return await fetch(targetUrl, {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Backend unreachable", detail: String(err) }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Static assets + SPA fallback handled by [assets] binding
    return env.ASSETS.fetch(request);
  },
};
