import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { SaveStatus } from '../types';
import { getTranslations } from '../i18n';

interface UseAutoSaveOptions {
  noteId: string | null;
  title: string;
  content: string;
  isExternal?: boolean;
  externalPath?: string;
  canAutoSaveExternal?: boolean;
  baseUpdatedAt?: number | null;
  onSaved?: (noteId: string, title: string, updatedAt: number) => void;
}

const DEBOUNCE_MS = 350;
const MAX_WAIT_MS = 2000;
const RETRY_DELAY_MS = 1500;

export function useAutoSave({
  noteId,
  title,
  content,
  isExternal = false,
  externalPath,
  canAutoSaveExternal = false,
  baseUpdatedAt = null,
  onSaved,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const docKey = isExternal && externalPath ? `ext:${externalPath}` : noteId ? `note:${noteId}` : null;

  const versionRef = useRef(0);
  const baseUpdatedAtRef = useRef<number | null>(baseUpdatedAt ?? null);
  baseUpdatedAtRef.current = baseUpdatedAt ?? baseUpdatedAtRef.current;
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const journalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const latestRef = useRef({
    docKey,
    noteId,
    title,
    content,
    isExternal,
    externalPath,
    canAutoSaveExternal,
  });
  latestRef.current = {
    docKey,
    noteId,
    title,
    content,
    isExternal,
    externalPath,
    canAutoSaveExternal,
  };

  const lastSavedRef = useRef<{ docKey: string | null; title: string; content: string }>({
    docKey,
    title,
    content,
  });

  // Debounced in-flight draft journal for crash/power loss recovery (non-blocking)
  const scheduleDraftRecoveryJournal = useCallback((id: string, t: string, c: string) => {
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
    journalTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          `nook_draft_recovery_${id}`,
          JSON.stringify({ title: t, content: c, timestamp: Date.now() })
        );
      } catch {
        // Ignore localStorage quotas
      }
    }, 600);
  }, []);

  const clearDraftRecoveryJournal = useCallback((id: string) => {
    if (journalTimerRef.current) {
      clearTimeout(journalTimerRef.current);
      journalTimerRef.current = null;
    }
    try {
      localStorage.removeItem(`nook_draft_recovery_${id}`);
    } catch {
      // Ignore
    }
  }, []);

  // Flush journal synchronously on sudden window closing (internal notes only)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cur = latestRef.current;
      if (cur.noteId && !cur.isExternal) {
        try {
          localStorage.setItem(
            `nook_draft_recovery_${cur.noteId}`,
            JSON.stringify({
              title: cur.title,
              content: cur.content,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const executeSave = useCallback(async () => {
    const cur = latestRef.current;
    if (!cur.docKey) return;

    // Atomic identity check: refuse to save if React hasn't settled baseline for this document
    if (lastSavedRef.current.docKey !== cur.docKey) {
      return;
    }

    if (cur.isExternal) {
      // CRITICAL DATA PROTECTION: Never overwrite an external .txt/.md file unless user explicitly edited it
      if (!cur.externalPath || !cur.canAutoSaveExternal) {
        setStatus('saved');
        return;
      }
      if (lastSavedRef.current.content === cur.content) {
        setStatus('saved');
        return;
      }
    } else {
      if (
        lastSavedRef.current.title === cur.title &&
        lastSavedRef.current.content === cur.content
      ) {
        setStatus('saved');
        return;
      }
    }

    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    const currentVersion = ++versionRef.current;
    const targetKey = cur.docKey;
    const targetNoteId = cur.noteId;
    const targetTitle = cur.title;
    const targetContent = cur.content;
    const targetIsExternal = cur.isExternal;
    const targetExternalPath = cur.externalPath;

    setStatus('saving');
    setErrorMessage(null);

    try {
      if (targetIsExternal && targetExternalPath) {
        await api.writeExternalFile(targetExternalPath, targetContent);
        if (lastSavedRef.current.docKey === targetKey && currentVersion >= versionRef.current) {
          lastSavedRef.current = { docKey: targetKey, title: targetTitle, content: targetContent };
          setStatus('saved');
          onSavedRef.current?.(targetExternalPath, targetTitle, Date.now());
        }
      } else if (targetNoteId) {
        const res = await api.saveNote(
          targetNoteId,
          targetTitle,
          targetContent,
          currentVersion,
          baseUpdatedAtRef.current ?? undefined
        );
        if (lastSavedRef.current.docKey === targetKey && currentVersion >= versionRef.current) {
          lastSavedRef.current = { docKey: targetKey, title: targetTitle, content: targetContent };
          baseUpdatedAtRef.current = res.updated_at;
          clearDraftRecoveryJournal(targetNoteId);
          setStatus('saved');
          onSavedRef.current?.(targetNoteId, targetTitle, res.updated_at);
        }
      }
    } catch (err: any) {
      console.error('Nook AutoSave persistence error:', err);
      if (lastSavedRef.current.docKey === targetKey) {
        setStatus('error');
        setErrorMessage(err?.toString() || getTranslations().appAlerts.persistNoteError);

        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          executeSave();
        }, RETRY_DELAY_MS);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [clearDraftRecoveryJournal]);

  // Handle Document Switching: reset tracking baseline whenever docKey changes
  const prevDocKeyRef = useRef<string | null>(docKey);

  useEffect(() => {
    if (prevDocKeyRef.current !== docKey) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      lastSavedRef.current = { docKey, title, content };
      setStatus('saved');
      setErrorMessage(null);
      versionRef.current = 0;
      baseUpdatedAtRef.current = baseUpdatedAt ?? null;
      prevDocKeyRef.current = docKey;
    }
  }, [docKey, title, content, baseUpdatedAt]);

  // Debounce & Max-Wait Timing
  useEffect(() => {
    if (!docKey || lastSavedRef.current.docKey !== docKey) return;

    const hasChanged = isExternal
      ? canAutoSaveExternal && lastSavedRef.current.content !== content
      : lastSavedRef.current.title !== title || lastSavedRef.current.content !== content;

    if (hasChanged) {
      setStatus('unsaved');
      if (noteId && !isExternal) {
        scheduleDraftRecoveryJournal(noteId, title, content);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (maxWaitTimerRef.current) {
          clearTimeout(maxWaitTimerRef.current);
          maxWaitTimerRef.current = null;
        }
        executeSave();
      }, DEBOUNCE_MS);

      if (!maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(() => {
          maxWaitTimerRef.current = null;
          executeSave();
        }, MAX_WAIT_MS);
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [docKey, noteId, title, content, isExternal, canAutoSaveExternal, executeSave, scheduleDraftRecoveryJournal]);

  // Flush on unmount, window blur, beforeunload or visibility change
  const flushNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    await executeSave();
  }, [executeSave]);

  // Cancel any pending saves immediately (e.g. on delete note)
  const cancelPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (journalTimerRef.current) {
      clearTimeout(journalTimerRef.current);
      journalTimerRef.current = null;
    }
    if (latestRef.current.noteId) {
      clearDraftRecoveryJournal(latestRef.current.noteId);
    }
    setStatus('saved');
  }, [clearDraftRecoveryJournal]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushNow();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };

    const handleBlur = () => {
      flushNow();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flushNow]);

  return {
    status,
    errorMessage,
    flushNow,
    cancelPendingSave,
    isDirty: status === 'unsaved',
  };
}
