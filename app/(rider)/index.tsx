import Icon from "@react-native-vector-icons/material-design-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker } from "@/src/components/map";
import { colors, radius, spacing } from "@/src/theme";

const RECENTS = [
  { label: "V&A Waterfront", sub: "Cape Town" },
  { label: "OR Tambo Airport", sub: "Kempton Park" },
  { label: "Sandton City", sub: "Sandton" },
];

export default function RiderHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);
  const snaps = useMemo(() => ["32%", "80%"], []);
  const [where, setWhere] = useState("");
  const [coords, setCoords] = useState({ latitude: -26.2041, longitude: 28.0473 });

  useEffect(() => { (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
  })(); }, []);

  const goBook = (d?: string) => {
    const dest = (d ?? where).trim(); if (!dest) return;
    router.push({ pathname: "/(rider)/booking", params: { destination: dest, pLat: String(coords.latitude), pLng: String(coords.longitude) }});
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} region={{ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }} showsUserLocation>
        <Marker coordinate={coords} />
      </MapView>

      <View style={[s.menu, { top: insets.top + spacing.md }]}>
        <Icon name="menu" size={22} color={colors.onSurface} />
      </View>

      <BottomSheet ref={sheetRef} index={0} snapPoints={snaps} backgroundStyle={{ backgroundColor: colors.surface }}>
        <BottomSheetView style={{ padding: spacing.xl, gap: spacing.sm }}>
          <Text style={{ color: colors.muted }}>Howzit 👋</Text>
          <Text style={s.title}>Where to?</Text>
          <View style={s.search}>
            <Icon name="magnify" size={20} color={colors.muted} />
            <TextInput value={where} onChangeText={setWhere} onSubmitEditing={() => goBook()} placeholder="Enter destination" placeholderTextColor={colors.muted} style={{ flex: 1, fontSize: 16, color: colors.onSurface }} returnKeyType="search" />
          </View>
          <Text style={s.section}>RECENT</Text>
          {RECENTS.map(r => (
            <Pressable key={r.label} onPress={() => goBook(r.label)} style={s.row}>
              <View style={s.rowIcon}><Icon name="map-marker" size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{r.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{r.sub}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
const s = StyleSheet.create({
  menu: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  section: { marginTop: spacing.lg, color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});

