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
import { useAutoSave } from '../hooks/useAutoSave';
import { api, isTauri } from '../services/api';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  Collection,
  NoteSummary,
  AppSettings,
  ContextMenuState,
  ExternalFile,
  TabItem,
  PendingPairRequest,
} from '../types';
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

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'gray',
  accentColor: '#ECECEC',
  editorFont: "'Inter', sans-serif",
  editorFontSize: 15,
  lineWrapping: true,
  showLineNumbers: false,
  lineHeight: 1.6,
  restoreLastNote: true,
  confirmPermanentDelete: true,
  lastOpenedNoteId: null,
};

export const App: React.FC = () => {
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

  // Sidebar Collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nook_settings') || localStorage.getItem('lumina_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sanitize legacy purple colors
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
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Modals & Overlays
  const [showSplash, setShowSplash] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isMoveNoteOpen, setIsMoveNoteOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [noteToMoveId, setNoteToMoveId] = useState<string | null>(null);

  // Nook Mobile & Responsive Viewport States
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('mobile') === 'true' ||
      window.innerWidth <= 768 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  });
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

  // Drag & Drop Feedback Overlay & Toast States
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const [importedToastName, setImportedToastName] = useState<string | null>(null);

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

  // Apply theme to document element
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

    localStorage.setItem('nook_settings', JSON.stringify({ ...settings, theme: activeTheme }));
    localStorage.setItem('lumina_settings', JSON.stringify({ ...settings, theme: activeTheme }));

    // Persist to SQLite backend so Nook Web and Desktop share the same theme
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

      // Apply saved theme from SQLite database (vital for Nook Web in browser!)
      if (Array.isArray(dbSettings) && dbSettings.length > 0) {
        const themeItem = dbSettings.find((s) => s.key === 'theme');
        if (themeItem && themeItem.value) {
          let t = themeItem.value;
          if (t === 'oled') t = 'dark';
          if (t === 'light') t = 'white';
          if (t === 'pink') t = 'sakura';
          if (['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(t)) {
            document.documentElement.setAttribute('data-theme', t);
            setSettings((prev) => ({ ...prev, theme: t as any }));
          }
        }
      }

      // Trigger discreet daily auto-backup
      api.triggerAutoBackup().catch((err) => console.error('Discreet auto backup skipped:', err));

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

    // Check onboarding: NEVER show desktop keyboard shortcuts modal on mobile
    const completed = localStorage.getItem('nook_onboarding_completed');
    if (!completed) {
      if (isMobileViewport) {
        localStorage.setItem('nook_onboarding_completed', 'true');
      } else {
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
          let t = val;
          if (t === 'oled') t = 'dark';
          if (t === 'light') t = 'white';
          if (t === 'pink') t = 'sakura';
          if (['gray', 'dark', 'white', 'neon', 'sakura', 'pink'].includes(t)) {
            document.documentElement.setAttribute('data-theme', t);
            setSettings((prev) => ({ ...prev, theme: t as any }));
          }
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

  // Mobile viewport resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      const params = new URLSearchParams(window.location.search);
      const isMobile =
        params.get('mobile') === 'true' ||
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobileViewport(isMobile);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
            title: note.title || 'Sem título',
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
      const cleanTitle = file.name.replace(/\.(txt|md|markdown)$/i, '') || 'Nota importada';
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
      const existingStarter = notes.find((n) =>
        n.title.toLowerCase().includes('bem-vindo ao nook')
      );
      if (existingStarter) {
        await openNote(existingStarter.id);
      } else {
        const starterContent = `# Bem-vindo ao Nook 🐾\n\nO seu refúgio de escrita: minimalista, rápido e 100% offline.\nProjetado para manter seu foco total nas palavras, sem distrações.\n\n---\n\n### ✦ Primeiros Passos Interativos\nExperimente os recursos do Nook diretamente nesta nota:\n\n- [x] Abrir o Nook\n- [ ] Clicar nesta caixa de seleção para concluir a tarefa\n- [ ] Pressionar \`Ctrl + E\` para alternar entre Edição e Modo Leitura\n- [ ] Pressionar \`Ctrl + K\` para abrir a Busca & Paleta de Comandos\n- [ ] Pressionar \`Ctrl + B\` para recolher a barra lateral e focar na escrita\n\n---\n\n### ✦ Pilares do Nook\n\n> [!tip] Salvamento Contínuo\n> O Nook salva todas as suas alterações em segundo plano instantaneamente no SQLite nativo. Nunca se preocupe em apertar Ctrl+S.\n\n- **Abas Inteligentes:** Abra até 5 notas simultâneas no topo da interface.\n- **Arrastar e Soltar:** Arraste qualquer arquivo \`.md\` ou \`.txt\` do Explorer diretamente para o editor ou para uma pasta na barra lateral.\n- **Histórico Seguro:** O Nook cria versões automáticas das suas notas para você consultar ou restaurar a qualquer momento.\n- **Sem Nuvem Obrigatória:** Seus dados pertencem exclusivamente a você e ficam armazenados localmente.\n\n---\n\n### ✦ Atalhos Mais Úteis\n\n| Ação | Atalho |\n| :--- | :--- |\n| **Nova Nota Rápida** | \`Ctrl + N\` |\n| **Busca & Comandos** | \`Ctrl + K\` |\n| **Modo Leitura / Edição** | \`Ctrl + E\` |\n| **Recolher Barra Lateral** | \`Ctrl + B\` |\n| **Central de Ajuda / Atalhos** | \`Ctrl + /\` |\n\n*Dica: Você pode reabrir esta central de atalhos a qualquer momento pressionando \`Ctrl + /\`.*`;
        const newNote = await api.createNote(null, 'Bem-vindo ao Nook 🐾', starterContent);
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
      const newNote = await api.createNote(null, 'Sem título', '');
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      await openNote(newNote.id);
    } catch (err) {
      console.error('Failed to create quick note:', err);
    }
  };

  // Create Note in Collection
  const handleCreateNoteInCollection = async (collectionId: string) => {
    await flushNowRef.current();
    try {
      const newNote = await api.createNote(collectionId, 'Sem título', '');
      const activeNotes = await api.getActiveNotes();
      setNotes(activeNotes);
      await openNote(newNote.id);
    } catch (err) {
      console.error('Failed to create note in collection:', err);
    }
  };

  // Create Project Prompt
  const handleCreateProjectPrompt = () => {
    setPromptDialog({
      isOpen: true,
      title: 'Novo Projeto',
      placeholder: 'Nome do projeto (ex: Trabalho, Pessoal...)',
      initialValue: '',
      onConfirm: async (name) => {
        setPromptDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.createCollection(name, 'project', null);
          const colls = await api.getCollections();
          setCollections(colls);
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
      title: 'Nova Pasta',
      placeholder: 'Nome da pasta...',
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
      title: type === 'note' ? 'Renomear Nota' : 'Renomear Pasta/Projeto',
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
        title: `Nota "${targetName}" não encontrada. Criar agora?`,
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
    link.download = `${note.title || 'nota'}.md`;
    link.click();
    URL.revokeObjectURL(url);
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
      const isBlank = (!title.trim() || title === 'Sem título') && !content.trim();
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
          filters: [{ name: 'Documentos Markdown & Texto', extensions: ['md', 'txt', 'markdown'] }],
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
      alert(`Erro ao abrir arquivo: ${err?.toString()}`);
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
          title: 'Escolher pasta de destino para exportar notas',
        });
        if (!selectedDir || typeof selectedDir !== 'string') return;
        const count = await api.exportLibraryToFolder(selectedDir);
        alert(`Exportação concluída! ${count} notas exportadas em: ${selectedDir}`);
      } catch (err: any) {
        alert(`Erro na exportação: ${err?.toString()}`);
      }
      return;
    }

    alert('Exportação direta para pastas locais disponível apenas no aplicativo Desktop.');
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+N: Quick Capture (global quick note)
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateQuickNote();
        return;
      }
      // Ctrl+/: Shortcut Hotbar & Onboarding
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setIsOnboardingOpen((prev) => !prev);
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
      // Ctrl+B: Toggle Sidebar
      else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
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
  }, [flushNow]);

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
                    fileData.filename.replace(/\.(txt|md|markdown)$/i, '') || 'Nota importada';
                  const newNote = await api.createNote(targetCollectionId, cleanTitle, fileData.content);
                  const activeNotes = await api.getActiveNotes();
                  setNotes(activeNotes);
                  await openNote(newNote.id);
                  setImportedToastName(fileData.filename);
                } else if (isQuickNotes) {
                  // Dropped on quick notes in sidebar -> import as quick note
                  const fileData = await api.readExternalFile(filePath);
                  const cleanTitle =
                    fileData.filename.replace(/\.(txt|md|markdown)$/i, '') || 'Nota importada';
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
  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
    setIsMobileDrawerOpen(false);
  }, []);
  const handleOpenTrash = useCallback(() => {
    setIsTrashOpen(true);
    setIsMobileDrawerOpen(false);
  }, []);
  const handleToggleSidebar = useCallback(() => setIsSidebarCollapsed((prev) => !prev), []);
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
        height: '100dvh',
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
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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
          onOpenSettings={handleOpenSettings}
          onOpenTrash={handleOpenTrash}
          isCollapsed={isMobileViewport ? false : isSidebarCollapsed}
          onToggleCollapse={isMobileViewport ? () => setIsMobileDrawerOpen(false) : handleToggleSidebar}
          onImportFile={handleImportFile}
          isMobile={isMobileViewport}
        />
      </div>

      {/* Right Area: Top Tab Bar (Desktop) / Mobile Header (Mobile) + Editor */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-main)',
          position: 'relative',
        }}
      >
        {isMobileViewport ? (
          <MobileTopBar
            onToggleDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
            onNewNote={() => {
              handleCreateQuickNote();
              setIsMobileDrawerOpen(false);
            }}
            onOpenSearch={() => setIsCommandPaletteOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onDeleteNote={activeNoteId ? () => handleDeleteNote(activeNoteId) : undefined}
            activeNoteTitle={title}
            saveStatus={saveStatus}
          />
        ) : (
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
        )}

        <div
          style={{
            flex: 1,
            height: isMobileViewport ? 'calc(100% - 48px)' : 'calc(100% - 38px)',
            overflow: 'hidden',
          }}
        >
          <Editor
            noteId={activeNoteId}
            title={title}
            content={content}
            onTitleChange={(newTitle) => {
              if (!externalFileRef.current) setTitle(newTitle);
            }}
            onContentChange={(newContent) => {
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
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
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
        onExportLibrary={handleExportLibrary}
        onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        onOpenShortcuts={() => setIsOnboardingOpen(true)}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        onTriggerBackup={async () => {
          if (!isTauri()) {
            alert('Backups locais disponíveis apenas no aplicativo Desktop.');
            return;
          }
          try {
            await api.triggerAutoBackup(true);
            alert('Backup de segurança gerado com sucesso!');
          } catch (err: any) {
            alert(`Falha no backup: ${err?.toString()}`);
          }
        }}
        isMobile={isMobileViewport}
      />

      {/* Code-split Lazy Modals */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={(newSettings) => {
              setSettings((prev) => ({ ...prev, ...newSettings }));
              if (newSettings.theme) {
                api.saveSetting('theme', newSettings.theme).catch(() => {});
              }
            }}
            onExportLibrary={handleExportLibrary}
            onBackupSuccess={loadInitialData}
            isMobile={isMobileViewport}
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

        {!isMobileViewport && isOnboardingOpen && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            onStartWriting={() => {
              setIsOnboardingOpen(false);
              handleOpenStarterNote();
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
export default App;
