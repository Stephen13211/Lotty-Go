import { supabase, SUPABASE_URL } from "./supabase";
import type { Ride } from "./rides";

export type RideMessage = { id: string; ride_id: string; sender_id: string; body: string; created_at: string };
export type WaitingQuote = { free_minutes: number; fee_per_minute: number; billable_minutes: number; waiting_fee: number; charging_started: boolean };

export async function getActiveRide(userId: string, role: "rider" | "driver") {
  const column = role === "rider" ? "rider_id" : "driver_id";
  const { data, error } = await supabase.from("rides").select("*").eq(column,userId)
    .in("status",["accepted","in_progress"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data as Ride | null;
}

export async function getRequestedRide(userId:string) {
  const {data,error}=await supabase.from("rides").select("*").eq("rider_id",userId)
    .eq("status","requested").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  return data as Ride|null;
}

export async function markDriverArrived(rideId:string) {
  const {data,error}=await supabase.rpc("driver_arrive_at_pickup",{p_ride_id:rideId});
  if(error)throw error; return data as string;
}
export async function startTrip(rideId:string) {
  const {data,error}=await supabase.rpc("start_ride_trip",{p_ride_id:rideId});
  if(error)throw error; return data?.[0] as {ride_status:string;final_waiting_fee:number;billable_waiting_minutes:number};
}
export async function completeTrip(rideId:string) {
  const {error}=await supabase.rpc("complete_ride_trip",{p_ride_id:rideId}); if(error)throw error;
}
export async function updateDriverLocation(rideId:string,latitude:number,longitude:number) {
  const {error}=await supabase.rpc("update_active_ride_location",{p_ride_id:rideId,p_latitude:latitude,p_longitude:longitude});
  if(error)throw error;
}
export async function getWaitingQuote(rideId:string) {
  const {data,error}=await supabase.rpc("get_ride_waiting_quote",{p_ride_id:rideId});
  if(error)throw error; return (data?.[0] ?? null) as WaitingQuote | null;
}
export async function listRideMessages(rideId:string) {
  const {data,error}=await supabase.from("ride_messages").select("*").eq("ride_id",rideId).order("created_at",{ascending:true});
  if(error)throw error; return (data??[]) as RideMessage[];
}
export async function sendRideMessage(rideId:string,senderId:string,body:string) {
  const {error}=await supabase.from("ride_messages").insert({ride_id:rideId,sender_id:senderId,body:body.trim()});
  if(error)throw error;
}
export async function getMatchedDriverProfile(rideId:string) {
  // The public-profile RPC verifies that the signed-in rider owns this active
  // ride and returns only the driver's trip identity fields.
  const {data,error}=await supabase.rpc("get_matched_driver_profile",{p_ride_id:rideId});
  if(error)throw error;
  return (data?.[0] ?? null) as {
    legal_name:string|null;vehicle_make:string|null;vehicle_model:string|null;
    vehicle_year:number|null;vehicle_registration:string|null;profile_photo_url:string|null;
  } | null;
}

export async function createTripShareLink(rideId:string) {
  const {data,error}=await supabase.rpc("create_trip_share_link",{p_ride_id:rideId});
  if(error)throw error;
  if(typeof data!=="string"||!data)throw new Error("Could not create a trip-sharing link");
  const base=SUPABASE_URL.replace(/\/+$/,"");
  return `${base}/functions/v1/trip-share?token=${encodeURIComponent(data)}`;
}

export async function revokeTripShareLinks(rideId:string) {
  const {error}=await supabase.rpc("revoke_trip_share_links",{p_ride_id:rideId});
  if(error)throw error;
}

export async function cancelRide(rideId:string,reason:string) {
  const {data,error}=await supabase.rpc("cancel_ride_request",{p_ride_id:rideId,p_reason:reason});
  if(error)throw error;
  return (data?.[0] ?? null) as {cancelled_status:string;cancellation_fee:number;driver_distance_km:number|null} | null;
}
