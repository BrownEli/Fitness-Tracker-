// Helper utility for managing web notifications across desktop & mobile (Android Chrome)

export async function registerNotificationServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.warn('ServiceWorker registration failed:', err);
    }
  }
  return null;
}

export async function sendWebNotification(
  title: string,
  options: NotificationOptions,
  onClick?: () => void
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: 'Web Notifications are not supported in this browser.' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: 'Notification permission is not granted.' };
  }

  // 1. Try Service Worker Notification (Required for Android Chrome & mobile browsers)
  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      if (reg) {
        // Wait briefly for service worker to activate if installing
        if (reg.installing || reg.waiting) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        await reg.showNotification(title, options);
        return { success: true };
      }
    } catch (swErr: any) {
      console.warn('ServiceWorker notification attempt failed, trying standard constructor fallback...', swErr);
    }
  }

  // 2. Fallback to standard Notification constructor (Desktop browsers)
  try {
    const notif = new Notification(title, options);
    if (onClick) {
      notif.onclick = onClick;
    }
    return { success: true };
  } catch (err: any) {
    console.error('Notification constructor error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to trigger notification on this device.'
    };
  }
}
