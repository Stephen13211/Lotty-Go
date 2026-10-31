import Icon from "@react-native-vector-icons/material-design-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker, Polyline } from "@/src/components/map";
import { useAuth } from "@/src/lib/auth";
import { createRide, estimateFare, haversineKm, RIDE_OPTIONS, type PaymentMethod, type RideType } from "@/src/lib/rides";
import { colors, radius, spacing } from "@/src/theme";

const RECENTS = [
  { label: "V&A Waterfront", sub: "Cape Town" },
  { label: "OR Tambo Airport", sub: "Kempton Park" },
  { label: "Sandton City", sub: "Sandton" },
];

type Coords = { latitude: number; longitude: number };

export default function RiderHome() {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const snaps = useMemo(() => ["55%", "88%"], []);
  const { session, configured } = useAuth();
  const [where, setWhere] = useState("");
  const [pickup, setPickup] = useState<Coords>({ latitude: -26.2041, longitude: 28.0473 });
  const [pickupAddress, setPickupAddress] = useState("Current location");
  const [destination, setDestination] = useState<Coords | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideType>("lotty_x");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPickup(point);
        try {
          const addresses = await Location.reverseGeocodeAsync(point);
          const a = addresses[0];
          if (a) setPickupAddress([a.name, a.street, a.city].filter(Boolean).join(", ") || "Current location");
        } catch {}
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const km = destination ? haversineKm(pickup, destination) : 0;
  const selectedOption = RIDE_OPTIONS.find(option => option.type === selectedRide) ?? RIDE_OPTIONS[0];

  const chooseDestination = async (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const results = await Location.geocodeAsync(clean + ", South Africa");
      if (!results.length) {
        Alert.alert("Location not found", "Please try a more specific destination.");
        return;
      }
      const point = { latitude: results[0].latitude, longitude: results[0].longitude };
      setWhere(clean);
      setDestination(point);
      sheetRef.current?.snapToIndex(1);
    } catch {
      Alert.alert("Search unavailable", "We couldn't find that destination. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRide = async () => {
    if (!where.trim() || !destination) {
      Alert.alert("Choose a destination", "Enter your destination before proceeding.");
      return;
    }
    if (!configured || !session) {
      Alert.alert("Sign in required", "Please sign in before requesting a ride.");
      return;
    }
    if (selectedOption.available === false) {
      Alert.alert("Coming soon", "Lotty Women will be available once women-driver verification and matching are ready.");
      return;
    }
    setBusy(true);
    try {
      await createRide({
        rider_id: session.user.id,
        pickup_address: pickupAddress,
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        dropoff_address: where,
        dropoff_lat: destination.latitude,
        dropoff_lng: destination.longitude,
        ride_type: selectedRide,
        payment_method: payment,
        fare: estimateFare(km, selectedOption.multiplier),
        distance_km: Number(km.toFixed(2)),
      });
      Alert.alert("Ride requested", "Your request has been sent. Finding a driver near you.");
    } catch (error: any) {
      Alert.alert("Request failed", error?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{
          latitude: destination ? (pickup.latitude + destination.latitude) / 2 : pickup.latitude,
          longitude: destination ? (pickup.longitude + destination.longitude) / 2 : pickup.longitude,
          latitudeDelta: destination ? Math.max(0.035, Math.abs(pickup.latitude - destination.latitude) * 1.8) : 0.05,
          longitudeDelta: destination ? Math.max(0.035, Math.abs(pickup.longitude - destination.longitude) * 1.8) : 0.05,
        }}
        showsUserLocation
      >
        <Marker coordinate={pickup} />
        {destination && <Marker coordinate={destination} pinColor={colors.brandSecondary} />}
        {destination && <Polyline coordinates={[pickup, destination]} strokeColor={colors.brandPrimary} strokeWidth={4} />}
      </MapView>

      <View style={[s.menu, { top: insets.top + spacing.md }]}>
        <Icon name="menu" size={22} color={colors.onSurface} />
      </View>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snaps}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: colors.muted }}>Howzit 👋</Text>
          <Text style={s.title}>Where to?</Text>

          <View style={s.locationBox}>
            <View style={s.locationLine}>
              <Icon name="map-marker" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={s.locationLabel}>PICKUP</Text>
                <Text style={s.locationValue} numberOfLines={1}>{pickupAddress}</Text>
              </View>
            </View>
            <View style={s.locationDivider} />
            <View style={s.search}>
              <Icon name="magnify" size={20} color={colors.muted} />
              <TextInput
                value={where}
                onChangeText={(value) => { setWhere(value); setDestination(null); }}
                onSubmitEditing={() => chooseDestination(where)}
                placeholder="Enter destination"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, fontSize: 16, color: colors.onSurface }}
                returnKeyType="search"
              />
              {busy && <ActivityIndicator size="small" color={colors.brandPrimary} />}
              {where.length > 0 && <Pressable onPress={() => { setWhere(""); setDestination(null); }}><Icon name="close-circle" size={20} color={colors.muted} /></Pressable>}
            </View>
          </View>

          {!destination && (
            <>
              <Text style={s.section}>RECENT DESTINATIONS</Text>
              {RECENTS.map(item => (
                <Pressable key={item.label} onPress={() => chooseDestination(item.label)} style={s.recentRow}>
                  <View style={s.recentIcon}><Icon name="clock-outline" size={19} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.locationValue}>{item.label}</Text>
                    <Text style={s.subText}>{item.sub}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </>
          )}

          {destination && (
            <>
              <View style={s.distanceRow}>
                <Text style={s.section}>CHOOSE YOUR RIDE</Text>
                <Text style={s.subText}>Approx. {km.toFixed(1)} km</Text>
              </View>
              {RIDE_OPTIONS.map(option => {
                const active = selectedRide === option.type;
                const unavailable = option.available === false;
                return (
                  <Pressable
                    key={option.type}
                    disabled={unavailable}
                    onPress={() => setSelectedRide(option.type)}
                    style={[s.rideOption, active && s.rideOptionActive, unavailable && { opacity: 0.55 }]}
                  >
                    <View style={s.rideIcon}><Icon name={option.icon as any} size={27} color={colors.onSurface} /></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.rideName}>{option.name}</Text>
                      <Text style={s.subText}>{option.seats} passengers{unavailable ? " · Coming soon" : " · Available"}</Text>
                    </View>
                    {unavailable ? <Text style={s.comingSoon}>SOON</Text> : <Text style={s.fare}>R{estimateFare(km, option.multiplier)}</Text>}
                    {active && !unavailable && <Icon name="check-circle" size={21} color={colors.brandPrimary} />}
                  </Pressable>
                );
              })}

              <Text style={s.section}>PAYMENT METHOD</Text>
              <View style={s.paymentRow}>
                <Pressable onPress={() => setPayment("cash")} style={[s.paymentOption, payment === "cash" && s.paymentActive]}>
                  <Icon name="cash" size={22} color={colors.onSurface} />
                  <Text style={s.paymentText}>Cash</Text>
                  {payment === "cash" && <Icon name="check-circle" size={18} color={colors.brandPrimary} />}
                </Pressable>
                <Pressable onPress={() => setPayment("card")} style={[s.paymentOption, payment === "card" && s.paymentActive]}>
                  <Icon name="credit-card-outline" size={22} color={colors.onSurface} />
                  <Text style={s.paymentText}>Card</Text>
                  {payment === "card" && <Icon name="check-circle" size={18} color={colors.brandPrimary} />}
                </Pressable>
              </View>
              <Text style={s.paymentNote}>Card payment selection is a placeholder until card payments are connected.</Text>

              <Pressable onPress={confirmRide} disabled={busy || selectedOption.available === false} style={[s.cta, (busy || selectedOption.available === false) && { opacity: 0.55 }]}>
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>Proceed to Ride · R{estimateFare(km, selectedOption.multiplier)}</Text>}
              </Pressable>
              <Pressable onPress={() => { setDestination(null); setWhere(""); }} style={s.changeDestination}>
                <Text style={s.changeText}>Change destination</Text>
              </Pressable>
            </>
          )}
          {!destination && (
            <Pressable onPress={() => chooseDestination(where)} disabled={!where.trim() || busy} style={[s.cta, (!where.trim() || busy) && { opacity: 0.45 }]}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>Find destination</Text>}
            </Pressable>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  menu: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  locationBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  locationLine: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  locationDivider: { height: 1, backgroundColor: colors.border, marginLeft: 30 },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  locationValue: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48 },
  section: { marginTop: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  subText: { color: colors.muted, fontSize: 12 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  recentIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  distanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rideOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginTop: spacing.xs },
  rideOptionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  rideIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rideName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  fare: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  comingSoon: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  paymentRow: { flexDirection: "row", gap: spacing.sm },
  paymentOption: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.sm },
  paymentActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  paymentText: { color: colors.onSurface, fontWeight: "700" },
  paymentNote: { color: colors.muted, fontSize: 10 },
  cta: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, marginTop: spacing.md },
  ctaText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  changeDestination: { alignItems: "center", padding: spacing.sm },
  changeText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
});
