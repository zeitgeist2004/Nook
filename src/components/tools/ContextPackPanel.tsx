import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Check,
  Copy,
  Download,
  ArrowUp,
  ArrowDown,
  Folder,
  FileText,
  Eye,
  Code2,
} from 'lucide-react';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { Collection, Note, NoteSummary } from '../../types';
import { api, isTauri } from '../../services/api';
import { useTranslation } from '../../i18n';
import {
  ContextPackNoteInput,
  assembleContextPackMarkdown,
  getCollectionBreadcrumbPath,
  getDescendantCollectionIds,
  getNotesInCollectionSubtree,
  measureTextStats,
} from '../../utils/workflowUtils';
import { MarkdownViewer } from '../editor/MarkdownViewer';

interface ContextPackPanelProps {
  project: Collection | null;
  collections: Collection[];
  notes: NoteSummary[];
  activeNoteId: string | null;
  isMobile?: boolean;
}

export const ContextPackPanel: React.FC<ContextPackPanelProps> = ({
  project,
  collections,
  notes,
  activeNoteId,
  isMobile = false,
}) => {
  const { t, format } = useTranslation();
  const [includeOtherProjects, setIncludeOtherProjects] = useState(false);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [previewMode, setPreviewMode] = useState<'raw' | 'rendered'>('raw');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadedNotes, setLoadedNotes] = useState<Record<string, Note>>({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const noteCacheRef = useRef<Record<string, Note>>({});

  // Default-select active note if inside current project when panel mounts
  useEffect(() => {
    if (!project) return;
    const subNotes = getNotesInCollectionSubtree(project.id, collections, notes);
    if (activeNoteId && subNotes.some((n) => n.id === activeNoteId)) {
      setSelectedIds([activeNoteId]);
    } else {
      setSelectedIds([]);
    }
  }, [project?.id]);

  const projectNotes = useMemo(() => {
    if (!project) return [];
    return getNotesInCollectionSubtree(project.id, collections, notes);
  }, [project, collections, notes]);

  const otherNotes = useMemo(() => {
    const projectNoteIds = new Set(projectNotes.map((n) => n.id));
    return notes.filter((n) => !projectNoteIds.has(n.id));
  }, [projectNotes, notes]);

  const visibleNotes = useMemo(() => {
    if (!project) return notes;
    return includeOtherProjects ? [...projectNotes, ...otherNotes] : projectNotes;
  }, [project, includeOtherProjects, projectNotes, otherNotes, notes]);

  const projectSubfolders = useMemo(() => {
    if (!project) return [];
    const descendantIds = new Set(getDescendantCollectionIds(project.id, collections));
    return collections.filter((c) => descendantIds.has(c.id));
  }, [project, collections]);

  // Lazily fetch full Markdown content only for currently selected note IDs
  useEffect(() => {
    let cancelled = false;
    const missing = selectedIds.filter((id) => !noteCacheRef.current[id]);
    if (missing.length === 0) {
      setLoadedNotes({ ...noteCacheRef.current });
      return;
    }

    setIsLoadingContent(true);
    Promise.all(missing.map((id) => api.getNoteById(id)))
      .then((results) => {
        if (cancelled) return;
        for (const n of results) {
          if (n) {
            noteCacheRef.current[n.id] = n;
          }
        }
        setLoadedNotes({ ...noteCacheRef.current });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const assembledMarkdown = useMemo(() => {
    if (selectedIds.length === 0) return '';
    const items: ContextPackNoteInput[] = [];
    for (const id of selectedIds) {
      const summary = notesById.get(id);
      const full = loadedNotes[id];
      const noteObj = full || summary;
      if (!noteObj) continue;
      const folderPath = noteObj.collection_id
        ? getCollectionBreadcrumbPath(noteObj.collection_id, collections, project?.id)
        : '';
      items.push({
        note: noteObj,
        folderPath: folderPath || undefined,
      });
    }

    return assembleContextPackMarkdown({
      projectName: project?.name || t.projectTools.contextQuickNotesLabel,
      items,
      includeHeader,
      headerPrefix: t.projectTools.contextDocumentHeading,
      untitledLabel: t.common.untitled,
    });
  }, [selectedIds, notesById, loadedNotes, collections, project, includeHeader, t]);

  const stats = useMemo(() => measureTextStats(assembledMarkdown), [assembledMarkdown]);

  const toggleNote = (noteId: string) => {
    setSelectedIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const toggleFolderNotes = (collectionId: string) => {
    const folderNoteIds = getNotesInCollectionSubtree(collectionId, collections, notes).map(
      (n) => n.id
    );
    if (folderNoteIds.length === 0) return;

    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = folderNoteIds.every((id) => prevSet.has(id));
      if (allSelected) {
        const removeSet = new Set(folderNoteIds);
        return prev.filter((id) => !removeSet.has(id));
      }
      const next = [...prev];
      for (const id of folderNoteIds) {
        if (!prevSet.has(id)) next.push(id);
      }
      return next;
    });
  };

  const moveSelected = (idx: number, delta: -1 | 1) => {
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  const handleCopy = async () => {
    if (!assembledMarkdown) return;
    await navigator.clipboard.writeText(assembledMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExport = async () => {
    if (!assembledMarkdown) return;
    const baseName = (project?.name || 'nook-context')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, '-');
    const filename = `${baseName}-context.md`;

    if (isTauri()) {
      try {
        const selected = await saveFileDialog({
          defaultPath: filename,
          filters: [{ name: t.dialogs.markdownFilterName, extensions: ['md'] }],
        });
        if (!selected) return;
        await api.writeExternalFile(selected, assembledMarkdown);
        return;
      } catch (err) {
        console.warn('Save dialog fallback:', err);
      }
    }

    const blob = new Blob([assembledMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedIds(visibleNotes.map((n) => n.id))}
            className="nook-tool-chip"
          >
            {t.projectTools.contextSelectAll}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="nook-tool-chip"
            disabled={selectedIds.length === 0}
          >
            {t.projectTools.contextClearAll}
          </button>
          {project && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeOtherProjects}
                onChange={(e) => setIncludeOtherProjects(e.target.checked)}
              />
              <span>{t.projectTools.contextIncludeOtherProjects}</span>
            </label>
          )}
        </div>

        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {format(t.projectTools.contextNotesCount, { count: selectedIds.length })}
        </span>
      </div>

      {/* Main Split Area */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 0.95fr) minmax(260px, 1.25fr)',
          gap: '12px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left: Folders + Checkboxes */}
        <div
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-main)',
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: isMobile ? '220px' : '100%',
          }}
        >
          {/* Folder group quick toggles inside current project */}
          {project && projectSubfolders.length > 1 && (
            <div style={{ paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
              {projectSubfolders
                .filter((f) => f.id !== project.id)
                .map((folder) => {
                  const subIds = getNotesInCollectionSubtree(folder.id, collections, notes).map(
                    (n) => n.id
                  );
                  if (subIds.length === 0) return null;
                  const allIn = subIds.every((id) => selectedIds.includes(id));
                  return (
                    <label
                      key={folder.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        backgroundColor: allIn ? 'var(--bg-selected)' : 'transparent',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={allIn}
                          onChange={() => toggleFolderNotes(folder.id)}
                        />
                        <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {folder.name}
                        </span>
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t.projectTools.contextSelectFolder} ({subIds.length})
                      </span>
                    </label>
                  );
                })}
            </div>
          )}

          {/* Individual notes */}
          {visibleNotes.map((note) => {
            const isChecked = selectedIds.includes(note.id);
            const pathHint = note.collection_id
              ? getCollectionBreadcrumbPath(note.collection_id, collections)
              : t.projectTools.contextQuickNotesLabel;
            return (
              <label
                key={note.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: isChecked ? 'var(--bg-selected)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleNote(note.id)}
                  style={{ marginTop: '3px', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.title || t.common.untitled}
                    </span>
                  </div>
                  {pathHint && (
                    <div
                      style={{
                        fontSize: '10.5px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pathHint}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Right: Order + Live Preview + Export Actions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: 0,
          }}
        >
          {/* Reorder selected notes */}
          {selectedIds.length > 1 && (
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-main)',
                padding: '6px 8px',
                maxHeight: '115px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                {t.projectTools.contextOrderTitle}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {selectedIds.map((id, idx) => {
                  const note = notesById.get(id);
                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-elevated)',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {idx + 1}. {note?.title || t.common.untitled}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => moveSelected(idx, -1)}
                          disabled={idx === 0}
                          aria-label={t.projectTools.contextMoveUp}
                          className="nook-icon-btn"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelected(idx, 1)}
                          disabled={idx === selectedIds.length - 1}
                          aria-label={t.projectTools.contextMoveDown}
                          className="nook-icon-btn"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview Box */}
          <div
            style={{
              flex: 1,
              minHeight: '160px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-main)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderBottom: '1px solid var(--border-subtle)',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                />
                <span>{t.projectTools.contextIncludeHeader}</span>
              </label>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('raw')}
                  className={`nook-tool-chip ${previewMode === 'raw' ? 'active' : ''}`}
                >
                  <Code2 size={12} />
                  <span>Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('rendered')}
                  className={`nook-tool-chip ${previewMode === 'rendered' ? 'active' : ''}`}
                >
                  <Eye size={12} />
                  <span>{t.projectTools.contextPreviewTitle}</span>
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {selectedIds.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t.projectTools.contextEmptySelect}
                </div>
              ) : isLoadingContent && !assembledMarkdown ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t.common.loading}
                </div>
              ) : previewMode === 'raw' ? (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.55,
                    color: 'var(--text-primary)',
                  }}
                >
                  {assembledMarkdown}
                </pre>
              ) : (
                <MarkdownViewer
                  content={assembledMarkdown}
                  onContentChange={() => {}}
                  fontSize={13.5}
                />
              )}
            </div>
          </div>

          {/* Footer stats + Copy / Export buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {format(t.projectTools.contextStatsSummary, {
                count: selectedIds.length,
                words: stats.words,
                chars: stats.chars,
                lines: stats.lines,
              })}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExport}
                disabled={!assembledMarkdown}
                className="nook-btn-secondary"
              >
                <Download size={14} />
                <span>{t.projectTools.contextExportBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!assembledMarkdown}
                className="nook-btn-primary"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? t.common.copiedExclamation : t.projectTools.contextCopyBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
