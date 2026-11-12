import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { radius, spacing } from "@/src/theme";

const BG = "https://images.unsplash.com/photo-1599407384144-77deae48a47a?w=1200&q=85";

// Keep the existing welcome screen appearance unchanged while the rest of the app
// adopts the new gold-and-black theme.
const WELCOME_COLORS = {
  riderButton: "#156D4A",
  riderText: "#FFFFFF",
  driverButton: "#F2A900",
  driverText: "#1A1A1A",
};

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setRole, session } = useAuth();
  const pick = async (r: "rider"|"driver") => { await setRole(r); if (session) { router.replace(r === "driver" ? "/driver-application" : "/(rider)"); return; } router.push({ pathname: "/(auth)/login", params: { role: r }}); };

  return (
    <ImageBackground source={{ uri: BG }} style={{ flex: 1, justifyContent: "space-between" }}>
      <LinearGradient colors={["transparent","rgba(26,26,26,0.5)","rgba(26,26,26,0.95)"]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl }}>
        <Text style={s.brand}>Lotty Go</Text>
        <Text style={s.tag}>Mzansi's ride, your way.</Text>
      </View>
      <View style={{ paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.md }}>
        <Pressable onPress={() => pick("rider")} style={[s.cta, { backgroundColor: WELCOME_COLORS.riderButton }]}>
          <Text style={[s.ctaT, { color: WELCOME_COLORS.riderText }]}>Ride with Lotty Go</Text>
        </Pressable>
        <Pressable onPress={() => pick("driver")} style={[s.cta, { backgroundColor: WELCOME_COLORS.driverButton }]}>
          <Text style={[s.ctaT, { color: WELCOME_COLORS.driverText }]}>Drive & Earn</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}
const s = StyleSheet.create({
  brand: { fontSize: 44, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  tag: { fontSize: 16, color: "#fff", opacity: 0.85, marginTop: spacing.sm },
  cta: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ctaT: { fontSize: 17, fontWeight: "700" },
});
