import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing } from "@/src/theme";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const handled = useRef(false);
  const [message, setMessage] = useState("Confirming your email and opening Lotty Go…");

  useEffect(() => {
    if (handled.current) return;
    const code = typeof params.code === "string" ? params.code : null;
    const error = typeof params.error_description === "string"
      ? params.error_description
      : typeof params.error === "string" ? params.error : null;

    if (error) {
      handled.current = true;
      setMessage("Email verification could not be completed. Please open the verification link again or request a new one.");
      return;
    }
    if (!code) {
      setMessage("Waiting for the verification link…");
      return;
    }

    handled.current = true;
    let active = true;
    (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (exchangeError) {
        setMessage("This verification link may have expired. Please request a new verification email and try again.");
        return;
      }
      router.replace("/");
    })().catch(() => {
      if (active) setMessage("Could not finish verification. Please request a new verification email and try again.");
    });
    return () => { active = false; };
  }, [params.code, params.error, params.error_description, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.surface },
  message: { color: colors.onSurface, fontSize: 16, lineHeight: 24, textAlign: "center" },
});
