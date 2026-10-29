import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/src/lib/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { session, role, loading } = useAuth();
  if (loading) return <View style={styles.l}><ActivityIndicator color={colors.brandPrimary} size="large"/></View>;
  if (!session) return <Redirect href="/welcome" />;
  if (role === "driver") return <Redirect href="/(driver)" />;
  if (role === "rider") return <Redirect href="/(rider)" />;
  return <Redirect href="/welcome" />;
}
const styles = StyleSheet.create({ l: { flex: 1, alignItems: "center", justifyContent: "center" }});

