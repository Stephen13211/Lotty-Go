import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ error: "Sign in required." }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  if (!url || !anon || !service || !secret) return reply({ error: "Payment service is not configured." }, 503);
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Session expired. Sign in again." }, 401);
  let input: { ride_id?: string };
  try { input = await req.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!input.ride_id) return reply({ error: "Ride ID is required." }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    const { data: ride, error: rideError } = await admin.from("rides").select("id,rider_id,driver_id,fare,payment_method,status,payment_status").eq("id", input.ride_id).maybeSingle();
    if (rideError) throw rideError;
    if (!ride || ride.rider_id !== authData.user.id) return reply({ error: "Ride not found for this rider." }, 404);
    if (ride.payment_method !== "card") return reply({ error: "This ride is not set to card payment." }, 400);
    if (ride.status !== "completed" || !ride.driver_id) return reply({ error: "Card payment becomes available after the driver completes the trip, so the final fare includes any waiting fee." }, 409);
    if (ride.payment_status === "paid") return reply({ already_paid: true, message: "This ride is already paid." });
    const { data: driver, error: driverError } = await admin.from("driver_profiles").select("application_status,payout_provider,payout_recipient_id,payout_status").eq("user_id", ride.driver_id).maybeSingle();
    if (driverError) throw driverError;
    if (!driver || driver.application_status !== "approved" || driver.payout_provider !== "paystack" || !driver.payout_recipient_id || driver.payout_status !== "verified") {
      return reply({ error: "This driver's bank payout account has not been verified by Lotty Go yet. Please choose cash or contact support." }, 409);
    }
    const { data: existing, error: existingError } = await admin.from("payments").select("collection_status,gateway_reference").eq("ride_id", ride.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.collection_status === "paid") return reply({ already_paid: true, message: "This ride is already paid." });
    const reference = `lottygo-${ride.id.replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "")}`;
    const fare = Number(ride.fare);
    if (!Number.isFinite(fare) || fare <= 0) return reply({ error: "Invalid ride fare." }, 400);
    const driverShare = Math.round(fare * 75) / 100;
    const lottyShare = Math.round((fare - driverShare) * 100) / 100;
    const paymentRow = {
      ride_id: ride.id, rider_id: ride.rider_id, driver_id: ride.driver_id, total_fare: fare,
      payment_method: "card", driver_share: driverShare, lotty_share: lottyShare, currency: "ZAR",
      gateway: "paystack", gateway_reference: reference, collection_status: "pending",
      driver_payout_status: "pending", lotty_settlement_status: "pending",
    };
    const { error: saveError } = await admin.from("payments").upsert(paymentRow, { onConflict: "ride_id" });
    if (saveError) throw saveError;
    const { error: rideUpdateError } = await admin.from("rides").update({ payment_status: "pending" }).eq("id", ride.id);
    if (rideUpdateError) throw rideUpdateError;

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: authData.user.email,
        amount: String(Math.round(fare * 100)),
        currency: "ZAR",
        reference,
        subaccount: driver.payout_recipient_id,
        bearer: "account",
        callback_url: "https://oqcmwtfjgphumnhnjrpz.supabase.co/functions/v1/paystack-callback",
        metadata: JSON.stringify({ ride_id: ride.id, rider_id: ride.rider_id, driver_id: ride.driver_id, platform_share_percent: 25 }),
      }),
    });
    const payload = await initResponse.json().catch(() => ({}));
    if (!initResponse.ok || payload.status !== true || !payload.data?.authorization_url) {
      await admin.from("payments").update({ collection_status: "failed" }).eq("ride_id", ride.id).eq("gateway_reference", reference);
      await admin.from("rides").update({ payment_status: "unpaid" }).eq("id", ride.id).eq("payment_status", "pending");
      return reply({ error: payload.message ?? "Paystack could not start the card payment." }, 400);
    }
    return reply({ authorization_url: payload.data.authorization_url, reference, amount: fare, currency: "ZAR" });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Could not initiate card payment." }, 400);
  }
});