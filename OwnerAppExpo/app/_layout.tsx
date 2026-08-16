import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  //
  // getLastNotificationResponseAsync() does NOT clear itself after being
  // read — the OS keeps returning the same last-tapped response on every
  // future cold start until a genuinely new notification is tapped. Without
  // deduping, that means the app opens straight to the Notification Center
  // forever after the first real tap, even for unrelated app launches. The
  // fix is to persist which response identifier was already handled and
  // ignore a repeat of it — the standard mitigation for this well-documented
  // expo-notifications behavior.
  useEffect(() => {
    const LAST_HANDLED_KEY = 'krishna_owner_last_handled_notification_response';

    const handleResponse = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const responseId = response.notification.request.identifier;
      const lastHandledId = await AsyncStorage.getItem(LAST_HANDLED_KEY);
      if (responseId === lastHandledId) return;
      await AsyncStorage.setItem(LAST_HANDLED_KEY, responseId);
      router.push('/notification-center');
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response);
    });

    Notifications.getLastNotificationResponseAsync().then(handleResponse);

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
