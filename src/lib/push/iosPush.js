// src/lib/push/iosPush.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://onekamer-server.onrender.com";

let listenersRegistered = false;
let currentUserId = null;

export async function iosPush(userId) {
  currentUserId = userId;

  const Capacitor = typeof window !== "undefined" ? window.Capacitor : null;
  const PushNotifications = Capacitor?.Plugins?.PushNotifications;

  if (!Capacitor) return;
  if (!PushNotifications) return;
  if (!Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return;
  if (!currentUserId) return;
  if (typeof Capacitor.getPlatform !== "function") return;
  if (Capacitor.getPlatform() !== "ios") return;

  console.log("[iOS Push] iosPush() start, uid=", currentUserId);

  if (!listenersRegistered) {
    listenersRegistered = true;

    PushNotifications.addListener("registration", async (token) => {
      try {
        const uid = currentUserId;

        console.log("[iOS Push] ✅ registration event fired, token=", token);
        console.log("[iOS Push] token typeof =", typeof token);
        console.log("[iOS Push] token keys =", token ? Object.keys(token) : null);
        console.log("[iOS Push] token raw =", token);
        console.log("[iOS Push] token.value typeof =", typeof token?.value);

        const tokenValue = token?.value;
        if (!uid) {
          console.warn("[iOS Push] no uid at registration time");
          return;
        }
        if (!tokenValue) {
          console.warn("[iOS Push] no token.value at registration time");
          return;
        }

        console.log("[iOS Push] token.value (prefix) =", String(tokenValue).slice(0, 16) + "...");
        
        console.log("[iOS Push] API_BASE =", API_BASE);
    
        const payload = {
          user_id: uid,
          device_token: String(tokenValue),
          platform: "ios",
          apns_environment: "sandbox",
          device_id: "ios-real-device",
          provider: "apns",
        };

console.log("🧪 [iOS Push] PAYLOAD SENT TO SERVER =", JSON.stringify(payload, null, 2));
console.log("🧪 [iOS Push] PAYLOAD KEYS =", Object.keys(payload));

       const endpoint = `${API_BASE}/api/push/register-device?cb=${Date.now()}`;
console.log("[iOS Push] endpoint =", endpoint);

console.log("[iOS Push] FINAL URL =", endpoint);

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
  },
  cache: "no-store",
  body: JSON.stringify(payload),
});

console.log("[iOS Push] res.url =", res.url);
console.log("[iOS Push] X-Push-Version =", res.headers.get("X-Push-Version"));
console.log("[iOS Push] X-Push-File =", res.headers.get("X-Push-File"));

const text = await res.text();
console.log("[iOS Push] register-device status:", res.status);
console.log("[iOS Push] register-device body:", text);
      } catch (e) {
        console.error("[iOS Push] erreur register-device", e);
        console.error("[iOS Push] erreur register-device message =", e?.message);
        console.error("[iOS Push] erreur register-device stack =", e?.stack);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[iOS Push] ❌ registrationError event", err);
    });

    // Bonus debug (optionnel)
    PushNotifications.addListener("pushNotificationReceived", (notif) => {
      console.log("[iOS Push] pushNotificationReceived", notif);
    });
  }

  const perm = await PushNotifications.requestPermissions();
  console.log("[iOS Push] permission result:", perm);

  if (perm.receive !== "granted") {
    console.warn("[iOS Push] permission not granted");
    return;
  }

  console.log("[iOS Push] calling register()");
  await PushNotifications.register();
  console.log("[iOS Push] register() called");
}
