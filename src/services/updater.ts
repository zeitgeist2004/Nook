import { getVersion } from '@tauri-apps/api/app';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isTauri } from './api';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'failed';

export interface UpdaterSnapshot {
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  progressPercent: number;
  errorMessage: string | null;
  lastCheckedAt: number | null;
  dismissedVersion: string | null;
}

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily check
const LAST_CHECK_STORAGE_KEY = 'nook_last_update_check_at';
const DISMISSED_VERSION_KEY = 'nook_dismissed_update_version';
export const RELEASES_PAGE_URL = 'https://github.com/zeitgeist2004/Nook/releases';

function readStoredNumber(key: string): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredString(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function shouldRunScheduledUpdateCheck(
  nowMs: number,
  lastCheckedAt: number | null,
  autoUpdateCheckEnabled: boolean,
  isOnline: boolean
): boolean {
  if (!autoUpdateCheckEnabled || !isOnline) return false;
  if (!lastCheckedAt) return true;
  return nowMs - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

type SnapshotListener = (snapshot: UpdaterSnapshot) => void;

class NookUpdaterService {
  private snapshot: UpdaterSnapshot = {
    status: 'idle',
    currentVersion: '1.0.0',
    availableVersion: null,
    releaseDate: null,
    releaseNotes: null,
    downloadedBytes: 0,
    totalBytes: null,
    progressPercent: 0,
    errorMessage: null,
    lastCheckedAt: readStoredNumber(LAST_CHECK_STORAGE_KEY),
    dismissedVersion: readStoredString(DISMISSED_VERSION_KEY),
  };

  private listeners = new Set<SnapshotListener>();
  private pendingUpdate: Update | null = null;
  private checkInFlight = false;
  private versionResolved = false;

  constructor() {
    this.resolveAppVersion();
  }

  private async resolveAppVersion() {
    if (this.versionResolved || !isTauri()) return;
    try {
      const v = await getVersion();
      if (v) {
        this.versionResolved = true;
        this.updateSnapshot({ currentVersion: v });
      }
    } catch {
      // Fallback stays '1.0.0' cleanly
    }
  }

  private updateSnapshot(patch: Partial<UpdaterSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((cb) => cb(this.snapshot));
  }

  private releasePendingHandle() {
    if (this.pendingUpdate) {
      const ref = this.pendingUpdate;
      this.pendingUpdate = null;
      ref.close().catch(() => {});
    }
  }

  getSnapshot(): UpdaterSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dismissNotificationForCurrentVersion() {
    const ver = this.snapshot.availableVersion;
    if (!ver) return;
    try {
      localStorage.setItem(DISMISSED_VERSION_KEY, ver);
    } catch {
      // Ignore storage errors
    }
    this.updateSnapshot({ dismissedVersion: ver });
  }

  async checkForUpdates(options?: { manual?: boolean; autoEnabled?: boolean }): Promise<UpdaterSnapshot> {
    if (!isTauri()) {
      return this.snapshot;
    }

    const manual = options?.manual ?? false;
    const autoEnabled = options?.autoEnabled ?? true;

    await this.resolveAppVersion();

    if (this.checkInFlight) {
      return this.snapshot;
    }
    if (this.snapshot.status === 'downloading' || this.snapshot.status === 'ready') {
      return this.snapshot;
    }

    const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const now = Date.now();
    if (!manual && !shouldRunScheduledUpdateCheck(now, this.snapshot.lastCheckedAt, autoEnabled, online)) {
      return this.snapshot;
    }
    if (!online) {
      if (manual) {
        this.updateSnapshot({
          status: 'failed',
          errorMessage: 'offline',
        });
      }
      return this.snapshot;
    }

    this.checkInFlight = true;
    if (manual) {
      this.updateSnapshot({ status: 'checking', errorMessage: null });
    }

    try {
      const update = await check({ timeout: 15000 });
      const checkedNow = Date.now();
      try {
        localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(checkedNow));
      } catch {
        // Ignore storage errors
      }

      if (update) {
        this.releasePendingHandle();
        this.pendingUpdate = update;
        this.updateSnapshot({
          status: 'available',
          currentVersion: update.currentVersion || this.snapshot.currentVersion,
          availableVersion: update.version,
          releaseDate: update.date || null,
          releaseNotes: update.body || null,
          downloadedBytes: 0,
          totalBytes: null,
          progressPercent: 0,
          errorMessage: null,
          lastCheckedAt: checkedNow,
          dismissedVersion: manual ? null : readStoredString(DISMISSED_VERSION_KEY),
        });
      } else {
        this.releasePendingHandle();
        this.updateSnapshot({
          status: 'up-to-date',
          availableVersion: null,
          releaseDate: null,
          releaseNotes: null,
          errorMessage: null,
          lastCheckedAt: checkedNow,
        });
      }
    } catch (err: any) {
      if (manual) {
        this.updateSnapshot({
          status: 'failed',
          errorMessage: err?.message || String(err) || 'Update check failed',
        });
      }
    } finally {
      this.checkInFlight = false;
    }

    return this.snapshot;
  }

  async downloadUpdate(canProceed?: () => boolean): Promise<boolean> {
    if (!isTauri() || !this.pendingUpdate) return false;
    if (canProceed && !canProceed()) {
      return false;
    }
    if (this.snapshot.status === 'downloading') return false;

    const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    if (!online) {
      this.updateSnapshot({ status: 'failed', errorMessage: 'offline' });
      return false;
    }

    this.updateSnapshot({
      status: 'downloading',
      downloadedBytes: 0,
      totalBytes: null,
      progressPercent: 0,
      errorMessage: null,
    });

    let accumulated = 0;
    let totalLen: number | null = null;

    try {
      await this.pendingUpdate.download((event) => {
        if (event.event === 'Started') {
          totalLen = event.data.contentLength ?? null;
          this.updateSnapshot({
            status: 'downloading',
            totalBytes: totalLen,
            downloadedBytes: 0,
            progressPercent: 0,
          });
        } else if (event.event === 'Progress') {
          accumulated += event.data.chunkLength || 0;
          const pct =
            totalLen && totalLen > 0
              ? Math.min(99, Math.round((accumulated / totalLen) * 100))
              : 0;
          this.updateSnapshot({
            status: 'downloading',
            downloadedBytes: accumulated,
            totalBytes: totalLen,
            progressPercent: pct,
          });
        } else if (event.event === 'Finished') {
          this.updateSnapshot({
            status: 'ready',
            progressPercent: 100,
          });
        }
      });

      this.updateSnapshot({
        status: 'ready',
        progressPercent: 100,
      });
      return true;
    } catch (err: any) {
      this.updateSnapshot({
        status: 'failed',
        errorMessage: err?.message || String(err) || 'Download failed',
      });
      return false;
    }
  }

  async installAndRestart(opts: {
    flushPendingWrites: () => Promise<void>;
    isCriticalOperationRunning?: () => boolean;
  }): Promise<{ installed: boolean; blockedByPendingOp?: boolean; error?: string }> {
    if (!isTauri() || !this.pendingUpdate) {
      return { installed: false, error: 'No pending update package.' };
    }

    if (opts.isCriticalOperationRunning?.()) {
      return { installed: false, blockedByPendingOp: true };
    }

    try {
      await opts.flushPendingWrites();
      if (opts.isCriticalOperationRunning?.()) {
        return { installed: false, blockedByPendingOp: true };
      }

      await this.pendingUpdate.install({ restartAfterInstall: true });
      // Fallback explicit relaunch in case install returns without terminating on some setups
      await relaunch().catch(() => {});
      return { installed: true };
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Install failed';
      this.updateSnapshot({
        status: 'failed',
        errorMessage: msg,
      });
      return { installed: false, error: msg };
    }
  }
}

export const updaterService = new NookUpdaterService();
