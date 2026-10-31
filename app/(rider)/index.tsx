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

type Coords = { latitude: number; longitude: number };
const FALLBACK: Coords = { latitude: -33.9249, longitude: 18.4241 };

export default function RiderHome() {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const snaps = useMemo(() => ["62%", "90%"], []);
  const { session, configured } = useAuth();
  const [pickupText, setPickupText] = useState("Finding your current location…");
  const [pickup, setPickup] = useState<Coords | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [destination, setDestination] = useState<Coords | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideType>("lotty_x");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(true);

  const addressFor = (a?: Location.LocationGeocodedAddress) =>
    a ? [a.name, a.street, a.subregion, a.city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ") : "";

  const useCurrentLocation = async () => {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Allow Lotty Go to use your location, or type your pickup address manually.");
        setPickupText("");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setPickup(point);
      try {
        const addresses = await Location.reverseGeocodeAsync(point);
        setPickupText(addressFor(addresses[0]) || "Current location");
      } catch {
        setPickupText("Current location");
      }
    } catch {
      Alert.alert("Could not get location", "Please type your pickup address instead, or try Use current location again.");
      setPickupText("");
    } finally {
      setLocationBusy(false);
    }
  };

  useEffect(() => { useCurrentLocation(); }, []);

  const geocodeAddress = async (text: string): Promise<Coords | null> => {
    const clean = text.trim();
    if (!clean) return null;
    const results = await Location.geocodeAsync(clean.toLowerCase().includes("south africa") ? clean : clean + ", South Africa");
    if (!results.length) return null;
    return { latitude: results[0].latitude, longitude: results[0].longitude };
  };

  const setPickupFromText = async () => {
    if (!pickupText.trim()) {
      Alert.alert("Enter pickup", "Type your pickup address or use your current location.");
      return;
    }
    setBusy(true);
    try {
      const point = await geocodeAddress(pickupText);
      if (!point) {
        setPickup(null);
        Alert.alert("Pickup not found", "Please add a suburb, city or street and try again.");
        return;
      }
      setPickup(point);
      setPickupText(pickupText.trim());
      Alert.alert("Pickup updated", "Your pickup location has been set.");
    } catch {
      Alert.alert("Search unavailable", "We couldn't find that pickup. Please try again.");
    } finally { setBusy(false); }
  };

  const setDestinationFromText = async () => {
    if (!destinationText.trim()) {
      Alert.alert("Enter destination", "Type where you want to go.");
      return;
    }
    setBusy(true);
    try {
      const point = await geocodeAddress(destinationText);
      if (!point) {
        setDestination(null);
        Alert.alert("Destination not found", "Please add a suburb, city or street and try again.");
        return;
      }
      setDestination(point);
      setDestinationText(destinationText.trim());
      sheetRef.current?.snapToIndex(1);
    } catch {
      Alert.alert("Search unavailable", "We couldn't find that destination. Please try again.");
    } finally { setBusy(false); }
  };

  const km = pickup && destination ? haversineKm(pickup, destination) : 0;
  const selectedOption = RIDE_OPTIONS.find(option => option.type === selectedRide) ?? RIDE_OPTIONS[0];
  const canConfirm = !!pickup && !!destination && !busy && selectedOption.available !== false;

  const confirmRide = async () => {
    if (!pickupText.trim() || !destinationText.trim()) {
      Alert.alert("Add your locations", "Enter both pickup and destination before confirming.");
      return;
    }
    if (!pickup) {
      await setPickupFromText();
      return;
    }
    if (!destination) {
      await setDestinationFromText();
      return;
    }
    if (!configured || !session) {
      Alert.alert("Sign in required", "Please sign in before requesting a ride.");
      return;
    }
    setBusy(true);
    try {
      await createRide({
        rider_id: session.user.id,
        pickup_address: pickupText.trim(),
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        dropoff_address: destinationText.trim(),
        dropoff_lat: destination.latitude,
        dropoff_lng: destination.longitude,
        ride_type: selectedRide,
        payment_method: payment,
        fare: estimateFare(km, selectedOption.multiplier),
        distance_km: Number(km.toFixed(2)),
      });
      Alert.alert("Ride requested", "Your request has been sent. Driver matching will depend on available drivers.");
    } catch (error: any) {
      Alert.alert("Request failed", error?.message ?? "Please try again.");
    } finally { setBusy(false); }
  };

  const mapCenter = pickup ?? FALLBACK;
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{
          latitude: destination && pickup ? (pickup.latitude + destination.latitude) / 2 : mapCenter.latitude,
          longitude: destination && pickup ? (pickup.longitude + destination.longitude) / 2 : mapCenter.longitude,
          latitudeDelta: destination && pickup ? Math.max(0.035, Math.abs(pickup.latitude - destination.latitude) * 1.8) : 0.06,
          longitudeDelta: destination && pickup ? Math.max(0.035, Math.abs(pickup.longitude - destination.longitude) * 1.8) : 0.06,
        }}
        showsUserLocation
      >
        {pickup && <Marker coordinate={pickup} />}
        {destination && <Marker coordinate={destination} pinColor={colors.brandSecondary} />}
        {destination && pickup && <Polyline coordinates={[pickup, destination]} strokeColor={colors.brandPrimary} strokeWidth={4} />}
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
          <Text style={s.title}>Book your ride</Text>

          <View style={s.locationBox}>
            <Text style={s.locationLabel}>PICKUP LOCATION</Text>
            <View style={s.inputRow}>
              <Icon name="map-marker" size={21} color={colors.brandPrimary} />
              <TextInput
                value={pickupText}
                onChangeText={(value) => { setPickupText(value); setPickup(null); }}
                onSubmitEditing={setPickupFromText}
                placeholder="Type or edit your pickup address"
                placeholderTextColor={colors.muted}
                style={s.input}
                returnKeyType="search"
              />
              {locationBusy ? <ActivityIndicator color={colors.brandPrimary} /> : null}
            </View>
            <View style={s.actionRow}>
              <Pressable onPress={useCurrentLocation} style={s.smallAction}>
                <Icon name="crosshairs-gps" size={16} color={colors.brandPrimary} />
                <Text style={s.actionText}>Use current location</Text>
              </Pressable>
              <Pressable onPress={setPickupFromText} style={s.smallAction}>
                <Text style={s.actionText}>Set pickup</Text>
              </Pressable>
            </View>
            <View style={s.locationDivider} />
            <Text style={s.locationLabel}>DESTINATION</Text>
            <View style={s.inputRow}>
              <Icon name="map-marker-check" size={21} color={colors.brandSecondary} />
              <TextInput
                value={destinationText}
                onChangeText={(value) => { setDestinationText(value); setDestination(null); }}
                onSubmitEditing={setDestinationFromText}
                placeholder="Where would you like to go?"
                placeholderTextColor={colors.muted}
                style={s.input}
                returnKeyType="search"
              />
              {busy ? <ActivityIndicator color={colors.brandPrimary} /> : null}
            </View>
            <Pressable onPress={setDestinationFromText} style={[s.smallAction, { alignSelf: "flex-end" }]}>
              <Text style={s.actionText}>Find destination</Text>
            </Pressable>
          </View>

          <View style={s.distanceRow}>
            <Text style={s.section}>CHOOSE YOUR RIDE</Text>
            <Text style={s.subText}>{pickup && destination ? `Approx. ${km.toFixed(1)} km` : "Set both locations for fare"}</Text>
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
                {unavailable ? <Text style={s.comingSoon}>SOON</Text> : <Text style={s.fare}>{pickup && destination ? `R${estimateFare(km, option.multiplier)}` : "—"}</Text>}
                {active && !unavailable && <Icon name="check-circle" size={21} color={colors.brandPrimary} />}
              </Pressable>
            );
          })}

          <Text style={s.section}>CHOOSE PAYMENT METHOD</Text>
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
          <Text style={s.paymentNote}>Card selection is displayed, but card charging is not connected yet.</Text>

          <Pressable onPress={confirmRide} disabled={busy || selectedOption.available === false} style={[s.cta, (busy || selectedOption.available === false) && { opacity: 0.55 }]}>
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>Confirm Ride{pickup && destination ? ` · R${estimateFare(km, selectedOption.multiplier)}` : ""}</Text>}
          </Pressable>
          {!pickup || !destination ? <Text style={s.hint}>Enter or confirm your pickup and destination to calculate your fare and request a ride.</Text> : null}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  menu: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  locationBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xs },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 46 },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: spacing.xs },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: spacing.xs },
  actionText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  locationDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  section: { marginTop: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  subText: { color: colors.muted, fontSize: 12 },
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
  hint: { color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: spacing.md },
  cta: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, marginTop: spacing.md },
  ctaText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
});
