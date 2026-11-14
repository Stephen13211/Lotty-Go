import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { DRIVER_BACKGROUND_LOCATION_TASK } from "./driverBackgroundTask";

export async function startDriverBackgroundTracking() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Allow location access while using Lotty Go before going online.");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    throw new Error("Allow Lotty Go to access your location in the background. Android may open Settings for this permission.");
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 15,
      deferredUpdatesInterval: 10000,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Lotty Go driver mode is active",
        notificationBody: "Your location is shared while you are online so nearby riders can find you.",
        notificationColor: "#D4AF37",
      },
    });
  }
}

export async function stopDriverBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
}

export async function registerDriverPushNotifications(driverId: string) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("ride-requests", {
      name: "Ride requests",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    throw new Error("Enable notifications so Lotty Go can alert you when a rider requests a trip.");
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Lotty Go push notification project is not configured.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("driver_push_tokens").upsert({
    driver_id: driverId,
    expo_push_token: token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    updated_at: new Date().toISOString(),
  }, { onConflict: "expo_push_token" });
  if (error) throw error;
  return token;
}
