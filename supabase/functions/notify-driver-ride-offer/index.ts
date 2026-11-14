import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !userData.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { rideId, driverId } = await req.json();
    if (typeof rideId !== "string" || typeof driverId !== "string") return new Response(JSON.stringify({ error: "rideId and driverId are required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: ride, error: rideError } = await admin.from("rides").select("id,rider_id,status,pickup_address,fare,ride_type").eq("id", rideId).maybeSingle();
    if (rideError || !ride || ride.rider_id !== userData.user.id || ride.status !== "requested") {
      return new Response(JSON.stringify({ error: "Ride not found or not owned by signed-in rider" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: attempt, error: attemptError } = await admin.from("ride_dispatch_attempts").select("id,expires_at,status").eq("ride_id", rideId).eq("driver_id", driverId).eq("status", "offered").gt("expires_at", new Date().toISOString()).maybeSingle();
    if (attemptError || !attempt) return new Response(JSON.stringify({ error: "No active offer exists for this driver" }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: availability } = await admin.from("driver_availability").select("is_online,location_updated_at").eq("driver_id", driverId).maybeSingle();
    if (!availability?.is_online || !availability.location_updated_at || Date.now() - new Date(availability.location_updated_at).getTime() > 90000) {
      return new Response(JSON.stringify({ error: "Driver is no longer reachable" }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: tokens, error: tokenError } = await admin.from("driver_push_tokens").select("expo_push_token").eq("driver_id", driverId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return new Response(JSON.stringify({ sent: 0, reason: "Driver has no registered push token" }), { headers: { ...cors, "Content-Type": "application/json" } });

    const messages = tokens.map((item: { expo_push_token: string }) => ({
      to: item.expo_push_token,
      sound: "default",
      priority: "high",
      channelId: "ride-requests",
      title: "New Lotty Go ride request",
      body: `${ride.pickup_address} · R${Number(ride.fare).toFixed(2)}`,
      data: { screen: "driver", rideId, driverId },
    }));
    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const pushResult = await pushResponse.json();
    if (!pushResponse.ok) throw new Error("Expo push service rejected the notification");
    return new Response(JSON.stringify({ sent: messages.length, result: pushResult }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("notify-driver-ride-offer failed", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Notification failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});