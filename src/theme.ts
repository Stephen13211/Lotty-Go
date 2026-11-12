// Lotty Go — Dark Luxury (charcoal/black + gold & platinum)
export const colors = {
  // Base surfaces
  surface: "#0B0B0D",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#161619",
  onSurfaceSecondary: "#F5F3EA",
  surfaceInverse: "#F5F3EA",
  onSurfaceInverse: "#0B0B0D",

  // Brand — gold & platinum
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#0B0B0D",
  brandSecondary: "#E5E4E2",
  onBrandSecondary: "#0B0B0D",
  brandTertiary: "#1D180E",
  onBrandTertiary: "#E9C767",

  // Status
  success: "#3FBF7F",
  warning: "#F5C518",
  error: "#E5484D",

  // Lines & secondary text
  border: "#2A2617",
  borderStrong: "#463D1E",
  divider: "#1E1E22",
  muted: "#9A9AA3",

  // Luxury extras
  goldLight: "#F9E27D",
  goldDark: "#8C6A15",
  platinum: "#E5E4E2",
  platinumDark: "#C7CBD1",
};

// Gold gradients for expo-linear-gradient
export const gradients = {
  gold: ["#F9E27D", "#D4AF37", "#8C6A15"] as const,
  goldButton: ["#F2D060", "#C9992B"] as const,
  platinum: ["#F4F4F6", "#C7CBD1"] as const,
};

// Gold glow shadow for buttons & cards
export const glow = {
  goldGlow: {
    shadowColor: "#D4AF37",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
