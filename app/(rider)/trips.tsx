import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { listMyRides, type Ride } from "@/src/lib/rides";
import { colors, radius, spacing } from "@/src/theme";

const STATUS: Record<string,string> = { requested: colors.warning, accepted: "#1976D2", in_progress: colors.brandPrimary, completed: colors.success, cancelled: colors.error };

export default function Trips() {
  const insets = useSafeAreaInsets();
  const { configured } = useAuth();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["my-rides"], queryFn: listMyRides, enabled: configured });

  const render = ({ item }: { item: Ride }) => (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Icon name="map-marker-outline" size={18} color={colors.brandPrimary} />
        <Text style={{ flex: 1, fontWeight: "700", color: colors.onSurface }} numberOfLines={1}>{item.dropoff_address}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>R{item.fare} · {item.distance_km} km</Text>
        <View style={[s.pill, { backgroundColor: STATUS[item.status] ?? colors.muted }]}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>{item.status.replace("_"," ")}</Text></View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={{ padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.onSurface }}>Your trips</Text>
      </View>
      {!configured ? (
        <View style={s.empty}><Icon name="database-off-outline" size={48} color={colors.muted} /><Text style={s.emptyText}>Add Supabase keys in .env</Text></View>
      ) : isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.brandPrimary} /> : (
        <FlatList data={data ?? []} keyExtractor={r => r.id} renderItem={render}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
          ListEmptyComponent={<View style={s.empty}><Icon name="car-off" size={48} color={colors.muted} /><Text style={s.emptyText}>No trips yet</Text></View>} />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: 14 },
});

