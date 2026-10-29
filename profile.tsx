import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut, setRole } = useAuth();
  const name = (session?.user?.user_metadata?.full_name as string) ?? session?.user?.email ?? "Guest";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
        <View style={s.avatar}><Icon name="steering" size={38} color={colors.onBrandSecondary} /></View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.onSurface }}>{name}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>Driver · Lotty Go</Text>
      </View>
      <Pressable onPress={async () => { await setRole("rider"); router.replace("/(rider)"); }} style={s.sw}>
        <Icon name="map-marker-radius" size={18} color={colors.onBrandPrimary} /><Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Switch to Rider</Text>
      </Pressable>
      <Pressable onPress={async () => { await signOut(); router.replace("/welcome"); }} style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ color: colors.error, fontWeight: "700" }}>Log out</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: radius.pill, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  sw: { margin: spacing.lg, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
});

