/** Whether this browser exposes the Notification API at all. */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Current permission state, with an extra 'unsupported' case for browsers without the API. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/** Asks for notification permission if it hasn't been decided, and resolves to whether we ended up with it. A previous denial is respected without re-prompting. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Shows a desktop notification, focusing the app when it's clicked. Silently does nothing unless permission has already been granted. */
export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'focusos-session',
      requireInteraction: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers block the constructor outside a service worker; ignore.
  }
}
