
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/src/theme";

let MapReal: any = View;
let MarkerReal: any = View;
let PolylineReal: any = View;

if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
    MapReal = Maps.default;
      MarkerReal = Maps.Marker;
        PolylineReal = Maps.Polyline;
        }

        export const Marker = MarkerReal;
        export const Polyline = PolylineReal;

        export function MapView(props: any) {
          if (Platform.OS === "web") {
              const WebMap = require("./web-map").default;
                  return <WebMap {...props} />;
                    }

                      return <MapReal {...props} />;
                      }
                      
