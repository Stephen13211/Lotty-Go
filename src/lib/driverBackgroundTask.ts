import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { supabase } from "./supabase";

export const DRIVER_BACKGROUND_LOCATION_TASK = "lotty-driver-background-location";

type LocationTaskPayload = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask(DRIVER_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("Lotty Go background location task failed", error);
    return;
  }

  const locations = (data as LocationTaskPayload | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const { data: availability, error: availabilityError } = await supabase
      .from("driver_availability")
      .select("is_online")
      .eq("driver_id", authData.user.id)
      .maybeSingle();

    if (availabilityError || !availability?.is_online) {
      if (await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
      }
      return;
    }

    const { error: updateError } = await supabase.rpc("set_driver_availability", {
      p_online: true,
      p_latitude: latest.coords.latitude,
      p_longitude: latest.coords.longitude,
    });
    if (updateError) console.warn("Lotty Go background heartbeat failed", updateError);
  } catch (taskError) {
    console.warn("Lotty Go could not publish background location", taskError);
  }
});
