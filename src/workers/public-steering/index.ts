/**
 * Public steering Worker.
 *
 * Sits in front of the Cloudflare CDN pool. Three steering modes:
 * - passthrough: serve directly from R2, inject `served-by: cf-edge`
 * - path_routing: `/video/*` always to CF (illustrates surgical control)
 * - percent_rollout: redirect some traffic to CloudFront based on ROLLOUT_PCT
 */

import type { Env } from "../../types";

const MODE_PASSTHROUGH = "passthrough";
const MODE_PATH_ROUTING = "path_routing";
const MODE_PERCENT_ROLLOUT = "percent_rollout";

/**
 * Normalize incoming path to R2 object key.
 * Strips leading `/` and ensures `public/` prefix.
 *
 * @param pathname - raw request pathname
 * @returns R2 object key
 */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/^\//, "");
  if (trimmed.startsWith("public/")) {
    return trimmed;
  }
  return `public/${trimmed}`;
}

/**
 * Serve an object from the R2 bucket.
 *
 * @param env - Worker env with R2 binding
 * @param key - R2 object key
 * @param extraHeaders - additional response headers
 * @returns Response or null if not found
 */
async function serveFromR2(
  env: Env,
  key: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const object = await env.BUCKET.get(key);
  if (!object) {
    return null;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("served-by", "cf-edge");
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }

  return new Response(object.body, { headers });
}

/**
 * Main fetch handler.
 *
 * @param request - incoming request
 * @param env - Worker environment
 * @returns Response
 */
export async function handlePublicSteering(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const mode = env.STEERING_MODE || MODE_PASSTHROUGH;

  // Passthrough mode: serve everything from R2
  if (mode === MODE_PASSTHROUGH) {
    const key = normalizePath(url.pathname);
    const resp = await serveFromR2(env, key);
    if (resp) return resp;
    return new Response("Not found", { status: 404 });
  }

  // Path routing mode: video always to CF, everything else passthrough
  if (mode === MODE_PATH_ROUTING) {
    if (url.pathname.startsWith("/video/")) {
      const key = normalizePath(url.pathname);
      const resp = await serveFromR2(env, key, {
        "routing-decision": "video-locked-to-cf",
      });
      if (resp) return resp;
      return new Response("Not found", { status: 404 });
    }
    const key = normalizePath(url.pathname);
    const resp = await serveFromR2(env, key, {
      "routing-decision": "default-passthrough",
    });
    if (resp) return resp;
    return new Response("Not found", { status: 404 });
  }

  // Percent rollout mode: randomly redirect some traffic to CloudFront
  if (mode === MODE_PERCENT_ROLLOUT) {
    const pct = Number.parseInt(env.ROLLOUT_PCT || "0", 10);
    const roll = Math.floor(Math.random() * 100);
    if (roll < pct) {
      // Serve from R2 via this Worker
      const key = normalizePath(url.pathname);
      const resp = await serveFromR2(env, key, {
        "routing-decision": "rollout-cf",
      });
      if (resp) return resp;
      return new Response("Not found", { status: 404 });
    }
    // Redirect to CloudFront
    const cfUrl = `https://cloudfront-pool.demo.jsherron.com${url.pathname}`;
    return Response.redirect(cfUrl, 302);
  }

  return new Response("Unknown steering mode", { status: 500 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handlePublicSteering(request, env);
  },
} satisfies ExportedHandler<Env>;
