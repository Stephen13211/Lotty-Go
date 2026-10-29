import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker } from "@/src/components/map";
import { useAuth } from "@/src/lib/auth";
import { acceptRide, listOpenRides, type Ride } from "@/src/lib/rides";
import { colors, radius, spacing } from "@/src/theme";

export default function DriverHome() {
  const insets = useSafeAreaInsets();
  const { session, configured } = useAuth();
  const qc = useQueryClient();
  const [online, setOnline] = useState(false);
  const [coords, setCoords] = useState({ latitude: -26.2041, longitude: 28.0473 });

  useEffect(() => { (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const l = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: l.coords.latitude, longitude: l.coords.longitude });
    }
  })(); }, []);

  const { data: open } = useQuery({ queryKey: ["open-rides"], queryFn: listOpenRides, enabled: configured && online, refetchInterval: online ? 5000 : false });
  const next: Ride | undefined = open?.[0];

  const accept = async () => {
    if (!session || !next) return;
    try { await acceptRide(next.id, session.user.id); qc.invalidateQueries({ queryKey: ["open-rides"] }); Alert.alert("Accepted","Head to pickup."); }
    catch (e: any) { Alert.alert("Failed", e?.message ?? "Try again"); }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} region={{ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }} showsUserLocation>
        <Marker coordinate={coords} />
      </MapView>

      <View style={[s.pill, { top: insets.top + spacing.md }]}>
        <Icon name="cash" size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Today: R0</Text>
      </View>
      <View style={[s.status, { top: insets.top + spacing.md, backgroundColor: online ? colors.success : colors.surfaceInverse }]}>
        <View style={[s.dot, { backgroundColor: online ? "#4ADE80" : colors.muted }]} />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>{online ? "ONLINE" : "OFFLINE"}</Text>
      </View>

      <ScrollView style={s.sheet} contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
        {!online ? (
          <>
            <Text style={s.title}>Ready to earn?</Text>
            <Text style={{ color: colors.muted }}>Go online to receive requests.</Text>
            <Pressable onPress={() => setOnline(true)} style={s.go}><Text style={s.goT}>GO</Text></Pressable>
          </>
        ) : next ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 13 }}>NEW RIDE REQUEST</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.onSurface }} numberOfLines={1}>{next.dropoff_address}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Stat label="Payout" v={`R${next.fare}`} /><Stat label="Distance" v={`${next.distance_km} km`} /><Stat label="Type" v={next.ride_type.replace("_"," ")} />
            </View>
            <Pressable onPress={accept} style={s.accept}><Text style={{ color: colors.onBrandSecondary, fontWeight: "800", fontSize: 17 }}>Accept ride</Text></Pressable>
          </View>
        ) : (
          <>
            <Text style={s.title}>You're online</Text>
            <Text style={{ color: colors.muted }}>Waiting for requests…</Text>
            <Pressable onPress={() => setOnline(false)} style={s.offline}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Go offline</Text></Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Stat({ label, v }: { label: string; v: string }) {
  return <View style={s.stat}><Text style={{ fontSize: 11, color: colors.muted, fontWeight: "700" }}>{label}</Text><Text style={{ fontSize: 15, fontWeight: "800", color: colors.onSurface, textTransform: "capitalize" }}>{v}</Text></View>;
}
const s = StyleSheet.create({
  pill: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.lg, paddingVertical: 8, backgroundColor: colors.surfaceInverse, borderRadius: radius.pill },
  status: { position: "absolute", left: spacing.lg, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "55%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, elevation: 10 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  go: { alignSelf: "center", width: 160, height: 160, borderRadius: 999, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  goT: { color: colors.onBrandPrimary, fontSize: 48, fontWeight: "900", letterSpacing: 2 },
  offline: { alignSelf: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  accept: { height: 56, borderRadius: radius.pill, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
});

