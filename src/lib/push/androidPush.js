// src/lib/push/androidPush.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://onekamer-server.onrender.com";

let listenersRegistered = false;
let currentUserId = null;

export async function androidPush(userId) {
  currentUserId = userId;

  const Capacitor = typeof window !== "undefined" ? window.Capacitor : null;
  const PushNotifications = Capacitor?.Plugins?.PushNotifications;

  if (!Capacitor) return;
  if (!PushNotifications) return;
  if (!Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return;
  if (!currentUserId) return;
  if (typeof Capacitor.getPlatform !== "function") return;
  if (Capacitor.getPlatform() !== "android") return;

  console.log("[Android Push] androidPush() start, uid=", currentUserId);

  if (!listenersRegistered) {
    listenersRegistered = true;

    PushNotifications.addListener("registration", async (token) => {
      try {
        const uid = currentUserId;
        const tokenValue = token?.value || token;

        console.log("[Android Push] ✅ registration event fired, token=", token);
        if (!uid) {
          console.warn("[Android Push] no uid at registration time");
          return;
        }
        if (!tokenValue) {
          console.warn("[Android Push] no token.value at registration time");
          return;
        }

        const payload = {
          user_id: uid,
          token: String(tokenValue),
          platform: "android",
          device_id: "android-real-device",
          provider: "fcm",
        };

        const endpoint = `${API_BASE}/api/push/register-device?cb=${Date.now()}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            Pragma: "no-cache",
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log("[Android Push] register-device status:", res.status);
        console.log("[Android Push] register-device body:", text);
      } catch (e) {
        console.error("[Android Push] erreur register-device", e?.message || e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[Android Push] ❌ registrationError event", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notif) => {
      console.log("[Android Push] pushNotificationReceived", notif);
      try {
        const title = notif?.title || notif?.notification?.title || "Notification";
        const body = notif?.body || notif?.notification?.body || "";
        const data = notif?.data || notif?.notification?.data || {};
        const url = (data && (data.url || data.link)) || "/";
        if (typeof window !== "undefined") {
          window.postMessage({ type: "NEW_PUSH", payload: { title, body, url, data } }, "*");
        }
      } catch (_) {}
    });
  }

  const perm = await PushNotifications.requestPermissions();
  console.log("[Android Push] permission result:", perm);
  if (perm.receive !== "granted") {
    console.warn("[Android Push] permission not granted");
    return;
  }

  console.log("[Android Push] calling register()");
  await PushNotifications.register();
  console.log("[Android Push] register() called");
}
