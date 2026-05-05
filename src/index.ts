/**
 * Worker entry point.
 * Routing only — no business logic here.
 * Add handlers in src/handlers/ and wire them up below.
 */

import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // TODO: Add routes here
    // Example:
    // if (url.pathname === "/health" && request.method === "GET") {
    //   return new Response("ok");
    // }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
