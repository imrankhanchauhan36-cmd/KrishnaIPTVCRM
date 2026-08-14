import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Without this, expo-updates only checks + downloads a new OTA update on
// launch, then applies it on the NEXT cold start after that (see the
// library's own reloadAsync() docs) — so a published update stays
// invisible until the app is fully closed and reopened twice. Fetching and
// reloading immediately here means one relaunch is enough. isEnabled is
// false in Expo Go / dev builds, and any check/fetch failure (offline,
// etc.) is swallowed — an update check must never block or crash the app.
const checkForUpdate = async () => {
  if (!Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Silent — a failed update check must never break the running app.
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    checkForUpdate();
  }, []);

  // Only one notification type currently reaches a staff recipient
  // (STAFF_TEST_NOTIFICATION — see backend audit), and it carries no
  // customer/subscription/payment reference to deep-link to, so "open the
  // Notification Center" is the correct destination for every tap right
  // now rather than a per-type routing table that doesn't have real data
  // to route with yet. Covers all three tap paths: foreground, background
  // (app alive, resumed via the tap), and cold start (app was killed).
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notification-center');
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) router.push('/notification-center');
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="notification-center" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
