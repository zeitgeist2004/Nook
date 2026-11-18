import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Command,
  FilePlus,
  Zap,
  BookOpen,
  PanelLeft,
  HelpCircle,
  Feather,
  FolderTree,
  Search,
  Menu,
  MoreHorizontal,
  Save,
  Sliders,
  Check,
  Heart,
} from 'lucide-react';
import { NookIdleMascot, NookWelcomeMascot } from '../mascot/NookMascot';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { getEnvironmentProfile } from '../../utils/platform';
import { AppLanguage } from '../../types';
import {
  markFirstUseOnboardingCompleted,
} from '../../utils/onboardingUtils';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWriting: () => void;
  onOpenSupport?: () => void;
  isMobile?: boolean;
  mode?: 'welcome' | 'help';
  selectedLanguage?: AppLanguage;
  onSelectLanguage?: (lang: AppLanguage) => void;
}

interface LanguageSlide {
  id: AppLanguage;
  nativeLabel: string;
  greeting: string;
  chooseSubtitle: string;
  tagline: string;
}

const WELCOME_SLIDES: LanguageSlide[] = [
  {
    id: 'en',
    nativeLabel: 'English',
    greeting: 'Welcome to Nook',
    chooseSubtitle: 'Choose your language',
    tagline: 'Your space for ideas.',
  },
  {
    id: 'pt',
    nativeLabel: 'Português',
    greeting: 'Boas-vindas ao Nook',
    chooseSubtitle: 'Escolha seu idioma',
    tagline: 'Seu espaço para ideias.',
  },
  {
    id: 'es',
    nativeLabel: 'Español',
    greeting: 'Te damos la bienvenida a Nook',
    chooseSubtitle: 'Elige tu idioma',
    tagline: 'Tu espacio para las ideas.',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartWriting,
  onOpenSupport,
  isMobile = false,
  mode = 'welcome',
  selectedLanguage,
  onSelectLanguage,
}) => {
  const { t, language } = useTranslation();
  const isHelpMode = mode === 'help';
  const activeLang = selectedLanguage || language || 'en';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const touchStartXRef = useRef<number | null>(null);

  useDialogA11y({ isOpen, onClose, closeOnEscape: false });

  useEffect(() => {
    if (isOpen) {
      setStep(0);
    }
  }, [isOpen]);

  const handleDismiss = () => {
    markFirstUseOnboardingCompleted();
    onClose();
  };

  const handleCompleteStart = () => {
    onSelectLanguage?.(activeLang);
    markFirstUseOnboardingCompleted();
    onClose();
    onStartWriting();
  };

  const cycleLanguage = (delta: number) => {
    const currIdx = Math.max(0, WELCOME_SLIDES.findIndex((s) => s.id === activeLang));
    const nextIdx = (currIdx + delta + WELCOME_SLIDES.length) % WELCOME_SLIDES.length;
    onSelectLanguage?.(WELCOME_SLIDES[nextIdx].id);
  };

  // Keyboard accessibility: Escape closes, Left/Right switches language in step 0, Enter advances
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
        return;
      }

      if (!isHelpMode && step === 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        cycleLanguage(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'A') {
          return;
        }
        e.preventDefault();
        if (isHelpMode) {
          handleDismiss();
        } else if (step < 2) {
          setStep((prev) => (prev + 1) as 0 | 1 | 2);
        } else {
          handleCompleteStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isHelpMode, step, activeLang]);

  if (!isOpen) return null;

  const env = getEnvironmentProfile();
  const showTouchGuide = isMobile || env.isMobilePlatform;
  const showWebShortcuts = !showTouchGuide && env.isWeb;

  const currentSlide = WELCOME_SLIDES.find((s) => s.id === activeLang) || WELCOME_SLIDES[0];

  const desktopShortcuts = [
    {
      action: t.onboarding.shortcutNewNoteAction,
      desc: t.onboarding.shortcutNewNoteDesc,
      keys: ['Ctrl', 'N'],
      icon: <FilePlus size={14} />,
    },
    {
      action: t.onboarding.shortcutCommandAction,
      desc: t.onboarding.shortcutCommandDesc,
      keys: ['Ctrl', 'K'],
      icon: <Command size={14} />,
    },
    {
      action: t.onboarding.shortcutReadEditAction,
      desc: t.onboarding.shortcutReadEditDesc,
      keys: ['Ctrl', 'E'],
      icon: <BookOpen size={14} />,
    },
    {
      action: t.onboarding.shortcutSidebarAction,
      desc: t.onboarding.shortcutSidebarDesc,
      keys: ['Ctrl', 'B'],
      icon: <PanelLeft size={14} />,
    },
    {
      action: t.onboarding.shortcutCaptureAction,
      desc: t.onboarding.shortcutCaptureDesc,
      keys: ['Ctrl', 'Alt', 'N'],
      icon: <Zap size={14} />,
    },
    {
      action: t.commandPalette.cmdShortcutsTitle,
      desc: t.commandPalette.cmdShortcutsSub,
      keys: ['Ctrl', '/'],
      icon: <HelpCircle size={14} />,
    },
  ];

  const webShortcuts = [
    {
      action: t.onboarding.shortcutCommandAction,
      desc: t.onboarding.shortcutCommandDesc,
      keys: ['Ctrl', 'K'],
      icon: <Command size={14} />,
    },
    {
      action: t.onboarding.shortcutReadEditAction,
      desc: t.onboarding.shortcutReadEditDesc,
      keys: ['Ctrl', 'E'],
      icon: <BookOpen size={14} />,
    },
    {
      action: t.onboarding.shortcutSidebarAction,
      desc: t.onboarding.shortcutSidebarDesc,
      keys: ['Ctrl', 'B'],
      icon: <PanelLeft size={14} />,
    },
    {
      action: t.common.save,
      desc: t.ux.shortcutSaveDesc,
      keys: ['Ctrl', 'S'],
      icon: <Save size={14} />,
    },
    {
      action: t.common.settings,
      desc: t.sidebar.settingsTitle,
      keys: ['Ctrl', ','],
      icon: <Sliders size={14} />,
    },
    {
      action: t.commandPalette.cmdShortcutsTitle,
      desc: t.commandPalette.cmdShortcutsSub,
      keys: ['Ctrl', '/'],
      icon: <HelpCircle size={14} />,
    },
  ];

  const touchItems = [
    {
      action: t.ux.touchNavSidebarAction,
      desc: t.ux.touchNavSidebarDesc,
      icon: <Menu size={14} />,
    },
    {
      action: t.ux.touchNavSearchAction,
      desc: t.ux.touchNavSearchDesc,
      icon: <Search size={14} />,
    },
    {
      action: t.ux.touchNavReadAction,
      desc: t.ux.touchNavReadDesc,
      icon: <BookOpen size={14} />,
    },
    {
      action: t.ux.touchNavMoreAction,
      desc: t.ux.touchNavMoreDesc,
      icon: <MoreHorizontal size={14} />,
    },
  ];

  const essentials = [
    {
      icon: <Feather size={16} />,
      title: t.onboarding.quickNotesTitle,
      desc: t.onboarding.quickNotesDesc,
    },
    {
      icon: <FolderTree size={16} />,
      title: t.onboarding.projectsTitle,
      desc: t.onboarding.projectsDesc,
    },
    {
      icon: <Search size={16} />,
      title: t.onboarding.searchTitle,
      desc: t.onboarding.searchDesc,
    },
  ];

  const activeShortcuts = showWebShortcuts ? webShortcuts : desktopShortcuts;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.74)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding:
          'max(14px, env(safe-area-inset-top, 14px)) 12px max(14px, env(safe-area-inset-bottom, 14px)) 12px',
        boxSizing: 'border-box',
        animation: 'fadeIn var(--transition-fast) ease-out',
      }}
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isHelpMode ? t.ux.helpAndShortcutsBtn : currentSlide.greeting}
        style={{
          width: isHelpMode ? 'min(95vw, 560px)' : 'min(94vw, 480px)',
          maxHeight: 'min(92dvh, var(--nook-viewport-height, 92dvh), 680px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 24px 52px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'nookPopIn 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-right Close */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
          <Tooltip content={t.common.close} shortcut="Esc" position="left">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t.onboarding.closeAria}
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* ================================================================ */}
        {/* HELP & SHORTCUTS MODE (? / Ctrl+/ / Mobile Menu Help)            */}
        {/* ================================================================ */}
        {isHelpMode ? (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div
                style={{
                  padding: isMobile ? '16px 16px 12px 16px' : '22px 24px 14px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '14px',
                  paddingRight: '44px',
                }}
              >
                <h1
                  style={{
                    fontSize: isMobile ? '17px' : '18px',
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    color: 'var(--text-primary)',
                    margin: '0 0 4px 0',
                  }}
                >
                  {t.ux.helpAndShortcutsBtn}
                </h1>
                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {t.ux.welcomeTagline}
                </p>
              </div>

              <div style={{ padding: isMobile ? '0 16px 14px 16px' : '0 24px 18px 24px' }}>
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    paddingLeft: '2px',
                  }}
                >
                  {showTouchGuide
                    ? t.ux.touchNavTitle
                    : showWebShortcuts
                    ? t.ux.shortcutsPlatformWeb
                    : t.ux.shortcutsPlatformDesktop}
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  {showTouchGuide
                    ? touchItems.map((item, idx) => (
                        <div
                          key={item.action}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '9px 12px',
                            borderBottom:
                              idx < touchItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                        >
                          <div style={{ color: 'var(--text-secondary)', display: 'inline-flex', marginTop: '2px' }}>
                            {item.icon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {item.action}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                              {item.desc}
                            </div>
                          </div>
                        </div>
                      ))
                    : activeShortcuts.map((item, idx) => (
                        <div
                          key={item.action}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '8px 12px',
                            borderBottom:
                              idx < activeShortcuts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                            <div style={{ color: 'var(--text-secondary)', display: 'inline-flex', flexShrink: 0 }}>
                              {item.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {item.action}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                {item.desc}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                            {item.keys.map((k, ki) => (
                              <kbd
                                key={`${k}-${ki}`}
                                style={{
                                  fontSize: '10px',
                                  fontFamily: 'var(--font-mono)',
                                  padding: '2px 5px',
                                  backgroundColor: 'var(--bg-elevated)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                </div>

                {(showWebShortcuts || showTouchGuide) && (
                  <p
                    style={{
                      margin: '8px 2px 0',
                      fontSize: '11px',
                      lineHeight: 1.4,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showTouchGuide ? t.ux.shortcutsMobileNote : t.ux.shortcutsWebNote}
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                padding: isMobile ? '10px 16px' : '12px 24px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: onOpenSupport ? 'space-between' : 'flex-end',
                gap: '10px',
              }}
            >
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    onOpenSupport();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={13} />
                  <span>{t.support.helpButton}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.common.close}
              </button>
            </div>
          </>
        ) : (
          /* ================================================================ */
          /* 3-STAGE MULTILINGUAL FIRST-RUN ONBOARDING                        */
          /* ================================================================ */
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '22px 18px 14px' : '28px 26px 18px' }}>
              {/* Progress Indicator Dots (Minimalist 3-step marker) */}
              <div
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                }}
              >
                {[0, 1, 2].map((idx) => (
                  <span
                    key={idx}
                    style={{
                      width: step === idx ? '18px' : '6px',
                      height: '6px',
                      borderRadius: '999px',
                      backgroundColor: step === idx ? 'var(--accent)' : 'var(--border-color)',
                      transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                ))}
              </div>

              {/* STAGE 0: Language Carousel */}
              {step === 0 && (
                <div
                  key="onboarding-step-0"
                  className="nook-onboarding-step"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
                    const diff = endX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(diff) > 36) {
                      cycleLanguage(diff < 0 ? 1 : -1);
                    }
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <NookWelcomeMascot size={isMobile ? 62 : 70} />
                  </div>

                  <h1
                    style={{
                      fontSize: isMobile ? '19px' : '21px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--text-primary)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    {currentSlide.greeting}
                  </h1>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: '0 0 18px 0',
                    }}
                  >
                    {currentSlide.chooseSubtitle}
                  </p>

                  {/* Compact Language Carousel */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => cycleLanguage(-1)}
                      aria-label={t.onboarding.prevLangAria}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor: 'var(--bg-main)',
                        border: '1.5px solid var(--accent)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 16px',
                        transition: 'border-color 140ms ease',
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {currentSlide.nativeLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '3px', fontWeight: 500 }}>
                        {currentSlide.greeting}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {currentSlide.tagline}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => cycleLanguage(1)}
                      aria-label={t.onboarding.nextLangAria}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Direct Clickable Language Pills */}
                  <div
                    role="radiogroup"
                    aria-label={currentSlide.chooseSubtitle}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '6px',
                      width: '100%',
                      marginTop: '10px',
                    }}
                  >
                    {WELCOME_SLIDES.map((slide) => {
                      const active = slide.id === activeLang;
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => onSelectLanguage?.(slide.id)}
                          style={{
                            padding: '8px 6px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                            backgroundColor: active ? 'var(--accent-muted)' : 'var(--bg-main)',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: active ? 600 : 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 140ms ease',
                          }}
                        >
                          <span>{slide.nativeLabel}</span>
                          {active && <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STAGE 1: Essentials Only (Quick Notes, Projects, Search) */}
              {step === 1 && (
                <div
                  key="onboarding-step-1"
                  className="nook-onboarding-step"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <NookIdleMascot size={isMobile ? 58 : 66} />
                  </div>
                  <h1
                    style={{
                      fontSize: isMobile ? '18px' : '19px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--text-primary)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    {t.onboarding.welcome}
                  </h1>
                  <p
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                      margin: '0 0 16px 0',
                      maxWidth: '340px',
                    }}
                  >
                    {t.ux.welcomeTagline}
                  </p>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                    {essentials.map((item) => (
                      <div
                        key={item.title}
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '11px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '11px',
                        }}
                      >
                        <div
                          style={{
                            color: 'var(--accent)',
                            backgroundColor: 'var(--accent-muted)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px',
                            display: 'inline-flex',
                            flexShrink: 0,
                          }}
                        >
                          {item.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STAGE 2: Final Action — Start Writing */}
              {step === 2 && (
                <div
                  key="onboarding-step-2"
                  className="nook-onboarding-step"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '8px 0 6px',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <img
                      src="/brand/mascot/nook-head-wink.png"
                      alt={t.mascot.welcomeAlt}
                      style={{
                        width: isMobile ? '64px' : '74px',
                        height: isMobile ? '64px' : '74px',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  <h1
                    style={{
                      fontSize: isMobile ? '19px' : '21px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: 'var(--text-primary)',
                      margin: '0 0 6px 0',
                    }}
                  >
                    {t.onboarding.readyTitle}
                  </h1>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      maxWidth: '340px',
                      lineHeight: 1.5,
                    }}
                  >
                    {t.onboarding.readySubtitle}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div
              style={{
                padding: isMobile ? '10px 16px' : '12px 24px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => Math.max(0, prev - 1) as 0 | 1 | 2)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '6px 0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ArrowLeft size={13} />
                    <span>{t.onboarding.stepBack}</span>
                  </button>
                )}

                {step < 2 && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px 0',
                    }}
                  >
                    {t.onboarding.skip}
                  </button>
                )}
              </div>

              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev + 1) as 0 | 1 | 2)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>{t.onboarding.stepContinue}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCompleteStart}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  <span>{t.onboarding.startWritingCta}</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
