import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { colors } from "@/src/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/src/lib/auth";

const qc = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: true, headerTintColor: colors.brandPrimary, headerTitleStyle: { color: colors.onSurface, fontWeight: "800" }, headerStyle: { backgroundColor: colors.surface }, headerBackTitle: "Back", headerShadowVisible: false }}>
              <Stack.Screen name="(rider)" options={{ headerShown: false }} />
              <Stack.Screen name="(driver)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

