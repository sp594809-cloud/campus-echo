import { authConfigured } from '@/lib/auth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Register the service worker and subscribe for Web Push (closed-app alerts). */
export async function enablePushNotifications(getToken: () => Promise<string | null>) {
  if (!authConfigured || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false as const, reason: 'unsupported' };
  }
  try {
    const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) return { ok: false as const, reason: 'not-configured' };
    const { publicKey } = (await keyRes.json()) as { publicKey: string };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false as const, reason: 'denied' };

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON();
    const token = await getToken();
    if (!token || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false as const, reason: 'incomplete' };
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });
    if (!res.ok) return { ok: false as const, reason: 'server' };
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'error' };
  }
}
