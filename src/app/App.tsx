import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Editor } from '../components/editor/Editor';
import { TabBar } from '../components/tabs/TabBar';
import { CommandPalette } from '../components/search/CommandPalette';
import { ContextMenu } from '../components/sidebar/ContextMenu';
import { PromptDialog } from '../components/dialogs/PromptDialog';
import { MoveNoteDialog } from '../components/dialogs/MoveNoteDialog';
import { NookDropZoneVisual, NookImportSuccessToast } from '../components/mascot/NookMascot';
import { SplashScreen } from '../components/splash/SplashScreen';
import { ThemeBackdrop } from '../components/themes/ThemeBackdrop';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useAutoSave } from '../hooks/useAutoSave';
import { api, isTauri, ConnectionState } from '../services/api';
import { getEnvironmentProfile, installVisualViewportSync } from '../utils/platform';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { WifiOff, RefreshCw, Download, X } from 'lucide-react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { updaterService, UpdaterSnapshot } from '../services/updater';
import {
  hasCompletedFirstUseOnboarding,
  markFirstUseOnboardingCompleted,
} from '../utils/onboardingUtils';
import {
  Collection,
  NoteSummary,
  AppSettings,
  AppLanguage,
  BackupFrequency,
  BackupRetentionDays,
  ContextMenuState,
  ExternalFile,
  TabItem,
  PendingPairRequest,
  DevProjectsConfigMap,
  DevNotesMetaMap,
  DevWorkflowToolId,
  NoteWorkflowRole,
  ProjectDevConfig,
  SupportPreferences,
} from '../types';
import {
  formatHandoffForAgentCopy,
  parseDevNotesMeta,
  parseDevProjectsConfig,
  resolveRootProjectId,
} from '../utils/workflowUtils';
import {
  applyCompletedAction,
  applyInviteLater,
  applyInviteNever,
  applyInviteShown,
  canShowSupportInvite,
  computeActiveDeltaMs,
  loadLocalSupportPreferences,
  mergeSupportPreferences,
  parseSupportPreferences,
  saveLocalSupportPreferences,
} from '../utils/supportUtils';
import { LanguageProvider, formatMessage, hasExplicitStoredLanguage, normalizeLanguage, useTranslation } from '../i18n';
import { MobileTopBar } from '../components/mobile/MobileTopBar';
import { MobilePairingView } from '../components/mobile/MobilePairingView';
import { NookMobileModal } from '../components/mobile/NookMobileModal';
import { MobilePairApprovalDialog } from '../components/mobile/MobilePairApprovalDialog';

