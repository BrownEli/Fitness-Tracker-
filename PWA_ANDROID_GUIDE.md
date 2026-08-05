# How to Make Web Apps Installable on Android (PWA Guide)

This guide explains step-by-step how to convert any web application into a Progressive Web App (PWA) that can be installed on Android devices with its own home screen icon, splash screen, and full-screen experience (no Chrome address bar/header).

---

## Key Requirements for Android Installation

To make Chrome on Android present the **"Add to Home Screen"** or **"Install App"** prompt, your app must meet 4 core criteria:

1. **Web App Manifest (`manifest.json`)**: Configures app name, icons, theme colors, and display mode.
2. **Display Mode Set to `standalone`**: Removes the browser address bar, navigation controls, and Chrome header.
3. **Service Worker (`sw.js`)**: Registers a background script for caching/offline capabilities and PWA compliance.
4. **HTTPS / Secure Context**: Android PWA installation requires the app to be served over HTTPS.

---

## 1. Create `public/manifest.json`

Place `manifest.json` in your static directory (e.g., `public/manifest.json`).

```json
{
  "short_name": "My App",
  "name": "My App - Progressive Web Application",
  "description": "Full description of your application.",
  "icons": [
    {
      "src": "/icon-192.png",
      "type": "image/png",
      "sizes": "192x192",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any maskable"
    }
  ],
  "start_url": "/",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "display": "standalone",
  "orientation": "portrait"
}
```

### Key Fields Explained:
* **`"display": "standalone"`**: **CRITICAL.** Hides the Chrome address bar and navigation controls so the app feels like a native Android app.
* **`"icons"`**: Requires at least 192x192px and 512x512px PNG icons. Setting `"purpose": "any maskable"` ensures Android shapes the icon properly (circle, squircle, or rounded rect).
* **`"theme_color"`**: Sets the color of the Android status bar at the top of the phone screen.
* **`"background_color"`**: Sets the background color of the native Android splash screen while the app boots.

---

## 2. Update `index.html` Meta Tags

In your root `index.html`, add the manifest link and mobile meta tags inside the `<head>` section:

```html
<head>
  <meta charset="UTF-8" />
  <!-- Mobile Viewport -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

  <!-- Web App Manifest -->
  <link rel="manifest" href="/manifest.json" />

  <!-- Android Theme & Chrome Colors -->
  <meta name="theme-color" content="#0f172a" />
  <meta name="mobile-web-app-capable" content="yes" />

  <!-- iOS Apple Touch Fallbacks -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="My App" />
  <link rel="apple-touch-icon" href="/icon-192.png" />

  <title>My App</title>
</head>
```

---

## 3. Create `public/sw.js` (Service Worker)

Android Chrome requires an active Service Worker script to trigger installability. Place `sw.js` in your `public/` directory:

```javascript
const CACHE_NAME = 'app-cache-v1';

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch Event (Caching strategy)
self.addEventListener('fetch', (event) => {
  // Pass-through or custom network caching
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
```

---

## 4. Register the Service Worker in Code

In your main application entry point (e.g., `src/main.tsx`, `src/index.js`, or in `index.html`), register the service worker when the page loads:

```typescript
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}
```

---

## 5. How to Test on Android

1. Host your app on an HTTPS URL (e.g., Vercel, Netlify, Cloud Run, Firebase Hosting).
2. Open **Chrome on Android** and navigate to your site URL.
3. Tap the **3-dots menu** in Chrome top right → select **"Add to Home screen"** or **"Install app"**.
4. Once installed, launch the app from your Android app drawer/home screen. It will open as a standalone window without any Chrome address bar or browser chrome!

---

## Troubleshooting Checklist

* **Still seeing the Chrome browser header?**
  * Check that `"display": "standalone"` is in your `manifest.json`.
  * Ensure `index.html` has `<meta name="mobile-web-app-capable" content="yes" />`.
* **"Install app" option greyed out or missing?**
  * Ensure your site is served over **HTTPS** (http:// will not work on non-localhost).
  * Ensure `manifest.json` is accessible via `/manifest.json` in the browser network tab.
  * Check browser DevTools -> **Application** -> **Manifest** tab for syntax errors.
