// ============================================================================
// NOOK VOICE — VOICE SESSION HOOK
// Manages real-time transcription, progressive Markdown generation & auto-save
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VoiceMode,
  VoiceStatus,
  VoiceSaveStatus,
  VoiceSegment,
} from '../types/speech';
import { SpeechRecognitionService } from '../services/voice/speechRecognition';
import { screenWakeLock } from '../services/voice/screenWakeLock';
import { voiceOfflineStorage } from '../services/voice/voiceOfflineStorage';
import { api } from '../services/api';
import { getTranslations, useTranslation } from '../i18n';

interface UseVoiceSessionOptions {
  mode?: VoiceMode;
  onNoteCreated?: (noteId: string) => void;
  onSessionFinished?: (noteId: string) => void;
}

export function buildVoiceMarkdown(
  title: string,
  startTime: string,
  mode: VoiceMode,
  segments: VoiceSegment[]
): string {
  const { voice } = getTranslations();
  let md = `# ${title}\n\n*${voice.mdStartPrefix}: ${startTime}*\n\n`;
  if (mode === 'meeting') {
    md += `> ${voice.mdMeetingConsent}\n\n`;
  }
  md += `## ${voice.mdTranscriptHeading}\n\n`;
  if (segments.length === 0) {
    md += `_${voice.mdTranscriptInProgress}_\n`;
  } else {
    for (const seg of segments) {
      md += `[${seg.timeFormatted}] ${seg.text}\n\n`;
    }
  }
  return md;
}

