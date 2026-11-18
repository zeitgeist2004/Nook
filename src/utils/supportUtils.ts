import { SupportPreferences } from '../types';

export const OFFICIAL_SPONSORS_URL = 'https://github.com/sponsors/zeitgeist2004';
export const SUPPORT_PREFS_STORAGE_KEY = 'nook_support_prefs';

export const MIN_DAYS_FOR_FIRST_INVITE_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_ACTIVE_USAGE_MS = 5 * 60 * 60 * 1000;
export const COOLDOWN_AFTER_LATER_MS = 60 * 24 * 60 * 60 * 1000;
export const MAX_AUTO_INVITES = 2;

export const MAX_TICK_SLICE_MS = 75_000;
export const IDLE_THRESHOLD_MS = 120_000;
export const QUIET_MOMENT_IDLE_MIN_MS = 8_000;
export const QUIET_AFTER_TYPING_MS = 25_000;
export const STARTUP_GRACE_MS = 60_000;

export function createInitialSupportPreferences(now = Date.now()): SupportPreferences {
  return {
    firstUsedAt: now,
    activeUsageMs: 0,
    invitesShownCount: 0,
    lastInviteShownAt: null,
    neverShowAgain: false,
    showInvitesSetting: true,
    completedActionsCount: 0,
  };
}

export function parseSupportPreferences(
  raw: string | null | undefined,
  now = Date.now()
): SupportPreferences {
  if (!raw || !raw.trim()) {
    return createInitialSupportPreferences(now);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createInitialSupportPreferences(now);
    }
    return {
      firstUsedAt:
        typeof parsed.firstUsedAt === 'number' && parsed.firstUsedAt > 0
          ? parsed.firstUsedAt
          : now,
      activeUsageMs:
        typeof parsed.activeUsageMs === 'number' && parsed.activeUsageMs >= 0
          ? parsed.activeUsageMs
          : 0,
      invitesShownCount:
        typeof parsed.invitesShownCount === 'number' && parsed.invitesShownCount >= 0
          ? Math.floor(parsed.invitesShownCount)
          : 0,
      lastInviteShownAt:
        typeof parsed.lastInviteShownAt === 'number' && parsed.lastInviteShownAt > 0
          ? parsed.lastInviteShownAt
          : null,
      neverShowAgain: Boolean(parsed.neverShowAgain),
      showInvitesSetting:
        typeof parsed.showInvitesSetting === 'boolean' ? parsed.showInvitesSetting : true,
      completedActionsCount:
        typeof parsed.completedActionsCount === 'number' && parsed.completedActionsCount >= 0
          ? Math.floor(parsed.completedActionsCount)
          : 0,
    };
  } catch {
    return createInitialSupportPreferences(now);
  }
}

export function loadLocalSupportPreferences(now = Date.now()): {
  prefs: SupportPreferences;
  existed: boolean;
} {
  try {
    const raw = localStorage.getItem(SUPPORT_PREFS_STORAGE_KEY);
    if (raw) {
      return { prefs: parseSupportPreferences(raw, now), existed: true };
    }
  } catch {
    // ignore storage access issues
  }
  return { prefs: createInitialSupportPreferences(now), existed: false };
}

