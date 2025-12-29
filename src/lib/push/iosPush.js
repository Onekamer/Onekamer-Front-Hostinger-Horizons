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

        const tokenValue = token?.value;
        if (!uid) {
          console.warn("[iOS Push] no uid at registration time");
          return;
        }
        if (!tokenValue) {
          console.warn("[iOS Push] no token.value at registration time");
          return;
        }

        console.log("[iOS Push] token.value (prefix) =", tokenValue.slice(0, 16) + "...");
        
        console.log("[iOS Push] API_BASE =", API_BASE);
        console.log("[iOS Push] register-device url =", `${API_BASE}/push/register-device`);

        const res = await fetch(`${API_BASE}/push/register-device`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: uid,
            device_token: tokenValue,
            platform: "ios",
            apns_environment: "sandbox",
            device_id: "ios-real-device",
          }),
        });

        console.log("[iOS Push] X-Push-Version =", res.headers.get("X-Push-Version"));
        console.log("[iOS Push] X-Push-File =", res.headers.get("X-Push-File"));

        const text = await res.text();
        console.log("[iOS Push] register-device status:", res.status);
        console.log("[iOS Push] register-device body:", text);
      } catch (e) {
        console.error("[iOS Push] erreur register-device", e);
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
