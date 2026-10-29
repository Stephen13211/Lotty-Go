import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut, setRole } = useAuth();
  const name = (session?.user?.user_metadata?.full_name as string) ?? session?.user?.email ?? "Guest";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
        <View style={s.avatar}><Icon name="account" size={38} color={colors.onBrandPrimary} /></View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.onSurface }}>{name}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>Rider · Lotty Go</Text>
      </View>
      <View style={s.sec}>
        {["Payment methods","Saved places","Safety","Settings"].map(l => (
          <View key={l} style={s.row}><Icon name="chevron-right" size={20} color={colors.muted} style={{ position: "absolute", right: spacing.lg }} /><Text style={{ color: colors.onSurface }}>{l}</Text></View>
        ))}
      </View>
      <Pressable onPress={async () => { await setRole("driver"); router.replace("/(driver)"); }} style={s.switch}>
        <Icon name="steering" size={18} color={colors.onBrandSecondary} /><Text style={{ color: colors.onBrandSecondary, fontWeight: "700" }}>Switch to Driver</Text>
      </Pressable>
      <Pressable onPress={async () => { await signOut(); router.replace("/welcome"); }} style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ color: colors.error, fontWeight: "700" }}>Log out</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  sec: { marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden" },
  row: { padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  switch: { margin: spacing.lg, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
});

