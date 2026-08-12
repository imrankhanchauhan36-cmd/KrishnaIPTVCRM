import { registerMyPushToken } from '../services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const STORAGE_KEY = 'krishna_customer_push_token';

// Web Push requires the VAPID public key as a Uint8Array, but browsers hand
// it to you (and expect it back) as URL-safe base64 — this is the standard
// conversion, copied verbatim from the Push API spec's own example.
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Full flow: register the SW (if not already), request permission, create
// a PushSubscription, and register it with the backend against whichever
// customer identity the stored session belongs to (never sent explicitly
// by this module — the backend derives it from the Authorization header).
// Returns true on success, false otherwise — never throws, matching the
// Owner App's registerForPushNotifications convention (a push failure must
// never block the rest of the app).
export const registerForPushNotifications = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const previousRaw = localStorage.getItem(STORAGE_KEY);

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const tokenValue = JSON.stringify(subscription.toJSON());
    await registerMyPushToken(tokenValue, 'web', previousRaw || undefined);
    localStorage.setItem(STORAGE_KEY, tokenValue);
    return true;
  } catch (error) {
    console.warn('[Push] Registration failed:', error);
    return false;
  }
};

export const getPushPermissionState = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

// Read-only check for "did this device successfully complete registration
// before" — used only for display (e.g. the device-info section). Does not
// touch the registration/subscription flow above in any way.
export const isPushRegisteredLocally = (): boolean => {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
};
