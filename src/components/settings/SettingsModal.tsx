import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Type,
  Sliders,
  Database,
  Download,
  Upload,
  Check,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Copy,
  Power,
  Trash2,
  Globe,
  Heart,
  Info,
  ExternalLink,
  HardDrive,
} from 'lucide-react';
import { open as openFileDialog, save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import {
  AppLanguage,
  AppSettings,
  AutoBackupInfo,
  AutoBackupSummary,
  AuthorizedDevice,
  BackgroundDecorationsMode,
  BackupFrequency,
  BackupRetentionDays,
  CacheStats,
  MobileAccessInfo,
  ParagraphSpacing,
  ReadingWidth,
  SupportPreferences,
} from '../../types';
import { api, isTauri } from '../../services/api';
import { RELEASES_PAGE_URL, UpdaterSnapshot } from '../../services/updater';
import { QRCodeSvg } from '../mobile/QRCodeSvg';
import { SUPPORTED_LANGUAGES, useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { resetContextualTips } from '../../utils/onboardingUtils';
import { ContextualHint } from '../ui/ContextualHint';

type SettingsTabId = 'appearance' | 'editor' | 'language' | 'general' | 'data' | 'mobile' | 'about';

function formatBytesShort(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportLibrary: () => void;
  onBackupSuccess: () => void;
  isMobile?: boolean;
  supportPrefs?: SupportPreferences;
  onUpdateSupportPrefs?: (updater: (prev: SupportPreferences) => SupportPreferences) => void;
  onOpenSupport?: () => void;
  onOpenOnboarding?: () => void;
  initialTab?: SettingsTabId;
  updaterSnapshot?: UpdaterSnapshot;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
  updaterPendingOpNotice?: string | null;
  serverVersion?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportLibrary,
  onBackupSuccess,
  isMobile = false,
  supportPrefs,
  onUpdateSupportPrefs,
  onOpenSupport,
  onOpenOnboarding,
  initialTab,
  updaterSnapshot,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  updaterPendingOpNotice,
  serverVersion,
}) => {
  const { t, format } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab || 'appearance');
  const [dbPath, setDbPath] = useState<string>('');
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupInfo[]>([]);
  const [backupSummary, setBackupSummary] = useState<AutoBackupSummary | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [confirmDeleteBackups, setConfirmDeleteBackups] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [confirmRestartUpdate, setConfirmRestartUpdate] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDeletingBackups, setIsDeletingBackups] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [tipsResetDone, setTipsResetDone] = useState(false);
  const [isCompactModal, setIsCompactModal] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 680 : false
  );

  useDialogA11y({ isOpen, onClose });

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const check = () => setIsCompactModal(isMobile || window.innerWidth <= 680);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [isOpen, isMobile]);

  // Mobile Access State inside Settings
  const [mobileInfo, setMobileInfo] = useState<MobileAccessInfo | null>(null);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showThemesIntro, setShowThemesIntro] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nook_themes_v2_intro_seen') !== 'true';
    } catch {
      return false;
    }
  });

  const dismissThemesIntro = () => {
    setShowThemesIntro(false);
    try {
      localStorage.setItem('nook_themes_v2_intro_seen', 'true');
    } catch {
      // ignore storage errors
    }
  };

  const loadMobileStatus = async () => {
    try {
      const status = await api.getMobileStatus();
      setMobileInfo(status);
    } catch (e) {
      console.warn('Could not load mobile status:', e);
    }
  };

  const loadBackups = async () => {
    try {
      const [summary, cache] = await Promise.all([
        api.getAutoBackupsSummary(),
        api.getCacheStats(),
      ]);
      if (summary) {
        setBackupSummary(summary);
        setAutoBackups(summary.backups);
      } else {
        const list = await api.listAutoBackups();
        setAutoBackups(list);
      }
      if (cache) {
        setCacheStats(cache);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setTipsResetDone(false);
      setConfirmDeleteBackups(false);
      setConfirmClearCache(false);
      setConfirmRestartUpdate(false);
      api.getDatabasePath().then(setDbPath).catch(() => setDbPath(t.settings.localSqliteFallback));
      setDataMessage(null);
      loadBackups();
      loadMobileStatus();
    }
  }, [isOpen, initialTab, t.settings.localSqliteFallback]);

  if (!isOpen) return null;

  const fontOptions = [
    { label: t.settings.fontInterRecommended, value: "'Inter', sans-serif" },
    { label: t.settings.fontSegoe, value: "'Segoe UI Variable', 'Segoe UI', sans-serif" },
    { label: t.settings.fontGeorgia, value: "Georgia, 'Charter', 'Times New Roman', serif" },
    { label: t.settings.fontJetbrains, value: "'JetBrains Mono', monospace" },
    { label: t.settings.fontConsolas, value: "Consolas, 'Courier New', monospace" },
  ];

  const handleBackupExport = async () => {
    if (!isTauri()) {
      setDataMessage(t.settings.backupExportDesktopOnly);
      return;
    }
    try {
      const defaultName = `nook_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const selectedPath = await saveFileDialog({
        title: t.settings.saveBackupDialogTitle,
        defaultPath: defaultName,
        filters: [{ name: t.settings.backupFilterName, extensions: ['json'] }],
      });
      if (!selectedPath) return;

      await api.exportBackupJson(selectedPath);
      setDataMessage(format(t.settings.backupExportSuccess, { path: selectedPath }));
    } catch (err: any) {
      setDataMessage(format(t.settings.backupExportError, { error: err?.toString() || '' }));
    }
  };

  const handleBackupImport = async () => {
    if (!isTauri()) {
      setDataMessage(t.settings.backupImportDesktopOnly);
      return;
    }
    try {
      const selected = await openFileDialog({
        title: t.settings.selectBackupDialogTitle,
        multiple: false,
        filters: [{ name: t.settings.backupFilterName, extensions: ['json'] }],
      });
      if (!selected || typeof selected !== 'string') return;
      if (!window.confirm(t.settings.backupImportConfirm)) {
        return;
      }

      const msg = await api.importBackupJson(selected);
      await loadBackups();
      onBackupSuccess();
      setDataMessage(msg);
    } catch (err: any) {
      setDataMessage(format(t.settings.backupImportError, { error: err?.toString() || '' }));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.settings.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(95vw, 680px)',
          height: isCompactModal
            ? 'min(92dvh, var(--nook-viewport-height, 92dvh), 640px)'
            : 'min(88dvh, 560px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: isCompactModal ? 'column' : 'row',
          overflow: 'hidden',
        }}
        className="animate-modal-pop"
      >
        {/* Left Tabs Sidebar / Top Bar on Compact & Mobile */}
        <div
          className={isCompactModal ? 'settings-tabs-compact nook-touch-scroll-row' : undefined}
          style={{
            width: isCompactModal ? '100%' : '180px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: isCompactModal ? 'none' : '1px solid var(--border-color)',
            borderBottom: isCompactModal ? '1px solid var(--border-color)' : 'none',
            display: 'flex',
            flexDirection: isCompactModal ? 'row' : 'column',
            overflowX: isCompactModal ? 'auto' : 'visible',
            padding: isCompactModal ? '8px 10px' : '16px 8px',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          {!isCompactModal && (
            <div
              style={{
                padding: '6px 12px 14px 12px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {t.settings.title}
            </div>
          )}

          <button
            onClick={() => setActiveTab('appearance')}
            className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
          >
            <Palette size={15} />
            <span>{t.settings.tabAppearance}</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          >
            <Type size={15} />
            <span>{t.settings.tabEditor}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`tab-btn ${activeTab === 'language' ? 'active' : ''}`}
          >
            <Globe size={15} />
            <span>{t.settings.tabLanguage}</span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          >
            <Sliders size={15} />
            <span>{t.settings.tabGeneral}</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
          >
            <Database size={15} />
            <span>{t.settings.tabData}</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile')}
            className={`tab-btn ${activeTab === 'mobile' ? 'active' : ''}`}
          >
            <Smartphone size={15} />
            <span>{t.settings.tabMobile}</span>
            {mobileInfo?.active && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent, #00FF9D)',
                  marginLeft: 'auto',
                }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          >
            <Info size={15} />
            <span>{t.settings.tabAbout}</span>
            {(updaterSnapshot?.status === 'available' || updaterSnapshot?.status === 'ready') && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                  marginLeft: 'auto',
                }}
              />
            )}
          </button>

          {!isCompactModal && (
            <>
              <div style={{ flex: 1 }} />
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/brand/nook-mark.svg" alt="Nook" style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.settings.offlineBadge}</span>
              </div>
            </>
          )}
        </div>

        {/* Right Content Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          {/* Top Bar with Close button */}
          <div
            style={{
              height: '44px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {activeTab === 'appearance' && t.settings.headerAppearance}
              {activeTab === 'editor' && t.settings.headerEditor}
              {activeTab === 'language' && t.settings.headerLanguage}
              {activeTab === 'general' && t.settings.headerGeneral}
              {activeTab === 'data' && t.settings.headerData}
              {activeTab === 'mobile' && t.settings.headerMobile}
              {activeTab === 'about' && t.settings.headerAbout}
            </span>
            <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }} aria-label={t.common.close}>
              <X size={16} />
            </button>
          </div>

          {/* Tab Panes */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* APARÊNCIA */}
            {activeTab === 'appearance' && (
              <>
                {showThemesIntro && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-muted)',
                      border: '1px solid var(--accent-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t.settings.themesIntroTitle}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {t.settings.themesIntroDesc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={dismissThemesIntro}
                      aria-label={t.common.close}
                      style={{ color: 'var(--text-muted)', padding: '4px', flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div>
                  <label className="setting-label">{t.settings.visualTheme}</label>
                  <p className="setting-desc">{t.settings.visualThemeDesc}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(134px, 1fr))', gap: '10px', marginTop: '12px' }}>
                    {[
                      {
                        id: 'gray',
                        label: t.themes.gray,
                        bg: '#1E1F24',
                        sidebar: '#17181C',
                        text: '#ECECEC',
                        muted: '#848996',
                        accent: '#ECECEC',
                        border: '#33363F',
                      },
                      {
                        id: 'dark',
                        label: t.themes.dark,
                        bg: '#090A0D',
                        sidebar: '#050608',
                        text: '#E7E9EE',
                        muted: '#707582',
                        accent: '#F4F5F8',
                        border: '#1D2028',
                      },
                      {
                        id: 'white',
                        label: t.themes.white,
                        bg: '#FAF9F6',
                        sidebar: '#F3F1EC',
                        text: '#1A1A1E',
                        muted: '#6E727D',
                        accent: '#1A1A1E',
                        border: '#E5E2DA',
                      },
                      {
                        id: 'neon',
                        label: t.themes.neon,
                        bg: '#060908',
                        sidebar: '#030505',
                        text: '#F1F5F4',
                        muted: '#76837F',
                        accent: '#00FF9D',
                        secondary: '#FFFFFF',
                        border: '#19221F',
                      },
                      {
                        id: 'sakura',
                        label: t.themes.sakura,
                        bg: '#161217',
                        sidebar: '#100C11',
                        text: '#F6EEF2',
                        muted: '#927986',
                        accent: '#E89EB8',
                        border: '#2F2531',
                      },
                    ].map((themeOption) => {
                      const isSelected =
                        settings.theme === themeOption.id ||
                        (themeOption.id === 'sakura' && (settings.theme as string) === 'pink') ||
                        (themeOption.id === 'dark' && (settings.theme as string) === 'oled') ||
                        (themeOption.id === 'white' && (settings.theme as string) === 'light');
                      return (
                        <button
                          key={themeOption.id}
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ theme: themeOption.id as any });
                            if (showThemesIntro) dismissThemesIntro();
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            padding: '8px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                            backgroundColor: isSelected ? 'var(--accent-muted)' : 'var(--bg-main)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            position: 'relative',
                            gap: '8px',
                          }}
                        >
                          {/* Compact Architectural Miniature */}
                          <div
                            style={{
                              height: '54px',
                              borderRadius: '6px',
                              backgroundColor: themeOption.bg,
                              border: `1px solid ${themeOption.border}`,
                              display: 'flex',
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            {/* Miniature sidebar */}
                            <div
                              style={{
                                width: '24%',
                                backgroundColor: themeOption.sidebar,
                                borderRight: `1px solid ${themeOption.border}`,
                                padding: '6px 4px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                              }}
                            >
                              <span style={{ width: '100%', height: '2px', borderRadius: '2px', backgroundColor: themeOption.accent, opacity: 0.7 }} />
                              <span style={{ width: '75%', height: '2px', borderRadius: '2px', backgroundColor: themeOption.muted, opacity: 0.45 }} />
                            </div>

                            {/* Miniature editor surface + sample text */}
                            <div
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                                textAlign: 'left',
                                gap: '2px',
                                position: 'relative',
                              }}
                            >
                              <span style={{ fontSize: '9.5px', fontWeight: 700, color: themeOption.text, lineHeight: 1.1 }}>
                                {t.settings.themeSampleHeading}
                              </span>
                              <span style={{ fontSize: '8px', color: themeOption.muted, lineHeight: 1.2 }}>
                                {t.settings.themeSampleBody}
                              </span>
                              <span
                                style={{
                                  width: '28px',
                                  height: '2px',
                                  borderRadius: '2px',
                                  backgroundColor: themeOption.accent,
                                  marginTop: '2px',
                                  boxShadow: themeOption.id === 'neon' ? `0 0 6px ${themeOption.accent}` : 'none',
                                }}
                              />

                              {/* Miniature Neon PCB / Sakura Blossom Signature Details (Balanced Full Canvas Preview) */}
                              {themeOption.id === 'neon' && (
                                <svg
                                  width="100%"
                                  height="100%"
                                  viewBox="0 0 110 54"
                                  preserveAspectRatio="xMidYMid slice"
                                  fill="none"
                                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                                >
                                  <path d="M0 14 H110 M0 28 H110 M0 42 H110 M24 0 V54 M56 0 V54 M88 0 V54" stroke="#00FF9D" strokeOpacity="0.10" strokeWidth="0.6" />
                                  <path d="M 0 10 L 28 10 L 38 20 L 58 20" stroke="#00FF9D" strokeOpacity="0.38" strokeWidth="0.95" />
                                  <path d="M 0 31 L 34 31 L 42 23 L 64 23" stroke="#00FF9D" strokeOpacity="0.44" strokeWidth="0.95" />
                                  <path d="M 110 42 L 78 42 L 66 30 L 46 30" stroke="#00FF9D" strokeOpacity="0.54" strokeWidth="1" />
                                  <path d="M 96 54 L 96 22 L 82 8" stroke="#00FF9D" strokeOpacity="0.34" strokeWidth="0.9" />
                                  <circle cx="58" cy="20" r="1.6" fill="#00FF9D" fillOpacity="0.74" />
                                  <circle cx="64" cy="23" r="1.5" fill="#00FF9D" fillOpacity="0.78" />
                                  <circle cx="46" cy="30" r="1.8" fill="#00FF9D" fillOpacity="0.82" />
                                  <circle cx="82" cy="8" r="1.4" fill="#00FF9D" fillOpacity="0.58" />
                                </svg>
                              )}

                              {themeOption.id === 'sakura' && (
                                <svg
                                  width="100%"
                                  height="100%"
                                  viewBox="0 0 110 54"
                                  preserveAspectRatio="xMidYMid slice"
                                  fill="none"
                                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                                >
                                  <path d="M 112 5 C 94 11, 78 20, 62 32" stroke="#7E5C6B" strokeOpacity="0.72" strokeWidth="1.2" strokeLinecap="round" />
                                  <path d="M -2 50 C 14 44, 28 38, 42 30" stroke="#7E5C6B" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
                                  <path d="M -2 14 C 18 18, 36 22, 54 27" stroke="#8A6475" strokeOpacity="0.52" strokeWidth="0.95" strokeLinecap="round" />
                                  {[
                                    { x: 90, y: 12, s: 0.25 },
                                    { x: 74, y: 23, s: 0.22 },
                                    { x: 54, y: 26, s: 0.21 },
                                    { x: 56, y: 11, s: 0.17 },
                                    { x: 26, y: 40, s: 0.21 },
                                  ].map((b, bIdx) => (
                                    <g key={bIdx} transform={`translate(${b.x}, ${b.y}) scale(${b.s})`}>
                                      {[0, 72, 144, 216, 288].map((a) => (
                                        <path
                                          key={a}
                                          d="M 0 -2 C -4 -9, -11 -17, -6 -24 C -3 -26, -1 -23, 0 -20.5 C 1 -23, 3 -26, 6 -24 C 11 -17, 4 -9, 0 -2 Z"
                                          transform={`rotate(${a})`}
                                          fill="#E89EB8"
                                          fillOpacity="0.72"
                                        />
                                      ))}
                                      <circle cx="0" cy="0" r="2.6" fill="#F6EEF2" fillOpacity="0.8" />
                                    </g>
                                  ))}
                                  <ellipse cx="44" cy="22" rx="2.4" ry="1.3" transform="rotate(-24 44 22)" fill="#E89EB8" fillOpacity="0.58" />
                                  <ellipse cx="66" cy="41" rx="2.2" ry="1.2" transform="rotate(32 66 41)" fill="#F0B0C6" fillOpacity="0.55" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Card Label & Active Check */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {themeOption.label}
                            </span>
                            {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhes de fundo (Sutis vs Desativados) */}
                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <label className="setting-label">{t.settings.backgroundDecorationsLabel}</label>
                    <p className="setting-desc">{t.settings.backgroundDecorationsDesc}</p>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px',
                      gap: '2px',
                    }}
                  >
                    {(
                      [
                        { id: 'subtle', label: t.settings.backgroundDecorationsSubtle },
                        { id: 'off', label: t.settings.backgroundDecorationsOff },
                      ] as Array<{ id: BackgroundDecorationsMode; label: string }>
                    ).map((opt) => {
                      const active = (settings.backgroundDecorations || 'subtle') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdateSettings({ backgroundDecorations: opt.id })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: active ? 600 : 500,
                            backgroundColor: active ? 'var(--bg-selected)' : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* EDITOR */}
            {activeTab === 'editor' && (
              <>
                <div>
                  <label className="setting-label">{t.settings.typography}</label>
                  <select
                    value={settings.editorFont}
                    onChange={(e) => onUpdateSettings({ editorFont: e.target.value })}
                    className="select-input"
                  >
                    {fontOptions.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="setting-label">
                      {format(t.settings.fontSize, { size: settings.editorFontSize })}
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="22"
                      step="1"
                      value={settings.editorFontSize}
                      onChange={(e) => onUpdateSettings({ editorFontSize: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', marginTop: '6px', accentColor: 'var(--accent)' }}
                    />
                  </div>

                  <div>
                    <label className="setting-label">
                      {format(t.settings.lineHeightLabel, { value: (settings.lineHeight || 1.65).toFixed(2) })}
                    </label>
                    <input
                      type="range"
                      min="1.45"
                      max="1.95"
                      step="0.05"
                      value={settings.lineHeight || 1.65}
                      onChange={(e) => onUpdateSettings({ lineHeight: parseFloat(e.target.value) })}
                      style={{ width: '100%', marginTop: '6px', accentColor: 'var(--accent)' }}
                    />
                  </div>
                </div>

                {/* Reading Width & Paragraph Spacing */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <label className="setting-label">{t.settings.readingWidthLabel}</label>
                      <p className="setting-desc">{t.settings.readingWidthDesc}</p>
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                        gap: '2px',
                      }}
                    >
                      {(
                        [
                          { id: 'comfortable', label: t.settings.readingWidthComfortable },
                          { id: 'wide', label: t.settings.readingWidthWide },
                          { id: 'full', label: t.settings.readingWidthFull },
                        ] as Array<{ id: ReadingWidth; label: string }>
                      ).map((opt) => {
                        const active = (settings.readingWidth || 'comfortable') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings({ readingWidth: opt.id })}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: active ? 600 : 500,
                              backgroundColor: active ? 'var(--bg-selected)' : 'transparent',
                              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      {t.settings.paragraphSpacingLabel}
                    </label>
                    <div
                      style={{
                        display: 'inline-flex',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                        gap: '2px',
                      }}
                    >
                      {(
                        [
                          { id: 'compact', label: t.settings.paragraphSpacingCompact },
                          { id: 'comfortable', label: t.settings.paragraphSpacingComfortable },
                          { id: 'airy', label: t.settings.paragraphSpacingAiry },
                        ] as Array<{ id: ParagraphSpacing; label: string }>
                      ).map((opt) => {
                        const active = (settings.paragraphSpacing || 'comfortable') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings({ paragraphSpacing: opt.id })}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: active ? 600 : 500,
                              backgroundColor: active ? 'var(--bg-selected)' : 'transparent',
                              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">{t.settings.lineWrap}</label>
                    <p className="setting-desc">{t.settings.lineWrapDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lineWrapping}
                    onChange={(e) => onUpdateSettings({ lineWrapping: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">{t.settings.lineNumbers}</label>
                    <p className="setting-desc">{t.settings.lineNumbersDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showLineNumbers}
                    onChange={(e) => onUpdateSettings({ showLineNumbers: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>
              </>
            )}

            {/* IDIOMA (Settings -> Language) */}
            {activeTab === 'language' && (
              <>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Globe size={15} style={{ color: 'var(--accent)' }} />
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      {t.settings.languageLabel}
                    </label>
                  </div>
                  <p className="setting-desc">{t.settings.languageDesc}</p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isCompactModal ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                      gap: '10px',
                      marginTop: '14px',
                    }}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isLangSelected = (settings.language || 'en') === lang.id;
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => onUpdateSettings({ language: lang.id as AppLanguage })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${isLangSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                            backgroundColor: isLangSelected ? 'var(--accent-muted)' : 'var(--bg-main)',
                            color: isLangSelected ? 'var(--accent)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
                              {lang.nativeName}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginTop: '2px',
                              }}
                            >
                              {lang.name}
                            </div>
                          </div>
                          {isLangSelected && <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* GERAL */}
            {activeTab === 'general' && (
              <>
                <div className="toggle-row">
                  <div>
                    <label className="setting-label">{t.settings.restoreLastNote}</label>
                    <p className="setting-desc">{t.settings.restoreLastNoteDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.restoreLastNote}
                    onChange={(e) => onUpdateSettings({ restoreLastNote: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">{t.settings.confirmPermanentDelete}</label>
                    <p className="setting-desc">{t.settings.confirmPermanentDeleteDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmPermanentDelete}
                    onChange={(e) => onUpdateSettings({ confirmPermanentDelete: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">{t.settings.devWorkflowLabel}</label>
                    <p className="setting-desc">{t.settings.devWorkflowDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings.developerWorkflowEnabled}
                    onChange={(e) => onUpdateSettings({ developerWorkflowEnabled: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                {settings.developerWorkflowEnabled && (
                  <ContextualHint
                    tipId="dev_workflow"
                    title={t.ux.tipDevToolsTitle}
                    description={t.ux.tipDevToolsDesc}
                    compact
                  />
                )}

                {isTauri() && (
                  <div>
                    <label className="setting-label">{t.settings.globalShortcut}</label>
                    <p className="setting-desc">
                      {t.settings.globalShortcutBefore}
                      <strong>{t.settings.globalShortcutKey}</strong>
                      {t.settings.globalShortcutAfter}
                    </p>
                  </div>
                )}

                {/* Onboarding / Help & Contextual Tips reset */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  {onOpenOnboarding && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenOnboarding();
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {t.ux.helpAndShortcutsBtn}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      resetContextualTips();
                      setTipsResetDone(true);
                    }}
                    style={{
                      fontSize: '12px',
                      color: tipsResetDone ? 'var(--accent)' : 'var(--text-muted)',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {tipsResetDone ? t.ux.tipsResetConfirmed : t.ux.resetTipsBtn}
                  </button>
                </div>
              </>
            )}

            {/* DADOS */}
            {activeTab === 'data' && (
              <>
                {!isTauri() && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {t.ux.webTabDataNotice}
                  </div>
                )}

                <div>
                  <label className="setting-label">{t.settings.localDb}</label>
                  <p className="setting-desc">{t.settings.localDbDesc}</p>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all',
                      marginTop: '6px',
                    }}
                  >
                    {dbPath || t.common.loading}
                  </div>
                </div>

                {/* Gerenciamento Inteligente de Backups Automáticos */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div className="toggle-row" style={{ paddingBottom: '10px', marginBottom: 0 }}>
                    <div>
                      <label className="setting-label">{t.backups.enabledLabel}</label>
                      <p className="setting-desc">{t.backups.enabledDesc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoBackupEnabled !== false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        onUpdateSettings({ autoBackupEnabled: enabled });
                        if (isTauri()) {
                          api.saveSetting('backup_enabled', enabled ? 'true' : 'false').then(() => loadBackups()).catch(() => {});
                        }
                      }}
                      className="toggle-checkbox"
                    />
                  </div>

                  {/* Frequency & Retention controls */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isCompactModal ? '1fr' : '1fr 1fr',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        {t.backups.frequencyLabel}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(
                          [
                            { id: '12h', label: t.backups.freq12h },
                            { id: 'daily', label: t.backups.freqDaily },
                            { id: 'weekly', label: t.backups.freqWeekly },
                          ] as Array<{ id: BackupFrequency; label: string }>
                        ).map((opt) => {
                          const active = (settings.backupFrequency || 'daily') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                onUpdateSettings({ backupFrequency: opt.id });
                                if (isTauri()) {
                                  api.saveSetting('backup_frequency', opt.id).then(() => loadBackups()).catch(() => {});
                                }
                              }}
                              style={{
                                padding: '5px 8px',
                                fontSize: '11.5px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
                                backgroundColor: active ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                fontWeight: active ? 600 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        {t.backups.retentionLabel}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(
                          [
                            { days: 7, label: t.backups.ret7Days },
                            { days: 14, label: t.backups.ret14Days },
                            { days: 30, label: t.backups.ret30Days },
                          ] as Array<{ days: BackupRetentionDays; label: string }>
                        ).map((opt) => {
                          const active = (settings.backupRetentionDays || 7) === opt.days;
                          return (
                            <button
                              key={opt.days}
                              type="button"
                              onClick={() => {
                                onUpdateSettings({ backupRetentionDays: opt.days });
                                if (isTauri()) {
                                  api.saveSetting('backup_retention_days', String(opt.days)).then(() => loadBackups()).catch(() => {});
                                }
                              }}
                              style={{
                                padding: '5px 8px',
                                fontSize: '11.5px',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
                                backgroundColor: active ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                fontWeight: active ? 600 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {format(t.backups.retentionHint, { days: settings.backupRetentionDays || 7 })}
                  </p>

                  {/* Minimalist Backup Metrics Summary */}
                  {isTauri() && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isCompactModal ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11.5px',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{t.backups.statStatus}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {settings.autoBackupEnabled !== false ? t.backups.statusActive : t.backups.statusPaused}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{t.backups.statCount}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {format(t.backups.filesCount, { count: backupSummary?.count ?? autoBackups.length })}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{t.backups.statSpace}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatBytesShort(backupSummary?.total_size_bytes ?? autoBackups.reduce((a, b) => a + b.size_bytes, 0))}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{t.backups.statLastBackup}</div>
                        <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {backupSummary?.last_backup_at
                            ? new Date(backupSummary.last_backup_at).toLocaleString(t.meta.dateLocale, {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : t.backups.neverLabel}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{t.backups.statNextBackup}</div>
                        <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {settings.autoBackupEnabled === false
                            ? t.backups.statusPaused
                            : backupSummary?.next_backup_at
                            ? new Date(backupSummary.next_backup_at).toLocaleString(t.meta.dateLocale, {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : t.backups.nextOnResume}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Backup Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isTauri()) {
                          setDataMessage(t.settings.desktopOnlyBackups);
                          return;
                        }
                        setIsBackingUp(true);
                        try {
                          const created = await api.triggerAutoBackup(true);
                          await loadBackups();
                          setDataMessage(
                            created
                              ? format(t.settings.backupSaved, { filename: created.filename })
                              : t.settings.localCopyUpdated
                          );
                        } catch (err: any) {
                          setDataMessage(format(t.settings.backupError, { error: err?.toString() || '' }));
                        } finally {
                          setIsBackingUp(false);
                        }
                      }}
                      disabled={isBackingUp}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        cursor: isBackingUp ? 'default' : 'pointer',
                        opacity: isBackingUp ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw size={13} className={isBackingUp ? 'animate-spin' : ''} />
                      <span>{isBackingUp ? t.settings.savingBtn : t.settings.backupNowBtn}</span>
                    </button>

                    {isTauri() && (
                      <button
                        type="button"
                        onClick={() => {
                          if ((backupSummary?.count ?? autoBackups.length) === 0) {
                            setDataMessage(t.backups.noAutoToDelete);
                            return;
                          }
                          setConfirmDeleteBackups((prev) => !prev);
                        }}
                        disabled={isDeletingBackups}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>{t.backups.deleteAutoBtn}</span>
                      </button>
                    )}
                  </div>

                  {/* Minimalist Inline Confirmation for Deleting Managed Auto-Backups */}
                  {confirmDeleteBackups && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--danger-muted)',
                        border: '1px solid var(--danger)',
                        fontSize: '11.5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t.backups.deleteAutoConfirmTitle}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {format(t.backups.deleteAutoConfirmDesc, {
                          count: backupSummary?.count ?? autoBackups.length,
                          size: formatBytesShort(
                            backupSummary?.total_size_bytes ??
                              autoBackups.reduce((a, b) => a + b.size_bytes, 0)
                          ),
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBackups(false)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingBackups}
                          onClick={async () => {
                            setIsDeletingBackups(true);
                            try {
                              const res = await api.deleteAutoBackups();
                              setConfirmDeleteBackups(false);
                              await loadBackups();
                              setDataMessage(
                                format(t.backups.deleteAutoDone, {
                                  count: res.deleted_count,
                                  size: formatBytesShort(res.freed_bytes),
                                })
                              );
                            } catch (err: any) {
                              setDataMessage(format(t.settings.backupError, { error: err?.toString() || '' }));
                            } finally {
                              setIsDeletingBackups(false);
                            }
                          }}
                          style={{
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            backgroundColor: 'var(--danger)',
                            color: '#FFFFFF',
                          }}
                        >
                          {t.backups.deleteAutoConfirmBtn}
                        </button>
                      </div>
                    </div>
                  )}

                  {autoBackups.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        maxHeight: '112px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px',
                        backgroundColor: 'var(--bg-elevated)',
                      }}
                    >
                      {autoBackups.map((b) => (
                        <div
                          key={b.filename}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5px 8px',
                            fontSize: '11.5px',
                            borderRadius: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                            <ShieldCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {b.filename}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatBytesShort(b.size_bytes)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {b.created_at
                                ? new Date(b.created_at).toLocaleString(t.meta.dateLocale, {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {t.settings.noRecentBackups}
                    </div>
                  )}
                </div>

                {/* Manual Export / Import Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={onExportLibrary}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                  >
                    <Download size={16} />
                    <span>{t.settings.exportLibraryBtn}</span>
                  </button>

                  <button
                    onClick={handleBackupExport}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                  >
                    <Download size={16} />
                    <span>{t.settings.createBackupBtn}</span>
                  </button>

                  {isTauri() && (
                    <button
                      onClick={handleBackupImport}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                    >
                      <Upload size={16} />
                      <span>{t.settings.restoreBackupBtn}</span>
                    </button>
                  )}
                </div>

                {/* Separate Safe Cache Cleanup Section */}
                {isTauri() && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <HardDrive size={14} style={{ color: 'var(--text-secondary)' }} />
                          <label className="setting-label" style={{ marginBottom: 0 }}>
                            {t.backups.cacheSectionTitle}
                          </label>
                        </div>
                        <p className="setting-desc" style={{ marginTop: '2px' }}>
                          {t.backups.cacheSectionDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if ((cacheStats?.cache_file_count || 0) === 0) {
                            setConfirmClearCache(true);
                          } else {
                            setConfirmClearCache((p) => !p);
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          flexShrink: 0,
                        }}
                      >
                        {t.backups.clearCacheBtn}
                      </button>
                    </div>

                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {format(t.backups.cacheSizeLabel, {
                        size: formatBytesShort(cacheStats?.cache_size_bytes ?? 0),
                      })}
                    </div>

                    {confirmClearCache && (
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-color)',
                          fontSize: '11.5px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {(cacheStats?.cache_file_count || 0) === 0
                            ? `${t.backups.cacheEmpty} ${t.backups.cacheSafetyNote}`
                            : format(t.backups.clearCacheConfirmDesc, {
                                count: cacheStats?.cache_file_count || 0,
                                size: formatBytesShort(cacheStats?.cache_size_bytes || 0),
                              })}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setConfirmClearCache(false)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-main)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {t.common.cancel}
                          </button>
                          <button
                            type="button"
                            disabled={isClearingCache}
                            onClick={async () => {
                              setIsClearingCache(true);
                              try {
                                const res = await api.clearAppCache();
                                setConfirmClearCache(false);
                                await loadBackups();
                                setDataMessage(
                                  res.deleted_files > 0
                                    ? format(t.backups.clearCacheDone, {
                                        count: res.deleted_files,
                                        size: formatBytesShort(res.freed_bytes),
                                      })
                                    : `${t.backups.cacheEmpty} ${t.backups.cacheSafetyNote}`
                                );
                              } catch (err: any) {
                                setDataMessage(format(t.settings.backupError, { error: err?.toString() || '' }));
                              } finally {
                                setIsClearingCache(false);
                              }
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              backgroundColor: 'var(--primary)',
                              color: 'var(--primary-foreground)',
                            }}
                          >
                            {t.backups.clearCacheConfirmBtn}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {dataMessage && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-muted)',
                      color: 'var(--accent)',
                      fontSize: '12px',
                    }}
                  >
                    {dataMessage}
                  </div>
                )}
              </>
            )}

            {/* TAB: NOOK MOBILE */}
            {activeTab === 'mobile' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label className="setting-label">{t.settings.remoteAccess}</label>
                    <span className="setting-desc">
                      {t.settings.remoteAccessDesc}
                    </span>
                  </div>

                  {isTauri() && (
                    <button
                      onClick={async () => {
                        setMobileLoading(true);
                        try {
                          if (mobileInfo?.active) {
                            await api.stopMobileAccess();
                          } else {
                            await api.startMobileAccess();
                          }
                          await loadMobileStatus();
                        } catch (err: any) {
                          setDataMessage(format(t.settings.errorWithMsg, { msg: String(err?.message || err) }));
                        } finally {
                          setMobileLoading(false);
                        }
                      }}
                      disabled={mobileLoading}
                      style={{
                        height: '32px',
                        padding: '0 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: mobileInfo?.active ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent, #00FF9D)',
                        color: mobileInfo?.active ? '#EF4444' : 'var(--bg-main, #000000)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: mobileLoading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Power size={13} />
                      <span>
                        {mobileLoading
                          ? t.settings.wait
                          : mobileInfo?.active
                          ? t.settings.deactivateAccess
                          : t.settings.activateAccess}
                      </span>
                    </button>
                  )}
                </div>

                {mobileInfo?.active ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '16px',
                        padding: '16px',
                        backgroundColor: 'var(--bg-main)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        alignItems: 'center',
                      }}
                    >
                      <QRCodeSvg
                        value={mobileInfo?.qr_payload || mobileInfo?.url || ''}
                        size={140}
                      />

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent, #00FF9D)' }}>
                            {t.settings.tunnelActiveBadge}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t.settings.scanQrTitle}
                          </div>
                        </div>

                        {mobileInfo?.pair_code && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.settings.codeLabel}</span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '14px',
                                color: 'var(--accent, #00FF9D)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              {mobileInfo.pair_code}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            if (mobileInfo?.qr_payload || mobileInfo?.url) {
                              navigator.clipboard.writeText(mobileInfo.qr_payload || mobileInfo.url || '');
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            height: '28px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'transparent',
                            color: copiedLink ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedLink ? t.settings.linkCopied : t.settings.copyLink}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '8px',
                        }}
                      >
                        {format(t.settings.authorizedDevices, { count: mobileInfo?.authorized_devices?.length || 0 })}
                      </div>

                      {mobileInfo?.authorized_devices && mobileInfo.authorized_devices.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {mobileInfo.authorized_devices.map((device: AuthorizedDevice) => (
                            <div
                              key={device.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-main)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {device.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {device.is_revoked ? t.settings.revoked : t.settings.authorized}
                                </div>
                              </div>

                              {!device.is_revoked ? (
                                <button
                                  onClick={async () => {
                                    await api.revokeMobileDevice(device.id);
                                    await loadMobileStatus();
                                  }}
                                  style={{
                                    height: '24px',
                                    padding: '0 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    backgroundColor: 'transparent',
                                    color: '#EF4444',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {t.settings.revoke}
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    await api.deleteMobileDevice(device.id);
                                    await loadMobileStatus();
                                  }}
                                  style={{
                                    height: '24px',
                                    width: '24px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title={t.settings.removeHistory}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {t.settings.noDevicesYet}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px',
                      backgroundColor: 'var(--bg-main)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                      textAlign: 'center',
                      marginTop: '12px',
                    }}
                  >
                    <Smartphone size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {t.settings.disabledTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {isTauri() ? t.settings.disabledDesc : t.ux.desktopFeatureNotice}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SOBRE O NOOK & AUTO-UPDATE */}
            {activeTab === 'about' && (
              <>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img
                        src="/brand/nook-mark.svg"
                        alt="Nook"
                        style={{ width: '38px', height: '38px', objectFit: 'contain' }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Nook
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {t.settings.aboutDesc}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        fontSize: '11.5px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      v{updaterSnapshot?.currentVersion || serverVersion || '1.0.0'}
                    </div>
                  </div>

                  {/* Updater Section (Desktop vs Web/Mobile) */}
                  <div
                    style={{
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {isTauri() ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {t.updater.updateStateLabel}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {updaterSnapshot?.status === 'checking' && t.updater.statusChecking}
                              {updaterSnapshot?.status === 'up-to-date' && t.updater.statusUpToDate}
                              {updaterSnapshot?.status === 'available' &&
                                format(t.updater.updateAvailableBanner, {
                                  version: updaterSnapshot.availableVersion || '',
                                })}
                              {updaterSnapshot?.status === 'downloading' &&
                                format(t.updater.downloadProgress, {
                                  percent: updaterSnapshot.progressPercent,
                                })}
                              {updaterSnapshot?.status === 'ready' &&
                                format(t.updater.readyBanner, {
                                  version: updaterSnapshot.availableVersion || '',
                                })}
                              {updaterSnapshot?.status === 'failed' && t.updater.statusFailed}
                              {(!updaterSnapshot || updaterSnapshot.status === 'idle') && t.updater.statusIdle}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {(updaterSnapshot?.status === 'idle' ||
                              updaterSnapshot?.status === 'up-to-date' ||
                              updaterSnapshot?.status === 'failed' ||
                              updaterSnapshot?.status === 'checking') &&
                              onCheckForUpdates && (
                                <button
                                  type="button"
                                  disabled={updaterSnapshot?.status === 'checking'}
                                  onClick={onCheckForUpdates}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                  }}
                                >
                                  <RefreshCw
                                    size={13}
                                    className={updaterSnapshot?.status === 'checking' ? 'animate-spin' : undefined}
                                  />
                                  <span>
                                    {updaterSnapshot?.status === 'checking'
                                      ? t.updater.checkingBtn
                                      : t.updater.checkNowBtn}
                                  </span>
                                </button>
                              )}

                            {updaterSnapshot?.status === 'available' && onDownloadUpdate && (
                              <button
                                type="button"
                                onClick={onDownloadUpdate}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--primary)',
                                  color: 'var(--primary-foreground)',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <Download size={13} />
                                <span>{t.updater.updateNowBtn}</span>
                              </button>
                            )}

                            {updaterSnapshot?.status === 'ready' && onInstallUpdate && (
                              <button
                                type="button"
                                onClick={() => setConfirmRestartUpdate(true)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--primary)',
                                  color: 'var(--primary-foreground)',
                                  border: 'none',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <RefreshCw size={13} />
                                <span>{t.updater.installRestartBtn}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real Byte Progress Bar */}
                        {updaterSnapshot?.status === 'downloading' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div
                              style={{
                                width: '100%',
                                height: '6px',
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
                                  transition: 'width 150ms linear',
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {formatBytesShort(updaterSnapshot.downloadedBytes)}
                              {updaterSnapshot.totalBytes ? ` / ${formatBytesShort(updaterSnapshot.totalBytes)}` : ''}
                            </div>
                          </div>
                        )}

                        {updaterSnapshot?.status === 'failed' && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-color)',
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.45,
                            }}
                          >
                            {t.updater.failedHint}
                          </div>
                        )}

                        {updaterPendingOpNotice && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--accent-muted)',
                              color: 'var(--accent)',
                              fontSize: '11.5px',
                            }}
                          >
                            {updaterPendingOpNotice}
                          </div>
                        )}

                        {confirmRestartUpdate && updaterSnapshot?.status === 'ready' && onInstallUpdate && (
                          <div
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--accent-border)',
                              fontSize: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div style={{ color: 'var(--text-primary)', lineHeight: 1.45 }}>
                              {format(t.updater.confirmRestartDesc, {
                                version: updaterSnapshot.availableVersion || '',
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setConfirmRestartUpdate(false)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11.5px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-main)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {t.updater.laterBtn}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmRestartUpdate(false);
                                  onInstallUpdate();
                                }}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  borderRadius: 'var(--radius-sm)',
                                  border: 'none',
                                  backgroundColor: 'var(--primary)',
                                  color: 'var(--primary-foreground)',
                                }}
                              >
                                {t.updater.installRestartBtn}
                              </button>
                            </div>
                          </div>
                        )}

                        {updaterSnapshot?.releaseNotes && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              maxHeight: '88px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {updaterSnapshot.releaseNotes}
                          </div>
                        )}

                        <div className="toggle-row" style={{ paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', marginBottom: 0 }}>
                          <div>
                            <label className="setting-label" style={{ fontSize: '12.5px' }}>
                              {t.updater.autoCheckLabel}
                            </label>
                            <p className="setting-desc">{t.updater.autoCheckDesc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.autoUpdateCheck !== false}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              onUpdateSettings({ autoUpdateCheck: enabled });
                              api.saveSetting('auto_update_check', enabled ? 'true' : 'false').catch(() => {});
                            }}
                            className="toggle-checkbox"
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {serverVersion
                          ? format(t.updater.webVersionNotice, { version: serverVersion })
                          : t.updater.desktopOnlyNotice}
                      </div>
                    )}

                    <div>
                      <a
                        href={RELEASES_PAGE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>{t.updater.releaseNotesLink}</span>
                      </a>
                    </div>
                  </div>

                  {/* Voluntary Support Section inside About Nook */}
                  <div
                    style={{
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t.support.aboutCardTitle}
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: '12px',
                          lineHeight: 1.5,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t.support.aboutCardDesc}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenSupport) {
                            onOpenSupport();
                          } else {
                            api.openSponsorsPage().catch(() => {});
                          }
                        }}
                        title={t.support.aboutOpensExternalHint}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '7px 13px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-sidebar)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12.5px',
                          fontWeight: 500,
                        }}
                      >
                        <Heart size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span>{t.support.aboutCardButton}</span>
                      </button>

                      {onUpdateSupportPrefs &&
                        supportPrefs &&
                        supportPrefs.showInvitesSetting &&
                        !supportPrefs.neverShowAgain && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSupportPrefs((prev) => ({
                                ...prev,
                                showInvitesSetting: false,
                                neverShowAgain: true,
                              }))
                            }
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11.5px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {t.support.aboutAlreadySupportedBtn}
                          </button>
                        )}

                      {supportPrefs && (!supportPrefs.showInvitesSetting || supportPrefs.neverShowAgain) && (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {t.support.aboutAlreadySupportedStatus}
                        </span>
                      )}
                    </div>

                    {onUpdateSupportPrefs && supportPrefs && (
                      <div
                        className="toggle-row"
                        style={{
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-subtle)',
                          marginBottom: 0,
                        }}
                      >
                        <div>
                          <label className="setting-label" style={{ fontSize: '12.5px' }}>
                            {t.support.aboutInvitesToggleTitle}
                          </label>
                          <p className="setting-desc">{t.support.aboutInvitesToggleDesc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={supportPrefs.showInvitesSetting && !supportPrefs.neverShowAgain}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            onUpdateSupportPrefs((prev) => ({
                              ...prev,
                              showInvitesSetting: enabled,
                              neverShowAgain: !enabled,
                            }));
                          }}
                          className="toggle-checkbox"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .settings-tabs-compact .tab-btn {
          width: auto;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--text-secondary);
          width: 100%;
          text-align: left;
        }
        .tab-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }
        .tab-btn.active {
          background-color: var(--bg-selected);
          color: var(--accent);
          font-weight: 500;
        }
        .setting-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .setting-desc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .select-input {
          width: 100%;
          padding: 8px 10px;
          margin-top: 6px;
          background-color: var(--bg-main);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .toggle-checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--accent);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
