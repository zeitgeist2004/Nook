import { invoke } from '@tauri-apps/api/core';
import {
  AuthorizedDevice,
  AutoBackupInfo,
  AutoBackupSummary,
  CacheStats,
  ClearCacheResult,
  Collection,
  DeleteBackupsResult,
  FolderInspectionResult,
  InstructionFileDetail,
  InstructionFileSummary,
  MobileAccessInfo,
  Note,
  NoteSummary,
  NoteVersion,
  PendingPairRequest,
  SearchResultItem,
  SkillDetail,
  SkillSummary,
  WriteInstructionResult,
} from '../types';
import { getTranslations } from '../i18n';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// ----------------------------------------------------------------------------
// WEBSOCKET REAL-TIME SYNC CLIENT
// ----------------------------------------------------------------------------
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'unauthorized';
type SyncListener = (event: string, data: any) => void;
type StatusListener = (connected: boolean) => void;
type ConnectionStateListener = (state: ConnectionState) => void;

class NookSyncClient {
  private ws: WebSocket | null = null;
  private syncListeners: Set<SyncListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private isConnected = false;
  private connectionState: ConnectionState = 'reconnecting';
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private explicitWsUrl: string | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      if (isTauri()) {
        this.connectionState = 'connected';
        this.isConnected = true;
        // In Tauri Desktop, listen for live sync events emitted by Axum routes
        import('@tauri-apps/api/event')
          .then(({ listen }) => {
            listen<any>('nook-sync', (event) => {
              const payload = event.payload;
              if (!payload) return;
              const ev = payload.event || payload.type;
              const data = payload.data !== undefined ? payload.data : payload.payload;
              if (ev) {
                this.syncListeners.forEach((cb) => cb(ev, data));
              }
            });
          })
          .catch((err) => console.warn('Could not attach Tauri sync listener:', err));
      } else {
        // In Browser, connect to WebSocket and resume on network/visibility recovery
        this.connect();
        window.addEventListener('online', () => {
          if (this.connectionState !== 'unauthorized') {
            this.reconnectNow();
          }
        });
        document.addEventListener('visibilitychange', () => {
          if (
            document.visibilityState === 'visible' &&
            !this.isConnected &&
            this.connectionState !== 'unauthorized'
          ) {
            this.reconnectNow();
          }
        });
      }
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(nextState: ConnectionState) {
    const prevConnected = this.isConnected;
    this.connectionState = nextState;
    this.isConnected = nextState === 'connected';
    if (prevConnected !== this.isConnected) {
      this.statusListeners.forEach((cb) => cb(this.isConnected));
    }
    this.stateListeners.forEach((cb) => cb(nextState));
  }

  markUnauthorized() {
    if (isTauri()) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.setConnectionState('unauthorized');
  }

  markConnectedFromHttp() {
    if (isTauri()) return;
    if (this.connectionState === 'unauthorized' || this.connectionState === 'disconnected') {
      this.reconnectNow();
    }
  }

  onSync(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected);
    return () => this.statusListeners.delete(listener);
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => this.stateListeners.delete(listener);
  }

  reconnectNow() {
    if (typeof window === 'undefined' || isTauri()) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.setConnectionState('reconnecting');
    this.connect(this.explicitWsUrl);
  }

  connect(explicitUrl?: string) {
    if (typeof window === 'undefined' || isTauri()) return;
    this.explicitWsUrl = explicitUrl;
    if (this.connectionState === 'unauthorized') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let url = explicitUrl;
    if (!url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      url = `${protocol}//${window.location.host}/ws`;
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
      };

      this.ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          const ev = payload.event || payload.type;
          const data = payload.data !== undefined ? payload.data : payload.payload;
          if (ev) {
            this.syncListeners.forEach((cb) => cb(ev, data));
          }
        } catch {
          // ignore keepalive or parse errors
        }
      };

      this.ws.onclose = (event) => {
        this.ws = null;
        if (this.connectionState === 'unauthorized') return;
        // Policy violation / explicit auth close
        if (event.code === 1008 || event.code === 4401 || event.code === 4403) {
          this.setConnectionState('unauthorized');
          return;
        }
        this.reconnectAttempts += 1;
        this.setConnectionState(this.reconnectAttempts >= 3 ? 'disconnected' : 'reconnecting');
        this.scheduleReconnect(explicitUrl);
      };

      this.ws.onerror = () => {
        if (this.ws) {
          try {
            this.ws.close();
          } catch {}
        }
      };
    } catch {
      this.reconnectAttempts += 1;
      this.setConnectionState(this.reconnectAttempts >= 3 ? 'disconnected' : 'reconnecting');
      this.scheduleReconnect(explicitUrl);
    }
  }

  private scheduleReconnect(explicitUrl?: string) {
    if (this.reconnectTimer || this.connectionState === 'unauthorized') return;
    // Bounded exponential backoff: 2.5s -> 5s -> 10s -> 15s (stops hammering on sustained offline)
    const delay =
      this.reconnectAttempts <= 2
        ? 2500
        : this.reconnectAttempts <= 4
        ? 5000
        : this.reconnectAttempts <= 6
        ? 10000
        : 15000;
    if (this.reconnectAttempts > 10) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(explicitUrl);
    }, delay);
  }
}

