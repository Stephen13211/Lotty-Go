
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/src/lib/supabase";
import { listMyRides, Ride } from "@/src/lib/rides";
import { colors } from "@/src/theme";

export default function DriverTrips() {
  const insets = useSafeAreaInsets();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function getDriver() {
      const { data, error } = await supabase.auth.getSession();

      if (!error) {
        setDriverId(data.session?.user.id ?? null);
      }

      setAuthLoading(false);
    }

    getDriver();
  }, []);

  const {
    data: rides = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["driver-trips"],
    queryFn: listMyRides,
    enabled: !!driverId,
  });

  const mine = rides.filter(
    (ride: Ride) => ride.driver_id === driverId
  );

  if (authLoading || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.brandPrimary}
        />
        <Text style={styles.muted}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 20 },
      ]}
    >
      <Text style={styles.title}>My Trips</Text>
      <Text style={styles.subtitle}>
        Your driving history
      </Text>

      {!driverId ? (
        <Text style={styles.empty}>
          Please log in to view your trips.
        </Text>
      ) : error ? (
        <Text style={styles.empty}>
          Could not load your trips. Please try again.
        </Text>
      ) : (
        <FlatList
          data={mine}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              You don't have any trips yet.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.fare}>
                R{Number(item.fare).toFixed(2)}
              </Text>

              <Text style={styles.address}>
                Pickup: {item.pickup_address}
              </Text>

              <Text style={styles.address}>
                Drop-off: {item.dropoff_address}
              </Text>

              <Text style={styles.status}>
                {item.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 5,
    marginBottom: 24,
  },
  muted: {
    color: colors.muted,
    marginTop: 12,
  },
  empty: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 40,
  },
  list: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
  },
  fare: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.brandPrimary,
    marginBottom: 10,
  },
  address: {
    color: colors.text,
    marginBottom: 6,
  },
  status: {
    color: colors.brandPrimary,
    fontWeight: "bold",
    marginTop: 10,
  },
});
