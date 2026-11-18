import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Star,
  Plus,
  Copy,
  Check,
  CopyPlus,
  Edit2,
  ArrowLeft,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react';
import { Collection, DevNotesMetaMap, Note, NoteSummary } from '../../types';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import {
  createStarterPromptTemplate,
  extractPromptVariables,
  fillPromptVariables,
  humanizeVarName,
} from '../../utils/workflowUtils';

interface PromptLibraryPanelProps {
  project: Collection | null;
  collections: Collection[];
  notes: NoteSummary[];
  activeNoteId: string | null;
  devNotesMeta: DevNotesMetaMap;
  initialTemplateNoteId?: string | null;
  onUpdateNoteMeta: (noteId: string, updater: (prev: DevNotesMetaMap[string] | undefined) => DevNotesMetaMap[string] | undefined) => void;
  onCreateNoteAndOpen: (collectionId: string | null, title: string, content: string, role: 'prompt') => Promise<Note>;
  onDuplicatePromptNote: (noteId: string) => Promise<void>;
  onOpenNoteInEditor: (noteId: string) => void;
  onCloseModal: () => void;
}

export const PromptLibraryPanel: React.FC<PromptLibraryPanelProps> = ({
  project,
  collections,
  notes,
  activeNoteId,
  devNotesMeta,
  initialTemplateNoteId,
  onUpdateNoteMeta,
  onCreateNoteAndOpen,
  onDuplicatePromptNote,
  onOpenNoteInEditor,
  onCloseModal,
}) => {
  const { t, format, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
  const [fillingNoteId, setFillingNoteId] = useState<string | null>(initialTemplateNoteId || null);
  const [fillingNote, setFillingNote] = useState<Note | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    if (initialTemplateNoteId) {
      setFillingNoteId(initialTemplateNoteId);
    }
  }, [initialTemplateNoteId]);

  useEffect(() => {
    if (!fillingNoteId) {
      setFillingNote(null);
      setVarValues({});
      return;
    }
    let cancelled = false;
    setLoadingTemplate(true);
    api
      .getNoteById(fillingNoteId)
      .then((note) => {
        if (cancelled) return;
        setFillingNote(note);
        if (note) {
          const vars = extractPromptVariables(note.content);
          const initial: Record<string, string> = {};
          for (const v of vars) {
            if (/proj/i.test(v) && project?.name) {
              initial[v] = project.name;
            } else {
              initial[v] = '';
            }
          }
          setVarValues(initial);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fillingNoteId, project?.name]);

  const collectionsById = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections]
  );

  const templateNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((n) => devNotesMeta[n.id]?.role === 'prompt')
      .filter((n) => {
        if (filterMode === 'favorites' && !devNotesMeta[n.id]?.isFavorite) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          (n.snippet || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const favA = devNotesMeta[a.id]?.isFavorite ? 1 : 0;
        const favB = devNotesMeta[b.id]?.isFavorite ? 1 : 0;
        if (favA !== favB) return favB - favA;
        return b.updated_at - a.updated_at;
      });
  }, [notes, devNotesMeta, filterMode, searchQuery]);

  const activeNoteIsTemplate = !!(activeNoteId && devNotesMeta[activeNoteId]?.role === 'prompt');
  const activeNoteSummary = activeNoteId ? notes.find((n) => n.id === activeNoteId) : null;

  const variables = useMemo(() => {
    if (!fillingNote) return [];
    return extractPromptVariables(fillingNote.content);
  }, [fillingNote]);

  const assembledPrompt = useMemo(() => {
    if (!fillingNote) return '';
    return fillPromptVariables(fillingNote.content, varValues);
  }, [fillingNote, varValues]);

  const handleCreateTemplate = async () => {
    const starter = createStarterPromptTemplate(language, project?.name);
    const created = await onCreateNoteAndOpen(
      project?.id ?? null,
      starter.title,
      starter.content,
      'prompt'
    );
    onCloseModal();
    onOpenNoteInEditor(created.id);
  };

  const handleCopyDirect = async (noteId: string) => {
    const full = await api.getNoteById(noteId);
    if (!full) return;
    await navigator.clipboard.writeText(full.content);
    setCopiedId(noteId);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleCopyFilled = async () => {
    if (!assembledPrompt) return;
    await navigator.clipboard.writeText(assembledPrompt);
    setCopiedId('filled');
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Variable Fill Screen
  if (fillingNoteId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFillingNoteId(null)}
            className="nook-btn-secondary"
          >
            <ArrowLeft size={14} />
            <span>{t.projectTools.promptBackListBtn}</span>
          </button>

          {fillingNote && (
            <button
              type="button"
              onClick={() => {
                onCloseModal();
                onOpenNoteInEditor(fillingNote.id);
              }}
              className="nook-btn-secondary"
            >
              <Edit2 size={13} />
              <span>{t.projectTools.promptOpenEditorBtn}</span>
            </button>
          )}
        </div>

        {loadingTemplate || !fillingNote ? (
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', padding: '20px 0' }}>
            {t.common.loading}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t.projectTools.promptFillTitle}: {fillingNote.title || t.common.untitled}
            </div>

            {variables.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '10px',
                }}
              >
                {variables.map((v) => (
                  <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {humanizeVarName(v)}{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {`{{${v}}}`}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={varValues[v] || ''}
                      onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                      placeholder={format(t.projectTools.promptVarPlaceholder, { name: humanizeVarName(v) })}
                      className="nook-input"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-main)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                {t.projectTools.promptNoVariablesHint}
              </div>
            )}

            <div
              style={{
                flex: 1,
                minHeight: '150px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-main)',
                padding: '10px 12px',
                overflowY: 'auto',
              }}
            >
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
                {assembledPrompt}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleCopyFilled} className="nook-btn-primary">
                {copiedId === 'filled' ? <Check size={14} /> : <Copy size={14} />}
                <span>
                  {copiedId === 'filled' ? t.common.copiedExclamation : t.projectTools.promptCopyFilledBtn}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Library Listing View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.projectTools.promptSearchPlaceholder}
              className="nook-input"
              style={{ paddingLeft: '30px', width: '100%' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`nook-tool-chip ${filterMode === 'all' ? 'active' : ''}`}
          >
            {t.projectTools.promptFilterAll}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('favorites')}
            className={`nook-tool-chip ${filterMode === 'favorites' ? 'active' : ''}`}
          >
            <Star size={12} />
            <span>{t.projectTools.promptFilterFavorites}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {activeNoteSummary && (
            <button
              type="button"
              onClick={() =>
                onUpdateNoteMeta(activeNoteSummary.id, (prev) =>
                  prev?.role === 'prompt'
                    ? undefined
                    : { ...prev, role: 'prompt', updatedAt: Date.now() }
                )
              }
              className="nook-btn-secondary"
            >
              <BookmarkCheck size={14} />
              <span>
                {activeNoteIsTemplate
                  ? t.projectTools.promptUnmarkBtn
                  : t.projectTools.promptMarkActiveBtn}
              </span>
            </button>
          )}
          <button type="button" onClick={handleCreateTemplate} className="nook-btn-primary">
            <Plus size={14} />
            <span>{t.projectTools.promptCreateBtn}</span>
          </button>
        </div>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
        {t.projectTools.promptSyntaxHint}
      </div>

      {/* Templates List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {templateNotes.length === 0 ? (
          <div
            style={{
              flex: 1,
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '28px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={22} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t.projectTools.promptEmptyTitle}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.45 }}>
              {t.projectTools.promptEmptyDesc}
            </div>
          </div>
        ) : (
          templateNotes.map((note) => {
            const meta = devNotesMeta[note.id];
            const isFav = !!meta?.isFavorite;
            const colName = note.collection_id ? collectionsById.get(note.collection_id)?.name : null;

            return (
              <div
                key={note.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-main)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {note.title || t.common.untitled}
                    </span>
                    {colName && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {colName}
                      </span>
                    )}
                  </div>
                  {note.snippet && (
                    <div
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        marginTop: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {note.snippet.replace(/\s+/g, ' ').trim()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNoteMeta(note.id, (prev) => ({
                        role: 'prompt',
                        ...prev,
                        isFavorite: !isFav,
                        updatedAt: Date.now(),
                      }))
                    }
                    title={isFav ? t.projectTools.promptFavoriteRemove : t.projectTools.promptFavoriteAdd}
                    className="nook-icon-btn"
                    style={{ color: isFav ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicatePromptNote(note.id)}
                    title={t.projectTools.promptDuplicateBtn}
                    className="nook-icon-btn"
                  >
                    <CopyPlus size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyDirect(note.id)}
                    title={t.common.copy}
                    className="nook-icon-btn"
                  >
                    {copiedId === note.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCloseModal();
                      onOpenNoteInEditor(note.id);
                    }}
                    title={t.projectTools.promptOpenEditorBtn}
                    className="nook-icon-btn"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setFillingNoteId(note.id)}
                    className="nook-btn-primary"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                  >
                    {t.projectTools.promptUseBtn}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
