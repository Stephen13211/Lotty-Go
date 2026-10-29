import Icon from "@react-native-vector-icons/material-design-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!configured) { setErr("Add Supabase URL + anon key in .env."); return; }
    setErr(null); setBusy(true);
    try { await signIn(email.trim(), password); router.replace("/"); }
    catch (e: any) { setErr(e?.message ?? "Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Icon name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.sub}>Log in as a {role === "driver" ? "driver" : "rider"}.</Text>

        <Text style={s.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} style={s.input} />
        <Text style={s.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} style={s.input} />
        {err && <Text style={{ color: colors.error }}>{err}</Text>}

        <Pressable onPress={submit} disabled={busy} style={[s.cta, { opacity: busy ? 0.8 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaT}>Log in</Text>}
        </Pressable>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.lg }}>
          <Text style={{ color: colors.muted }}>New to Lotty Go? </Text>
          <Link href={{ pathname: "/(auth)/signup", params: { role: role ?? "rider" }}} asChild>
            <Pressable><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Create account</Text></Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 32, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 15, color: colors.muted, marginBottom: spacing.lg },
  label: { fontSize: 13, color: colors.onSurfaceSecondary, fontWeight: "600" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 14, fontSize: 16, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  cta: { marginTop: spacing.lg, height: 56, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaT: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});