export function useVoiceSession({
  mode = 'note',
  onNoteCreated,
  onSessionFinished,
}: UseVoiceSessionOptions = {}) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  const [activeMode, setActiveMode] = useState<VoiceMode>(mode);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [saveStatus, setSaveStatus] = useState<VoiceSaveStatus>('saved');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [segments, setSegments] = useState<VoiceSegment[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const engineRef = useRef<SpeechRecognitionService | null>(null);
  const timerRef = useRef<any>(null);
  const sequenceRef = useRef(0);
  const versionRef = useRef(0);
  const sessionSeqRef = useRef(0);
  const pendingFinishRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<{ title: string; content: string } | null>(null);
  const segmentsRef = useRef<VoiceSegment[]>([]);
  const noteIdRef = useRef<string | null>(null);
  const noteTitleRef = useRef<string>('');
  const startTimeStrRef = useRef<string>('');
  const activeModeRef = useRef<VoiceMode>(mode);

  const isSupported = SpeechRecognitionService.isSupported();

  // Progressive auto-save to Nook Backend (SQLite / Cloudflare Tunnel)
  const persistMarkdownIncremental = useCallback(
    async (targetNoteId: string, title: string, content: string) => {
      if (!targetNoteId) return;

      pendingSaveRef.current = { title, content };
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      const currentVersion = ++versionRef.current;
      setSaveStatus('saving');

      try {
        await api.saveNote(targetNoteId, title, content, currentVersion);
        if (currentVersion >= versionRef.current) {
          setSaveStatus('saved');
          await voiceOfflineStorage.removePendingDraft(targetNoteId);
        }
      } catch (err) {
        console.warn('Nook Voice: Cloud save failed, queueing offline draft:', err);
        setSaveStatus('offline_saved');
        await voiceOfflineStorage.savePendingDraft(targetNoteId, title, content, currentVersion);
      } finally {
        isSavingRef.current = false;
        // Check if new content was queued during inflight request
        if (
          pendingSaveRef.current &&
          pendingSaveRef.current.content !== content
        ) {
          const next = pendingSaveRef.current;
          persistMarkdownIncremental(targetNoteId, next.title, next.content);
        }
      }
    },
    []
  );

  // Initialize Speech Engine
  useEffect(() => {
    if (!isSupported) {
      setStatus('error');
      setErrorMessage(tRef.current.voice.errUnsupportedBrowser);
      return;
    }

    const engine = new SpeechRecognitionService(
      {
        onStatusChange: (newStatus, msg) => {
          setStatus(newStatus);
          if (msg) setErrorMessage(msg);
        },
        onInterim: (text) => {
          setInterimText(text);
        },
        onFinalSegment: (text, timestamp) => {
          const timeFormatted = new Date(timestamp).toLocaleTimeString(tRef.current.meta.dateLocale, {
            hour: '2-digit',
            minute: '2-digit',
          });
          const newSeg: VoiceSegment = {
            id: `seg_${Date.now()}_${++sequenceRef.current}`,
            sequence: sequenceRef.current,
            text,
            timestamp,
            timeFormatted,
          };

          setSegments((prev) => {
            const next = [...prev, newSeg];
            segmentsRef.current = next;
            // Trigger progressive background save immediately if noteId is ready
            const currentNoteId = noteIdRef.current;
            const currentTitle = noteTitleRef.current;
            const currentStartTime = startTimeStrRef.current;
            const currentMode = activeModeRef.current;
            if (currentNoteId && currentTitle && currentStartTime) {
              const md = buildVoiceMarkdown(currentTitle, currentStartTime, currentMode, next);
              persistMarkdownIncremental(currentNoteId, currentTitle, md);
            }
            return next;
          });
        },
        onError: (errText, isFatal) => {
          setErrorMessage(errText);
          if (isFatal) {
            setStatus('error');
            screenWakeLock.release();
          }
        },
      },
      tRef.current.meta.speechLocale
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      screenWakeLock.release();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSupported, persistMarkdownIncremental]);

  // Keep speech recognition language synced with UI language setting
  useEffect(() => {
    engineRef.current?.setLang(t.meta.speechLocale);
  }, [t.meta.speechLocale]);

  // Stopwatch timer
  useEffect(() => {
    if (status === 'listening') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  // Start Voice Session
  const startSession = useCallback(
    (selectedMode?: VoiceMode) => {
      if (!isSupported) return;

      // 1. CRITICAL: Start Web Speech Recognition SYNCHRONOUSLY at the very start of the user gesture!
      // In iOS Safari, any prior deferrals or promise executions revoke transient user activation,
      // which causes Safari to reject microphone access with error: 'not-allowed'.
      setStatus('requesting_permission');
      engineRef.current?.setLang(tRef.current.meta.speechLocale);
      engineRef.current?.start();

      const currentMode = selectedMode || activeModeRef.current;
      activeModeRef.current = currentMode;
      if (selectedMode) setActiveMode(selectedMode);

      setErrorMessage(null);
      setSegments([]);
      segmentsRef.current = [];
      setInterimText('');
      setElapsedSeconds(0);
      sequenceRef.current = 0;
      versionRef.current = 0;
      noteIdRef.current = null;
      setNoteId(null);

      const now = new Date();
      const dateStr = now.toLocaleDateString(tRef.current.meta.dateLocale);
      const timeStr = now.toLocaleTimeString(tRef.current.meta.dateLocale, { hour: '2-digit', minute: '2-digit' });
      const title =
        currentMode === 'meeting'
          ? `${tRef.current.voice.noteTitleMeetingPrefix}${dateStr}`
          : `${tRef.current.voice.noteTitleVoicePrefix}${dateStr}`;

      noteTitleRef.current = title;
      startTimeStrRef.current = timeStr;
      setNoteTitle(title);

      const currentSessionSeq = ++sessionSeqRef.current;
      pendingFinishRef.current = false;
      const initialMarkdown = buildVoiceMarkdown(title, timeStr, currentMode, []);

      // 2. Concurrently create real note in SQLite backend in background
      api.createNote(null, title, initialMarkdown)
        .then((createdNote) => {
          if (currentSessionSeq !== sessionSeqRef.current) return;
          setNoteId(createdNote.id);
          noteIdRef.current = createdNote.id;
          onNoteCreated?.(createdNote.id);

          // Flush any segments that arrived while note creation was resolving (including early finish)
          if (segmentsRef.current.length > 0 || pendingFinishRef.current) {
            const md = buildVoiceMarkdown(title, timeStr, currentMode, segmentsRef.current);
            persistMarkdownIncremental(createdNote.id, title, md);
          }
          if (pendingFinishRef.current) {
            pendingFinishRef.current = false;
            onSessionFinished?.(createdNote.id);
          }
        })
        .catch((err: any) => {
          if (currentSessionSeq !== sessionSeqRef.current) return;
          console.error('Failed to create voice note:', err);
          setStatus('error');
          setErrorMessage(tRef.current.voice.errorInitNote);
        });

      // 3. Concurrently acquire wake lock
      screenWakeLock.acquire().catch(() => {});
    },
    [isSupported, onNoteCreated, onSessionFinished, persistMarkdownIncremental]
  );

  // Pause
  const pauseSession = useCallback(() => {
    engineRef.current?.pause();
    screenWakeLock.release();
  }, []);

  // Resume
  const resumeSession = useCallback(async () => {
    setErrorMessage(null);
    await screenWakeLock.acquire();
    engineRef.current?.resume();
  }, []);

  // Finish
  const finishSession = useCallback(async () => {
    engineRef.current?.stop();
    screenWakeLock.release();
    setStatus('finished');

    const currentNoteId = noteIdRef.current;
    const currentTitle = noteTitleRef.current;
    const currentStartTime = startTimeStrRef.current;
    const currentMode = activeModeRef.current;

    // Final flush save (or mark pending finish if initial note creation is still in flight)
    if (currentNoteId && currentTitle && currentStartTime) {
      const finalMd = buildVoiceMarkdown(currentTitle, currentStartTime, currentMode, segmentsRef.current);
      await persistMarkdownIncremental(currentNoteId, currentTitle, finalMd);
    } else if (!currentNoteId && currentTitle && currentStartTime) {
      pendingFinishRef.current = true;
    }

    if (currentNoteId) {
      onSessionFinished?.(currentNoteId);
    }
  }, [persistMarkdownIncremental, onSessionFinished]);

  const addManualSegment = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const now = Date.now();
      const timeFormatted = new Date(now).toLocaleTimeString(tRef.current.meta.dateLocale, {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newSeg: VoiceSegment = {
        id: `seg_${Date.now()}_${++sequenceRef.current}`,
        sequence: sequenceRef.current,
        text: trimmed,
        timestamp: now,
        timeFormatted,
      };

      setSegments((prev) => {
        const next = [...prev, newSeg];
        segmentsRef.current = next;

        const currentNoteId = noteIdRef.current;
        const currentTitle = noteTitleRef.current;
        const currentStartTime = startTimeStrRef.current;
        const currentMode = activeModeRef.current;
        if (currentNoteId && currentTitle && currentStartTime) {
          const md = buildVoiceMarkdown(currentTitle, currentStartTime, currentMode, next);
          persistMarkdownIncremental(currentNoteId, currentTitle, md);
        }
        return next;
      });

      // If note has not yet been initialized in SQLite, initialize it now
      if (!noteIdRef.current) {
        const currentDate = new Date();
        const dateStr = currentDate.toLocaleDateString(tRef.current.meta.dateLocale);
        const timeStr = currentDate.toLocaleTimeString(tRef.current.meta.dateLocale, { hour: '2-digit', minute: '2-digit' });
        const title =
          activeModeRef.current === 'meeting'
            ? `${tRef.current.voice.noteTitleMeetingPrefix}${dateStr}`
            : `${tRef.current.voice.noteTitleVoicePrefix}${dateStr}`;

        noteTitleRef.current = title;
        startTimeStrRef.current = timeStr;
        setNoteTitle(title);

        const currentSessionSeq = ++sessionSeqRef.current;
        const initialMarkdown = buildVoiceMarkdown(title, timeStr, activeModeRef.current, [newSeg]);
        api.createNote(null, title, initialMarkdown)
          .then((createdNote) => {
            if (currentSessionSeq !== sessionSeqRef.current) return;
            setNoteId(createdNote.id);
            noteIdRef.current = createdNote.id;
            onNoteCreated?.(createdNote.id);
          })
          .catch((err) => {
            console.error('Failed to create manual voice note:', err);
          });
      }
    },
    [persistMarkdownIncremental, onNoteCreated]
  );

  const updateMode = useCallback((newMode: VoiceMode) => {
    activeModeRef.current = newMode;
    setActiveMode(newMode);
  }, []);

  return {
    mode: activeMode,
    setMode: updateMode,
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
  };
}
