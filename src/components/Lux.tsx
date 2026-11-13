import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { colors, glow, gradients, radius, spacing } from "@/src/theme";

export function GoldButton({ title, onPress, icon }: { title: string; onPress: () => void; icon?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed]}>
      <LinearGradient
        colors={gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.goldBtn, glow.goldGlow]}
      >
        <Text style={styles.goldBtnText}>{title}</Text>
        {icon ? <Icon name={icon as any} size={20} color={colors.onBrandPrimary} /> : <Icon name="arrow-right" size={19} color={colors.onBrandPrimary} />}
      </LinearGradient>
    </Pressable>
  );
}

export function LuxCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  buttonShell: { borderRadius: radius.pill, overflow: "hidden", shadowColor: colors.brandPrimary, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  goldBtn: {
    minHeight: 56,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  goldBtnText: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#151517",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#39301B",
    padding: spacing.xl,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
