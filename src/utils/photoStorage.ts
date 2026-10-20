/**
 * Utility for safely saving captured food photos to the user's device
 * and persisting draft images across app closes/reloads.
 */

const DB_NAME = 'ais_fitness_food_photos_db';
const DB_VERSION = 1;
const STORE_NAME = 'food_photo_drafts';
const DRAFT_KEY = 'active_food_draft';
const LOCAL_STORAGE_FALLBACK_KEY = 'ais_draft_food_photos_fallback';
const AUTO_SAVE_PREF_KEY = 'ais_auto_save_food_photos';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Downloads / saves a food photo directly to the user's device (e.g. Downloads or Camera roll).
 */
export async function saveImageToDevice(
  dataUrlOrFile: string | File | Blob,
  customFilename?: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = customFilename || `food-photo-${nowStr}.jpg`;

  try {
    let blob: Blob;
    if (typeof dataUrlOrFile === 'string') {
      const parts = dataUrlOrFile.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else {
      blob = dataUrlOrFile;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
    return true;
  } catch (err) {
    console.warn('Failed to save photo to device:', err);
    return false;
  }
}

/**
 * Saves all images in an array to the device one by one.
 */
export async function saveAllImagesToDevice(images: string[]): Promise<number> {
  let savedCount = 0;
  for (let i = 0; i < images.length; i++) {
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `food-photo-${nowStr}-${i + 1}.jpg`;
    const ok = await saveImageToDevice(images[i], filename);
    if (ok) savedCount++;
    // Small delay between programmatic downloads to prevent browser throttling
    if (images.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return savedCount;
}

/**
 * Persists food draft images and description hint so they are never lost if the app closes or reloads.
 */
export async function persistFoodPhotoDraft(images: string[], hint = ''): Promise<void> {
  if (typeof window === 'undefined') return;

  const draftData = {
    id: DRAFT_KEY,
    images,
    hint,
    updatedAt: Date.now(),
  };

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draftData);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage if IndexedDB is blocked or disabled
    try {
      if (images.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(draftData));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
      }
    } catch (e) {
      console.warn('Could not store fallback draft:', e);
    }
  }
}

/**
 * Loads any unsaved food photo draft from previous sessions.
 */
export async function loadFoodPhotoDraft(): Promise<{ images: string[]; hint: string; updatedAt: number } | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.images) && req.result.images.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.images) && parsed.images.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Clears the saved food photo draft once the meal has been logged or explicitly cleared.
 */
export async function clearFoodPhotoDraft(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
  } catch {
    // ignore
  }
}

/**
 * Preference for auto-saving photos to device upon capture.
 */
export function getAutoSavePhotosPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(AUTO_SAVE_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoSavePhotosPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTO_SAVE_PREF_KEY, String(enabled));
  } catch {
    // ignore
  }
}
