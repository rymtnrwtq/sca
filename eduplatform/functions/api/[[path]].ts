/**
 * Cloudflare Pages Function — proxies /api/* to VPS backend.
 *
 * Set env variable BACKEND_URL in CF Pages dashboard:
 *   BACKEND_URL=https://your-vps-domain.com
 */

interface Env {
  BACKEND_URL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const backendUrl = context.env.BACKEND_URL;

  if (!backendUrl) {
    return new Response("BACKEND_URL not configured", { status: 502 });
  }

  const url = new URL(context.request.url);
  const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  // Pass real client IP
  headers.set("X-Forwarded-For", context.request.headers.get("CF-Connecting-IP") || "");
  headers.set("X-Forwarded-Proto", "https");

  const hasBody =
    context.request.method !== "GET" && context.request.method !== "HEAD";

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: hasBody ? context.request.body : undefined,
    // @ts-expect-error CF-specific
    duplex: hasBody ? "half" : undefined,
  });

  // Forward response as-is (status, headers, body)
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
