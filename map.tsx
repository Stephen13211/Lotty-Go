import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/src/theme";

let MapReal: any = View, MarkerReal: any = View, PolylineReal: any = View;
if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  MapReal = Maps.default; MarkerReal = Maps.Marker; PolylineReal = Maps.Polyline;
}
export const Marker = MarkerReal;
export const Polyline = PolylineReal;
export function MapView(props: any) {
  if (Platform.OS === "web") {
    return (
      <View style={[props.style, s.fb]}>
        <Text style={s.t}>Live map on iOS / Android</Text>
        <Text style={s.sub}>Scan Expo Go QR to see Google Maps.</Text>
        {props.children}
      </View>
    );
  }
  return <MapReal {...props} />;
}
const s = StyleSheet.create({
  fb: { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  t: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
});

