import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";

const HERO_IMAGE = "https://images.unsplash.com/photo-1616591938203-9b5630a01006?auto=format&fit=crop&fm=jpg&q=88&w=1800";

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setRole, session } = useAuth();

  const pick = async (role: "rider" | "driver") => {
    await setRole(role);
    if (session) {
      router.replace(role === "driver" ? "/driver-application" : "/(rider)");
      return;
    }
    router.push({ pathname: "/(auth)/login", params: { role } });
  };

  return (
    <ImageBackground source={{ uri: HERO_IMAGE }} resizeMode="cover" style={styles.screen}>
      <LinearGradient
        colors={["rgba(7,7,8,0.68)", "rgba(7,7,8,0.12)", "rgba(7,7,8,0.78)", "#0B0B0D"]}
        locations={[0, 0.34, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.brand}>LOTTY GO</Text>
        <Text style={styles.tagline}>YOUR RIDE. YOUR WAY.</Text>
      </View>

      <View style={styles.carBrand}>
        <Text style={styles.carBrandText}>LOTTY GO</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.headline}>Move with confidence.</Text>
        <Text style={styles.subline}>Reliable rides, made for Mzansi.</Text>
        <Pressable onPress={() => pick("rider")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Ride with Lotty Go</Text>
        </Pressable>
        <Pressable onPress={() => pick("driver")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Drive & Earn</Text>
        </Pressable>
        <Text style={styles.footnote}>SAFE JOURNEYS START HERE</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0D", justifyContent: "space-between" },
  header: { paddingHorizontal: 26 },
  brand: { color: "#D4AF37", fontSize: 31, fontWeight: "900", letterSpacing: 4 },
  tagline: { color: "#E5E4E2", fontSize: 10, fontWeight: "700", letterSpacing: 3, marginTop: 7 },
  carBrand: { alignSelf: "center", marginTop: 24, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 5, backgroundColor: "rgba(11,11,13,0.72)", borderWidth: 1, borderColor: "rgba(212,175,55,0.8)" },
  carBrandText: { color: "#E7C65A", fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  footer: { paddingHorizontal: 24, gap: 12 },
  headline: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", letterSpacing: -0.6 },
  subline: { color: "#D2D0C8", fontSize: 14, marginBottom: 10 },
  primaryButton: { minHeight: 57, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#D4AF37" },
  primaryText: { color: "#0B0B0D", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  secondaryButton: { minHeight: 55, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,11,13,0.68)", borderWidth: 1.4, borderColor: "#D4AF37" },
  secondaryText: { color: "#F5E7B0", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  footnote: { color: "#89857A", fontSize: 9, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginTop: 5 },
});
