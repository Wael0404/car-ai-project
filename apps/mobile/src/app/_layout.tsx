import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { font, useTheme } from "@/lib/theme";

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Do not retry client errors (401, 404...), only network/server errors.
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );

  // Wait for the font (a few ms, bundled) to avoid a flash of the system font.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.bg },
            headerTintColor: t.text,
            headerTitleStyle: { fontFamily: font.bold, fontSize: 17 },
            headerBackButtonDisplayMode: "minimal",
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="garage" options={{ headerShown: false }} />
          <Stack.Screen name="add-vehicle" options={{ title: "Ajouter une voiture", presentation: "modal" }} />
          <Stack.Screen name="vehicle/[id]" options={{ title: "" }} />
          <Stack.Screen name="maintenance/[vehicleId]/[itemId]" options={{ title: "Prix et garages" }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
