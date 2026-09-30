import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // Server-function errors must reach the client as decodable JSON; an HTML
    // error page or a rethrown plain Error (or h3/framework error with statusCode)
    // makes the client decoder fail with "Invariant failed" instead of showing
    // the real message. Check /_serverFn/ FIRST so those errors are always
    // serialised to JSON regardless of whether they carry a statusCode.
    if (new URL(request.url).pathname.includes("/_serverFn/")) {
      if (error instanceof Response) throw error;
      if (
        error != null &&
        typeof error === "object" &&
        ("isRedirect" in error || "isNotFound" in error)
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    // Outside server-function paths: re-throw framework-level HTTP errors
    // (redirect, CSRF, etc.) and render a friendly error page for everything else.
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
