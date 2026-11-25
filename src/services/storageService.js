const PREFS_KEY = 'voicereader_preferences_v1';
const FALLBACK_DOCS_KEY = 'voicereader_documents_fallback_v1';
const DB_NAME = 'VoiceReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

export const DEFAULT_PREFERENCES = {
  theme: 'light',
  language: 'en-US',
  voiceURI: '',
  genderFilter: 'all', // 'all' | 'female' | 'male'
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  readingMode: 'continuous', // 'continuous' | 'paragraph'
  autoOcr: true,
  ocrLanguage: 'auto',
  autoDetectLanguage: true,
  ttsProvider: 'webspeech', // 'webspeech' | 'cloud-placeholder'
  highlightWord: true,
};

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors for preferences
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadFallbackDocs() {
  try {
    const raw = localStorage.getItem(FALLBACK_DOCS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackDocs(docs) {
  try {
    localStorage.setItem(FALLBACK_DOCS_KEY, JSON.stringify(docs.slice(0, 20)));
  } catch {
    // Ignore quota issues in fallback
  }
}

export async function getAllDocuments() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []).sort(
          (a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return loadFallbackDocs().sort(
      (a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)
    );
  }
}

export async function saveDocumentRecord(doc) {
  const record = {
    ...doc,
    lastOpenedAt: doc.lastOpenedAt || Date.now(),
    createdAt: doc.createdAt || Date.now(),
  };

  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const existing = loadFallbackDocs().filter((d) => d.id !== record.id);
    existing.unshift(record);
    saveFallbackDocs(existing);
  }

  return record;
}

export async function updateDocumentProgress(id, updates) {
  if (!id) return;
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          resolve();
          return;
        }
        const putReq = store.put({
          ...existing,
          ...updates,
          lastOpenedAt: Date.now(),
        });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    const docs = loadFallbackDocs().map((d) =>
      d.id === id ? { ...d, ...updates, lastOpenedAt: Date.now() } : d
    );
    saveFallbackDocs(docs);
  }
}

export async function deleteDocumentRecord(id) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const docs = loadFallbackDocs().filter((d) => d.id !== id);
    saveFallbackDocs(docs);
  }
}

export async function clearAllDocuments() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.removeItem(FALLBACK_DOCS_KEY);
  }
}

