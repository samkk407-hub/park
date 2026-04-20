import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, parking, isLoading } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "login";
    const inSetupGroup = segments[0] === "setup";

    if (!user && !inAuthGroup) {
      router.replace("/login");
      return;
    }

    if (user && !inAuthGroup) {
      const isAttendant = user.role === "attendant";
      if (!parking && !inSetupGroup) {
        if (isAttendant) {
          // Attendant should not go to setup — their parking comes from owner
          // If no parking loaded yet, stay put (data may still be loading)
          return;
        }
        router.replace("/setup");
      }
    }
  }, [user, parking, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry" options={{ presentation: "modal" }} />
      <Stack.Screen name="exit" options={{ presentation: "modal" }} />
      <Stack.Screen name="ticket" options={{ presentation: "modal" }} />
      <Stack.Screen name="entry-detail" options={{ presentation: "modal" }} />
      <Stack.Screen name="staff" options={{ presentation: "modal" }} />
      <Stack.Screen name="logs" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
