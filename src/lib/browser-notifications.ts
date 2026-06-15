export function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return "unsupported";
  return window.Notification.requestPermission();
}

export function sendBrowserNotification(title: string, body: string) {
  if (!browserNotificationsSupported()) return false;
  if (window.Notification.permission !== "granted") return false;

  new window.Notification(title, {
    body,
    silent: false,
  });

  return true;
}
