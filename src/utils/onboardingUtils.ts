export type ContextualTipId =
  | 'projects'
  | 'quick_notes'
  | 'search'
  | 'history'
  | 'context_pack'
  | 'mobile_sync'
  | 'voice'
  | 'dev_workflow';

const CONTEXTUAL_TIPS_STORAGE_KEY = 'nook_contextual_tips_v1';
const FIRST_USE_ONBOARDING_KEY = 'nook_onboarding_completed';

function readSeenTipSet(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(CONTEXTUAL_TIPS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenTipSet(set: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CONTEXTUAL_TIPS_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore storage quota / private mode failures gracefully
  }
}

export function hasSeenContextualTip(tipId: ContextualTipId): boolean {
  return readSeenTipSet().has(tipId);
}

export function dismissContextualTip(tipId: ContextualTipId): void {
  const seen = readSeenTipSet();
  if (!seen.has(tipId)) {
    seen.add(tipId);
    writeSeenTipSet(seen);
  }
}

export function resetContextualTips(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(CONTEXTUAL_TIPS_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function hasCompletedFirstUseOnboarding(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(FIRST_USE_ONBOARDING_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markFirstUseOnboardingCompleted(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FIRST_USE_ONBOARDING_KEY, 'true');
  } catch {
    // Ignore
  }
}