// Code-splitting / Lazy loading for secondary dialogs to optimize initial bundle & startup
const SettingsModal = lazy(() =>
  import('../components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const TrashView = lazy(() =>
  import('../components/sidebar/TrashView').then((m) => ({ default: m.TrashView }))
);
const VersionHistoryDialog = lazy(() =>
  import('../components/dialogs/VersionHistoryDialog').then((m) => ({ default: m.VersionHistoryDialog }))
);
const OnboardingModal = lazy(() =>
  import('../components/onboarding/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);
const NookVoiceModal = lazy(() =>
  import('../components/mobile/voice/NookVoiceModal').then((m) => ({ default: m.NookVoiceModal }))
);
const ProjectToolsModal = lazy(() =>
  import('../components/tools/ProjectToolsModal').then((m) => ({ default: m.ProjectToolsModal }))
);
const SupportInviteCard = lazy(() =>
  import('../components/support/SupportInviteCard').then((m) => ({ default: m.SupportInviteCard }))
);

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'gray',
  language: 'en',
  accentColor: '#ECECEC',
  editorFont: "'Inter', sans-serif",
  editorFontSize: 15,
  lineWrapping: true,
  showLineNumbers: false,
  lineHeight: 1.65,
  readingWidth: 'comfortable',
  paragraphSpacing: 'comfortable',
  backgroundDecorations: 'subtle',
  restoreLastNote: true,
  confirmPermanentDelete: true,
  lastOpenedNoteId: null,
  developerWorkflowEnabled: false,
  autoBackupEnabled: true,
  backupFrequency: 'daily',
  backupRetentionDays: 7,
  autoUpdateCheck: true,
};

interface AppWorkspaceProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const AppWorkspace: React.FC<AppWorkspaceProps> = ({ settings, setSettings }) => {
  const { t, format } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  // Collections & Notes
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Active Note Editor Buffer
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [activeNoteUpdatedAt, setActiveNoteUpdatedAt] = useState<number | null>(null);

  // External File Mode
  const [externalFile, setExternalFile] = useState<ExternalFile | null>(null);
  const [isExternalDirty, setIsExternalDirty] = useState(false);

  // Live concurrency & identity guards to prevent async race overwrites
  const activeNoteIdRef = useRef<string | null>(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const externalFileRef = useRef<ExternalFile | null>(externalFile);
  externalFileRef.current = externalFile;
  const activeTabIdRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const flushNowRef = useRef<() => Promise<void>>(async () => {});
  const handleOpenExternalFileRef = useRef<(path?: string) => Promise<void>>(async () => {});
  const hasDoneInitialRestoreRef = useRef(false);

  // Multi-Tab Management (Max 5 Tabs)
  const MAX_TABS = 5;
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  activeTabIdRef.current = activeTabId;

  // Sidebar Collapse (+ temporary responsive auto-collapse without clobbering preference)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [narrowSidebarOverride, setNarrowSidebarOverride] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Modals & Overlays (skip splash directly when arriving via mobile QR pairing code)
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined' && !isTauri()) {
      return !new URLSearchParams(window.location.search).get('pair');
    }
    return true;
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'appearance' | 'editor' | 'language' | 'general' | 'data' | 'mobile' | 'about' | undefined
  >(undefined);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isMoveNoteOpen, setIsMoveNoteOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'welcome' | 'help'>('welcome');
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [noteToMoveId, setNoteToMoveId] = useState<string | null>(null);
  const [updaterSnapshot, setUpdaterSnapshot] = useState<UpdaterSnapshot>(() => updaterService.getSnapshot());
  const [updaterPendingOpNotice, setUpdaterPendingOpNotice] = useState<string | null>(null);
  const [confirmCornerUpdateRestart, setConfirmCornerUpdateRestart] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [webAssetUpdateAvailable, setWebAssetUpdateAvailable] = useState(false);

  // Developer Workflow State (Local-first, lazy-loaded & optional)
  const [devProjectsConfig, setDevProjectsConfig] = useState<DevProjectsConfigMap>({});
  const [devNotesMeta, setDevNotesMeta] = useState<DevNotesMetaMap>({});
  const [projectToolsState, setProjectToolsState] = useState<{
    isOpen: boolean;
    projectId: string | null;
    tool: DevWorkflowToolId;
    promptNoteId?: string | null;
  }>({
    isOpen: false,
    projectId: null,
    tool: 'context-pack',
    promptNoteId: null,
  });

  // Nook Mobile & Responsive Environment Profile (Runtime separated from Layout width)
  const [initialEnv] = useState(() => getEnvironmentProfile());
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(initialEnv.isCompactViewport);
  const [isNarrowDesktop, setIsNarrowDesktop] = useState<boolean>(initialEnv.isNarrowDesktop);
  const [isTouchMobileRuntime, setIsTouchMobileRuntime] = useState<boolean>(initialEnv.isMobilePlatform);
  const isMobileViewportRef = useRef(isMobileViewport);
  isMobileViewportRef.current = isMobileViewport;
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('pair');
  });
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isMobileActive, setIsMobileActive] = useState(false);
  const [pendingPairRequest, setPendingPairRequest] = useState<PendingPairRequest | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    api.getConnectionState()
  );
  const connectionStateRef = useRef<ConnectionState>(connectionState);
  connectionStateRef.current = connectionState;

  // Drag & Drop Feedback Overlay & Toast States
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const [importedToastName, setImportedToastName] = useState<string | null>(null);

  // Voluntary Support State (Local-first, synced cleanly across Desktop & Web, zero tracking)
  const [supportPrefs, setSupportPrefs] = useState<SupportPreferences>(
    () => loadLocalSupportPreferences().prefs
  );
  const supportPrefsRef = useRef(supportPrefs);
  supportPrefsRef.current = supportPrefs;
  const [isSupportInviteOpen, setIsSupportInviteOpen] = useState(false);
  const [hasMountedSupportInvite, setHasMountedSupportInvite] = useState(false);
  const isSupportInviteOpenRef = useRef(isSupportInviteOpen);
  isSupportInviteOpenRef.current = isSupportInviteOpen;
  const supportDismissedSessionRef = useRef(false);
  const sessionStartedAtRef = useRef<number>(Date.now());
  const lastInteractionAtRef = useRef<number>(Date.now());
  const lastTypingAtRef = useRef<number>(0);
  const lastUsageTickAtRef = useRef<number>(Date.now());
  const isExternalDirtyRef = useRef(isExternalDirty);
  isExternalDirtyRef.current = isExternalDirty;
  const saveStatusRef = useRef<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const hasBlockingSupportFlowRef = useRef(false);
  const isVoiceModalOpenRef = useRef(isVoiceModalOpen);
  isVoiceModalOpenRef.current = isVoiceModalOpen;
  const isAutoBackupInFlightRef = useRef(false);
  const initialServerVersionRef = useRef<string | null>(null);
  const hadPreExistingProfileRef = useRef<boolean>(
    typeof window !== 'undefined'
      ? !!(
          localStorage.getItem('nook_onboarding_completed') ||
          localStorage.getItem('nook_settings') ||
          localStorage.getItem('lumina_settings')
        )
      : false
  );

  const updateSupportPrefs = useCallback(
    (updater: (prev: SupportPreferences) => SupportPreferences, persistRemote = true) => {
      setSupportPrefs((prev) => {
        const next = updater(prev);
        supportPrefsRef.current = next;
        saveLocalSupportPreferences(next);
        if (persistRemote) {
          api.saveSetting('support_prefs', JSON.stringify(next)).catch(() => {});
        }
        return next;
      });
    },
    []
  );

  const handleOpenSupport = useCallback(() => {
    api.openSponsorsPage().catch(() => {
      alert(tRef.current.support.openErrorToast);
    });
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'root',
  });

  // Prompt Dialog State
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    initialValue?: string;
    placeholder?: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Apply theme & persist settings snapshot to localStorage
  useEffect(() => {
    let activeTheme = (settings.theme as string) || 'gray';
    // Backwards compatibility for legacy saved theme strings
    if (activeTheme === 'oled') activeTheme = 'dark';
    if (activeTheme === 'light') activeTheme = 'white';
    if (activeTheme === 'pink') activeTheme = 'sakura';
    if (!['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(activeTheme)) {
      activeTheme = 'gray';
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    // Remove inline style overrides so theme.css defines the exact color harmony
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--accent-foreground');
    document.documentElement.style.removeProperty('--primary-foreground');

    const snapshot = { ...settings, theme: activeTheme };
    localStorage.setItem('nook_settings', JSON.stringify(snapshot));
    localStorage.setItem('lumina_settings', JSON.stringify(snapshot));
    localStorage.setItem('nook_language', normalizeLanguage(settings.language));
  }, [settings]);

  // Persist theme to SQLite backend so Nook Web and Desktop share the same theme
  useEffect(() => {
    let activeTheme = (settings.theme as string) || 'gray';
    if (activeTheme === 'oled') activeTheme = 'dark';
    if (activeTheme === 'light') activeTheme = 'white';
    if (activeTheme === 'pink') activeTheme = 'sakura';
    if (!['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(activeTheme)) {
      activeTheme = 'gray';
    }
    api.saveSetting('theme', activeTheme).catch(() => {});
  }, [settings.theme]);

  // Load Initial Data (stable callback: never re-runs initial note restoration on note switch)
  const loadInitialData = useCallback(async () => {
    try {
      const shouldCheckStartupRestore = !hasDoneInitialRestoreRef.current;
      hasDoneInitialRestoreRef.current = true;

      const [colls, activeNotes, dbSettings, initialFile] = await Promise.all([
        api.getCollections(),
        api.getActiveNotes(),
        api.getSettings().catch(() => []),
        shouldCheckStartupRestore && isTauri()
          ? api.getInitialFile().catch(() => null)
          : Promise.resolve(null),
      ]);
      setCollections(colls);
      setNotes(activeNotes);

      // Apply saved theme & language from SQLite database (vital for Nook Web in browser!)
      if (Array.isArray(dbSettings) && dbSettings.length > 0) {
        const themeItem = dbSettings.find((s) => s.key === 'theme');
        if (themeItem && themeItem.value) {
          let tVal = themeItem.value;
          if (tVal === 'oled') tVal = 'dark';
          if (tVal === 'light') tVal = 'white';
          if (tVal === 'pink') tVal = 'sakura';
          if (['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(tVal)) {
            document.documentElement.setAttribute('data-theme', tVal);
            setSettings((prev) => ({ ...prev, theme: tVal as any }));
          }
        }
        const langItem = dbSettings.find((s) => s.key === 'language');
        if (langItem && langItem.value) {
          const normalizedLang = normalizeLanguage(langItem.value);
          setSettings((prev) =>
            prev.language === normalizedLang ? prev : { ...prev, language: normalizedLang }
          );
        } else if (
          !hasExplicitStoredLanguage() &&
          (activeNotes.length > 0 || colls.length > 0) &&
          dbSettings.some((s) => s.key === 'support_prefs')
        ) {
          // Preserve pre-i18n Brazilian Portuguese desktop libraries smoothly on first upgrade
          setSettings((prev) => (prev.language === 'pt' ? prev : { ...prev, language: 'pt' }));
        }

        const backupEnabledItem = dbSettings.find((s) => s.key === 'backup_enabled');
        const backupFreqItem = dbSettings.find((s) => s.key === 'backup_frequency');
        const backupRetItem = dbSettings.find((s) => s.key === 'backup_retention_days');
        const autoUpdateItem = dbSettings.find((s) => s.key === 'auto_update_check');
        if (backupEnabledItem || backupFreqItem || backupRetItem || autoUpdateItem) {
          setSettings((prev) => ({
            ...prev,
            ...(backupEnabledItem ? { autoBackupEnabled: backupEnabledItem.value !== 'false' } : {}),
            ...(backupFreqItem && ['12h', 'daily', 'weekly'].includes(backupFreqItem.value)
              ? { backupFrequency: backupFreqItem.value as BackupFrequency }
              : {}),
            ...(backupRetItem && [7, 14, 30].includes(Number(backupRetItem.value))
              ? { backupRetentionDays: Number(backupRetItem.value) as BackupRetentionDays }
              : {}),
            ...(autoUpdateItem ? { autoUpdateCheck: autoUpdateItem.value !== 'false' } : {}),
          }));
        }
        const wfItem = dbSettings.find((s) => s.key === 'developer_workflow_enabled');
        if (wfItem) {
          const enabled = wfItem.value === 'true';
          setSettings((prev) =>
            !!prev.developerWorkflowEnabled === enabled
              ? prev
              : { ...prev, developerWorkflowEnabled: enabled }
          );
        }
        const devProjItem = dbSettings.find((s) => s.key === 'dev_projects_config');
        if (devProjItem) {
          setDevProjectsConfig(parseDevProjectsConfig(devProjItem.value));
        }
        const devNotesItem = dbSettings.find((s) => s.key === 'dev_notes_meta');
        if (devNotesItem) {
          setDevNotesMeta(parseDevNotesMeta(devNotesItem.value));
        }
        const appearancePrefsItem = dbSettings.find((s) => s.key === 'appearance_prefs');
        if (appearancePrefsItem?.value) {
          try {
            const parsed = JSON.parse(appearancePrefsItem.value);
            if (parsed && typeof parsed === 'object') {
              setSettings((prev) => ({
                ...prev,
                ...(typeof parsed.editorFont === 'string' ? { editorFont: parsed.editorFont } : {}),
                ...(typeof parsed.editorFontSize === 'number' ? { editorFontSize: parsed.editorFontSize } : {}),
                ...(typeof parsed.lineHeight === 'number' ? { lineHeight: parsed.lineHeight } : {}),
                ...(typeof parsed.lineWrapping === 'boolean' ? { lineWrapping: parsed.lineWrapping } : {}),
                ...(typeof parsed.showLineNumbers === 'boolean' ? { showLineNumbers: parsed.showLineNumbers } : {}),
                ...(parsed.readingWidth ? { readingWidth: parsed.readingWidth } : {}),
                ...(parsed.paragraphSpacing ? { paragraphSpacing: parsed.paragraphSpacing } : {}),
                ...(parsed.backgroundDecorations ? { backgroundDecorations: parsed.backgroundDecorations } : {}),
              }));
            }
          } catch {
            // ignore invalid JSON
          }
        }
      }

      // Hydrate or migrate voluntary support preferences without resetting state
      const supportItem = Array.isArray(dbSettings)
        ? dbSettings.find((s) => s.key === 'support_prefs')
        : undefined;
      if (supportItem?.value) {
        const remoteSupport = parseSupportPreferences(supportItem.value);
        setSupportPrefs((prev) => {
          const merged = mergeSupportPreferences(prev, remoteSupport, true);
          supportPrefsRef.current = merged;
          saveLocalSupportPreferences(merged);
          return merged;
        });
      } else {
        saveLocalSupportPreferences(supportPrefsRef.current);
        api.saveSetting('support_prefs', JSON.stringify(supportPrefsRef.current)).catch(() => {});
      }

      // Schedule discreet idle-aware automatic backup (respecting configured 12h/daily/weekly policy)
      window.setTimeout(() => {
        const msSinceTyping = Date.now() - lastTypingAtRef.current;
        if (!isDirtyRef.current && !isExternalDirtyRef.current && msSinceTyping > 2500) {
          isAutoBackupInFlightRef.current = true;
          api
            .triggerAutoBackup(false)
            .catch((err) => console.error('Discreet auto backup skipped:', err))
            .finally(() => {
              isAutoBackupInFlightRef.current = false;
            });
        }
      }, 2500);

      // In Web/Mobile runtime, inspect server version cleanly for stale UI asset detection
      if (!isTauri()) {
        api.getServerStatus().then((st) => {
          if (st?.version) {
            setServerVersion(st.version);
            if (!initialServerVersionRef.current) {
              initialServerVersionRef.current = st.version;
            } else if (initialServerVersionRef.current !== st.version) {
              setWebAssetUpdateAvailable(true);
            }
          }
        }).catch(() => {});
      }

      // Priority 1: External file passed from Windows CLI / Explorer double-click
      if (initialFile) {
        await handleOpenExternalFileRef.current(initialFile);
        return;
      }

      // Priority 2: On cold startup only, restore last opened note if nothing else was already opened
      if (shouldCheckStartupRestore && loadSeqRef.current === 0 && !externalFileRef.current) {
        const curSettings = settingsRef.current;
        const isMob = isMobileViewportRef.current;
        if (curSettings.restoreLastNote && curSettings.lastOpenedNoteId) {
          const found = activeNotes.find((n) => n.id === curSettings.lastOpenedNoteId);
          if (found) {
            await openNote(found.id);
          } else if (isMob && activeNotes.length > 0) {
            await openNote(activeNotes[0].id);
          }
        } else if (isMob && activeNotes.length > 0) {
          await openNote(activeNotes[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await loadInitialData();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    init();

    // First-open multilingual onboarding (never re-shown to upgrading existing users or mobile pairing sessions)
    const completed = localStorage.getItem('nook_onboarding_completed');
    if (!completed && !pairCode) {
      if (hadPreExistingProfileRef.current) {
        markFirstUseOnboardingCompleted();
      } else {
        setOnboardingMode('welcome');
        setIsOnboardingOpen(true);
      }
    }

    // Real-time synchronization (Desktop <-> Web WebSocket sync)
    const unsubscribeSync = api.onSync((event, data) => {
      if (!isMounted) return;

      if (event === 'note.saved' || event === 'note.updated' || event === 'note.restored_version') {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === data.id ? { ...n, title: data.title, updated_at: data.updated_at ?? n.updated_at } : n
          )
        );
        setTabs((prev) =>
          prev.map((t) => (t.id === data.id ? { ...t, title: data.title } : t))
        );
        if (data.id && data.content !== undefined && activeNoteIdRef.current === data.id && !externalFileRef.current) {
          setTitle((currTitle) => (currTitle !== data.title ? data.title : currTitle));
          setContent((currContent) => (currContent !== data.content ? data.content : currContent));
          if (typeof data.updated_at === 'number') {
            setActiveNoteUpdatedAt(data.updated_at);
          }
        }
      } else if (event === 'note.title_updated') {
        setNotes((prev) =>
          prev.map((n) => (n.id === data.id ? { ...n, title: data.title } : n))
        );
        setTabs((prev) =>
          prev.map((t) => (t.id === data.id ? { ...t, title: data.title } : t))
        );
        if (data.id && activeNoteIdRef.current === data.id && !externalFileRef.current) {
          setTitle((currTitle) => (currTitle !== data.title ? data.title : currTitle));
        }
      } else if (event === 'note.permanent_deleted') {
        if (data?.id) {
          setTabs((prev) => prev.filter((t) => t.id !== data.id));
          if (activeNoteIdRef.current === data.id && !externalFileRef.current) {
            setActiveNoteId(null);
            setActiveNoteUpdatedAt(null);
            setActiveTabId(null);
            setTitle('');
            setContent('');
          }
        }
        api.getActiveNotes().then((freshNotes) => {
          if (isMounted) setNotes(freshNotes);
        }).catch(console.error);
      } else if (
        event === 'note.created' ||
        event === 'note.deleted' ||
        event === 'note.restored' ||
        event === 'note.moved' ||
        event === 'note.pinned' ||
        event === 'note.pin_toggled' ||
        event === 'trash.emptied'
      ) {
        if ((event === 'note.pinned' || event === 'note.pin_toggled') && data?.id && typeof data?.is_pinned === 'boolean') {
          setTabs((prev) =>
            prev.map((t) => (t.id === data.id ? { ...t, isPinned: data.is_pinned } : t))
          );
          if (activeNoteIdRef.current === data.id && !externalFileRef.current) {
            setIsPinned(data.is_pinned);
          }
        }
        api.getActiveNotes().then((freshNotes) => {
          if (isMounted) setNotes(freshNotes);
        }).catch(console.error);
      } else if (
        event === 'collection.created' ||
        event === 'collection.renamed' ||
        event === 'collection.moved' ||
        event === 'collection.reordered' ||
        event === 'collection.deleted' ||
        event === 'collection.restored'
      ) {
        api.getCollections().then((freshCollections) => {
          if (isMounted) setCollections(freshCollections);
        }).catch(console.error);
      } else if (event === 'settings.updated') {
        const key = data?.key || data?.payload?.key;
        const val = data?.value || data?.payload?.value;
        if (key === 'theme' && val) {
          let tVal = val;
          if (tVal === 'oled') tVal = 'dark';
          if (tVal === 'light') tVal = 'white';
          if (tVal === 'pink') tVal = 'sakura';
          if (['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(tVal)) {
            document.documentElement.setAttribute('data-theme', tVal);
            setSettings((prev) => ({ ...prev, theme: tVal as any }));
          }
        } else if (key === 'language' && val) {
          const normalizedLang = normalizeLanguage(val);
          setSettings((prev) =>
            prev.language === normalizedLang ? prev : { ...prev, language: normalizedLang }
          );
        } else if (key === 'developer_workflow_enabled') {
          const enabled = val === 'true';
          setSettings((prev) => ({ ...prev, developerWorkflowEnabled: enabled }));
        } else if (key === 'dev_projects_config') {
          setDevProjectsConfig(parseDevProjectsConfig(val));
        } else if (key === 'dev_notes_meta') {
          setDevNotesMeta(parseDevNotesMeta(val));
        } else if (key === 'appearance_prefs' && val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object') {
              setSettings((prev) => ({ ...prev, ...parsed }));
            }
          } catch {
            // ignore invalid JSON
          }
        } else if (key === 'support_prefs' && val) {
          const remoteSupport = parseSupportPreferences(val);
          setSupportPrefs((prev) => {
            const merged = mergeSupportPreferences(prev, remoteSupport, true);
            supportPrefsRef.current = merged;
            saveLocalSupportPreferences(merged);
            if (merged.neverShowAgain || !merged.showInvitesSetting) {
              setIsSupportInviteOpen(false);
            }
            return merged;
          });
        }
      } else if (event === 'mobile.pair_requested') {
        const req = data?.data || data;
        if (req && req.request_id) {
          setPendingPairRequest(req);
        }
      } else if (event === 'mobile.access_updated') {
        if (data && typeof data.active === 'boolean') {
          setIsMobileActive(data.active);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeSync();
    };
  }, [loadInitialData]);

  // Viewport + Virtual Keyboard CSS Sync + Connection State Tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cleanupVisualViewport = installVisualViewportSync();

    const checkLayout = () => {
      const profile = getEnvironmentProfile();
      setIsMobileViewport(profile.isCompactViewport);
      setIsNarrowDesktop((prev) => {
        if (prev !== profile.isNarrowDesktop && !profile.isNarrowDesktop) {
          setNarrowSidebarOverride(false);
        }
        return profile.isNarrowDesktop;
      });
      setIsTouchMobileRuntime(profile.isMobilePlatform);
    };

    window.addEventListener('resize', checkLayout);
    let wasDisconnected = false;
    const unsubConn = api.onConnectionStateChange((nextState) => {
      setConnectionState(nextState);
      if (nextState === 'connected' && wasDisconnected) {
        wasDisconnected = false;
        flushNowRef.current().then(() => {
          loadInitialData();
        }).catch(() => {});
      } else if (nextState !== 'connected') {
        wasDisconnected = true;
      }
    });

    return () => {
      cleanupVisualViewport();
      window.removeEventListener('resize', checkLayout);
      unsubConn();
    };
  }, [loadInitialData]);

  // Updater Subscription, Daily Background Check & Quiet Periodic Backup Scheduler
  useEffect(() => {
    const unsubUpdater = updaterService.subscribe(setUpdaterSnapshot);

    let initialUpdateTimer: number | null = null;
    if (isTauri()) {
      initialUpdateTimer = window.setTimeout(() => {
        updaterService
          .checkForUpdates({
            manual: false,
            autoEnabled: settingsRef.current.autoUpdateCheck !== false,
          })
          .catch(() => {});
      }, 5500);
    }

    // Quiet 30-minute auto-backup opportunity check (deferred whenever user is typing/saving)
    const backupIntervalId = window.setInterval(() => {
      if (!isTauri() || settingsRef.current.autoBackupEnabled === false) return;
      const msSinceTyping = Date.now() - lastTypingAtRef.current;
      if (
        isDirtyRef.current ||
        isExternalDirtyRef.current ||
        saveStatusRef.current !== 'saved' ||
        msSinceTyping < 10000 ||
        isAutoBackupInFlightRef.current
      ) {
        return;
      }
      isAutoBackupInFlightRef.current = true;
      api
        .triggerAutoBackup(false)
        .catch(() => {})
        .finally(() => {
          isAutoBackupInFlightRef.current = false;
        });
    }, 30 * 60 * 1000);

    return () => {
      unsubUpdater();
      if (initialUpdateTimer !== null) window.clearTimeout(initialUpdateTimer);
      window.clearInterval(backupIntervalId);
    };
  }, []);

  // Desktop Mobile Status & Event Listeners
  useEffect(() => {
    if (!isTauri()) return;

    api.getMobileStatus().then((st) => {
      setIsMobileActive(st.active);
    }).catch(() => {});

    let isCancelled = false;
    let unlistenPair: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    import('@tauri-apps/api/event').then(({ listen }) => {
      if (isCancelled) return;
      listen<any>('nook-mobile-pair-requested', (event) => {
        const req = event.payload?.data || event.payload;
        if (!isCancelled && req && req.request_id) {
          setPendingPairRequest(req);
        }
      }).then((un) => {
        if (isCancelled) un();
        else unlistenPair = un;
      });

      listen<any>('mobile-access-updated', (event) => {
        if (!isCancelled && event.payload && typeof event.payload.active === 'boolean') {
          setIsMobileActive(event.payload.active);
        }
      }).then((un) => {
        if (isCancelled) un();
        else unlistenStatus = un;
      });
    }).catch(console.warn);

    return () => {
      isCancelled = true;
      if (unlistenPair) unlistenPair();
      if (unlistenStatus) unlistenStatus();
    };
  }, []);

  // Window startup: guarantee maximized state and support F11 fullscreen toggle
  useEffect(() => {
    if (!isTauri()) return;

    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.maximize().catch(() => {});
        win.setFocus().catch(() => {});
      })
      .catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow();
          const isFull = await win.isFullscreen();
          await win.setFullscreen(!isFull);
        }).catch(() => {});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-refresh when returning to app (window focus, visibilitychange, or restore event from Web)
  useEffect(() => {
    const handleRefresh = async () => {
      try {
        const [freshNotes, freshColls] = await Promise.all([
          api.getActiveNotes(),
          api.getCollections(),
        ]);
        setNotes(freshNotes);
        setCollections(freshColls);

        // CRITICAL: Never touch title/content when viewing/editing an external file or during dirty typing
        const targetNoteId = activeNoteIdRef.current;
        if (!targetNoteId || externalFileRef.current || isDirtyRef.current) {
          return;
        }

        const freshCurrent = await api.getNoteById(targetNoteId);
        // Re-verify after async await that we didn't switch to another note or external file!
        if (
          freshCurrent &&
          activeNoteIdRef.current === targetNoteId &&
          !externalFileRef.current &&
          !isDirtyRef.current
        ) {
          setTitle((curr) => (curr !== freshCurrent.title ? freshCurrent.title : curr));
          setContent((curr) => (curr !== freshCurrent.content ? freshCurrent.content : curr));
        }
      } catch (err) {
        console.warn('Auto refresh error:', err);
      }
    };

    // 1. Window focus & visibility change
    const onFocus = () => handleRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // 2. Tauri native focus and reload events
    let isCancelled = false;
    let unlistenTauriFocus: (() => void) | undefined;
    let unlistenTauriReload: (() => void) | undefined;

    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        if (isCancelled) return;
        listen('tauri://focus', () => handleRefresh()).then((un) => {
          if (isCancelled) un();
          else unlistenTauriFocus = un;
        });
        listen('nook-reload', () => handleRefresh()).then((un) => {
          if (isCancelled) un();
          else unlistenTauriReload = un;
        });
      }).catch(console.error);
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (unlistenTauriFocus) unlistenTauriFocus();
      if (unlistenTauriReload) unlistenTauriReload();
    };
  }, []);

  // Web browser tab close: automatically restore desktop application from tray
  useEffect(() => {
    if (isTauri()) return;

    const handleRestoreOnUnload = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/app/restore');
        } else {
          fetch('/api/app/restore', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleRestoreOnUnload);
    window.addEventListener('pagehide', handleRestoreOnUnload);

    return () => {
      window.removeEventListener('beforeunload', handleRestoreOnUnload);
      window.removeEventListener('pagehide', handleRestoreOnUnload);
    };
  }, []);

  // Auto-Save Hook
  const { status: saveStatus, flushNow, cancelPendingSave } = useAutoSave({
    noteId: activeNoteId,
    title,
    content,
    isExternal: !!externalFile,
    externalPath: externalFile?.path,
    canAutoSaveExternal: isExternalDirty,
    baseUpdatedAt: activeNoteUpdatedAt,
    onSaved: (id, newTitle, updatedAt) => {
      if (id === activeNoteIdRef.current && !externalFileRef.current) {
        setActiveNoteUpdatedAt(updatedAt);
      }
      // Update note in list
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, title: newTitle, updated_at: updatedAt } : n))
      );
      // Update tab title
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
      );
    },
  });
  flushNowRef.current = flushNow;
  isDirtyRef.current = saveStatus === 'unsaved' || saveStatus === 'saving';
  saveStatusRef.current = saveStatus;

  const isBlockingSupportModalOpen =
    showSplash ||
    isCommandPaletteOpen ||
    isSettingsOpen ||
    isTrashOpen ||
    isMoveNoteOpen ||
    isVersionHistoryOpen ||
    isOnboardingOpen ||
    isMobileHelpOpen ||
    isVoiceModalOpen ||
    isMobileModalOpen ||
    isMobileDrawerOpen ||
    projectToolsState.isOpen ||
    promptDialog.isOpen ||
    !!pendingPairRequest ||
    contextMenu.isOpen ||
    isWindowDragOver ||
    !!pairCode;
  hasBlockingSupportFlowRef.current = isBlockingSupportModalOpen;

  useEffect(() => {
    if (isSupportInviteOpen && (isBlockingSupportModalOpen || isMobileViewport)) {
      setIsSupportInviteOpen(false);
    }
  }, [isSupportInviteOpen, isBlockingSupportModalOpen, isMobileViewport]);

  // Low-frequency active usage tracking (60s) + calm-moment evaluator (zero keylogging/telemetry)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let lastRecordedActivity = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity < 2000) return;
      lastRecordedActivity = now;
      lastInteractionAtRef.current = now;
    };

    const flushActiveSegment = (endedNow: number, assumeWasActive: boolean) => {
      const elapsed = endedNow - lastUsageTickAtRef.current;
      lastUsageTickAtRef.current = endedNow;
      const delta = computeActiveDeltaMs({
        elapsedMs: elapsed,
        isVisible: assumeWasActive ? true : document.visibilityState === 'visible',
        hasFocus: assumeWasActive
          ? true
          : typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : true,
        msSinceLastInteraction: endedNow - lastInteractionAtRef.current,
      });
      if (delta > 0) {
        updateSupportPrefs((prev) => ({
          ...prev,
          activeUsageMs: prev.activeUsageMs + delta,
        }));
      }
    };

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        flushActiveSegment(now, true);
      } else {
        lastUsageTickAtRef.current = now;
        lastInteractionAtRef.current = now;
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      lastUsageTickAtRef.current = now;
      lastInteractionAtRef.current = now;
    };

    const handleBlur = () => {
      flushActiveSegment(Date.now(), true);
    };

    const handlePageHide = () => {
      flushActiveSegment(Date.now(), true);
    };

    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      flushActiveSegment(now, false);

      if (isSupportInviteOpenRef.current) return;

      const eligible = canShowSupportInvite(supportPrefsRef.current, {
        now,
        sessionStartedAt: sessionStartedAtRef.current,
        msSinceLastInteraction: now - lastInteractionAtRef.current,
        msSinceLastTyping:
          lastTypingAtRef.current > 0
            ? now - lastTypingAtRef.current
            : now - sessionStartedAtRef.current,
        dismissedThisSession: supportDismissedSessionRef.current,
        isMobileViewport: isMobileViewportRef.current,
        isVisible: document.visibilityState === 'visible',
        hasFocus: typeof document.hasFocus === 'function' ? document.hasFocus() : true,
        isSavingOrDirty:
          isDirtyRef.current || isExternalDirtyRef.current || saveStatusRef.current !== 'saved',
        hasSyncError: connectionStateRef.current !== 'connected',
        hasBlockingModalOrFlow: hasBlockingSupportFlowRef.current,
      });

      if (eligible) {
        supportDismissedSessionRef.current = true;
        updateSupportPrefs((prev) => applyInviteShown(prev, now));
        setHasMountedSupportInvite(true);
        setIsSupportInviteOpen(true);
      }
    }, 60_000);

    return () => {
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [updateSupportPrefs]);

  // Open a Note (Flushes previous note first!)
  const openNote = async (noteId: string) => {
    if (activeNoteIdRef.current === noteId && activeTabIdRef.current === noteId && !externalFileRef.current) return;

    // Flush any pending save on previous doc
    await flushNowRef.current();
    const seq = ++loadSeqRef.current;

    try {
      const note = await api.getNoteById(noteId);
      if (seq !== loadSeqRef.current) return;
      if (note) {
        setExternalFile(null);
        setIsExternalDirty(false);
        setActiveNoteId(note.id);
        setActiveNoteUpdatedAt(note.updated_at);
        setTitle(note.title);

        // Check if there is a newer unpersisted draft recovery journal from an unexpected shutdown
        const recoveredRaw = localStorage.getItem(`nook_draft_recovery_${note.id}`);
        let restoredContent = note.content;
        if (recoveredRaw && recoveredRaw.length > 0) {
          try {
            const parsed = JSON.parse(recoveredRaw);
            if (
              parsed &&
              typeof parsed.content === 'string' &&
              typeof parsed.timestamp === 'number' &&
              parsed.timestamp > note.updated_at &&
              parsed.content !== note.content
            ) {
              restoredContent = parsed.content;
            } else {
              localStorage.removeItem(`nook_draft_recovery_${note.id}`);
            }
          } catch {
            // Discard corrupted/legacy draft instead of overwriting saved SQLite note
            localStorage.removeItem(`nook_draft_recovery_${note.id}`);
          }
        }
        setContent(restoredContent);

        setIsPinned(note.is_pinned);

        // Multi-Tab Sync (Max 5 Tabs)
        setTabs((prev) => {
          const exists = prev.some((t) => t.id === note.id);
          if (exists) {
            return prev.map((t) =>
              t.id === note.id ? { ...t, title: note.title, isPinned: note.is_pinned } : t
            );
          }
          const newTab: TabItem = {
            id: note.id,
            type: 'note',
            title: note.title || tRef.current.common.untitled,
            isPinned: note.is_pinned,
          };
          if (prev.length < MAX_TABS) {
            return [...prev, newTab];
          }
          // If already 5 tabs, replace active tab
          return prev.map((t) => (t.id === activeTabIdRef.current ? newTab : t));
        });

        setActiveTabId(note.id);

        // Update settings last opened note
        setSettings((prev) => ({ ...prev, lastOpenedNoteId: note.id }));
      }
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  };

  // Import File (.txt / .md) from Drag & Drop or Explorer
  const handleImportFile = async (file: File, collectionId?: string | null) => {
    await flushNowRef.current();
    try {
      const fileContent = await file.text();
      const cleanTitle = file.name.replace(/\.(txt|md|markdown)$/i, '') || tRef.current.appAlerts.importedNoteDefault;
      const newNote = await api.createNote(collectionId ?? null, cleanTitle, fileContent);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      await openNote(newNote.id);
    } catch (err) {
      console.error('Failed to import file:', err);
    }
  };

  // Open or Create Starter Note for Onboarding
  const handleOpenStarterNote = async () => {
    await flushNowRef.current();
    try {
      const existingStarter = notes.find((n) => {
        const lower = n.title.toLowerCase();
        return (
          lower.includes('bem-vindo ao nook') ||
          lower.includes('welcome to nook') ||
          lower.includes('bienvenido a nook')
        );
      });
      if (existingStarter) {
        await openNote(existingStarter.id);
      } else {
        const { starterNote } = tRef.current;
        const newNote = await api.createNote(null, `${starterNote.title} 🐾`, starterNote.content);
        const activeNotes = await api.getActiveNotes();
        setNotes(activeNotes);
        await openNote(newNote.id);
      }
    } catch (err) {
      console.error('Failed to open starter note:', err);
      await handleCreateQuickNote();
    }
  };

  // Create Quick Note
  const handleCreateQuickNote = async () => {
    await flushNowRef.current();
    try {
      const newNote = await api.createNote(null, tRef.current.common.untitled, '');
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      updateSupportPrefs(applyCompletedAction);
      await openNote(newNote.id);
    } catch (err) {
      console.error('Failed to create quick note:', err);
    }
  };

  // Create Note in Collection
  const handleCreateNoteInCollection = async (collectionId: string) => {
    await flushNowRef.current();
    try {
      const newNote = await api.createNote(collectionId, tRef.current.common.untitled, '');
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      updateSupportPrefs(applyCompletedAction);
      await openNote(newNote.id);
    } catch (err) {
      console.error('Failed to create note in collection:', err);
    }
  };

  // Create Project Prompt
  const handleCreateProjectPrompt = () => {
    setPromptDialog({
      isOpen: true,
      title: tRef.current.dialogs.newProjectPrompt,
      placeholder: tRef.current.dialogs.newProjectPlaceholder,
      initialValue: '',
      onConfirm: async (name) => {
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.createCollection(name, 'project', null);
          const colls = await api.getCollections();
          setCollections(colls);
          updateSupportPrefs(applyCompletedAction);
        } catch (err) {
          console.error('Failed to create project:', err);
        }
      },
    });
  };

  // Create Folder in Collection Prompt
  const handleCreateFolderInCollection = (parentId: string) => {
    setPromptDialog({
      isOpen: true,
      title: tRef.current.dialogs.newSubfolderPrompt,
      placeholder: tRef.current.dialogs.subfolderPlaceholder,
      initialValue: '',
      onConfirm: async (name) => {
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.createCollection(name, 'folder', parentId);
          const colls = await api.getCollections();
          setCollections(colls);
        } catch (err) {
          console.error('Failed to create folder:', err);
        }
      },
    });
  };

  // Rename Prompt
  const handleRenamePrompt = (id: string, currentName: string, type: 'note' | 'collection') => {
    setPromptDialog({
      isOpen: true,
      title: type === 'note' ? tRef.current.dialogs.renameNoteTitle : tRef.current.dialogs.renameCollectionTitle,
      initialValue: currentName,
      onConfirm: async (newName) => {
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          if (type === 'note') {
            await api.updateNoteTitle(id, newName);
            if (activeNoteId === id) setTitle(newName);
            const activeNotes = await api.getActiveNotes();
            setNotes(activeNotes);
          } else {
            await api.updateCollectionName(id, newName);
            const colls = await api.getCollections();
            setCollections(colls);
          }
        } catch (err) {
          console.error('Failed to rename:', err);
        }
      },
    });
  };

  // Reorder Collections (Drag & Drop sorting)
  const handleReorderCollections = async (orderedIds: string[]) => {
    setCollections((prev) => {
      const orderMap = new Map<string, number>();
      orderedIds.forEach((id, idx) => orderMap.set(id, idx));
      const updated = prev.map((c) => {
        if (orderMap.has(c.id)) {
          return { ...c, sort_order: orderMap.get(c.id)! };
        }
        return c;
      });
      return [...updated].sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    });

    try {
      await api.reorderCollections(orderedIds);
    } catch (err) {
      console.error('Failed to reorder collections:', err);
      const colls = await api.getCollections();
      setCollections(colls);
    }
  };

  // Soft Delete Note
  const handleDeleteNote = async (id: string) => {
    try {
      if (activeNoteId === id) {
        cancelPendingSave();
        ++loadSeqRef.current;
        setActiveNoteId(null);
        setExternalFile(null);
        setIsExternalDirty(false);
        setActiveTabId(null);
        setTitle('');
        setContent('');
      }
      setTabs((prev) => prev.filter((t) => t.id !== id));
      await api.softDeleteNote(id);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Soft Delete Collection
  const handleDeleteCollection = async (id: string) => {
    try {
      await api.deleteCollection(id);
      const [colls, activeNotes] = await Promise.all([
        api.getCollections(),
        api.getActiveNotes(),
      ]);
      const activeIds = new Set(activeNotes.map((n) => n.id));
      if (activeNoteIdRef.current && !externalFileRef.current && !activeIds.has(activeNoteIdRef.current)) {
        cancelPendingSave();
        ++loadSeqRef.current;
        setActiveNoteId(null);
        setActiveNoteUpdatedAt(null);
        setActiveTabId(null);
        setTitle('');
        setContent('');
      }
      setTabs((prev) => prev.filter((t) => t.type === 'external' || activeIds.has(t.id)));
      setCollections(colls);
      setNotes(activeNotes);
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  };

  // Duplicate Note
  const handleDuplicateNote = async (id: string) => {
    try {
      const duplicated = await api.duplicateNote(id);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      if (duplicated) {
        await openNote(duplicated.id);
      }
    } catch (err) {
      console.error('Failed to duplicate note:', err);
    }
  };

  // Toggle Pin Note
  const handleTogglePinNote = async (id: string) => {
    try {
      const newPinned = await api.togglePinNote(id);
      if (activeNoteId === id) setIsPinned(newPinned);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Move Note
  const handleMoveNote = async (noteId: string, targetCollectionId: string | null) => {
    try {
      await api.moveNote(noteId, targetCollectionId);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
    } catch (err) {
      console.error('Failed to move note:', err);
    }
  };

  // Copy Note Content
  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
  };

  // Navigate Wikilink
  const handleNavigateWikilink = (targetName: string) => {
    const clean = targetName.trim().toLowerCase();
    const found = notes.find((n) => n.title.trim().toLowerCase() === clean);
    if (found) {
      openNote(found.id);
    } else {
      setPromptDialog({
        isOpen: true,
        title: format(tRef.current.dialogs.noteNotFoundCreatePrompt, { name: targetName }),
        initialValue: targetName,
        onConfirm: async (noteTitle) => {
          setPromptDialog((p) => ({ ...p, isOpen: false }));
          const created = await api.createNote(null, noteTitle, `# ${noteTitle}\n\n`);
          await loadInitialData();
          openNote(created.id);
        },
      });
    }
  };

  // Export Note to .md file
  const handleExportNote = async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.title || tRef.current.common.untitled}.md`;
    link.click();
    URL.revokeObjectURL(url);
    updateSupportPrefs(applyCompletedAction);
  };

  // Select Tab
  const handleSelectTab = async (tabId: string, customTabsList?: TabItem[]) => {
    if (tabId === activeTabIdRef.current && !customTabsList) return;
    await flushNowRef.current();
    const seq = ++loadSeqRef.current;

    const currentTabsList = customTabsList || tabs;
    const targetTab = currentTabsList.find((t) => t.id === tabId);
    if (!targetTab) return;

    setActiveTabId(targetTab.id);

    if (targetTab.type === 'note') {
      try {
        const note = await api.getNoteById(targetTab.id);
        if (seq !== loadSeqRef.current) return;
        if (note) {
          setExternalFile(null);
          setIsExternalDirty(false);
          setActiveNoteId(note.id);
          setTitle(note.title);
          setContent(note.content);
          setIsPinned(note.is_pinned);
          setSettings((prev) => ({ ...prev, lastOpenedNoteId: note.id }));
        }
      } catch (err) {
        console.error('Failed to select note tab:', err);
      }
    } else if (targetTab.externalPath) {
      try {
        const fileData = await api.readExternalFile(targetTab.externalPath);
        if (seq !== loadSeqRef.current) return;
        setActiveNoteId(null);
        setIsExternalDirty(false);
        setExternalFile({
          path: fileData.path,
          filename: fileData.filename,
          isModified: false,
        });
        setTitle(fileData.filename);
        setContent(fileData.content);
        setIsPinned(false);
      } catch (err) {
        console.error('Failed to select external tab:', err);
      }
    }
  };

  // Close Tab
  const handleCloseTab = async (tabId: string) => {
    await flushNowRef.current();

    const currentTabs = [...tabs];
    const tabIndex = currentTabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    // If the closed tab was an empty untitled note, clean it up from db/list
    if (activeNoteIdRef.current === tabId) {
      const normalizedTitle = title.trim().toLowerCase();
      const isBlank =
        (!normalizedTitle ||
          normalizedTitle === 'sem título' ||
          normalizedTitle === 'untitled' ||
          normalizedTitle === 'sin título') &&
        !content.trim();
      if (isBlank && !externalFileRef.current) {
        try {
          await api.softDeleteNote(tabId);
          const activeNotes = await api.getActiveNotes();
          setNotes(activeNotes);
        } catch {}
      }
    }

    const remainingTabs = currentTabs.filter((t) => t.id !== tabId);

    if (remainingTabs.length === 0) {
      ++loadSeqRef.current;
      setTabs([]);
      setActiveTabId(null);
      setActiveNoteId(null);
      setExternalFile(null);
      setIsExternalDirty(false);
      setTitle('');
      setContent('');
      return;
    }

    setTabs(remainingTabs);

    if (activeTabIdRef.current === tabId) {
      const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)];
      await handleSelectTab(nextTab.id, remainingTabs);
    }
  };

  // Open External File (.md / .txt) via Native Dialog or Direct Path
  const handleOpenExternalFile = async (targetFilePath?: string) => {
    let filePath = targetFilePath;
    if (!filePath) {
      try {
        const selected = await openFileDialog({
          multiple: false,
          filters: [{ name: tRef.current.dialogs.openMdFilterName, extensions: ['md', 'txt', 'markdown'] }],
        });
        if (!selected || typeof selected !== 'string') return;
        filePath = selected;
      } catch (err) {
        console.warn('Native open file dialog fallback:', err);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md,.markdown';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            await flushNowRef.current();
            const seq = ++loadSeqRef.current;
            const fileContent = reader.result as string;
            if (seq !== loadSeqRef.current) return;
            const tabId = file.name;
            setActiveNoteId(null);
            setIsExternalDirty(false);
            setExternalFile({
              path: file.name,
              filename: file.name,
              isModified: false,
            });
            setTitle(file.name);
            setContent(fileContent);
            setIsPinned(false);

            setTabs((prev) => {
              const newTab: TabItem = {
                id: tabId,
                type: 'external',
                title: file.name,
                externalPath: file.name,
              };
              if (prev.some((t) => t.id === tabId)) return prev;
              if (prev.length < MAX_TABS) return [...prev, newTab];
              return prev.map((t) => (t.id === activeTabIdRef.current ? newTab : t));
            });
            setActiveTabId(tabId);
          };
          reader.readAsText(file);
        };
        input.click();
        return;
      }
    }

    if (!filePath) return;

    await flushNowRef.current();
    const seq = ++loadSeqRef.current;

    try {
      const fileData = await api.readExternalFile(filePath);
      if (seq !== loadSeqRef.current) return;

      setActiveNoteId(null);
      setIsExternalDirty(false);
      setExternalFile({
        path: fileData.path,
        filename: fileData.filename,
        isModified: false,
      });
      setTitle(fileData.filename);
      setContent(fileData.content);
      setIsPinned(false);

      const tabId = fileData.path;
      setTabs((prev) => {
        const existing = prev.find((t) => t.id === tabId);
        if (existing) {
          return prev.map((t) => (t.id === tabId ? { ...t, title: fileData.filename } : t));
        }
        const newTab: TabItem = {
          id: tabId,
          type: 'external',
          title: fileData.filename,
          externalPath: fileData.path,
        };
        if (prev.length < MAX_TABS) {
          return [...prev, newTab];
        }
        return prev.map((t) => (t.id === activeTabIdRef.current ? newTab : t));
      });

      setActiveTabId(tabId);
    } catch (err: any) {
      console.error('Failed to open external file:', err);
      alert(formatMessage(tRef.current.appAlerts.openExternalError, { error: String(err) }));
    }
  };
  handleOpenExternalFileRef.current = handleOpenExternalFile;

  // Listen for external file open events (Windows file association double-click on .md / .txt)
  useEffect(() => {
    if (!isTauri()) return;

    // Warm start: listen for single-instance secondary launch events (uses live ref!)
    let isCancelled = false;
    let unlistenFile: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      if (isCancelled) return;
      listen<string>('nook-open-file', (event) => {
        if (!isCancelled && event.payload) {
          handleOpenExternalFileRef.current(event.payload);
        }
      }).then((un) => {
        if (isCancelled) un();
        else unlistenFile = un;
      });
    }).catch(console.warn);

    return () => {
      isCancelled = true;
      if (unlistenFile) unlistenFile();
    };
  }, []);

  // Export Entire Library
  const handleExportLibrary = async () => {
    if (isTauri()) {
      try {
        const selectedDir = await openFileDialog({
          directory: true,
          multiple: false,
          title: tRef.current.appAlerts.exportFolderPromptTitle,
        });
        if (!selectedDir || typeof selectedDir !== 'string') return;
        const count = await api.exportLibraryToFolder(selectedDir);
        updateSupportPrefs(applyCompletedAction);
        alert(format(tRef.current.appAlerts.exportSuccess, { count, dir: selectedDir }));
      } catch (err: any) {
        alert(format(tRef.current.appAlerts.exportError, { error: String(err) }));
      }
      return;
    }

    alert(tRef.current.appAlerts.exportDesktopOnly);
  };

  // Calculate Breadcrumbs for Active Note
  const activeNote = notes.find((n) => n.id === activeNoteId);
  const breadcrumbs = useMemo(() => {
    if (!activeNote || !activeNote.collection_id) return [];

    const crumbs: Array<{ id: string; name: string }> = [];
    const visited = new Set<string>();
    let curId: string | null = activeNote.collection_id;

    while (curId && !visited.has(curId)) {
      visited.add(curId);
      const col = collections.find((c) => c.id === curId);
      if (col) {
        crumbs.unshift({ id: col.id, name: col.name });
        curId = col.parent_id;
      } else {
        break;
      }
    }
    return crumbs;
  }, [activeNote, collections]);

  const handleToggleSidebar = useCallback(() => {
    if (isNarrowDesktop) {
      setNarrowSidebarOverride((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  }, [isNarrowDesktop]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+N: Quick Capture (global quick note)
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateQuickNote();
        return;
      }
      // Ctrl+/: Shortcut Hotbar & Help
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        if (isMobileViewportRef.current) {
          setIsMobileHelpOpen((prev) => !prev);
        } else {
          setOnboardingMode(hasCompletedFirstUseOnboarding() ? 'help' : 'welcome');
          setIsOnboardingOpen((prev) => !prev);
        }
        return;
      }
      // Ctrl+N: New Quick Note
      if (e.ctrlKey && e.key.toLowerCase() === 'n' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handleCreateQuickNote();
      }
      // Ctrl+K: Command Palette
      else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl+P: Quick Search
      else if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Ctrl+B: Toggle Sidebar or Mobile Drawer
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (isMobileViewportRef.current) {
          setIsMobileDrawerOpen((prev) => !prev);
        } else {
          handleToggleSidebar();
        }
      }
      // Ctrl+,: Settings
      else if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
      // Ctrl+S: Force Flush Save
      else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushNow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flushNow, handleToggleSidebar]);

  // Native Tauri Drag & Drop Listener for Windows Explorer
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    try {
      const webview = getCurrentWebview();
      if (webview && typeof webview.onDragDropEvent === 'function') {
        webview
          .onDragDropEvent(async (event) => {
            if (event.payload.type === 'over' || event.payload.type === 'enter') {
              setIsWindowDragOver(true);
            } else if (event.payload.type === 'leave') {
              setIsWindowDragOver(false);
            } else if (event.payload.type === 'drop') {
              setIsWindowDragOver(false);
              const paths = event.payload.paths;
              if (!paths || paths.length === 0) return;

              const pos = event.payload.position;
              const dpr = window.devicePixelRatio || 1;
              const cssX = pos.x / dpr;
              const cssY = pos.y / dpr;
              const targetEl = document.elementFromPoint(cssX, cssY);

              // 1. Check if dropped over a specific collection/project in sidebar
              const collectionEl = targetEl?.closest('[data-collection-id]');
              const targetCollectionId = collectionEl?.getAttribute('data-collection-id');

              // 2. Check if dropped over Quick Notes section in sidebar
              const isQuickNotes = !!targetEl?.closest('[data-drop-zone="quick-notes"]');

              for (const filePath of paths) {
                if (!/\.(md|txt|markdown)$/i.test(filePath)) continue;

                if (targetCollectionId) {
                  // Dropped on project or folder in sidebar -> import note into project
                  const fileData = await api.readExternalFile(filePath);
                  const cleanTitle =
                    fileData.filename.replace(/\.(txt|md|markdown)$/i, '') || tRef.current.appAlerts.importedNoteDefault;
                  const newNote = await api.createNote(targetCollectionId, cleanTitle, fileData.content);
                  const activeNotes = await api.getActiveNotes();
                  setNotes(activeNotes);
                  await openNote(newNote.id);
                  setImportedToastName(fileData.filename);
                } else if (isQuickNotes) {
                  // Dropped on quick notes in sidebar -> import as quick note
                  const fileData = await api.readExternalFile(filePath);
                  const cleanTitle =
                    fileData.filename.replace(/\.(txt|md|markdown)$/i, '') || tRef.current.appAlerts.importedNoteDefault;
                  const newNote = await api.createNote(null, cleanTitle, fileData.content);
                  const activeNotes = await api.getActiveNotes();
                  setNotes(activeNotes);
                  await openNote(newNote.id);
                  setImportedToastName(fileData.filename);
                } else {
                  // Dropped on free space in Nook (editor, tabs, window body):
                  // Open directly as external markdown in a new tab!
                  await handleOpenExternalFileRef.current(filePath);
                  const filename = filePath.split(/[/\\]/).pop() || filePath;
                  setImportedToastName(filename);
                }
              }
            }
          })
          .then((u) => {
            unlisten = u;
          });
      }
    } catch (err) {
      console.warn('Tauri onDragDropEvent listener initialization:', err);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [tabs, activeTabId, notes]);

  // Memoized stable handlers for pure rendering performance
  const handleOpenCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
    setIsMobileDrawerOpen(false);
  }, []);
  const handleOpenSettings = useCallback((tab?: 'appearance' | 'editor' | 'language' | 'general' | 'data' | 'mobile' | 'about') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
    setIsMobileDrawerOpen(false);
  }, []);
  const handleOpenTrash = useCallback(() => {
    setIsTrashOpen(true);
    setIsMobileDrawerOpen(false);
  }, []);
  const handleOpenContextMenu = useCallback(
    (e: React.MouseEvent, type: 'note' | 'collection', item: any) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        type,
        targetItem: item,
        targetId: item.id,
      });
    },
    []
  );

  // Developer Workflow Handlers (local-first & optional)
  const handleUpdateProjectConfig = useCallback(
    (projectId: string, updater: (prev: ProjectDevConfig) => ProjectDevConfig) => {
      setDevProjectsConfig((prev) => {
        const nextProject = updater(prev[projectId] || {});
        const next: DevProjectsConfigMap = { ...prev, [projectId]: nextProject };
        api.saveSetting('dev_projects_config', JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const handleUpdateNoteMeta = useCallback(
    (
      noteId: string,
      updater: (
        prev: DevNotesMetaMap[string] | undefined
      ) => DevNotesMetaMap[string] | undefined
    ) => {
      setDevNotesMeta((prev) => {
        const updated = updater(prev[noteId]);
        const next: DevNotesMetaMap = { ...prev };
        if (updated === undefined) {
          delete next[noteId];
        } else {
          next[noteId] = updated;
        }
        api.saveSetting('dev_notes_meta', JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const handleCreateWorkflowNote = useCallback(
    async (
      collectionId: string | null,
      noteTitle: string,
      noteContent: string,
      role: NoteWorkflowRole
    ) => {
      await flushNowRef.current();
      const created = await api.createNote(collectionId, noteTitle, noteContent);
      handleUpdateNoteMeta(created.id, () => ({ role, updatedAt: Date.now() }));
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      return created;
    },
    [handleUpdateNoteMeta]
  );

  const handleDuplicatePromptNote = useCallback(
    async (noteId: string) => {
      const duplicated = await api.duplicateNote(noteId);
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      if (duplicated) {
        handleUpdateNoteMeta(duplicated.id, () => ({
          role: 'prompt',
          isFavorite: false,
          updatedAt: Date.now(),
        }));
      }
    },
    [handleUpdateNoteMeta]
  );

  const handleOpenProjectTools = useCallback(
    (collectionId?: string | null, tool: DevWorkflowToolId = 'context-pack', promptNoteId?: string | null) => {
      const fallbackCollectionId =
        collectionId ??
        notes.find((n) => n.id === activeNoteIdRef.current)?.collection_id ??
        null;
      const rootProjectId =
        resolveRootProjectId(fallbackCollectionId, collections) ||
        collections.find((c) => !c.parent_id)?.id ||
        null;

      setProjectToolsState({
        isOpen: true,
        projectId: rootProjectId,
        tool,
        promptNoteId: promptNoteId ?? null,
      });
      setIsMobileDrawerOpen(false);
    },
    [collections, notes]
  );

  const activeNoteWorkflowRole = activeNoteId ? devNotesMeta[activeNoteId]?.role ?? null : null;

  // Standalone Full-Tab Premium Splash Screen: completely isolated, zero background leakage
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Mobile Pairing Screen (Handshake with desktop via QR Code scan)
  if (pairCode) {
    return (
      <MobilePairingView
        pairCode={pairCode}
        onPairSuccess={() => {
          setPairCode(null);
          loadInitialData();
        }}
      />
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        if (e.dataTransfer.types?.includes('Files')) {
          e.preventDefault();
          setIsWindowDragOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types?.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!isWindowDragOver) setIsWindowDragOver(true);
        } else {
          // Internal UI drag (folders, notes, reordering): allow move without showing 🚫
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        // Only reset if leaving the entire window
        if (!e.relatedTarget) {
          setIsWindowDragOver(false);
        }
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsWindowDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const targetEl = document.elementFromPoint(e.clientX, e.clientY);
          const collectionEl = targetEl?.closest('[data-collection-id]');
          const targetCollectionId = collectionEl?.getAttribute('data-collection-id');
          const isQuickNotes = !!targetEl?.closest('[data-drop-zone="quick-notes"]');

          for (const file of Array.from(e.dataTransfer.files)) {
            if (!/\.(md|txt|markdown)$/i.test(file.name)) continue;

            if (targetCollectionId) {
              await handleImportFile(file, targetCollectionId);
              setImportedToastName(file.name);
            } else if (isQuickNotes) {
              await handleImportFile(file, null);
              setImportedToastName(file.name);
            } else {
              setImportedToastName(file.name);
              const fullPath = (file as any).path;
              if (fullPath) {
                await handleOpenExternalFile(fullPath);
              } else {
                const text = await file.text();
                const tabId = file.name;
                ++loadSeqRef.current;
                setActiveNoteId(null);
                setIsExternalDirty(false);
                setExternalFile({ path: file.name, filename: file.name, isModified: false });
                setTitle(file.name);
                setContent(text);
                setIsPinned(false);
                setTabs((prev) => {
                  const newTab: TabItem = { id: tabId, type: 'external', title: file.name, externalPath: file.name };
                  if (prev.some((t) => t.id === tabId)) return prev;
                  if (prev.length < MAX_TABS) return [...prev, newTab];
                  return prev.map((t) => (t.id === activeTabIdRef.current ? newTab : t));
                });
                setActiveTabId(tabId);
              }
            }
          }
        }
      }}
      style={{
        width: '100vw',
        height: 'var(--nook-viewport-height, 100dvh)',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      {/* Mobile Slide-over Drawer Backdrop */}
      {isMobileViewport && isMobileDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Left Sidebar (Desktop static vs Mobile slide-over drawer) */}
      <div
        aria-hidden={isMobileViewport && !isMobileDrawerOpen ? true : undefined}
        style={
          isMobileViewport
            ? {
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                width: 'min(85vw, 320px)',
                zIndex: 9999,
                transform: isMobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                visibility: isMobileDrawerOpen ? 'visible' : 'hidden',
                pointerEvents: isMobileDrawerOpen ? 'auto' : 'none',
                transition: isMobileDrawerOpen
                  ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s'
                  : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 0.25s',
                boxShadow: isMobileDrawerOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
                display: 'flex',
                flexDirection: 'column',
              }
            : undefined
        }
      >
        <Sidebar
          collections={collections}
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => {
            openNote(id);
            if (isMobileViewport) setIsMobileDrawerOpen(false);
          }}
          onCreateQuickNote={() => {
            handleCreateQuickNote();
            if (isMobileViewport) setIsMobileDrawerOpen(false);
          }}
          onCreateProjectPrompt={handleCreateProjectPrompt}
          onCreateNoteInCollection={(cId) => {
            handleCreateNoteInCollection(cId);
            if (isMobileViewport) setIsMobileDrawerOpen(false);
          }}
          onCreateFolderInCollection={handleCreateFolderInCollection}
          onOpenContextMenu={handleOpenContextMenu}
          onMoveNote={handleMoveNote}
          onReorderCollections={handleReorderCollections}
          onOpenCommandPalette={handleOpenCommandPalette}
          onOpenSettings={() => handleOpenSettings()}
          onOpenTrash={handleOpenTrash}
          onOpenSupport={handleOpenSupport}
          onOpenHelp={() => {
            if (isMobileViewport) {
              setIsMobileDrawerOpen(false);
              setIsMobileHelpOpen(true);
            } else {
              setOnboardingMode(hasCompletedFirstUseOnboarding() ? 'help' : 'welcome');
              setIsOnboardingOpen(true);
            }
          }}
          isCollapsed={
            isMobileViewport
              ? false
              : isNarrowDesktop
              ? !narrowSidebarOverride
              : isSidebarCollapsed
          }
          onToggleCollapse={isMobileViewport ? () => setIsMobileDrawerOpen(false) : handleToggleSidebar}
          onImportFile={handleImportFile}
          devWorkflowEnabled={!!settings.developerWorkflowEnabled}
          devProjectsConfig={devProjectsConfig}
          onOpenProjectTools={(colId) => handleOpenProjectTools(colId, 'context-pack')}
          isMobile={isMobileViewport}
          hasAvailableUpdate={
            isTauri() &&
            (updaterSnapshot.status === 'available' || updaterSnapshot.status === 'ready')
          }
          availableUpdateVersion={updaterSnapshot.availableVersion}
        />
      </div>

      {/* Right Area: Top Tab Bar (Desktop) / Mobile Header (Mobile) + Editor */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-main)',
          position: 'relative',
        }}
      >
        {/* Lightweight Non-Interactive Thematic Artwork */}
        <ThemeBackdrop
          theme={settings.theme}
          mode={settings.backgroundDecorations || 'subtle'}
          isMobile={isMobileViewport}
          hasActiveNote={!!(activeNoteId || externalFile)}
        />

        {isMobileViewport ? (
          <MobileTopBar
            onToggleDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
            onNewNote={() => {
              handleCreateQuickNote();
              setIsMobileDrawerOpen(false);
            }}
            onOpenSearch={() => setIsCommandPaletteOpen(true)}
            onOpenSettings={() => handleOpenSettings()}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onOpenHelp={() => setIsMobileHelpOpen(true)}
            onOpenTrash={() => setIsTrashOpen(true)}
            activeNoteTitle={title}
            saveStatus={saveStatus}
            connectionState={connectionState}
          />
        ) : (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onNewExternalTab={() => handleOpenExternalFile()}
              maxTabs={MAX_TABS}
              onOpenMobile={() => setIsMobileModalOpen(true)}
              isMobileActive={isMobileActive}
              onOpenVoice={() => setIsVoiceModalOpen(true)}
            />
          </div>
        )}

        {/* Clear Web / Mobile Sync Disconnection Banner (Non-blocking, preserves editor content) */}
        {!isTauri() && connectionState !== 'connected' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'relative',
              zIndex: 2,
              padding: '7px 14px',
              backgroundColor:
                connectionState === 'reconnecting'
                  ? 'var(--bg-sidebar)'
                  : 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <WifiOff
                size={14}
                style={{
                  color: connectionState === 'reconnecting' ? '#F59E0B' : '#EF4444',
                  flexShrink: 0,
                }}
              />
              <span style={{ lineHeight: 1.35 }}>
                {connectionState === 'unauthorized' ? (
                  <>
                    <strong>{t.ux.connSessionExpiredTitle} — </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.ux.connSessionExpiredDesc}</span>
                  </>
                ) : connectionState === 'disconnected' ? (
                  <>
                    <strong>{t.ux.connUnavailableTitle} — </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.ux.connUnavailableDesc}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>{t.ux.connReconnecting}</span>
                )}
              </span>
            </div>

            {connectionState === 'disconnected' && (
              <button
                type="button"
                onClick={() => api.reconnectSync()}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  minHeight: '28px',
                  fontSize: '11.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={12} />
                <span>{t.ux.connRetryBtn}</span>
              </button>
            )}
          </div>
        )}

        {/* Web / Mobile New Asset Reload Notice (after Desktop restarted from update) */}
        {!isTauri() && webAssetUpdateAvailable && connectionState === 'connected' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'relative',
              zIndex: 2,
              padding: '6px 14px',
              backgroundColor: 'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <span>{t.updater.webNewAssetPrompt}</span>
            <button
              type="button"
              onClick={async () => {
                await flushNowRef.current().catch(() => {});
                window.location.reload();
              }}
              className="btn-secondary"
              style={{ padding: '4px 10px', minHeight: '26px', fontSize: '11.5px', flexShrink: 0 }}
            >
              {t.updater.webReloadBtn}
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            height: isMobileViewport ? 'calc(100% - 48px)' : 'calc(100% - 38px)',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Editor
            noteId={activeNoteId}
            title={title}
            content={content}
            onTitleChange={(newTitle) => {
              const now = Date.now();
              lastTypingAtRef.current = now;
              lastInteractionAtRef.current = now;
              if (!externalFileRef.current) setTitle(newTitle);
            }}
            onContentChange={(newContent) => {
              const now = Date.now();
              lastTypingAtRef.current = now;
              lastInteractionAtRef.current = now;
              setContent(newContent);
              if (externalFileRef.current) {
                setIsExternalDirty(true);
              }
            }}
            breadcrumbs={breadcrumbs}
            saveStatus={saveStatus}
            isPinned={isPinned}
            onTogglePin={() => activeNoteId && handleTogglePinNote(activeNoteId)}
            onDelete={() => activeNoteId && handleDeleteNote(activeNoteId)}
            onDuplicate={() => activeNoteId && handleDuplicateNote(activeNoteId)}
            onExport={() => activeNoteId && handleExportNote(activeNoteId)}
            onCopyContent={handleCopyContent}
            onCreateQuickNote={handleCreateQuickNote}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
            settings={settings}
            isExternal={!!externalFile}
            externalPath={externalFile?.path}
            onNavigateWikilink={handleNavigateWikilink}
            onOpenOnboarding={() => {
              if (isMobileViewport) {
                setIsMobileHelpOpen(true);
              } else {
                setIsOnboardingOpen(true);
              }
            }}
            noteWorkflowRole={activeNoteWorkflowRole}
            onUsePromptTemplate={() => {
              if (activeNoteId) {
                handleOpenProjectTools(activeNote?.collection_id ?? null, 'prompts', activeNoteId);
              }
            }}
            onCopyHandoffContinue={() => {
              const rootId = resolveRootProjectId(activeNote?.collection_id, collections);
              const projectName = rootId
                ? collections.find((c) => c.id === rootId)?.name
                : undefined;
              const formatted = formatHandoffForAgentCopy({
                projectName,
                noteTitle: title,
                content,
                headerPrefix: t.projectTools.handoffDocPrefix,
              });
              if (formatted) {
                navigator.clipboard.writeText(formatted);
              }
            }}
            isMobile={isMobileViewport}
            onToggleDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
          />
        </div>

        {/* Visual Drag & Drop Overlay confined ONLY to the Editor Area! */}
        {isWindowDragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              animation: 'fadeIn 120ms ease-out',
            }}
          >
            <NookDropZoneVisual />
          </div>
        )}
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectNote={(noteId) => {
          openNote(noteId);
          if (isMobileViewport) setIsMobileDrawerOpen(false);
        }}
        onCreateQuickNote={handleCreateQuickNote}
        onCreateProject={handleCreateProjectPrompt}
        onOpenSettings={handleOpenSettings}
        onOpenTrash={handleOpenTrash}
        onOpenExternalFile={handleOpenExternalFile}
        onToggleTheme={() => {
          const themes: Array<'gray' | 'dark' | 'white' | 'neon' | 'sakura'> = ['gray', 'dark', 'white', 'neon', 'sakura'];
          setSettings((prev) => {
            let curr = prev.theme as any;
            if (curr === 'oled') curr = 'dark';
            if (curr === 'light') curr = 'white';
            if (curr === 'pink') curr = 'sakura';
            const currIdx = themes.indexOf(curr);
            const nextIdx = (currIdx + 1) % themes.length;
            const nextTheme = themes[nextIdx >= 0 ? nextIdx : 0];
            api.saveSetting('theme', nextTheme).catch(() => {});
            return {
              ...prev,
              theme: nextTheme,
            };
          });
        }}
        onToggleLanguage={() => {
          const langs: AppLanguage[] = ['pt', 'en', 'es'];
          setSettings((prev) => {
            const currIdx = langs.indexOf(normalizeLanguage(prev.language));
            const nextLang = langs[(currIdx + 1) % langs.length];
            api.saveSetting('language', nextLang).catch(() => {});
            return {
              ...prev,
              language: nextLang,
            };
          });
        }}
        onExportLibrary={handleExportLibrary}
        onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        onOpenShortcuts={() => {
          setOnboardingMode(hasCompletedFirstUseOnboarding() ? 'help' : 'welcome');
          setIsOnboardingOpen(true);
        }}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        onOpenProjectTools={(tool) => handleOpenProjectTools(null, tool ?? 'context-pack')}
        onOpenSupport={handleOpenSupport}
        onTriggerBackup={async () => {
          if (!isTauri()) {
            alert(t.appAlerts.backupDesktopOnly);
            return;
          }
          try {
            await api.triggerAutoBackup(true);
            alert(t.appAlerts.backupSuccess);
          } catch (err: any) {
            alert(format(t.appAlerts.backupFail, { error: String(err) }));
          }
        }}
        isMobile={isTouchMobileRuntime}
      />

      {/* Code-split Lazy Modals */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => {
              setIsSettingsOpen(false);
              setSettingsInitialTab(undefined);
              setUpdaterPendingOpNotice(null);
            }}
            initialTab={settingsInitialTab}
            settings={settings}
            onUpdateSettings={(newSettings) => {
              setSettings((prev) => {
                const updated = { ...prev, ...newSettings };
                if (
                  newSettings.editorFont !== undefined ||
                  newSettings.editorFontSize !== undefined ||
                  newSettings.lineHeight !== undefined ||
                  newSettings.lineWrapping !== undefined ||
                  newSettings.showLineNumbers !== undefined ||
                  newSettings.readingWidth !== undefined ||
                  newSettings.paragraphSpacing !== undefined ||
                  newSettings.backgroundDecorations !== undefined
                ) {
                  api
                    .saveSetting(
                      'appearance_prefs',
                      JSON.stringify({
                        editorFont: updated.editorFont,
                        editorFontSize: updated.editorFontSize,
                        lineHeight: updated.lineHeight,
                        lineWrapping: updated.lineWrapping,
                        showLineNumbers: updated.showLineNumbers,
                        readingWidth: updated.readingWidth,
                        paragraphSpacing: updated.paragraphSpacing,
                        backgroundDecorations: updated.backgroundDecorations,
                      })
                    )
                    .catch(() => {});
                }
                return updated;
              });
              if (newSettings.theme) {
                api.saveSetting('theme', newSettings.theme).catch(() => {});
              }
              if (newSettings.language) {
                api.saveSetting('language', newSettings.language).catch(() => {});
              }
              if (typeof newSettings.developerWorkflowEnabled === 'boolean') {
                api
                  .saveSetting(
                    'developer_workflow_enabled',
                    newSettings.developerWorkflowEnabled ? 'true' : 'false'
                  )
                  .catch(() => {});
              }
            }}
            onExportLibrary={handleExportLibrary}
            onBackupSuccess={loadInitialData}
            supportPrefs={supportPrefs}
            onUpdateSupportPrefs={updateSupportPrefs}
            onOpenSupport={handleOpenSupport}
            onOpenOnboarding={() => {
              if (isMobileViewport) {
                setIsMobileHelpOpen(true);
              } else {
                setOnboardingMode(hasCompletedFirstUseOnboarding() ? 'help' : 'welcome');
                setIsOnboardingOpen(true);
              }
            }}
            isMobile={isMobileViewport}
            updaterSnapshot={updaterSnapshot}
            updaterPendingOpNotice={updaterPendingOpNotice}
            serverVersion={serverVersion}
            onCheckForUpdates={() => {
              setUpdaterPendingOpNotice(null);
              updaterService
                .checkForUpdates({
                  manual: true,
                  autoEnabled: settingsRef.current.autoUpdateCheck !== false,
                })
                .catch(() => {});
            }}
            onDownloadUpdate={() => {
              setUpdaterPendingOpNotice(null);
              if (isVoiceModalOpenRef.current || isAutoBackupInFlightRef.current) {
                setUpdaterPendingOpNotice(t.updater.pendingOpsNotice);
                return;
              }
              updaterService.downloadUpdate().catch(() => {});
            }}
            onInstallUpdate={async () => {
              setUpdaterPendingOpNotice(null);
              const res = await updaterService.installAndRestart({
                flushPendingWrites: async () => {
                  await flushNowRef.current();
                },
                isCriticalOperationRunning: () =>
                  isDirtyRef.current ||
                  isExternalDirtyRef.current ||
                  saveStatusRef.current === 'saving' ||
                  isVoiceModalOpenRef.current ||
                  isAutoBackupInFlightRef.current,
              });
              if (res.blockedByPendingOp) {
                setUpdaterPendingOpNotice(t.updater.pendingOpsNotice);
              }
            }}
          />
        )}

        {isTrashOpen && (
          <TrashView
            isOpen={isTrashOpen}
            onClose={() => setIsTrashOpen(false)}
            onRestoreSuccess={loadInitialData}
          />
        )}

        {isVersionHistoryOpen && (
          <VersionHistoryDialog
            isOpen={isVersionHistoryOpen}
            onClose={() => setIsVersionHistoryOpen(false)}
            noteId={activeNoteId}
            currentTitle={title}
            currentContent={content}
            onVersionRestored={(restoredNote) => {
              setNotes((prev) =>
                prev.map((n) =>
                  n.id === restoredNote.id
                    ? { ...n, title: restoredNote.title, updated_at: restoredNote.updated_at }
                    : n
                )
              );
              setTabs((prev) =>
                prev.map((t) => (t.id === restoredNote.id ? { ...t, title: restoredNote.title } : t))
              );
              if (!externalFileRef.current && activeNoteIdRef.current === restoredNote.id) {
                setTitle(restoredNote.title);
                setContent(restoredNote.content);
                setActiveNoteUpdatedAt(restoredNote.updated_at);
              }
            }}
          />
        )}

        {isOnboardingOpen && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            mode={onboardingMode}
            isMobile={isMobileViewport}
            selectedLanguage={settings.language}
            onSelectLanguage={(lang) => {
              setSettings((prev) => ({ ...prev, language: lang }));
              api.saveSetting('language', lang).catch(() => {});
            }}
            onClose={() => setIsOnboardingOpen(false)}
            onStartWriting={() => {
              setIsOnboardingOpen(false);
              handleOpenStarterNote();
            }}
            onOpenSupport={handleOpenSupport}
          />
        )}

        {isMobileViewport && isMobileHelpOpen && (
          <OnboardingModal
            isOpen={isMobileHelpOpen}
            isMobile
            mode="help"
            selectedLanguage={settings.language}
            onSelectLanguage={(lang) => {
              setSettings((prev) => ({ ...prev, language: lang }));
              api.saveSetting('language', lang).catch(() => {});
            }}
            onClose={() => setIsMobileHelpOpen(false)}
            onStartWriting={() => {
              setIsMobileHelpOpen(false);
              handleCreateQuickNote();
            }}
            onOpenSupport={handleOpenSupport}
          />
        )}

        {/* Discreet Peripheral Update Pill (Desktop only, non-blocking, never interrupts typing) */}
        {isTauri() &&
          !isBlockingSupportModalOpen &&
          !isSupportInviteOpen &&
          (updaterSnapshot.status === 'available' ||
            updaterSnapshot.status === 'downloading' ||
            updaterSnapshot.status === 'ready') &&
          updaterSnapshot.dismissedVersion !== updaterSnapshot.availableVersion && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: 44,
                width: '300px',
                maxWidth: 'calc(100vw - 32px)',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 26px rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600 }}>
                  <Download size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span>{t.updater.updateAvailableTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => updaterService.dismissNotificationForCurrentVersion()}
                  aria-label={t.common.close}
                  style={{ color: 'var(--text-muted)', padding: '2px' }}
                >
                  <X size={13} />
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {updaterSnapshot.status === 'downloading'
                  ? format(t.updater.downloadProgress, { percent: updaterSnapshot.progressPercent })
                  : updaterSnapshot.status === 'ready'
                  ? format(t.updater.readyBanner, { version: updaterSnapshot.availableVersion || '' })
                  : format(t.updater.updateAvailableBanner, {
                      version: updaterSnapshot.availableVersion || '',
                    })}
              </div>

              {updaterSnapshot.status === 'downloading' && (
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--bg-elevated)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${updaterSnapshot.progressPercent}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              )}

              {confirmCornerUpdateRestart && updaterSnapshot.status === 'ready' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    {format(t.updater.confirmRestartDesc, {
                      version: updaterSnapshot.availableVersion || '',
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmCornerUpdateRestart(false)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.updater.laterBtn}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmCornerUpdateRestart(false);
                        const res = await updaterService.installAndRestart({
                          flushPendingWrites: async () => {
                            await flushNowRef.current();
                          },
                          isCriticalOperationRunning: () =>
                            isDirtyRef.current ||
                            isExternalDirtyRef.current ||
                            saveStatusRef.current === 'saving' ||
                            isVoiceModalOpenRef.current ||
                            isAutoBackupInFlightRef.current,
                        });
                        if (res.blockedByPendingOp) {
                          handleOpenSettings('about');
                        }
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      {t.updater.installRestartBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmCornerUpdateRestart(false);
                      updaterService.dismissNotificationForCurrentVersion();
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {t.updater.laterBtn}
                  </button>

                  {updaterSnapshot.status === 'available' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isVoiceModalOpenRef.current || isAutoBackupInFlightRef.current) {
                          handleOpenSettings('about');
                          return;
                        }
                        updaterService.downloadUpdate().catch(() => {});
                      }}
                      style={{
                        padding: '5px 11px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      {t.updater.updateNowBtn}
                    </button>
                  )}

                  {updaterSnapshot.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => setConfirmCornerUpdateRestart(true)}
                      style={{
                        padding: '5px 11px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      {t.updater.installRestartBtn}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        {hasMountedSupportInvite && !isMobileViewport && (
          <SupportInviteCard
            isOpen={isSupportInviteOpen}
            onSupport={() => {
              supportDismissedSessionRef.current = true;
              setIsSupportInviteOpen(false);
              updateSupportPrefs((prev) => applyInviteLater(prev));
              handleOpenSupport();
            }}
            onDismissLater={() => {
              supportDismissedSessionRef.current = true;
              setIsSupportInviteOpen(false);
              updateSupportPrefs((prev) => applyInviteLater(prev));
            }}
            onDismissNever={() => {
              supportDismissedSessionRef.current = true;
              setIsSupportInviteOpen(false);
              updateSupportPrefs(applyInviteNever);
            }}
            onAlreadySupported={() => {
              supportDismissedSessionRef.current = true;
              setIsSupportInviteOpen(false);
              updateSupportPrefs(applyInviteNever);
            }}
          />
        )}

        {isVoiceModalOpen && (
          <NookVoiceModal
            isOpen={isVoiceModalOpen}
            onClose={() => setIsVoiceModalOpen(false)}
            onOpenNote={(newNoteId) => {
              openNote(newNoteId);
              if (isMobileViewport) setIsMobileDrawerOpen(false);
            }}
          />
        )}

        {projectToolsState.isOpen && (
          <ProjectToolsModal
            isOpen={projectToolsState.isOpen}
            onClose={() => setProjectToolsState((prev) => ({ ...prev, isOpen: false, promptNoteId: null }))}
            initialProjectId={projectToolsState.projectId}
            initialTool={projectToolsState.tool}
            initialPromptNoteId={projectToolsState.promptNoteId}
            collections={collections}
            notes={notes}
            activeNoteId={activeNoteId}
            devProjectsConfig={devProjectsConfig}
            devNotesMeta={devNotesMeta}
            onUpdateProjectConfig={handleUpdateProjectConfig}
            onUpdateNoteMeta={handleUpdateNoteMeta}
            onCreateNote={handleCreateWorkflowNote}
            onDuplicatePromptNote={handleDuplicatePromptNote}
            onOpenNoteInEditor={(id) => {
              openNote(id);
              if (isMobileViewport) setIsMobileDrawerOpen(false);
            }}
            onOpenExternalDoc={(filePath) => handleOpenExternalFile(filePath)}
            onCreateProjectPrompt={handleCreateProjectPrompt}
            isMobile={isMobileViewport}
          />
        )}
      </Suspense>

      {/* Context Menu */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onRename={handleRenamePrompt}
        onDeleteNote={handleDeleteNote}
        onDeleteCollection={handleDeleteCollection}
        onDuplicateNote={handleDuplicateNote}
        onTogglePinNote={handleTogglePinNote}
        onExportNote={handleExportNote}
        onCreateNoteInCollection={handleCreateNoteInCollection}
        onCreateFolderInCollection={handleCreateFolderInCollection}
        onMoveNotePrompt={(noteId) => {
          setNoteToMoveId(noteId);
          setIsMoveNoteOpen(true);
        }}
        onOpenProjectTools={(colId) => handleOpenProjectTools(colId, 'context-pack')}
      />

      {/* Prompt Dialog */}
      <PromptDialog
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        initialValue={promptDialog.initialValue}
        placeholder={promptDialog.placeholder}
        onConfirm={promptDialog.onConfirm}
        onCancel={() => setPromptDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Move Note Dialog */}
      <MoveNoteDialog
        isOpen={isMoveNoteOpen}
        onClose={() => setIsMoveNoteOpen(false)}
        collections={collections}
        currentCollectionId={activeNote?.collection_id ?? null}
        onSelectDestination={(targetId) => {
          if (noteToMoveId) {
            handleMoveNote(noteToMoveId, targetId);
          }
        }}
      />

      {/* Import Confirmation Toast */}
      {importedToastName && (
        <NookImportSuccessToast
          filename={importedToastName}
          onClose={() => setImportedToastName(null)}
        />
      )}

      {/* Nook Mobile Modal (Desktop Tunnel Management & QR Code) */}
      <NookMobileModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />

      {/* Mobile Pair Request Approval Prompt (Desktop Alert) */}
      <MobilePairApprovalDialog
        request={pendingPairRequest}
        onClose={() => setPendingPairRequest(null)}
        onApproved={() => {
          setIsMobileActive(true);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const fallbackLanguage = normalizeLanguage(
      typeof window !== 'undefined' ? localStorage.getItem('nook_language') : null
    );
    const saved =
      typeof window !== 'undefined'
        ? localStorage.getItem('nook_settings') || localStorage.getItem('lumina_settings')
        : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          !parsed.accentColor ||
          parsed.accentColor === '#8B80F9' ||
          parsed.accentColor === '#6C5CE7' ||
          (typeof parsed.accentColor === 'string' &&
            (parsed.accentColor.toLowerCase().includes('8b80f9') ||
              parsed.accentColor.toLowerCase().includes('6c5ce7')))
        ) {
          parsed.accentColor = '#ECECEC';
        }
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          language: normalizeLanguage(parsed.language || fallbackLanguage),
        };
      } catch {
        return { ...DEFAULT_SETTINGS, language: fallbackLanguage };
      }
    }
    return { ...DEFAULT_SETTINGS, language: fallbackLanguage };
  });

  return (
    <ErrorBoundary scope="app">
      <LanguageProvider language={settings.language}>
        <AppWorkspace settings={settings} setSettings={setSettings} />
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
