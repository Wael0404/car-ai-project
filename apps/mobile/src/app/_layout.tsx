import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Txt } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { font, useColorMode, useTheme } from "@/lib/theme";

function AppStack() {
  const t = useTheme();
  const mode = useColorMode();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
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
        <Stack.Screen name="settings" options={{ title: "Paramètres" }} />
        <Stack.Screen
          name="add-vehicle"
          options={{
            title: "Ajouter une voiture",
            presentation: "modal",
            // A modal needs a visible way out on iOS.
            headerLeft: () => (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
                <Txt tone="primary" variant="bodyStrong">
                  Annuler
                </Txt>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="vehicle/[id]" options={{ title: "" }} />
        <Stack.Screen name="maintenance/[vehicleId]/[itemId]" options={{ title: "Prix et garages" }} />
      </Stack>
    </>
  );
}

function Root() {
  const t = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // Wait for the font (bundled, a few ms) to avoid a flash of the system font.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return <AppStack />;
}

export default function RootLayout() {
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

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
