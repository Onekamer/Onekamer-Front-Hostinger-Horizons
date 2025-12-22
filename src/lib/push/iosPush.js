// src/lib/push/iosPush.js
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://onekamer-server.onrender.com";
let listenersRegistered = false;
let currentUserId = null;

export async function iosPush(userId) {
  currentUserId = userId;

  if (!Capacitor.isNativePlatform()) return;
  if (!currentUserId) return;
  if (Capacitor.getPlatform() !== "ios") return;

  if (!listenersRegistered) {
    listenersRegistered = true;

    PushNotifications.addListener("registration", async (token) => {
      const uid = currentUserId;
      if (!uid) return;

      await fetch(`${API_BASE}/push/register-device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          device_token: token.value,
          platform: "ios",
        }),
      });
    });

    PushNotifications.addListener("registrationError", console.error);
  }

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();
}
