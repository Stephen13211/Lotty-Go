import Icon from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function Signup() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: "rider"|"driver" }>();
  const { signUp, configured } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!configured) { setErr("Add Supabase URL + anon key in .env."); return; }
    if (name.trim().length < 2) { setErr("Please enter your name."); return; }
    setErr(null); setBusy(true);
    try { await signUp(email.trim(), password, name.trim(), (role as any) ?? "rider"); router.replace("/"); }
    catch (e: any) { setErr(e?.message ?? "Sign up failed"); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Icon name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={s.title}>Create account</Text>
        <Text style={s.sub}>Join as a {role === "driver" ? "driver" : "rider"}.</Text>

        <Text style={s.label}>Full name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Thabo Mokoena" placeholderTextColor={colors.muted} style={s.input} />
        <Text style={s.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} style={s.input} />
        <Text style={s.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 characters" placeholderTextColor={colors.muted} style={s.input} />
        {err && <Text style={{ color: colors.error }}>{err}</Text>}

        <Pressable onPress={submit} disabled={busy} style={[s.cta, { opacity: busy ? 0.8 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaT}>Create account</Text>}
        </Pressable>
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

