import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ActiveRideScreen from "@/src/components/ActiveRideScreen";
import RideMatchingScreen from "@/src/components/RideMatchingScreen";
import { MapView, Marker, Polyline } from "@/src/components/map";
import { useAuth } from "@/src/lib/auth";
import { advanceRideDispatch, createRide, estimateFare, getNearbyOnlineDrivers, haversineKm, RIDE_OPTIONS, type PaymentMethod, type RideType } from "@/src/lib/rides";
import { getActiveRide, getRequestedRide } from "@/src/lib/activeRide";
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
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    const query = value.trim();
    // Do not search again after a result has been selected. This prevents
    // the second popup of businesses appearing after the first selection.
    if (query.length < 3 || query === selectedLabel) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Mapbox address search, restricted to South Africa.
        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        if (!token) throw new Error("Mapbox token is missing");

        const url =
                    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
                    encodeURIComponent(query) +
                    ".json?access_token=" + encodeURIComponent(token) +
                    "&country=za&language=en&limit=5" +
                    "&types=address,poi,place,locality,neighborhood,postcode";

                    const response = await fetch(url);
        if (!response.ok) throw new Error("Mapbox address search unavailable");

        const json = await response.json();
        if (!active) return;

        const places: Place[] = (json.features ?? [])
          .map((item: any) => ({
            label: item.place_name || item.text,
            coords: {
              longitude: Number(item.center?.[0]),
              latitude: Number(item.center?.[1]),
            },
          }))
          .filter((place: Place) =>
            place.label &&
            Number.isFinite(place.coords.latitude) &&
            Number.isFinite(place.coords.longitude)
          );

        setSuggestions(places);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 900);
    return () => { active = false; clearTimeout(timer); };
  }, [value, selectedLabel]);

  return (
    <View style={s.placeWrap}>
      <Text style={s.locationLabel}>{label}</Text>
      <View style={s.inputRow}>
        <Icon name={icon as any} size={21} color={colors.brandPrimary} />
        <TextInput value={value} onChangeText={(text) => { setSelectedLabel(""); onChangeText(text); }} onSubmitEditing={onSubmit}
          placeholder={placeholder} placeholderTextColor={colors.muted}
          style={s.input} returnKeyType="search" autoCorrect={false} />
        {loading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        {rightAction}
      </View>
      {suggestions.length > 0 && (
        <View style={s.suggestions}>
          {suggestions.map((item, index) => (
            <Pressable key={item.label + index} onPress={() => { setSelectedLabel(item.label); onSelect(item); setSuggestions([]); }}
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
  const snaps = useMemo(() => ["48%", "76%"], []);
  const { session, configured } = useAuth();
  const queryClient = useQueryClient();
  const { data: activeRide } = useQuery({ queryKey: ["active-ride", session?.user.id, "rider"], queryFn: () => getActiveRide(session!.user.id, "rider"), enabled: configured && !!session, refetchInterval: 2000 });
  const { data: requestedRide } = useQuery({ queryKey: ["requested-ride", session?.user.id], queryFn: () => getRequestedRide(session!.user.id), enabled: configured && !!session, refetchInterval: 2000 });
  const { data: dispatchState } = useQuery({ queryKey: ["ride-dispatch", requestedRide?.id], queryFn: () => advanceRideDispatch(requestedRide!.id), enabled: !!requestedRide, refetchInterval: requestedRide ? 1500 : false });
  const [pickupText, setPickupText] = useState("");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideType>("lotty_x");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [courierNotes, setCourierNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(true);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState<Coords[]>([]);
  const [roadRouteDistanceKm, setRoadRouteDistanceKm] = useState<number | null>(null);
  const { data: nearbyDrivers = [] } = useQuery({
    queryKey: ["nearby-drivers", pickup?.coords.latitude, pickup?.coords.longitude, selectedRide],
    queryFn: () => getNearbyOnlineDrivers(pickup!.coords, selectedRide),
    enabled: !!session && !!pickup,
    refetchInterval: 10000,
  });

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
      // Keep the input empty: GPS is selected internally, while the field stays ready for manual typing.
      setPickupText("");
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

  const routePoints = useMemo(
    () => [pickup, ...stops.filter(stop => !!stop.coords), destination].filter(Boolean) as Place[],
    [pickup, stops, destination],
  );

  useEffect(() => {
    if (routePoints.length < 2) {
      setRoadRouteCoordinates([]);
      setRoadRouteDistanceKm(null);
      return;
    }

    let cancelled = false;
    setRoadRouteDistanceKm(null);
    const coordinates = routePoints
      .map(point => `${point.coords.longitude},${point.coords.latitude}`)
      .join(";");

    // OSRM returns the road-following route geometry instead of drawing a
    // straight line between pickup and destination pins.
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`)
      .then(response => {
        if (!response.ok) throw new Error("Route service unavailable");
        return response.json();
      })
      .then(result => {
        const routeCoordinates = result?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(routeCoordinates) && routeCoordinates.length > 1) {
          setRoadRouteCoordinates(
            routeCoordinates.map(([longitude, latitude]: [number, number]) => ({
              latitude,
              longitude,
            })),
          );
          setRoadRouteDistanceKm(Number(result.routes[0].distance) / 1000);
        } else if (!cancelled) {
          setRoadRouteCoordinates(routePoints.map(point => point.coords));
          setRoadRouteDistanceKm(
            routePoints.slice(1).reduce((total, point, index) =>
              total + haversineKm(routePoints[index].coords, point.coords), 0),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoadRouteCoordinates(routePoints.map(point => point.coords));
          setRoadRouteDistanceKm(
            routePoints.slice(1).reduce((total, point, index) =>
              total + haversineKm(routePoints[index].coords, point.coords), 0),
          );
        }
      });

    return () => { cancelled = true; };
  }, [routePoints]);

  const straightLineKm = routePoints.length > 1 ? routePoints.slice(1).reduce((total, point, index) => total + haversineKm(routePoints[index].coords, point.coords), 0) : 0;
  const km = roadRouteDistanceKm ?? straightLineKm;
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
      const created = await createRide({
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
        service_notes: selectedRide === "courier_motorcycle" ? courierNotes.trim() : null,
        fare: estimateFare(km, selectedOption.multiplier),
        distance_km: Number(km.toFixed(2)),
      });

      // Put the newly-created request into the matching screen immediately.
      // This prevents a second tap creating a duplicate while polling catches up.
      queryClient.setQueryData(["requested-ride", session.user.id], created);
      queryClient.invalidateQueries({ queryKey: ["active-ride", session.user.id, "rider"] });

      // Ride creation is already successful at this point. A temporary dispatch
      // error must not tell the rider the request failed or invite a duplicate.
      try {
        await advanceRideDispatch(created.id);
      } catch (dispatchError: any) {
        console.warn("Initial ride dispatch failed; matching screen will retry:", dispatchError);
        Alert.alert("Ride requested", "Your request has been saved. Lotty Go is still checking for an eligible nearby driver.");
        return;
      }
      Alert.alert("Ride requested", "Lotty Go is now offering your request to nearby eligible drivers.");
    } catch (error: any) {
      Alert.alert("Request failed", error?.message ?? "Please try again.");
    } finally { setBusy(false); }
  };

  const mapCenter = pickup?.coords ?? FALLBACK;
  const mapLine = roadRouteCoordinates.length > 1 ? roadRouteCoordinates : routePoints.map(point => point.coords);
  if (activeRide) return <ActiveRideScreen ride={activeRide} role="rider" />;
  if (requestedRide) return <RideMatchingScreen ride={requestedRide} dispatchStatus={dispatchState?.dispatch_status} nearbyDrivers={nearbyDrivers} />;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill}
        region={{
          latitude: destination && pickup ? (Math.min(...mapLine.map(p => p.latitude)) + Math.max(...mapLine.map(p => p.latitude))) / 2 : mapCenter.latitude,
          longitude: destination && pickup ? (Math.min(...mapLine.map(p => p.longitude)) + Math.max(...mapLine.map(p => p.longitude))) / 2 : mapCenter.longitude,
          latitudeDelta: destination && pickup ? Math.max(0.035, (Math.max(...mapLine.map(p => p.latitude)) - Math.min(...mapLine.map(p => p.latitude))) * 1.8) : 0.06,
          longitudeDelta: destination && pickup ? Math.max(0.035, (Math.max(...mapLine.map(p => p.longitude)) - Math.min(...mapLine.map(p => p.longitude))) * 1.8) : 0.06,
        }} showsUserLocation>
        {nearbyDrivers.map((driver, index) => <Marker key={`nearby-driver-${index}`} coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}>
          <View style={s.nearbyCar}><Icon name={driver.vehicle_type === "motorcycle" ? "motorbike" : "car-side"} size={19} color="#FFFFFF" /></View>
        </Marker>)}
        {pickup && <Marker coordinate={pickup.coords} />}
        {stops.map((stop, i) => stop.coords && <Marker key={stop.id} coordinate={stop.coords} pinColor="#E5A000" />)}
        {destination && <Marker coordinate={destination.coords} pinColor={colors.brandSecondary} />}
        {mapLine.length > 1 && <Polyline coordinates={mapLine} strokeColor={colors.brandPrimary} strokeWidth={4} />}
      </MapView>

      <View style={[s.menu, { top: insets.top + spacing.md }]}>
        <Icon name="menu" size={22} color={colors.onSurface} />
      </View>

      <BottomSheet ref={sheetRef} index={0} snapPoints={snaps} enableDynamicSizing={false}
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
            <View style={s.actionRow}>
              <View style={s.addStopsLabel}><Icon name="map-marker-plus-outline" size={16} color={colors.brandPrimary} /><Text style={s.locationLabel}>ADD STOPS · UP TO 2</Text></View>
              <Pressable disabled={stops.length >= 2} onPress={() => setStops(old => old.length >= 2 ? old : [...old, { id: String(Date.now()), label: "", coords: null as any }])} style={[s.addStopButton, stops.length >= 2 && { opacity: 0.4 }]}>
                <Icon name="plus" size={15} color={colors.brandPrimary} /><Text style={s.addStopText}>Add stop</Text>
              </Pressable>
            </View>
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
            <View style={s.locationDivider} />
            <PlaceInput label="DESTINATION" value={destinationText} placeholder="Where would you like to go?"
              icon="map-marker-check" onChangeText={value => { setDestinationText(value); setDestination(null); }}
              onSelect={selectDestination} />
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
              <LinearGradient colors={active ? ["#F9E27D", "#C9992B"] : ["#29251B", "#171719"]} style={s.rideIcon}><Icon name={option.icon as any} size={25} color={active ? "#17130A" : colors.goldLight} /></LinearGradient>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.rideName}>{option.name}</Text>
                <Text style={s.subText}>{option.type === "courier_motorcycle" ? "Motorcycle parcel delivery" : `${option.seats} passengers`}{unavailable ? " · Coming soon" : " · Available"}</Text>
              </View>
              {unavailable ? <Text style={s.comingSoon}>SOON</Text> : <Text style={s.fare}>{routePoints.length > 1 ? `R${estimateFare(km, option.multiplier)}` : "—"}</Text>}
              {active && !unavailable && <Icon name="check-circle" size={21} color={colors.brandPrimary} />}
            </Pressable>;
          })}

          {selectedRide === "courier_motorcycle" ? <View style={{ gap: spacing.xs }}><Text style={s.section}>DELIVERY INSTRUCTIONS</Text><TextInput value={courierNotes} onChangeText={setCourierNotes} placeholder="Describe the parcel and any pickup or drop-off instructions" placeholderTextColor={colors.muted} multiline style={s.courierInput} /></View> : null}
          <Text style={s.section}>CHOOSE PAYMENT METHOD</Text>
          <View style={s.paymentRow}>
            <Pressable onPress={() => setPayment("cash")} style={[s.paymentOption, payment === "cash" && s.paymentActive]}>
              <Icon name="cash" size={22} color={colors.onSurface} /><Text style={s.paymentText}>Cash</Text>
              {payment === "cash" ? <Icon name="check-circle" size={18} color={colors.brandPrimary} /> : null}
            </Pressable>
            <Pressable onPress={() => setPayment("card")} style={[s.paymentOption, payment === "card" && s.paymentActive]}>
              <Icon name="credit-card-outline" size={22} color={colors.onSurface} /><Text style={s.paymentText}>Card</Text>
              {payment === "card" ? <Icon name="check-circle" size={18} color={colors.brandPrimary} /> : null}
            </Pressable>
          </View>
          <Text style={s.paymentNote}>{payment === "card" ? "Card payment is collected securely after the trip, once the final fare and any waiting fee are known. Only drivers with verified Paystack bank accounts can accept card rides." : "Cash rides are paid directly to the driver. Lotty Go does not take a commission from cash fares."}</Text>
          <Pressable onPress={confirmRide} disabled={busy || !!requestedRide || selectedOption.available === false}
            style={({ pressed }) => [s.ctaShell, (busy || selectedOption.available === false) && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.985 }] }]}>
            <LinearGradient colors={["#F9E27D", "#D4AF37", "#A77C20"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Text style={s.ctaText}>Confirm ride</Text><Text style={s.ctaFare}>{routePoints.length > 1 ? "R" + estimateFare(km, selectedOption.multiplier) : "Continue"}</Text></>}
            </LinearGradient>
          </Pressable>
          <Text style={s.hint}>Choose a pickup and destination from the suggestions. Add up to two stops between pickup and destination.</Text>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  nearbyCar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 25, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.5 },
  locationBox: { backgroundColor: "#141416", borderRadius: 18, borderWidth: 1, borderColor: "#39301B", paddingHorizontal: spacing.md, paddingVertical: 8, marginTop: spacing.xs, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  placeWrap: { position: "relative" },
  locationLabel: { color: "#B9B3A4", fontSize: 9, fontWeight: "900", letterSpacing: 1.15, marginTop: 1 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 38 },
  input: { flex: 1, fontSize: 13, color: colors.onSurface, paddingVertical: 5 },
  suggestions: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm, elevation: 5, zIndex: 30 },
  suggestionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionText: { flex: 1, color: colors.onSurface, fontSize: 13 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: spacing.xs },
  actionText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  selectedText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700", paddingVertical: spacing.xs },
  locationDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  addStopsLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  addStopButton: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: "#705B25", backgroundColor: "#211C10", paddingHorizontal: 11, paddingVertical: 6 },
  addStopText: { color: colors.goldLight, fontSize: 11, fontWeight: "800" },
  removeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  stopWrap: { marginTop: spacing.sm },
  section: { marginTop: spacing.md, color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  subText: { color: colors.muted, fontSize: 12 },
  distanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rideOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginTop: spacing.xs },
  rideOptionActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  rideIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#55451E" },
  rideName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  fare: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  comingSoon: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  courierInput: { minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, color: colors.onSurface, padding: spacing.md, textAlignVertical: "top" },
  paymentRow: { flexDirection: "row", gap: spacing.sm },
  paymentOption: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.sm },
  paymentActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  paymentText: { color: colors.onSurface, fontWeight: "700" },
  paymentNote: { color: colors.muted, fontSize: 10 },
  hint: { color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: spacing.md },
  ctaShell: { marginTop: spacing.md, borderRadius: radius.pill, overflow: "hidden", shadowColor: colors.brandPrimary, shadowOpacity: 0.28, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  cta: { minHeight: 54, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  ctaText: { color: "#17130A", fontSize: 15, fontWeight: "900", letterSpacing: 0.4 },
  ctaFare: { color: "#17130A", fontSize: 15, fontWeight: "900" },
});