export const syncClient = new NookSyncClient();

// Helper for fetch calls in browser
async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    syncClient.markUnauthorized();
    throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  }

  syncClient.markConnectedFromHttp();

  const text = await res.text();
  if (!text || !text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

// ----------------------------------------------------------------------------
// API ADAPTER
// ----------------------------------------------------------------------------
export const api = {
  // Sync listener registration
  onSync: (listener: SyncListener) => syncClient.onSync(listener),
  onStatusChange: (listener: StatusListener) => syncClient.onStatusChange(listener),
  onConnectionStateChange: (listener: ConnectionStateListener) =>
    syncClient.onConnectionStateChange(listener),
  reconnectSync: () => syncClient.reconnectNow(),
  getConnectionState: () => syncClient.state,
  isWebConnected: () => syncClient.connected,

  // -------------------------------------------------------------
  // NOOK WEB COMMANDS
  // -------------------------------------------------------------
  async openNookWeb(): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('open_nook_web');
    }
    return window.location.href;
  },

  async openSponsorsPage(): Promise<void> {
    const OFFICIAL_URL = 'https://github.com/sponsors/zeitgeist2004';
    if (isTauri()) {
      await invoke<string>('open_sponsors_page');
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(OFFICIAL_URL, '_blank', 'noopener,noreferrer');
    }
  },

  async restoreDesktopApp(): Promise<boolean> {
    if (isTauri()) {
      return true;
    }
    try {
      await fetch('/api/app/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return true;
    } catch (err) {
      console.warn('Failed to restore desktop app:', err);
      return false;
    }
  },

  async getWebStatus(): Promise<{ running: boolean; port?: number; url?: string }> {
    if (isTauri()) {
      return await invoke('get_web_status');
    }
    return {
      running: true,
      port: Number(window.location.port) || 80,
      url: window.location.origin,
    };
  },

  // -------------------------------------------------------------
  // NOTES
  // -------------------------------------------------------------
  async getActiveNotes(): Promise<NoteSummary[]> {
    if (isTauri()) {
      return await invoke<NoteSummary[]>('get_active_notes');
    }
    return await fetchJson<NoteSummary[]>('/api/notes');
  },

  async getNoteById(id: string): Promise<Note | null> {
    if (isTauri()) {
      return await invoke<Note | null>('get_note_by_id', { id });
    }
    try {
      return await fetchJson<Note>(`/api/notes/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },

  async createNote(
    collectionId?: string | null,
    title?: string,
    content?: string
  ): Promise<Note> {
    if (isTauri()) {
      return await invoke<Note>('create_note', {
        collectionId: collectionId ?? null,
        title: title ?? null,
        content: content ?? null,
      });
    }
    return await fetchJson<Note>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        collection_id: collectionId ?? null,
        title: title ?? null,
        content: content ?? null,
      }),
    });
  },

  async saveNote(
    id: string,
    title: string,
    content: string,
    version: number,
    baseUpdatedAt?: number
  ): Promise<{ success: boolean; id: string; version: number; updated_at: number }> {
    if (isTauri()) {
      return await invoke('save_note', { id, title, content, version, baseUpdatedAt });
    }
    return await fetchJson<{ success: boolean; id: string; version: number; updated_at: number }>(
      '/api/notes/save',
      {
        method: 'POST',
        body: JSON.stringify({ id, title, content, version, base_updated_at: baseUpdatedAt }),
      }
    );
  },

  async updateNoteTitle(id: string, title: string): Promise<void> {
    if (isTauri()) {
      await invoke('update_note_title', { id, title });
    } else {
      await fetchJson('/api/notes/title', {
        method: 'POST',
        body: JSON.stringify({ id, title }),
      });
    }
  },

  async duplicateNote(id: string): Promise<Note | null> {
    if (isTauri()) {
      return await invoke<Note | null>('duplicate_note', { id });
    }
    return await fetchJson<Note | null>('/api/notes/duplicate', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  async moveNote(id: string, targetCollectionId: string | null): Promise<void> {
    if (isTauri()) {
      await invoke('move_note', { id, targetCollectionId });
    } else {
      await fetchJson('/api/notes/move', {
        method: 'POST',
        body: JSON.stringify({ id, target_collection_id: targetCollectionId }),
      });
    }
  },

  async togglePinNote(id: string): Promise<boolean> {
    if (isTauri()) {
      return await invoke<boolean>('toggle_pin_note', { id });
    }
    const res = await fetchJson<boolean | { pinned: boolean }>('/api/notes/pin', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    return typeof res === 'boolean' ? res : !!res.pinned;
  },

  async softDeleteNote(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('soft_delete_note', { id });
    } else {
      await fetchJson(`/api/notes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    }
  },

  async restoreNote(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('restore_note', { id });
    } else {
      await fetchJson(`/api/notes/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
      });
    }
  },

  async permanentDeleteNote(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('permanent_delete_note', { id });
    } else {
      await fetchJson(`/api/notes/${encodeURIComponent(id)}/permanent`, {
        method: 'DELETE',
      });
    }
  },

  async getTrashNotes(): Promise<NoteSummary[]> {
    if (isTauri()) {
      return await invoke<NoteSummary[]>('get_trash_notes');
    }
    return await fetchJson<NoteSummary[]>('/api/trash');
  },

  async emptyTrash(): Promise<void> {
    if (isTauri()) {
      await invoke('empty_trash');
    } else {
      await fetchJson('/api/trash', {
        method: 'DELETE',
      });
    }
  },

  // -------------------------------------------------------------
  // VERSIONS
  // -------------------------------------------------------------
  async getNoteVersions(noteId: string): Promise<NoteVersion[]> {
    if (isTauri()) {
      return await invoke<NoteVersion[]>('get_note_versions', { noteId });
    }
    return await fetchJson<NoteVersion[]>(`/api/notes/${encodeURIComponent(noteId)}/versions`);
  },

  async restoreNoteVersion(noteId: string, versionId: string): Promise<Note | null> {
    if (isTauri()) {
      return await invoke<Note | null>('restore_note_version', { noteId, versionId });
    }
    return await fetchJson<Note | null>(
      `/api/notes/${encodeURIComponent(noteId)}/versions/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ version_id: versionId }),
      }
    );
  },

  async createNoteVersion(noteId: string, title: string, content: string): Promise<NoteVersion> {
    if (isTauri()) {
      return await invoke<NoteVersion>('create_note_version', { noteId, title, content });
    }
    return await fetchJson<NoteVersion>(
      `/api/notes/${encodeURIComponent(noteId)}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      }
    );
  },

  // -------------------------------------------------------------
  // COLLECTIONS
  // -------------------------------------------------------------
  async getCollections(): Promise<Collection[]> {
    if (isTauri()) {
      return await invoke<Collection[]>('get_collections');
    }
    return await fetchJson<Collection[]>('/api/collections');
  },

  async createCollection(
    name: string,
    collectionType: 'project' | 'folder',
    parentId?: string | null
  ): Promise<Collection> {
    if (isTauri()) {
      return await invoke<Collection>('create_collection', {
        name,
        collectionType,
        parentId: parentId ?? null,
      });
    }
    return await fetchJson<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify({
        name,
        collection_type: collectionType,
        parent_id: parentId ?? null,
      }),
    });
  },

  async updateCollectionName(id: string, name: string): Promise<void> {
    if (isTauri()) {
      await invoke('update_collection_name', { id, name });
    } else {
      await fetchJson('/api/collections/rename', {
        method: 'POST',
        body: JSON.stringify({ id, name }),
      });
    }
  },

  async moveCollection(id: string, targetParentId: string | null): Promise<void> {
    if (isTauri()) {
      await invoke('move_collection', { id, targetParentId });
    } else {
      await fetchJson('/api/collections/move', {
        method: 'POST',
        body: JSON.stringify({ id, target_parent_id: targetParentId }),
      });
    }
  },

  async reorderCollections(orderedIds: string[]): Promise<void> {
    if (isTauri()) {
      await invoke('reorder_collections', { orderedIds, ordered_ids: orderedIds });
    } else {
      await fetchJson('/api/collections/reorder', {
        method: 'POST',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
    }
  },

  async deleteCollection(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_collection', { id });
    } else {
      await fetchJson(`/api/collections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    }
  },

  async restoreCollection(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('restore_collection', { id });
    } else {
      await fetchJson(`/api/collections/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
      });
    }
  },

  async getTrashCollections(): Promise<Collection[]> {
    if (isTauri()) {
      return await invoke<Collection[]>('get_trash_collections');
    }
    return await fetchJson<Collection[]>('/api/trash/collections');
  },

  // -------------------------------------------------------------
  // SEARCH
  // -------------------------------------------------------------
  async searchNotes(query: string): Promise<SearchResultItem[]> {
    if (isTauri()) {
      return await invoke<SearchResultItem[]>('search_notes', { query });
    }
    return await fetchJson<SearchResultItem[]>(`/api/search?q=${encodeURIComponent(query)}`);
  },

  // -------------------------------------------------------------
  // FILES (Desktop-only; web gracefully reports)
  // -------------------------------------------------------------
  async getInitialFile(): Promise<string | null> {
    if (isTauri()) {
      try {
        return await invoke<string | null>('get_initial_file');
      } catch {
        return null;
      }
    }
    return null;
  },

  async readExternalFile(filePath: string): Promise<{ path: string; filename: string; content: string }> {
    if (isTauri()) {
      return await invoke('read_external_file', { filePath });
    }
    throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
  },

  async writeExternalFile(filePath: string, content: string): Promise<void> {
    if (isTauri()) {
      await invoke('write_external_file', { filePath, content });
    } else {
      throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
    }
  },

  async exportLibraryToFolder(destinationFolder: string): Promise<number> {
    if (isTauri()) {
      return await invoke<number>('export_library_to_folder', { destinationFolder });
    }
    throw new Error(getTranslations().apiErrors.exportFolderDesktopOnly);
  },

  // -------------------------------------------------------------
  // BACKUP & SETTINGS
  // -------------------------------------------------------------
  async getDatabasePath(): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('get_database_path');
    }
    return 'SQLite (Loopback)';
  },

  async exportBackupJson(filePath: string): Promise<void> {
    if (isTauri()) {
      await invoke('export_backup_json', { filePath });
      return;
    }
    throw new Error(getTranslations().apiErrors.backupExportDesktopOnly);
  },

  async importBackupJson(filePath: string): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('import_backup_json', { filePath });
    }
    return getTranslations().apiErrors.backupImportDesktopOnly;
  },

  async triggerAutoBackup(force = false): Promise<AutoBackupInfo | null> {
    if (isTauri()) {
      return await invoke<AutoBackupInfo | null>('trigger_auto_backup', { force });
    }
    return null;
  },

  async listAutoBackups(): Promise<AutoBackupInfo[]> {
    if (isTauri()) {
      return await invoke<AutoBackupInfo[]>('list_auto_backups');
    }
    return [];
  },

  async getAutoBackupsSummary(): Promise<AutoBackupSummary | null> {
    if (isTauri()) {
      return await invoke<AutoBackupSummary>('get_auto_backups_summary');
    }
    return null;
  },

  async deleteAutoBackups(): Promise<DeleteBackupsResult> {
    if (isTauri()) {
      return await invoke<DeleteBackupsResult>('delete_auto_backups');
    }
    throw new Error(getTranslations().apiErrors.backupExportDesktopOnly);
  },

  async getCacheStats(): Promise<CacheStats | null> {
    if (isTauri()) {
      return await invoke<CacheStats>('get_cache_stats');
    }
    return null;
  },

  async clearAppCache(): Promise<ClearCacheResult> {
    if (isTauri()) {
      return await invoke<ClearCacheResult>('clear_app_cache');
    }
    throw new Error(getTranslations().apiErrors.backupExportDesktopOnly);
  },

  async getServerStatus(): Promise<{ status: string; version: string; build_id?: string } | null> {
    if (isTauri()) return null;
    try {
      return await fetchJson<{ status: string; version: string; build_id?: string }>('/api/status');
    } catch {
      return null;
    }
  },

  async getSettings(): Promise<Array<{ key: string; value: string }>> {
    if (isTauri()) {
      return await invoke<Array<{ key: string; value: string }>>('get_settings');
    }
    return await fetchJson<Array<{ key: string; value: string }>>('/api/settings');
  },

  async saveSetting(key: string, value: string): Promise<void> {
    if (isTauri()) {
      await invoke('save_setting', { key, value });
    } else {
      await fetchJson('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
    }
  },

  async closeSplashscreen(): Promise<void> {
    if (isTauri()) {
      try {
        await invoke('close_splashscreen');
      } catch (err) {
        console.warn('Failed to invoke close_splashscreen:', err);
      }
    }
  },

  // -------------------------------------------------------------
  // NOOK MOBILE & CLOUDFLARE TUNNEL
  // -------------------------------------------------------------
  async startMobileAccess(): Promise<MobileAccessInfo> {
    if (isTauri()) {
      return await invoke<MobileAccessInfo>('start_mobile_access');
    }
    throw new Error(getTranslations().apiErrors.mobileTunnelDesktopOnly);
  },

  async stopMobileAccess(): Promise<void> {
    if (isTauri()) {
      await invoke('stop_mobile_access');
    }
  },

  async getMobileStatus(): Promise<MobileAccessInfo> {
    if (isTauri()) {
      return await invoke<MobileAccessInfo>('get_mobile_status');
    }
    try {
      const devices = await this.getMobileDevices();
      return {
        active: true,
        connecting: false,
        url: window.location.origin,
        pair_code: null,
        qr_payload: null,
        error: null,
        authorized_devices: devices,
      };
    } catch {
      return {
        active: false,
        connecting: false,
        url: null,
        pair_code: null,
        qr_payload: null,
        error: null,
        authorized_devices: [],
      };
    }
  },

  async getMobileDevices(): Promise<AuthorizedDevice[]> {
    if (isTauri()) {
      return await invoke<AuthorizedDevice[]>('get_mobile_devices');
    }
    return await fetchJson<AuthorizedDevice[]>('/api/mobile/devices');
  },

  async getMobilePendingPairings(): Promise<PendingPairRequest[]> {
    if (isTauri()) {
      return await invoke<PendingPairRequest[]>('get_mobile_pending_pairings');
    }
    return [];
  },

  async approveMobilePairing(requestId: string): Promise<AuthorizedDevice> {
    if (isTauri()) {
      return await invoke<AuthorizedDevice>('approve_mobile_pairing', { requestId });
    }
    throw new Error(getTranslations().apiErrors.pairApprovalDesktopOnly);
  },

  async rejectMobilePairing(requestId: string): Promise<void> {
    if (isTauri()) {
      await invoke('reject_mobile_pairing', { requestId });
    }
  },

  async revokeMobileDevice(deviceId: string): Promise<void> {
    if (isTauri()) {
      await invoke('revoke_mobile_device', { deviceId });
    } else {
      await fetchJson(`/api/mobile/devices/${encodeURIComponent(deviceId)}/revoke`, {
        method: 'POST',
      });
    }
  },

  async deleteMobileDevice(deviceId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_mobile_device', { deviceId });
    } else {
      await fetchJson(`/api/mobile/devices/${encodeURIComponent(deviceId)}/delete`, {
        method: 'DELETE',
      });
    }
  },

  async requestMobilePairing(
    pairCode: string,
    deviceName: string,
    userAgent?: string
  ): Promise<{ success: boolean; request_id: string }> {
    return await fetchJson<{ success: boolean; request_id: string }>(
      '/api/mobile/pair/request',
      {
        method: 'POST',
        body: JSON.stringify({
          pair_code: pairCode,
          device_name: deviceName,
          user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
        }),
      }
    );
  },

  async pollMobilePairing(
    requestId: string
  ): Promise<{ approved: boolean; pending?: boolean; session_token?: string; error?: string }> {
    return await fetchJson<{ approved: boolean; pending?: boolean; session_token?: string; error?: string }>(
      `/api/mobile/pair/poll?request_id=${encodeURIComponent(requestId)}`
    );
  },

  // -------------------------------------------------------------
  // DEVELOPER WORKFLOW (Desktop-Only Local Filesystem Commands)
  // -------------------------------------------------------------
  async inspectLinkedFolder(
    folderPath: string,
    extraSkillRoots?: string[]
  ): Promise<FolderInspectionResult> {
    if (isTauri()) {
      return await invoke<FolderInspectionResult>('inspect_linked_folder', {
        folderPath,
        extraSkillRoots: extraSkillRoots ?? null,
      });
    }
    return {
      valid: false,
      exists: false,
      path: folderPath,
      folder_name: '',
      doc_files: [],
      instruction_count: 0,
      skill_count: 0,
    };
  },

  async openLocalFolder(folderPath: string): Promise<void> {
    if (isTauri()) {
      await invoke('open_local_folder', { folderPath });
    } else {
      throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
    }
  },

  async revealLocalFile(filePath: string, allowedRoots?: string[]): Promise<void> {
    if (isTauri()) {
      await invoke('reveal_local_file', {
        filePath,
        allowedRoots: allowedRoots ?? null,
      });
    } else {
      throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
    }
  },

  async listProjectInstructions(
    linkedFolder: string | null,
    customPaths: string[]
  ): Promise<InstructionFileSummary[]> {
    if (isTauri()) {
      return await invoke<InstructionFileSummary[]>('list_project_instructions', {
        linkedFolder,
        customPaths,
      });
    }
    return [];
  },

  async readProjectInstructionFile(
    filePath: string,
    allowedRoots: string[]
  ): Promise<InstructionFileDetail> {
    if (isTauri()) {
      return await invoke<InstructionFileDetail>('read_project_instruction_file', {
        filePath,
        allowedRoots,
      });
    }
    throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
  },

  async writeProjectInstructionFile(
    filePath: string,
    content: string,
    expectedHash: string,
    forceOverwrite: boolean,
    allowedRoots: string[]
  ): Promise<WriteInstructionResult> {
    if (isTauri()) {
      return await invoke<WriteInstructionResult>('write_project_instruction_file', {
        filePath,
        content,
        expectedHash,
        forceOverwrite,
        allowedRoots,
      });
    }
    throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
  },

  async listAgentSkills(
    linkedFolder: string | null,
    authorizedFolders: string[]
  ): Promise<SkillSummary[]> {
    if (isTauri()) {
      return await invoke<SkillSummary[]>('list_agent_skills', {
        linkedFolder,
        authorizedFolders,
      });
    }
    return [];
  },

  async readAgentSkillDetail(skillDir: string, allowedRoots: string[]): Promise<SkillDetail> {
    if (isTauri()) {
      return await invoke<SkillDetail>('read_agent_skill_detail', {
        skillDir,
        allowedRoots,
      });
    }
    throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
  },

  async readSkillReferenceFile(filePath: string, allowedRoots: string[]): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('read_skill_reference_file', {
        filePath,
        allowedRoots,
      });
    }
    throw new Error(getTranslations().apiErrors.externalFilesDesktopOnly);
  },
};
