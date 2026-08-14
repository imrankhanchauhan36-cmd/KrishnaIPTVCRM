// Push notification registration — permission request, Expo push token
// retrieval, and backend registration/unregistration. Self-contained and
// reusable; nothing in this file assumes who the resulting token belongs
// to — the caller always supplies the customerId explicitly.
//
// IMPORTANT — architecture note, not a limitation of this module:
// PushToken.customer (backend) refers to an IPTV subscriber (Customer),
// but this Owner App's own login is staff (Admin/Employee) — there is no
// "the currently logged-in person is also the customer" identity in this
// app, because it's the business owner's internal tool, not a
// subscriber-facing app. This module is therefore built to be called with
// an explicit customerId (e.g. "register the device the owner is holding
// right now on behalf of customer X"), not wired to any implicit "my own"
// customer identity — there isn't one to wire to yet.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, invalidatePushToken } from '../services/api';

const STORAGE_KEY_PREFIX = 'pushToken:'; // + customerId -> { tokenId, tokenValue }

// Foreground notification presentation — shown even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

// Returns { granted, canAskAgain } — never throws.
export const requestPushPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return { granted: true, canAskAgain: true };
  const requested = await Notifications.requestPermissionsAsync();
  return { granted: requested.status === 'granted', canAskAgain: requested.canAskAgain !== false };
};

// Obtains a real Expo push token using this project's existing EAS project
// ID (already configured in app.json — nothing invented here). Never
// throws. Returns { token, reason }: token is null on any failure, and
// reason distinguishes WHY so callers can show an accurate message instead
// of one generic "permission denied" for every possible cause — permission
// refusal, missing projectId, and getExpoPushTokenAsync() itself failing
// (e.g. native push credentials not configured for this build) are very
// different problems with very different fixes.
export const getExpoPushToken = async () => {
  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[PushNotifications] No EAS projectId resolved — check app.json extra.eas.projectId.');
    return { token: null, reason: 'missing-project-id' };
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (error) {
      console.warn('[PushNotifications] Could not create Android notification channel:', error.message);
      return { token: null, reason: 'channel-error' };
    }
  }

  const { granted } = await requestPushPermission();
  if (!granted) return { token: null, reason: 'permission-denied' };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data || null, reason: data ? null : 'token-error' };
  } catch (error) {
    // This is the failure mode when native push isn't actually configured
    // for this build (e.g. no FCM credentials) — permission was granted,
    // the channel exists, but the OS/Expo can't mint a token. Logged in
    // full here since this exact message is what tells us which of those
    // it is; the caller only gets the coarse `reason`.
    console.warn('[PushNotifications] Could not obtain a push token:', error.message);
    return { token: null, reason: 'token-error' };
  }
};

// Full registration flow: permission -> token -> register with backend.
// Stores the {tokenId, tokenValue} pair locally (per customerId) so a later
// unregister or refresh knows what to invalidate. Returns the registered
// token document, or null if registration could not complete for any
// reason (never throws — a push-registration failure must never block
// whatever screen triggered it).
export const registerForPushNotifications = async (customerId) => {
  if (!customerId) return null;

  const { token: tokenValue } = await getExpoPushToken();
  if (!tokenValue) return null;

  try {
    const previousRaw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + customerId);
    const previous = previousRaw ? JSON.parse(previousRaw) : null;

    const saved = await registerPushToken({
      customer: customerId,
      token: tokenValue,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      previousToken: previous?.tokenValue,
    });

    await AsyncStorage.setItem(
      STORAGE_KEY_PREFIX + customerId,
      JSON.stringify({ tokenId: saved._id, tokenValue })
    );
    return saved;
  } catch (error) {
    console.warn('[PushNotifications] Registration with backend failed:', error.message);
    return null;
  }
};

// Deactivates the locally-known token for this customer and clears local
// storage. Safe to call even if nothing was ever registered.
export const unregisterPushNotifications = async (customerId) => {
  if (!customerId) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + customerId);
    if (!raw) return;
    const { tokenId } = JSON.parse(raw);
    if (tokenId) await invalidatePushToken(tokenId);
  } catch (error) {
    console.warn('[PushNotifications] Unregister failed:', error.message);
  } finally {
    await AsyncStorage.removeItem(STORAGE_KEY_PREFIX + customerId);
  }
};

// Expo can reissue a token at any time (rare, but happens on some
// reinstalls/OS-level events). Call this once, e.g. near the root of the
// app, with the customerId currently associated with push registration —
// it re-registers automatically and the backend deactivates the old token
// via the previousToken field.
export const addPushTokenRefreshListener = (customerId) => {
  const subscription = Notifications.addPushTokenListener(() => {
    registerForPushNotifications(customerId).catch((error) =>
      console.warn('[PushNotifications] Token refresh re-registration failed:', error.message)
    );
  });
  return () => subscription.remove();
};
