import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";

const HERO_IMAGE = "https://images.pexels.com/photos/3581833/pexels-photo-3581833.jpeg?auto=compress&cs=tinysrgb&w=1800";

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
        <Pressable onPress={() => pick("rider")} style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}>
          <LinearGradient colors={["#F9E27D", "#D4AF37", "#A77C20"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Ride with Lotty Go</Text><Text style={styles.buttonArrow}>›</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => pick("driver")} style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}>
          <LinearGradient colors={["rgba(39,35,25,0.96)", "rgba(14,14,16,0.98)"]} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Drive & Earn</Text><Text style={styles.secondaryArrow}>↗</Text>
          </LinearGradient>
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
  buttonShell: { borderRadius: 17, overflow: "hidden", shadowColor: "#D4AF37", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  primaryButton: { minHeight: 59, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0B0B0D", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  buttonArrow: { color: "#17130A", fontSize: 25, fontWeight: "900", marginLeft: 10, marginTop: -2 },
  secondaryButton: { minHeight: 57, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.2, borderColor: "#806A30" },
  secondaryText: { color: "#F5E7B0", fontSize: 16, fontWeight: "800" },
  secondaryArrow: { color: "#D4AF37", fontSize: 18, fontWeight: "900", marginLeft: 10 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  footnote: { color: "#89857A", fontSize: 9, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginTop: 5 },
});
