import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { listMyRides } from "@/src/lib/rides";
import { colors, radius, spacing } from "@/src/theme";

export default function Earnings() {
  const insets = useSafeAreaInsets();
  const { configured, session } = useAuth();
  const { data } = useQuery({ queryKey: ["driver-rides", session?.user.id], queryFn: listMyRides, enabled: configured });
  const stats = useMemo(() => {
    const mine = (data ?? []).filter(r => r.driver_id === session?.user.id && r.status === "completed");
    return { total: mine.reduce((s,r) => s + Number(r.fare) * (r.payment_method === "cash" ? 1 : 0.75), 0), trips: mine.length, km: mine.reduce((s,r) => s + Number(r.distance_km), 0) };
  }, [data, session?.user.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.onSurface }}>Earnings</Text>
      <LinearGradient colors={["#F9E27D", "#D4AF37", "#8C6A15"]} style={s.hero}>
        <Text style={{ color: colors.onBrandPrimary, opacity: 0.85, fontSize: 13, fontWeight: "600" }}>Estimated driver earnings</Text>
        <Text style={{ color: colors.onBrandPrimary, fontSize: 40, fontWeight: "900" }}>R{stats.total.toFixed(2)}</Text>
      </LinearGradient>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Estimated driver earnings: 100% of cash fares and 75% of card fares. Card payments and automatic bank settlements are not connected yet.</Text>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={s.card}><Icon name="car" size={22} color={colors.brandPrimary} /><Text style={s.v}>{stats.trips}</Text><Text style={s.l}>Trips</Text></View>
        <View style={s.card}><Icon name="map-marker-distance" size={22} color={colors.brandPrimary} /><Text style={s.v}>{stats.km.toFixed(1)} km</Text><Text style={s.l}>Distance</Text></View>
      </View>
      <View style={s.tip}>
        <Icon name="lightbulb-on-outline" size={20} color={colors.brandSecondary} />
        <Text style={{ flex: 1, color: colors.onBrandTertiary }}>Peak hours in SA: 06:30–08:30 & 16:30–19:00. Stay near Sandton or airport for higher payouts.</Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: "#F9E27D", shadowColor: colors.brandPrimary, shadowOpacity: 0.25, shadowRadius: 16, elevation: 7 },
  card: { flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: "#151517", borderWidth: 1, borderColor: "#39301B", gap: 4 },
  v: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  l: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  tip: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
});

