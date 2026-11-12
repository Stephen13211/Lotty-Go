import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const incoming = new URL(req.url);
  const reference = incoming.searchParams.get("reference") ?? incoming.searchParams.get("trxref") ?? "";
  if (!/^[A-Za-z0-9.=-]{1,100}$/.test(reference)) return new Response("Missing or invalid payment reference.", { status: 400 });
  const appUrl = new URL("lottygo://payment-result");
  appUrl.searchParams.set("reference", reference);
  return Response.redirect(appUrl.toString(), 302);
});