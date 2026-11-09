import { supabase } from "./supabase";

export type DriverApplicationStatus = "not_started" | "pending" | "approved" | "rejected";
export type DriverProfile = {
  user_id: string;
  application_status: DriverApplicationStatus;
  legal_name: string | null;
  phone: string | null;
  vehicle_type: "car" | "motorcycle" | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_registration: string | null;
  women_riders_only: boolean;
  women_service_approved: boolean;
  payout_status: "not_connected" | "pending" | "verified" | "rejected";
  payout_provider?: string | null;
  payout_recipient_id?: string | null;
  review_notes: string | null;
  profile_photo_url?: string | null;
};

export async function getDriverProfile(userId: string) {
  const { data, error } = await supabase
    .from("driver_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as DriverProfile | null;
}

export async function saveDriverApplication(input: {
  user_id: string;
  legal_name: string;
  phone: string;
  vehicle_type: "car" | "motorcycle";
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_registration: string;
  women_riders_only: boolean;
}) {
  const { data, error } = await supabase.from("driver_profiles").upsert({
    ...input,
    application_status: "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return data as DriverProfile;
}

export async function setWomenOnlyPreference(enabled: boolean) {
  const { error } = await supabase.rpc("set_driver_women_preference", { p_enabled: enabled });
  if (error) throw error;
}


export type DriverAvailability = {
  driver_id: string;
  is_online: boolean;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
};

export async function setDriverAvailability(online: boolean, latitude?: number, longitude?: number) {
  const { error } = await supabase.rpc("set_driver_availability", {
    p_online: online,
    p_latitude: latitude ?? null,
    p_longitude: longitude ?? null,
  });
  if (error) throw error;
}

export async function getDriverAvailability(userId: string) {
  const { data, error } = await supabase
    .from("driver_availability")
    .select("driver_id,is_online,latitude,longitude,location_updated_at")
    .eq("driver_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as DriverAvailability | null;
}