export function saveLocalSupportPreferences(prefs: SupportPreferences): void {
  try {
    localStorage.setItem(SUPPORT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage access issues
  }
}

/**
 * Merges Desktop and Web preferences safely so neither resets accumulated progress
 * nor triggers duplicate invitations across surfaces.
 */
export function mergeSupportPreferences(
  local: SupportPreferences,
  remote: SupportPreferences,
  preferRemoteToggles = true
): SupportPreferences {
  const firstUsedAt = Math.min(local.firstUsedAt, remote.firstUsedAt);
  const lastInviteShownAt =
    local.lastInviteShownAt && remote.lastInviteShownAt
      ? Math.max(local.lastInviteShownAt, remote.lastInviteShownAt)
      : local.lastInviteShownAt || remote.lastInviteShownAt;

  return {
    firstUsedAt,
    activeUsageMs: Math.max(local.activeUsageMs, remote.activeUsageMs),
    invitesShownCount: Math.max(local.invitesShownCount, remote.invitesShownCount),
    lastInviteShownAt,
    neverShowAgain: preferRemoteToggles
      ? remote.neverShowAgain
      : local.neverShowAgain || remote.neverShowAgain,
    showInvitesSetting: preferRemoteToggles
      ? remote.showInvitesSetting
      : local.showInvitesSetting && remote.showInvitesSetting,
    completedActionsCount: Math.max(
      local.completedActionsCount,
      remote.completedActionsCount
    ),
  };
}

/**
 * Calculates safe active usage increment without counting sleep, minimized window, or long idle periods.
 */
export function computeActiveDeltaMs(options: {
  elapsedMs: number;
  isVisible: boolean;
  hasFocus: boolean;
  msSinceLastInteraction: number;
}): number {
  const { elapsedMs, isVisible, hasFocus, msSinceLastInteraction } = options;
  if (!isVisible || !hasFocus) return 0;
  if (msSinceLastInteraction < 0 || msSinceLastInteraction > IDLE_THRESHOLD_MS) {
    return 0;
  }
  if (elapsedMs <= 0) return 0;
  return Math.min(elapsedMs, MAX_TICK_SLICE_MS);
}

export interface SupportEligibilityContext {
  now: number;
  sessionStartedAt: number;
  msSinceLastInteraction: number;
  msSinceLastTyping: number;
  dismissedThisSession: boolean;
  isMobileViewport: boolean;
  isVisible: boolean;
  hasFocus: boolean;
  isSavingOrDirty: boolean;
  hasSyncError: boolean;
  hasBlockingModalOrFlow: boolean;
}

/**
 * Evaluates all strict eligibility and calm-moment constraints before showing the non-modal invite.
 */
export function canShowSupportInvite(
  prefs: SupportPreferences,
  ctx: SupportEligibilityContext
): boolean {
  if (prefs.neverShowAgain || !prefs.showInvitesSetting) return false;
  if (ctx.dismissedThisSession) return false;
  if (prefs.invitesShownCount >= MAX_AUTO_INVITES) return false;

  // Environmental & quiet-moment blocks (§9 & §11)
  if (ctx.isMobileViewport) return false;
  if (!ctx.isVisible || !ctx.hasFocus) return false;
  if (ctx.hasBlockingModalOrFlow) return false;
  if (ctx.isSavingOrDirty || ctx.hasSyncError) return false;

  // Never show during startup or right during/after active typing
  if (ctx.now - ctx.sessionStartedAt < STARTUP_GRACE_MS) return false;
  if (ctx.msSinceLastTyping < QUIET_AFTER_TYPING_MS) return false;
  if (ctx.msSinceLastInteraction < QUIET_MOMENT_IDLE_MIN_MS) return false;

  // Time & accumulated active usage gates (§5.1)
  if (ctx.now - prefs.firstUsedAt < MIN_DAYS_FOR_FIRST_INVITE_MS) return false;
  if (prefs.activeUsageMs < MIN_ACTIVE_USAGE_MS) return false;

  // Cooldown gate after first invite / "Agora não" (§8)
  if (prefs.invitesShownCount > 0 && prefs.lastInviteShownAt !== null) {
    if (ctx.now - prefs.lastInviteShownAt < COOLDOWN_AFTER_LATER_MS) {
      return false;
    }
  }

  return true;
}

export function applyInviteShown(
  prefs: SupportPreferences,
  now = Date.now()
): SupportPreferences {
  return {
    ...prefs,
    invitesShownCount: prefs.invitesShownCount + 1,
    lastInviteShownAt: now,
  };
}

export function applyInviteLater(
  prefs: SupportPreferences,
  now = Date.now()
): SupportPreferences {
  return {
    ...prefs,
    lastInviteShownAt: prefs.lastInviteShownAt ?? now,
  };
}

export function applyInviteNever(prefs: SupportPreferences): SupportPreferences {
  return {
    ...prefs,
    neverShowAgain: true,
    showInvitesSetting: false,
  };
}

export function applyCompletedAction(prefs: SupportPreferences): SupportPreferences {
  return {
    ...prefs,
    completedActionsCount: prefs.completedActionsCount + 1,
  };
}
