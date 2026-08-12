// Staff/Owner App device push registration. Permission request and Expo
// push token retrieval are identical to the customer push flow, so they're
// reused from pushNotifications.js rather than duplicated — only the
// registration target differs (staff-push-tokens, not push-tokens).
//
// Deliberately takes NO identity parameter: unlike registerForPushNotifications
// (customer flow, explicit customerId), this module never knows or sends a
// staffId/staffType of its own. The backend derives the calling staff
// member's identity from the already-stored session's accessToken (the same
// Authorization header every other authenticated call in this app already
// sends) — see staffPushToken.controller.js. This is intentional: it is the
// one thing this module must never guess or accept from a caller.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoPushToken } from './pushNotifications';
import { registerStaffPushToken, invalidateStaffPushToken } from '../services/api';

const STORAGE_KEY = 'staffPushToken'; // -> { tokenId, tokenValue }

// Full registration flow: permission -> token -> register with backend
// against whichever staff identity the stored accessToken belongs to.
// Returns the registered token document, or null if registration could not
// complete for any reason (never throws).
export const registerForStaffPushNotifications = async () => {
  const tokenValue = await getExpoPushToken();
  if (!tokenValue) return null;

  try {
    const previousRaw = await AsyncStorage.getItem(STORAGE_KEY);
    const previous = previousRaw ? JSON.parse(previousRaw) : null;

    const saved = await registerStaffPushToken({
      token: tokenValue,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      previousToken: previous?.tokenValue,
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tokenId: saved._id, tokenValue }));
    return saved;
  } catch (error) {
    console.warn('[StaffPushNotifications] Registration with backend failed:', error.message);
    return null;
  }
};

// Deactivates the locally-known token and clears local storage. Safe to
// call even if nothing was ever registered — e.g. wired to logout later.
export const unregisterStaffPushNotifications = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { tokenId } = JSON.parse(raw);
    if (tokenId) await invalidateStaffPushToken(tokenId);
  } catch (error) {
    console.warn('[StaffPushNotifications] Unregister failed:', error.message);
  } finally {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
};

export const isStaffPushRegistered = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return !!raw;
};
