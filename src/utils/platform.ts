export type RuntimePlatform = 'desktop' | 'web' | 'mobile';

export interface PlatformCapabilities {
  // Desktop-exclusive Windows capabilities
  systemTray: boolean;
  globalShortcuts: boolean;
  quickCaptureGlobal: boolean;
  fileAssociation: boolean;
  externalFilesDisk: boolean;
  projectLinking: boolean;
  revealInExplorer: boolean;
  agentInstructionsDisk: boolean;
  agentSkillsDisk: boolean;
  mobileTunnelHost: boolean;
  startupConfig: boolean;
  folderBackupExport: boolean;

  // Shared core capabilities across Desktop, Web, and Mobile
  notesCrud: boolean;
  projectsAndFolders: boolean;
  quickNotes: boolean;
  pinnedNotes: boolean;
  search: boolean;
  versionHistory: boolean;
  autoSave: boolean;
  markdownInternal: boolean;
  wordCounter: boolean;
  themes: boolean;
  promptLibrary: boolean;
  contextPack: boolean;
  sessionHandoff: boolean;
  devJournal: boolean;

  // Contextual / Input-dependent capabilities
  commandPaletteDesktopActions: boolean;
  splitEditorMode: boolean;
  voiceInputSupported: boolean;
  webRestoreApp: boolean;
  mobileLayoutOptimized: boolean;
}

export interface EnvironmentProfile {
  platform: RuntimePlatform;
  isDesktop: boolean;
  isWeb: boolean;
  isMobilePlatform: boolean;
  isCompactViewport: boolean;
  isNarrowDesktop: boolean;
  isTouchPrimary: boolean;
  viewportWidth: number;
  viewportHeight: number;
  capabilities: PlatformCapabilities;
}

export const COMPACT_BREAKPOINT_PX = 768;
export const NARROW_DESKTOP_BREAKPOINT_PX = 1040;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

export function isMobileUserAgentOrParam(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('mobile') === 'true' || params.get('pair')) {
    return true;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function isCoarseTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints =
    typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  return coarsePointer && hasTouchPoints;
}

/**
 * Resolves the execution runtime separately from window width so resizing Nook.exe
 * or Chrome on Desktop does not pretend the user is on a smartphone.
 */
export function resolveRuntimePlatform(options?: {
  tauri?: boolean;
  mobileHint?: boolean;
  touchPrimary?: boolean;
  viewportWidth?: number;
}): RuntimePlatform {
  const tauri = options?.tauri ?? isTauriRuntime();
  if (tauri) return 'desktop';

  const mobileHint = options?.mobileHint ?? isMobileUserAgentOrParam();
  if (mobileHint) return 'mobile';

  const width =
    options?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const touchPrimary = options?.touchPrimary ?? isCoarseTouchDevice();
  if (touchPrimary && width <= 900) return 'mobile';

  return 'web';
}

export function getPlatformCapabilities(
  platform: RuntimePlatform,
  isCompactViewport: boolean,
  voiceSupported = isSpeechRecognitionSupported()
): PlatformCapabilities {
  const isDesktop = platform === 'desktop';
  const isMobile = platform === 'mobile';

  return {
    // Exclusively local Windows Desktop
    systemTray: isDesktop,
    globalShortcuts: isDesktop,
    quickCaptureGlobal: isDesktop,
    fileAssociation: isDesktop,
    externalFilesDisk: isDesktop,
    projectLinking: isDesktop,
    revealInExplorer: isDesktop,
    agentInstructionsDisk: isDesktop,
    agentSkillsDisk: isDesktop,
    mobileTunnelHost: isDesktop,
    startupConfig: isDesktop,
    folderBackupExport: isDesktop,

    // Shared across all supported runtimes
    notesCrud: true,
    projectsAndFolders: true,
    quickNotes: true,
    pinnedNotes: true,
    search: true,
    versionHistory: true,
    autoSave: true,
    markdownInternal: true,
    wordCounter: true,
    themes: true,
    promptLibrary: true,
    contextPack: true,
    sessionHandoff: true,
    devJournal: true,

    // Contextual availability
    commandPaletteDesktopActions: !isMobile,
    splitEditorMode: !isCompactViewport,
    voiceInputSupported: voiceSupported,
    webRestoreApp: platform === 'web',
    mobileLayoutOptimized: isMobile || isCompactViewport,
  };
}

export function getEnvironmentProfile(overrides?: {
  tauri?: boolean;
  mobileHint?: boolean;
  touchPrimary?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  voiceSupported?: boolean;
}): EnvironmentProfile {
  const viewportWidth =
    overrides?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const viewportHeight =
    overrides?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
  const tauri = overrides?.tauri ?? isTauriRuntime();
  const mobileHint = overrides?.mobileHint ?? isMobileUserAgentOrParam();
  const touchPrimary = overrides?.touchPrimary ?? isCoarseTouchDevice();

  const platform = resolveRuntimePlatform({
    tauri,
    mobileHint,
    touchPrimary,
    viewportWidth,
  });

  const isCompactViewport = mobileHint || viewportWidth <= COMPACT_BREAKPOINT_PX;
  const isNarrowDesktop =
    !isCompactViewport && viewportWidth <= NARROW_DESKTOP_BREAKPOINT_PX && platform !== 'mobile';

  return {
    platform,
    isDesktop: platform === 'desktop',
    isWeb: platform === 'web',
    isMobilePlatform: platform === 'mobile',
    isCompactViewport,
    isNarrowDesktop,
    isTouchPrimary: touchPrimary || mobileHint,
    viewportWidth,
    viewportHeight,
    capabilities: getPlatformCapabilities(
      platform,
      isCompactViewport,
      overrides?.voiceSupported ?? isSpeechRecognitionSupported()
    ),
  };
}

/**
 * Synchronizes CSS `--nook-viewport-height` and `data-keyboard-open` from VisualViewport
 * so virtual keyboards on iOS Safari and Android Chrome never hide inputs or toolbars,
 * without triggering React re-renders or resize loops.
 */
export function installVisualViewportSync(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const root = document.documentElement;
  let rafId = 0;
  let lastHeight = -1;
  let lastKeyboardOpen: boolean | null = null;
  let baselineHeight = window.visualViewport?.height || window.innerHeight;

  const applyMetrics = () => {
    rafId = 0;
    const vv = window.visualViewport;
    const activeEl = document.activeElement as HTMLElement | null;
    const isTextInputFocused = Boolean(
      activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
    );

    const currentHeight = vv ? Math.round(vv.height) : window.innerHeight;
    if (!isTextInputFocused || currentHeight > baselineHeight) {
      baselineHeight = Math.max(baselineHeight, window.innerHeight, currentHeight);
    }

    // Track whether an on-screen virtual keyboard likely covers part of the layout viewport
    const heightDrop = Math.max(window.innerHeight - currentHeight, baselineHeight - currentHeight);
    const keyboardOpen = isTextInputFocused && heightDrop > 120 && window.innerWidth <= 1024;

    if (currentHeight !== lastHeight && currentHeight > 100) {
      lastHeight = currentHeight;
      root.style.setProperty('--nook-viewport-height', `${currentHeight}px`);
    }

    if (keyboardOpen !== lastKeyboardOpen) {
      lastKeyboardOpen = keyboardOpen;
      root.setAttribute('data-keyboard-open', keyboardOpen ? 'true' : 'false');
    }
  };

  const schedule = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(applyMetrics);
  };

  applyMetrics();

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    vv?.removeEventListener('resize', schedule);
    vv?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
  };
}
