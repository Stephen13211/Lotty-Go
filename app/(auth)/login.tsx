import { LinearGradient } from "expo-linear-gradient";
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
  const [err, setErr] = useState<string | null>(null); const [showSignupPrompt, setShowSignupPrompt] = useState(false); const [busy, setBusy] = useState(false);

  const resetPassword = async () => {
    if (!configured) { setErr("Supabase is not configured yet."); return; }
    if (!email.trim()) { setErr("Enter your email address first."); return; }
    setErr(null); setBusy(true);
    try {
      const { error } = await (await import("@/src/lib/supabase")).supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: "lottygo://reset-password" });
      if (error) throw error;
      setErr("Password reset email sent. Open the link on this phone to choose a new password.");
    } catch (e: any) { setErr(e?.message ?? "Could not send reset email."); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!configured) { setErr("Add Supabase URL + anon key in .env."); return; }
    setErr(null); setShowSignupPrompt(false); setBusy(true);
    try { await signIn(email.trim(), password); router.replace("/"); }
    catch (e: any) {
      const message = String(e?.message ?? "");
      if (message.toLowerCase().includes("invalid login credentials")) {
        setErr("Email or password is incorrect. If you haven't created a Lotty Go account yet, you can create one below.");
        setShowSignupPrompt(true);
      } else {
        setErr(message || "Login failed. Please try again.");
      }
    }
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
        {err && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.error }}>{err}</Text>
            {showSignupPrompt && (
              <Link href={{ pathname: "/(auth)/signup", params: { role: role ?? "rider" } }} asChild>
                <Pressable style={{ alignSelf: "flex-start", paddingVertical: spacing.xs }}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Create a Lotty Go account</Text>
                </Pressable>
              </Link>
            )}
          </View>
        )}
        <Pressable onPress={resetPassword} disabled={busy} style={{ alignSelf: "flex-end", paddingVertical: spacing.xs }}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Forgot password?</Text></Pressable>

        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [s.ctaShell, pressed && { transform: [{ scale: 0.985 }] }, { opacity: busy ? 0.8 : 1 }]}><LinearGradient colors={["#F9E27D", "#D4AF37", "#A77C20"]} style={s.cta}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaT}>Log in</Text>}</LinearGradient></Pressable>

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
  ctaShell: { marginTop: spacing.lg, borderRadius: radius.pill, overflow: "hidden", shadowColor: colors.brandPrimary, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  cta: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ctaT: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});

