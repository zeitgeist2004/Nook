// ============================================================================
// NOOK VOICE — MINIMALIST MONOCHROMATIC VOICE INTERFACE
// Production Speech-to-Text modal for Nook Mobile & Web
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  X,
  Play,
  Pause,
  Square,
  FileText,
  Users,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Plus,
} from 'lucide-react';
import { VoiceMode } from '../../../types/speech';
import { useVoiceSession } from '../../../hooks/useVoiceSession';
import { NookIdleMascot } from '../../mascot/NookMascot';
import { useTranslation } from '../../../i18n';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { ContextualHint } from '../../ui/ContextualHint';

interface NookVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNote?: (noteId: string) => void;
  defaultMode?: VoiceMode;
}

export const NookVoiceModal: React.FC<NookVoiceModalProps> = ({
  isOpen,
  onClose,
  onOpenNote,
  defaultMode = 'note',
}) => {
  const { t } = useTranslation();
  const [hasAcknowledgedPrivacy, setHasAcknowledgedPrivacy] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('nook_voice_privacy_acknowledged') === 'true';
  });

  const {
    mode,
    setMode,
    status,
    saveStatus,
    noteId,
    noteTitle,
    segments,
    interimText,
    elapsedSeconds,
    errorMessage,
    isSupported,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    addManualSegment,
  } = useVoiceSession({
    mode: defaultMode,
  });

  const [dictationInput, setDictationInput] = useState('');
  const [dictationFeedback, setDictationFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useDialogA11y({ isOpen, closeOnEscape: false });

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleAddDictation = () => {
    const text = dictationInput.trim();
    if (!text) return;
    addManualSegment(text);
    setDictationInput('');
    setDictationFeedback(t.voice.addedFeedback);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setDictationFeedback(null);
    }, 3500);
  };

  // Auto-scroll transcript container as speech arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (status === 'listening') {
          if (confirm(t.voice.confirmExitActive)) {
            finishSession();
            onClose();
          }
        } else {
          if (status !== 'idle' && status !== 'finished') {
            finishSession();
          }
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, finishSession, onClose, t.voice.confirmExitActive]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAcknowledgePrivacy = () => {
    setHasAcknowledgedPrivacy(true);
    try {
      localStorage.setItem('nook_voice_privacy_acknowledged', 'true');
    } catch {}
  };

  const handleSafeClose = () => {
    if (status === 'listening') {
      if (confirm(t.voice.confirmExitActive)) {
        finishSession();
        onClose();
      }
    } else {
      if (status !== 'idle' && status !== 'finished') {
        finishSession();
      }
      onClose();
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'requesting_permission':
        return t.voice.statusRequesting;
      case 'listening':
        return t.voice.statusListening;
      case 'processing':
        return t.voice.statusProcessing;
      case 'paused':
        return t.voice.statusPaused;
      case 'reconnecting':
        return t.voice.statusReconnecting;
      case 'error':
        return t.voice.statusError;
      case 'finished':
        return t.voice.statusFinished;
      default:
        return t.voice.statusIdle;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 16px) 16px',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.voice.title}
        className="animate-modal-pop"
        style={{
          width: '100%',
          maxWidth: '520px',
          height: 'min(92dvh, var(--nook-viewport-height, 92dvh), 680px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '52px',
            padding: '0 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mic size={17} style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Nook Voice
            </span>
          </div>

          <button
            onClick={handleSafeClose}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            aria-label={t.voice.closeAria}
          >
            <X size={18} />
          </button>
        </div>

        {/* First-Time Privacy Transparency Notice */}
        {!hasAcknowledgedPrivacy && (
          <div
            style={{
              padding: '24px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <ShieldCheck size={22} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {t.voice.privacyTitle}
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  {t.voice.privacyDesc}
                </div>
              </div>
            </div>

            <button
              onClick={handleAcknowledgePrivacy}
              style={{
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t.voice.privacyAccept}
            </button>
          </div>
        )}

        {/* Mode Selector (Before starting) */}
        {hasAcknowledgedPrivacy && status === 'idle' && (
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => setMode('note')}
              style={{
                flex: 1,
                height: '38px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                borderColor: mode === 'note' ? 'var(--text-primary)' : 'var(--border-subtle)',
                backgroundColor: mode === 'note' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: mode === 'note' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={14} />
              <span>{t.voice.modeNote}</span>
            </button>

            <button
              onClick={() => setMode('meeting')}
              style={{
                flex: 1,
                height: '38px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                borderColor: mode === 'meeting' ? 'var(--text-primary)' : 'var(--border-subtle)',
                backgroundColor: mode === 'meeting' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: mode === 'meeting' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={14} />
              <span>{t.voice.modeMeeting}</span>
            </button>
          </div>
        )}

        {/* Center: Status & Stopwatch */}
        {hasAcknowledgedPrivacy && (
          <div
            style={{
              padding: '16px 20px 10px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '10px',
                boxShadow: status === 'listening' ? '0 0 20px rgba(255, 255, 255, 0.15)' : 'none',
                transition: 'box-shadow 0.3s ease',
              }}
            >
              <NookIdleMascot size={52} />
            </div>

            {/* Stopwatch */}
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              {formatTimer(elapsedSeconds)}
            </div>

            {/* Status Pill Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: status === 'listening' ? '#FFFFFF' : 'var(--text-muted)',
                  animation: status === 'listening' ? 'pulse 1.2s infinite' : 'none',
                }}
              />
              <span>{getStatusLabel()}</span>
            </div>

            {errorMessage && (
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  marginTop: '6px',
                  textAlign: 'center',
                  maxWidth: '360px',
                }}
              >
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Main: Progressive Transcript Display */}
        {hasAcknowledgedPrivacy && (
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              minHeight: '80px',
              overflowY: 'auto',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
            <ContextualHint
              tipId="voice"
              title={t.ux.tipVoiceTitle}
              description={t.ux.tipVoiceDesc}
              compact
            />
            {!isSupported && (
              <div
                style={{
                  fontSize: '12px',
                  lineHeight: 1.45,
                  color: 'var(--text-secondary)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                {t.ux.voiceUnavailableHint}
              </div>
            )}
            {segments.length === 0 && !interimText && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '20px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                {status === 'idle'
                  ? t.voice.idlePrompt
                  : t.voice.listeningPrompt}
              </div>
            )}

            {/* Confirmed Final Segments */}
            {segments.map((seg) => (
              <div
                key={seg.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '14px',
                  lineHeight: '1.55',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {seg.timeFormatted}
                </span>
                <span>{seg.text}</span>
              </div>
            ))}

            {/* Progressive In-Flight Interim Text */}
            {interimText && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '14px',
                  lineHeight: '1.55',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-muted)',
                    flexShrink: 0,
                    marginTop: '8px',
                    animation: 'pulse 0.8s infinite',
                  }}
                />
                <span>{interimText}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer: Controls & Save State */}
        {hasAcknowledgedPrivacy && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0,
              maxHeight: '58vh',
              overflowY: 'auto',
            }}
          >
            {/* Save Status Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{noteTitle || 'Nook Voice'}</span>
              <span>
                {saveStatus === 'saving' && t.voice.saveSaving}
                {saveStatus === 'saved' && t.voice.saveSaved}
                {saveStatus === 'offline_saved' && t.voice.saveOffline}
                {saveStatus === 'error' && t.voice.saveError}
              </span>
            </div>

            {/* ================================================================= */}
            {/* MÉTODO 1: Reconhecimento Automático Contínuo (Web Speech API) */}
            {/* ================================================================= */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mic size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t.voice.method1Label}
                  </span>
                </div>
                {status === 'listening' && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                        animation: 'pulse 1s infinite',
                      }}
                    />
                    {t.voice.listeningBadge}
                  </span>
                )}
              </div>

              {/* Action Buttons for Método 1 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(status === 'idle' || status === 'error') && (
                  <button
                    onClick={() => startSession()}
                    disabled={!isSupported}
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: isSupported ? 'pointer' : 'not-allowed',
                      opacity: isSupported ? 1 : 0.5,
                    }}
                  >
                    <Mic size={17} />
                    <span>{status === 'error' ? t.voice.retryMethod1 : t.voice.startAutoRecording}</span>
                  </button>
                )}

                {status === 'requesting_permission' && (
                  <button
                    disabled
                    style={{
                      flex: 1,
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'wait',
                    }}
                  >
                    <Mic size={17} />
                    <span>{t.voice.startingMic}</span>
                  </button>
                )}

                {status === 'listening' && (
                  <>
                    <button
                      onClick={pauseSession}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Pause size={16} />
                      <span>{t.voice.pause}</span>
                    </button>

                    <button
                      onClick={finishSession}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Square size={15} />
                      <span>{t.voice.finish}</span>
                    </button>
                  </>
                )}

                {status === 'paused' && (
                  <>
                    <button
                      onClick={resumeSession}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={16} />
                      <span>{t.voice.resume}</span>
                    </button>

                    <button
                      onClick={finishSession}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Square size={15} />
                      <span>{t.voice.finish}</span>
                    </button>
                  </>
                )}

                {status === 'finished' && (
                  <>
                    <button
                      onClick={() => {
                        if (noteId && onOpenNote) {
                          onOpenNote(noteId);
                        }
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <FileText size={16} />
                      <span>{t.voice.openInEditor}</span>
                    </button>

                    <button
                      onClick={() => startSession()}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Mic size={16} />
                      <span>{t.voice.newTranscription}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* DIVISOR EXPLICATIVO */}
            {/* ================================================================= */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 2px',
              }}
            >
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {t.voice.dividerAlternative}
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            </div>

            {/* ================================================================= */}
            {/* MÉTODO 2: Ditado por Teclado (100% Funcional no iPhone / Android) */}
            {/* ================================================================= */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={13} style={{ color: 'var(--text-primary)' }} />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {t.voice.method2Label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10B981',
                  }}
                >
                  {t.voice.iphoneBadge}
                </span>
              </div>

              <p
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: '1.4',
                }}
              >
                {t.voice.method2Desc}
              </p>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                <input
                  type="text"
                  value={dictationInput}
                  onChange={(e) => setDictationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dictationInput.trim()) {
                      e.preventDefault();
                      handleAddDictation();
                    }
                  }}
                  placeholder={t.voice.dictationPlaceholder}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '42px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 12px',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <button
                  type="button"
                  onClick={handleAddDictation}
                  disabled={!dictationInput.trim()}
                  style={{
                    height: '42px',
                    padding: '0 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: dictationInput.trim() ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                    color: dictationInput.trim() ? 'var(--primary-foreground)' : 'var(--text-muted)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: dictationInput.trim() ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  aria-label={t.voice.addSpeechAria}
                >
                  <Plus size={16} />
                  <span>{t.voice.addToNote}</span>
                </button>
              </div>

              {/* Feedback visual imediato quando a fala for adicionada */}
              {dictationFeedback && (
                <div
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10B981',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  <span>{dictationFeedback}</span>
                </div>
              )}

              {/* Ação rápida para ver no editor */}
              {noteId && onOpenNote && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNote(noteId);
                      onClose();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    {t.voice.viewFullInEditor}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
