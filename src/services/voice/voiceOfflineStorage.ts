// ============================================================================
// NOOK VOICE — OFFLINE DRAFT & RECOVERY STORAGE (IndexedDB)
// Resilient temporary queue for internet drops or tunnel reconnects
// ============================================================================

export interface PendingVoiceDraft {
  noteId: string;
  title: string;
  content: string;
  version: number;
  updatedAt: number;
}

const DB_NAME = 'nook_voice_offline_db';
const STORE_NAME = 'pending_voice_drafts';
const DB_VERSION = 1;

class VoiceOfflineStorage {
  private memoryFallback: Map<string, PendingVoiceDraft> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable()) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('Nook Voice: IndexedDB could not be opened, falling back to memory/sessionStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('Nook Voice: IndexedDB exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async savePendingDraft(noteId: string, title: string, content: string, version: number): Promise<void> {
    const draft: PendingVoiceDraft = {
      noteId,
      title,
      content,
      version,
      updatedAt: Date.now(),
    };

    // Always maintain in memory and sessionStorage for immediate sync
    this.memoryFallback.set(noteId, draft);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(`nook_voice_draft_${noteId}`, JSON.stringify(draft));
      }
    } catch {}

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(draft);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve(); // Non-blocking
      } catch {
        resolve();
      }
    });
  }

  async getPendingDraft(noteId: string): Promise<PendingVoiceDraft | null> {
    const db = await this.getDB();
    if (!db) {
      if (this.memoryFallback.has(noteId)) {
        return this.memoryFallback.get(noteId)!;
      }
      try {
        const raw = window.sessionStorage?.getItem(`nook_voice_draft_${noteId}`);
        if (raw) return JSON.parse(raw);
      } catch {}
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(noteId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memoryFallback.get(noteId) || null);
      } catch {
        resolve(this.memoryFallback.get(noteId) || null);
      }
    });
  }

  async getAllPending(): Promise<PendingVoiceDraft[]> {
    const db = await this.getDB();
    if (!db) {
      return Array.from(this.memoryFallback.values());
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(Array.from(this.memoryFallback.values()));
      } catch {
        resolve(Array.from(this.memoryFallback.values()));
      }
    });
  }

  async removePendingDraft(noteId: string): Promise<void> {
    this.memoryFallback.delete(noteId);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(`nook_voice_draft_${noteId}`);
      }
    } catch {}

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(noteId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const voiceOfflineStorage = new VoiceOfflineStorage();
