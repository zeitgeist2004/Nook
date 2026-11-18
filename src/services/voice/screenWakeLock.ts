// ============================================================================
// NOOK VOICE — SCREEN WAKE LOCK SERVICE
// Keeps mobile screen active during transcription without timeouts
// ============================================================================

export class ScreenWakeLockService {
  private sentinel: any = null;
  private isRequested = false;
  private boundVisibilityHandler: (() => void) | null = null;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async acquire(): Promise<boolean> {
    if (!this.isSupported()) return false;
    this.isRequested = true;

    try {
      if (this.sentinel) {
        return true;
      }

      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });

      // Bind visibility change listener to re-acquire when app returns to foreground
      if (!this.boundVisibilityHandler && typeof document !== 'undefined') {
        this.boundVisibilityHandler = () => {
          if (this.isRequested && document.visibilityState === 'visible' && !this.sentinel) {
            this.acquire().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);
      }

      return true;
    } catch (err) {
      // Common when battery saver is active or tab is backgrounded
      return false;
    }
  }

  release() {
    this.isRequested = false;
    if (this.sentinel) {
      try {
        this.sentinel.release();
      } catch {}
      this.sentinel = null;
    }

    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }
}

export const screenWakeLock = new ScreenWakeLockService();
