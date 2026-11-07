import React from "react";
import { View, StyleSheet } from "react-native";
import {
  MapContainer as ReactLeafletMapContainer,
  TileLayer as ReactLeafletTileLayer,
  CircleMarker as ReactLeafletCircleMarker,
  Polyline as ReactLeafletPolyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// React Leaflet's runtime components accept Leaflet option props; these casts
// isolate the third-party declaration mismatch from our application types.
const MapContainer = ReactLeafletMapContainer as React.ComponentType<any>;
const TileLayer = ReactLeafletTileLayer as React.ComponentType<any>;
const CircleMarker = ReactLeafletCircleMarker as React.ComponentType<any>;
const LeafletPolyline = ReactLeafletPolyline as React.ComponentType<any>;

type Coordinate = { latitude: number; longitude: number };

export function Marker({ coordinate, pinColor = "#F5B400" }: {
  coordinate: Coordinate; pinColor?: string;
}) {
  return (
    <CircleMarker
      center={[coordinate.latitude, coordinate.longitude]}
      radius={9}
      pathOptions={{ color: "#FFFFFF", weight: 3, fillColor: pinColor, fillOpacity: 1 }}
    />
  );
}

export function Polyline({ coordinates, strokeColor = "#F5B400", strokeWidth = 5 }: {
  coordinates: Coordinate[]; strokeColor?: string; strokeWidth?: number;
}) {
  if (!coordinates || coordinates.length < 2) return null;
  return (
    <LeafletPolyline
      positions={coordinates.map(({ latitude, longitude }) => [latitude, longitude])}
      pathOptions={{ color: strokeColor, weight: strokeWidth }}
    />
  );
}

export function MapView(props: any) {
  const region = props.region ?? {};
  const latitude = Number(region.latitude ?? -33.9249);
  const longitude = Number(region.longitude ?? 18.4241);
  const latitudeDelta = Number(region.latitudeDelta ?? 0.06);
  const longitudeDelta = Number(region.longitudeDelta ?? 0.06);
  const zoom = Math.max(3, Math.min(18, Math.log2(360 / Math.max(latitudeDelta, longitudeDelta, 0.0001))));

  return (
    <View style={[styles.container, props.style]}>
      <MapContainer center={[latitude, longitude]} zoom={zoom}
        style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {props.children}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, overflow: "hidden" } });
