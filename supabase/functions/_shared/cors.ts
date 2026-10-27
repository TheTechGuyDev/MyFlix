export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const fail = (error: string, status = 400) => json({ error }, status);

/** Wraps a handler with CORS preflight and error handling. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
      return await handler(req);
    } catch (e) {
      console.error(e);
      const msg = e instanceof HttpError ? e.message : "Something went wrong. Please try again.";
      return fail(msg, e instanceof HttpError ? e.status : 500);
    }
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const env = (k: string) => Deno.env.get(k) ?? "";
export const site = () => (env("SITE_URL") || "https://thetechguydev.github.io/MyFlix").replace(/\/$/, "");
