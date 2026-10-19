// Device reminders use the Notifications API, not the Push API: there is no
// server to wake a closed app, so the reminder is raised while the app itself
// opens the prompt and then stays in the notification shade to be acted on
// later. Showing it through the worker registration is the deliberate part —
// only those notifications deliver their click event to the service worker,
// which is what lets a tap focus an open window or launch the app.

const supported = () => typeof window !== "undefined" && "Notification" in window;

export const notificationsSupported = supported;

export const notificationPermission = () => (supported() ? Notification.permission : "unsupported");

export async function requestNotificationPermission() {
  if (!supported() || Notification.permission !== "default") return Notification.permission;
  try {
    // The value is re-read instead of trusted from the result: Safari's older
    // callback form resolves differently across versions.
    await Notification.requestPermission();
  } catch {
    /* nothing to do — the permission below is the truth */
  }
  return Notification.permission;
}

// `tag` keeps one reminder per period: showing it again replaces the old card
// in the shade instead of stacking a list of the same nudge.
export async function showDeviceNotification({ title, body, tag, url = "/" }) {
  if (!supported() || Notification.permission !== "granted") return false;
  const options = {
    body,
    tag,
    icon: "/img/icon-192.png",
    badge: "/img/icon-192.png",
    data: { url },
    renotify: true,
  };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
