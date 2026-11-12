import React from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker as MapMarker,
  UserLocation,
} from "@maplibre/maplibre-react-native";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type Coordinate = { latitude: number; longitude: number };

export function Marker({
  coordinate,
  pinColor = "#F5B400",
}: {
  coordinate: Coordinate;
  pinColor?: string;
}) {
  return (
    <MapMarker lngLat={[coordinate.longitude, coordinate.latitude]} anchor="bottom">
      <View style={[styles.marker, { backgroundColor: pinColor }]}>
        <View style={styles.markerCore} />
      </View>
    </MapMarker>
  );
}

export function Polyline({
  coordinates,
  strokeColor = "#F5B400",
  strokeWidth = 5,
}: {
  coordinates: Coordinate[];
  strokeColor?: string;
  strokeWidth?: number;
}) {
  if (!coordinates || coordinates.length < 2) return null;

  const data = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: coordinates.map(({ latitude, longitude }) => [
        longitude,
        latitude,
      ]),
    },
  };

  return (
    <GeoJSONSource id="lotty-go-route-source" data={data as any}>
      <Layer
        id="lotty-go-route-line"
        type="line"
        layout={{
          "line-cap": "round",
          "line-join": "round",
        }}
        paint={{
          "line-color": strokeColor,
          "line-width": strokeWidth,
          "line-opacity": 1,
        }}
      />
    </GeoJSONSource>
  );
}

export function MapView(props: any) {
  const region = props.region ?? {};
  const latitude = Number(region.latitude ?? -33.9249);
  const longitude = Number(region.longitude ?? 18.4241);
  const latitudeDelta = Number(region.latitudeDelta ?? 0.06);
  const longitudeDelta = Number(region.longitudeDelta ?? 0.06);
  const zoom = Math.max(
    3,
    Math.min(18, Math.log2(360 / Math.max(latitudeDelta, longitudeDelta, 0.0001))),
  );

  const cameraKey = [latitude, longitude, latitudeDelta, longitudeDelta]
    .map((value) => value.toFixed(5))
    .join(":");

  return (
    <View style={[styles.container, props.style]}>
      <Map
        mapStyle={MAP_STYLE}
        style={StyleSheet.absoluteFill}
        androidView="texture"
        logo={false}
        compass={false}
      >
        <Camera
          key={cameraKey}
          initialViewState={{
            center: [longitude, latitude],
            zoom,
          }}
        />
        {props.showsUserLocation ? <UserLocation animated /> : null}
        {props.children}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  marker: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#D4AF37",
    backgroundColor: "#0B0B0D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  markerCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#D4AF37",
  },
});