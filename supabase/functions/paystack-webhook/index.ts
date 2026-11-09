import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function hex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret || !url || !service) return reply({ error: "Webhook is not configured." }, 503);
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = await hmac(secret, raw);
  if (!signature || !safeEqual(signature.toLowerCase(), expected)) return reply({ error: "Invalid webhook signature." }, 401);
  let event: any;
  try { event = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON." }, 400); }
  if (event.event !== "charge.success") return reply({ received: true, ignored: event.event ?? "unknown" });
  const reference = String(event.data?.reference ?? "");
  if (!reference) return reply({ error: "Missing transaction reference." }, 400);
  try {
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const verifyPayload = await verifyResponse.json().catch(() => ({}));
    const tx = verifyPayload.data;
    if (!verifyResponse.ok || verifyPayload.status !== true || tx?.status !== "success") return reply({ error: "Transaction verification failed." }, 400);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: payment, error: paymentError } = await admin.from("payments").select("id,ride_id,total_fare,currency,collection_status,payment_method").eq("gateway", "paystack").eq("gateway_reference", reference).maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.payment_method !== "card") return reply({ error: "Payment reference not found." }, 404);
    if (tx.currency !== "ZAR" || Number(tx.amount) !== Math.round(Number(payment.total_fare) * 100)) return reply({ error: "Verified transaction amount or currency does not match the ride." }, 400);
    if (String(tx.metadata?.ride_id ?? "") !== payment.ride_id) return reply({ error: "Ride metadata mismatch." }, 400);
    if (payment.collection_status === "paid") return reply({ received: true, already_processed: true });
    const { error: updatePaymentError } = await admin.from("payments").update({
      collection_status: "paid", paid_at: new Date().toISOString(),
      driver_payout_status: "pending", lotty_settlement_status: "pending",
    }).eq("id", payment.id).eq("collection_status", "pending");
    if (updatePaymentError) throw updatePaymentError;
    const { error: updateRideError } = await admin.from("rides").update({ payment_status: "paid" }).eq("id", payment.ride_id);
    if (updateRideError) throw updateRideError;
    return reply({ received: true, processed: true });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Webhook processing failed." }, 500);
  }
});