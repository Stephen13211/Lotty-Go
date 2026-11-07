import React from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline as LeafletPolyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function Marker({ coordinate, pinColor = "#F5B400" }: { coordinate: Coordinate; pinColor?: string }) {
  return (
    <CircleMarker
      center={[coordinate.latitude, coordinate.longitude]}
      radius={9}
      pathOptions={{ color: "#FFFFFF", weight: 3, fillColor: pinColor, fillOpacity: 1 }}
    />
  );
}

export function Polyline({ coordinates, strokeColor = "#F5B400", strokeWidth = 5 }: { coordinates: Coordinate[]; strokeColor?: string; strokeWidth?: number }) {
  if (!coordinates || coordinates.length < 2) return null;
  return (
    <LeafletPolyline
      positions={coordinates.map(point => [point.latitude, point.longitude])}
      pathOptions={{ color: strokeColor, weight: strokeWidth }}
    />
  );
}

export default function WebMap(props: any) {
  return (
    <MapContainer
      center={[-33.9249, 18.4241]}
      zoom={13}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {props.children}
    </MapContainer>
  );
}
