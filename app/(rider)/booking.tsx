import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker, Polyline } from "@/src/components/map";
import { useAuth } from "@/src/lib/auth";
import { createRide, estimateFare, haversineKm, RIDE_OPTIONS, type RideType } from "@/src/lib/rides";
import { colors, radius, spacing } from "@/src/theme";

export default function Booking() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, configured } = useAuth();
  const { destination, pLat, pLng } = useLocalSearchParams<{ destination?: string; pLat?: string; pLng?: string }>();
  const destinationAddress = typeof destination === "string" && destination.trim()
    ? destination.trim()
    : "Selected destination";
  const pickup = { latitude: parseFloat(pLat || "-26.2041"), longitude: parseFloat(pLng || "28.0473") };
  const dropoff = useMemo(() => ({ latitude: pickup.latitude + 0.04, longitude: pickup.longitude + 0.03 }), [pLat, pLng]);
  const km = useMemo(() => haversineKm(pickup, dropoff), [pLat, pLng]);
  const [sel, setSel] = useState<RideType>("lotty_x");
  const canUseLottyWomen = session?.user?.user_metadata?.gender === "female";
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!configured || !session) { Alert.alert("Supabase required", "Add keys + sign in to confirm."); return; }
    if (sel === "lotty_xl" && !canUseLottyWomen) { Alert.alert("Lotty Women unavailable", "Lotty Women is only available to female riders."); return; }
    const opt = RIDE_OPTIONS.find(o => o.type === sel)!;
    setBusy(true);
    try {
      await createRide({ rider_id: session.user.id, pickup_address: "Current location", pickup_lat: pickup.latitude, pickup_lng: pickup.longitude, dropoff_address: destinationAddress, dropoff_lat: dropoff.latitude, dropoff_lng: dropoff.longitude, ride_type: sel, payment_method: "cash", fare: estimateFare(km, opt.multiplier, Math.max(1, km * 2)), distance_km: Number(km.toFixed(2)) });
      Alert.alert("Ride requested", "Finding a driver near you.");
      router.replace("/(rider)/trips");
    } catch (e: any) { Alert.alert("Failed", e?.message ?? "Try again"); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill}
        region={{ latitude: (pickup.latitude+dropoff.latitude)/2, longitude: (pickup.longitude+dropoff.longitude)/2, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
        <Marker coordinate={pickup} />
        <Marker coordinate={dropoff} pinColor={colors.brandSecondary} />
        <Polyline coordinates={[pickup, dropoff]} strokeColor={colors.brandPrimary} strokeWidth={4} />
      </MapView>
      <Pressable onPress={() => router.back()} style={[s.back, { top: insets.top + spacing.md }]}>
        <Icon name="arrow-left" size={22} color={colors.onSurface} />
      </Pressable>
      <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={s.handle} />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>DROPOFF</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.onSurface }} numberOfLines={1}>{destinationAddress}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing.md }}>~{km.toFixed(1)} km</Text>
        {RIDE_OPTIONS.map(o => {
          const active = o.type === sel;
          return (
            <Pressable key={o.type} onPress={() => setSel(o.type)} style={[s.opt, active && { borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary }]}>
              <LinearGradient colors={active ? ["#F9E27D", "#C9992B"] : ["#29251B", "#171719"]} style={s.optIcon}><Icon name={o.icon as any} size={26} color={active ? "#17130A" : colors.goldLight} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{o.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{genderRestricted ? "Female riders only" : `${o.seats} seats · 3 min`}</Text>
              </View>
              {genderRestricted ? <Text style={{ fontWeight: "800", fontSize: 11, color: colors.muted }}>LOCKED</Text> : <Text style={{ fontWeight: "800", fontSize: 17, color: colors.onSurface }}>R{estimateFare(km, o.multiplier, Math.max(1, km * 2))}</Text>}
            </Pressable>
          );
        })}
        <Pressable onPress={confirm} disabled={busy} style={({ pressed }) => [s.ctaShell, { opacity: busy ? 0.8 : 1 }, pressed && { transform: [{ scale: 0.985 }] }]}>
          <LinearGradient colors={["#F9E27D", "#D4AF37", "#A77C20"]} style={s.cta}>
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaT}>Confirm ride</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  back: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, elevation: 10 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  opt: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.md, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: "#141416" },
  optIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#55451E" },
  ctaShell: { marginTop: spacing.md, borderRadius: radius.pill, overflow: "hidden", shadowColor: colors.brandPrimary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  cta: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ctaT: { color: "#17130A", fontSize: 16, fontWeight: "900", letterSpacing: 0.4 },
});