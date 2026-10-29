import Icon from "@react-native-vector-icons/material-design-icons";
import { Tabs } from "expo-router";
import { colors } from "@/src/theme";

export default function RiderLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brandPrimary, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: "Ride", tabBarIcon: ({color,size}) => <Icon name="map-marker-radius" color={color} size={size} /> }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: ({color,size}) => <Icon name="history" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({color,size}) => <Icon name="account-circle-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}

