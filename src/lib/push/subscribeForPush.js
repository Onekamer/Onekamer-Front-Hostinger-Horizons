// Abonnement Web Push (PROD)
// - Utilise VITE_VAPID_PUBLIC_KEY et VITE_API_URL
// - Enregistre/MAJ la subscription côté serveur via /api/push/subscribe

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default async function subscribeForPush(userId) {
  try {
    const provider = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';
    if (provider !== 'supabase_light') return { ignored: true };

    if (!('serviceWorker' in navigator)) return { error: 'SW not supported' };
    const reg = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { error: 'permission_denied' };
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return { error: 'missing_vapid_public_key' };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const payload = {
      userId,
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh')))) : null,
        auth: sub.getKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth')))) : null,
      },
    };

    const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    if (!API) return { error: 'missing_api_url' };

    const res = await fetch(`${API}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { error: `subscribe_failed_${res.status}`, details: txt };
    }

    return await res.json();
  } catch (e) {
    return { error: e?.message || 'unknown_error' };
  }
}
