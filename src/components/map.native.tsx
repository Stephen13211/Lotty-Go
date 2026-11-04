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
        paint={{
          "line-color": strokeColor,
          "line-width": strokeWidth,
          "line-opacity": 1,
          "line-cap": "round",
          "line-join": "round",
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

  // Remount Camera when the selected route changes so the map recentres and
  // fits the route bounds calculated by the rider screen.
  const cameraKey = [latitude, longitude, latitudeDelta, longitudeDelta]
    .map((value) => value.toFixed(5))
    .join(":");

  return (
    <View style={[styles.container, props.style]}>
      <Map
        mapStyle={MAP_STYLE}
        style={StyleSheet.absoluteFillObject}
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
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  markerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
});
