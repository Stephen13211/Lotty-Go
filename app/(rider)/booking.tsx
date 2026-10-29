import Icon from "@react-native-vector-icons/material-design-icons";
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
  const { destination, pLat, pLng } = useLocalSearchParams<{ destination: string; pLat: string; pLng: string }>();
  const pickup = { latitude: parseFloat(pLat || "-26.2041"), longitude: parseFloat(pLng || "28.0473") };
  const dropoff = useMemo(() => ({ latitude: pickup.latitude + 0.04, longitude: pickup.longitude + 0.03 }), [pLat, pLng]);
  const km = useMemo(() => haversineKm(pickup, dropoff), [pLat, pLng]);
  const [sel, setSel] = useState<RideType>("lotty_x");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!configured || !session) { Alert.alert("Supabase required", "Add keys + sign in to confirm."); return; }
    const opt = RIDE_OPTIONS.find(o => o.type === sel)!;
    setBusy(true);
    try {
      await createRide({ rider_id: session.user.id, pickup_address: "Current location", pickup_lat: pickup.latitude, pickup_lng: pickup.longitude, dropoff_address: destination, dropoff_lat: dropoff.latitude, dropoff_lng: dropoff.longitude, ride_type: sel, fare: estimateFare(km, opt.multiplier), distance_km: Number(km.toFixed(2)) });
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
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.onSurface }} numberOfLines={1}>{destination}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing.md }}>~{km.toFixed(1)} km</Text>

        {RIDE_OPTIONS.map(o => {
          const active = o.type === sel;
          return (
            <Pressable key={o.type} onPress={() => setSel(o.type)} style={[s.opt, active && { borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary }]}>
              <View style={s.optIcon}><Icon name={o.icon as any} size={28} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{o.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{o.seats} seats · 3 min</Text>
              </View>
              <Text style={{ fontWeight: "800", fontSize: 17, color: colors.onSurface }}>R{estimateFare(km, o.multiplier)}</Text>
            </Pressable>
          );
        })}

        <Pressable onPress={confirm} disabled={busy} style={[s.cta, { opacity: busy ? 0.8 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaT}>Confirm ride</Text>}
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  back: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, elevation: 10 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  opt: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.sm },
  optIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  cta: { marginTop: spacing.md, height: 56, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaT: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});

