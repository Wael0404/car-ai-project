import { Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from "@expo-google-fonts/cairo";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationBar } from "expo-navigation-bar";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { RobiProvider } from "@/components/RobiToast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Txt } from "@/components/ui";
import { t as tr } from "@/i18n";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { font, useColorMode, useTheme } from "@/lib/theme";

function AppStack() {
  const t = useTheme();
  const mode = useColorMode();
  const { isRTL } = useLanguage();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {/* Android: dark buttons on the white theme even when the phone is in dark mode. */}
      <NavigationBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.bold, fontSize: 17 },
          headerTitleAlign: isRTL ? "center" : undefined,
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          animation: isRTL ? "slide_from_left" : "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="garage" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: tr("screens.settings.title" as never) }} />
        <Stack.Screen
          name="add-vehicle"
          options={{
            title: tr("screens.addVehicle.title" as never),
            presentation: "modal",
            // A modal needs a visible way out on iOS.
            headerLeft: () => (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
                <Txt tone="primary" variant="bodyStrong">
                  {tr("common.cancel")}
                </Txt>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="vehicle/[id]" options={{ title: "" }} />
        <Stack.Screen name="maintenance/[vehicleId]/[itemId]" options={{ title: tr("parts.screenTitle" as never) }} />
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
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });
  // Wait for the fonts (bundled, a few ms) to avoid a flash of the system font.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return <AppStack />;
}

/**
 * Everything that shows text: remounted when the language changes, laid
 * out right-to-left in Arabic.
 */
function LocalizedApp() {
  const { lang, isRTL } = useLanguage();
  return (
    <View key={lang} style={{ flex: 1, direction: isRTL ? "rtl" : "ltr" }}>
      <RobiProvider>
        <Root />
      </RobiProvider>
    </View>
  );
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
    <LanguageProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocalizedApp />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
