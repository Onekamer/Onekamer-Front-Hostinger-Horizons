// src/lib/push/iosPush.js
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://onekamer-server.onrender.com";

// ✅ garde-fou global (singleton)
let listenersRegistered = false;

export async function iosPush(userId) {
  // ✅ empêche l’enregistrement multiple des listeners
  if (listenersRegistered) return;
  listenersRegistered = true;

  if (!Capacitor.isNativePlatform()) return;
  if (!userId) return;
  if (Capacitor.getPlatform() !== "ios") return;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    try {
      await fetch(`${API_BASE}/push/register-device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          device_token: token.value,
          platform: "ios",
        }),
      });
      console.log("[iOS Push] token enregistré");
    } catch (e) {
      console.error("[iOS Push] erreur register-device", e);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[iOS Push] registration error", err);
  });
}
