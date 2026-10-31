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
type Place = { label: string; coords: Coords };
type Stop = Place & { id: string };
const FALLBACK: Coords = { latitude: -33.9249, longitude: 18.4241 };

function PlaceInput({ label, value, placeholder, icon, onChangeText, onSelect, rightAction, onSubmit }: {
  label: string; value: string; placeholder: string; icon: string;
  onChangeText: (value: string) => void; onSelect: (place: Place) => void;
  rightAction?: React.ReactNode; onSubmit?: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) { setSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = "https://photon.komoot.io/api/?q=" + encodeURIComponent(query) + "&limit=6";
        const response = await fetch(url);
        const json = await response.json();
        if (!active) return;
        const places: Place[] = (json.features ?? []).map((feature: any) => {
          const p = feature.properties ?? {};
          const label = [p.name, p.street, p.suburb, p.city || p.town || p.village, p.state].filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ");
          return { label: label || query, coords: { longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] } };
        });
        setSuggestions(places);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [value]);

  return (
    <View style={s.placeWrap}>
      <Text style={s.locationLabel}>{label}</Text>
      <View style={s.inputRow}>
        <Icon name={icon as any} size={21} color={colors.brandPrimary} />
        <TextInput value={value} onChangeText={onChangeText} onSubmitEditing={onSubmit}
          placeholder={placeholder} placeholderTextColor={colors.muted}
          style={s.input} returnKeyType="search" autoCorrect={false} />
        {loading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        {rightAction}
      </View>
      {suggestions.length > 0 && (
        <View style={s.suggestions}>
          {suggestions.map((item, index) => (
            <Pressable key={item.label + index} onPress={() => { onSelect(item); setSuggestions([]); }}
              style={s.suggestionRow}>
              <Icon name="map-marker-outline" size={19} color={colors.muted} />
              <Text style={s.suggestionText} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function RiderHome() {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const snaps = useMemo(() => ["62%", "90%"], []);
  const { session, configured } = useAuth();
  const [pickupText, setPickupText] = useState("Finding your current location…");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideType>("lotty_x");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(true);

  const useCurrentLocation = async () => {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Allow Lotty Go to use your location, or type your pickup address.");
        setPickupText("");
        setPickup(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      let label = "Current location";
      try {
        const addresses = await Location.reverseGeocodeAsync(coords);
        const a = addresses[0];
        if (a) label = [a.name, a.street, a.subregion, a.city].filter(Boolean).join(", ") || label;
      } catch {}
      setPickup({ label, coords });
      setPickupText(label);
    } catch {
      Alert.alert("Could not get location", "Type your pickup address or try current location again.");
      setPickupText("");
      setPickup(null);
    } finally { setLocationBusy(false); }
  };

  useEffect(() => { useCurrentLocation(); }, []);

  const selectPickup = (place: Place) => { setPickup(place); setPickupText(place.label); };
  const selectDestination = (place: Place) => { setDestination(place); setDestinationText(place.label); };
  const selectStop = (id: string, place: Place) => setStops(old => old.map(stop => stop.id === id ? { ...stop, ...place } : stop));

  const routePoints = [pickup, ...stops.filter(stop => !!stop.coords), destination].filter(Boolean) as Place[];
  const km = routePoints.length > 1 ? routePoints.slice(1).reduce((total, point, index) => total + haversineKm(routePoints[index].coords, point.coords), 0) : 0;
  const selectedOption = RIDE_OPTIONS.find(option => option.type === selectedRide) ?? RIDE_OPTIONS[0];

  const confirmRide = async () => {
    if (!pickup || !destination || stops.some(stop => !stop.coords)) {
      Alert.alert("Complete your route", "Choose a pickup, destination and any additional stops from the suggestions.");
      return;
    }
    if (!configured || !session) {
      Alert.alert("Sign in required", "Please sign in before requesting a ride.");
      return;
    }
    if (selectedOption.available === false) {
      Alert.alert("Coming soon", "Lotty Women is not available yet.");
      return;
    }
    setBusy(true);
    try {
      await createRide({
        rider_id: session.user.id,
        pickup_address: pickup.label,
        pickup_lat: pickup.coords.latitude,
        pickup_lng: pickup.coords.longitude,
        dropoff_address: destination.label,
        dropoff_lat: destination.coords.latitude,
        dropoff_lng: destination.coords.longitude,
        stops: stops.map(stop => ({ address: stop.label, latitude: stop.coords.latitude, longitude: stop.coords.longitude })),
        ride_type: selectedRide,
        payment_method: payment,
        fare: estimateFare(km, selectedOption.multiplier),
        distance_km: Number(km.toFixed(2)),
      });
      Alert.alert("Ride requested", "Your ride request has been saved. Driver matching depends on available drivers.");
    } catch (error: any) {
      Alert.alert("Request failed", error?.message ?? "Please try again.");
    } finally { setBusy(false); }
  };

  const mapCenter = pickup?.coords ?? FALLBACK;
  const mapLine = routePoints.map(point => point.coords);
  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill}
        region={{
          latitude: destination && pickup ? (Math.min(...mapLine.map(p => p.latitude)) + Math.max(...mapLine.map(p => p.latitude))) / 2 : mapCenter.latitude,
          longitude: destination && pickup ? (Math.min(...mapLine.map(p => p.longitude)) + Math.max(...mapLine.map(p => p.longitude))) / 2 : mapCenter.longitude,
          latitudeDelta: destination && pickup ? Math.max(0.035, (Math.max(...mapLine.map(p => p.latitude)) - Math.min(...mapLine.map(p => p.latitude))) * 1.8) : 0.06,
          longitudeDelta: destination && pickup ? Math.max(0.035, (Math.max(...mapLine.map(p => p.longitude)) - Math.min(...mapLine.map(p => p.longitude))) * 1.8) : 0.06,
        }} showsUserLocation>
        {pickup && <Marker coordinate={pickup.coords} />}
        {stops.map((stop, i) => stop.coords && <Marker key={stop.id} coordinate={stop.coords} pinColor="#E5A000" />)}
        {destination && <Marker coordinate={destination.coords} pinColor={colors.brandSecondary} />}
        {mapLine.length > 1 && <Polyline coordinates={mapLine} strokeColor={colors.brandPrimary} strokeWidth={4} />}
      </MapView>

      <View style={[s.menu, { top: insets.top + spacing.md }]}>
        <Icon name="menu" size={22} color={colors.onSurface} />
      </View>

      <BottomSheet ref={sheetRef} index={1} snapPoints={snaps} enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.surface }} handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}>
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          keyboardShouldPersistTaps="always">
          <Text style={{ color: colors.muted }}>Howzit 👋</Text>
          <Text style={s.title}>Book your ride</Text>

          <View style={s.locationBox}>
            <PlaceInput label="PICKUP LOCATION" value={pickupText} placeholder="Type pickup address or use current location"
              icon="map-marker" onChangeText={value => { setPickupText(value); setPickup(null); }}
              onSelect={selectPickup} onSubmit={() => {}} />
            <View style={s.actionRow}>
              <Pressable onPress={useCurrentLocation} style={s.smallAction}>
                <Icon name="crosshairs-gps" size={16} color={colors.brandPrimary} />
                <Text style={s.actionText}>{locationBusy ? "Locating…" : "Use current location"}</Text>
              </Pressable>
              {pickup ? <Text style={s.selectedText}>Pickup selected</Text> : null}
            </View>
            <View style={s.locationDivider} />
            <PlaceInput label="DESTINATION" value={destinationText} placeholder="Where would you like to go?"
              icon="map-marker-check" onChangeText={value => { setDestinationText(value); setDestination(null); }}
              onSelect={selectDestination} rightAction={
                <Pressable onPress={() => setStops(old => [...old, { id: String(Date.now()), label: "", coords: null as any }])} style={s.plusButton}>
                  <Icon name="plus" size={22} color={colors.onBrandPrimary} />
                </Pressable>
              } />
            {stops.map((stop, index) => (
              <View key={stop.id} style={s.stopWrap}>
                <PlaceInput label={`STOP ${index + 1}`} value={stop.label} placeholder="Add another stop"
                  icon="map-marker-plus-outline" onChangeText={value => setStops(old => old.map(item => item.id === stop.id ? { ...item, label: value, coords: null as any } : item))}
                  onSelect={place => selectStop(stop.id, place)} rightAction={
                    <Pressable onPress={() => setStops(old => old.filter(item => item.id !== stop.id))} style={s.removeButton}>
                      <Icon name="close" size={20} color={colors.muted} />
                    </Pressable>
                  } />
              </View>
            ))}
            {destination ? <Text style={s.selectedText}>Destination selected · Route updates on map</Text> : null}
          </View>

          <View style={s.distanceRow}>
            <Text style={s.section}>CHOOSE YOUR RIDE</Text>
            <Text style={s.subText}>{routePoints.length > 1 ? `Approx. ${km.toFixed(1)} km` : "Select locations for fare"}</Text>
          </View>
          {RIDE_OPTIONS.map(option => {
            const active = selectedRide === option.type;
            const unavailable = option.available === false;
            return <Pressable key={option.type} disabled={unavailable} onPress={() => setSelectedRide(option.type)}
              style={[s.rideOption, active && s.rideOptionActive, unavailable && { opacity: 0.55 }]}>
              <View style={s.rideIcon}><Icon name={option.icon as any} size={27} color={colors.onSurface} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.rideName}>{option.name}</Text>
                <Text style={s.subText}>{option.seats} passengers{unavailable ? " · Coming soon" : " · Available"}</Text>
              </View>
              {unavailable ? <Text style={s.comingSoon}>SOON</Text> : <Text style={s.fare}>{routePoints.length > 1 ? `R${estimateFare(km, option.multiplier)}` : "—"}</Text>}
              {active && !unavailable && <Icon name="check-circle" size={21} color={colors.brandPrimary} />}
            </Pressable>;
          })}

          <Text style={s.section}>CHOOSE PAYMENT METHOD</Text>
          <View style={s.paymentRow}>
            <Pressable onPress={() => setPayment("cash")} style={[s.paymentOption, payment === "cash" && s.paymentActive]}>
              <Icon name="cash" size={22} color={colors.onSurface} /><Text style={s.paymentText}>Cash</Text>
              {payment === "cash" && <Icon name="check-circle" size={18} color={colors.brandPrimary} />}
            </Pressable>
            <Pressable onPress={() => setPayment("card")} style={[s.paymentOption, payment === "card" && s.paymentActive]}>
              <Icon name="credit-card-outline" size={22} color={colors.onSurface} /><Text style={s.paymentText}>Card</Text>
              {payment === "card" && <Icon name="check-circle" size={18} color={colors.brandPrimary} />}
            </Pressable>
          </View>
          <Text style={s.paymentNote}>Card selection is shown, but card charging is not connected yet.</Text>
          <Pressable onPress={confirmRide} disabled={busy || selectedOption.available === false}
            style={[s.cta, (busy || selectedOption.available === false) && { opacity: 0.55 }]}>
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={s.ctaText}>Confirm Ride{routePoints.length > 1 ? ` · R${estimateFare(km, selectedOption.multiplier)}` : ""}</Text>}
          </Pressable>
          <Text style={s.hint}>Choose a pickup and destination from the suggestions. Use the + beside destination to add stops.</Text>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  menu: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  locationBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  placeWrap: { position: "relative" },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xs },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 46 },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: spacing.xs },
  suggestions: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm, elevation: 5, zIndex: 30 },
  suggestionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionText: { flex: 1, color: colors.onSurface, fontSize: 13 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: spacing.xs },
  actionText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  selectedText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700", paddingVertical: spacing.xs },
  locationDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  plusButton: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  removeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  stopWrap: { marginTop: spacing.sm },
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
