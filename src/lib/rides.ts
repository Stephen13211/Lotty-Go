import { supabase } from "./supabase";

export type RideType = "lotty_x" | "lotty_comfort" | "lotty_xl";
export type RideStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled";
export type Ride = {
  id: string; rider_id: string; driver_id: string | null;
  pickup_address: string; pickup_lat: number; pickup_lng: number;
  dropoff_address: string; dropoff_lat: number; dropoff_lng: number;
  ride_type: RideType; fare: number; distance_km: number;
  status: RideStatus; created_at: string;
};

export const RIDE_OPTIONS = [
  { type: "lotty_x" as RideType, name: "Lotty X", seats: 4, multiplier: 1, icon: "car" },
  { type: "lotty_comfort" as RideType, name: "Lotty Comfort", seats: 4, multiplier: 1.4, icon: "car-sports" },
  { type: "lotty_xl" as RideType, name: "Lotty XL", seats: 6, multiplier: 1.8, icon: "van-passenger" },
];

export function estimateFare(km: number, m: number) { return Math.round((20 + km * 9) * m); }
export function haversineKm(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}) {
  const R = 6371, dLat = (b.latitude - a.latitude) * Math.PI / 180, dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const la1 = a.latitude * Math.PI / 180, la2 = b.latitude * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function createRide(input: Omit<Ride,"id"|"created_at"|"status"|"driver_id">) {
  const { data, error } = await supabase.from("rides").insert({ ...input, status: "requested" }).select().single();
  if (error) throw error; return data as Ride;
}
export async function listMyRides() {
  const { data, error } = await supabase.from("rides").select("*").order("created_at",{ascending:false});
  if (error) throw error; return (data ?? []) as Ride[];
}
export async function listOpenRides() {
  const { data, error } = await supabase.from("rides").select("*").eq("status","requested").order("created_at",{ascending:false});
  if (error) throw error; return (data ?? []) as Ride[];
}
export async function acceptRide(rideId: string, driverId: string) {
  const { data, error } = await supabase.from("rides").update({ driver_id: driverId, status: "accepted" }).eq("id", rideId).select().single();
  if (error) throw error; return data as Ride;
}
export async function updateRideStatus(rideId: string, status: RideStatus) {
  const { error } = await supabase.from("rides").update({ status }).eq("id", rideId);
  if (error) throw error;
}

