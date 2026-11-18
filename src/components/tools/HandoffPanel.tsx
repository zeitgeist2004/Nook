import React, { useState, useMemo } from 'react';
import { Copy, Check, FilePlus, ExternalLink } from 'lucide-react';
import { Collection, DevNotesMetaMap, Note, NoteSummary } from '../../types';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import {
  formatHandoffForAgentCopy,
  formatHandoffNoteMarkdown,
  formatHandoffTimestamp,
  getNotesInCollectionSubtree,
} from '../../utils/workflowUtils';

interface HandoffPanelProps {
  project: Collection | null;
  collections: Collection[];
  notes: NoteSummary[];
  devNotesMeta: DevNotesMetaMap;
  onCreateNote: (
    collectionId: string | null,
    title: string,
    content: string,
    role: 'handoff'
  ) => Promise<Note>;
  onOpenNoteInEditor: (noteId: string) => void;
  onCloseModal: () => void;
}

export const HandoffPanel: React.FC<HandoffPanelProps> = ({
  project,
  collections,
  notes,
  devNotesMeta,
  onCreateNote,
  onOpenNoteInEditor,
  onCloseModal,
}) => {
  const { t } = useTranslation();
  const [done, setDone] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [issues, setIssues] = useState('');
  const [importantInfo, setImportantInfo] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const labels = useMemo(
    () => ({
      done: t.projectTools.handoffFieldDone,
      nextSteps: t.projectTools.handoffFieldNext,
      issues: t.projectTools.handoffFieldIssues,
      importantInfo: t.projectTools.handoffFieldImportant,
    }),
    [t]
  );

  const projectHandoffs = useMemo(() => {
    const scopeNotes = project
      ? getNotesInCollectionSubtree(project.id, collections, notes)
      : notes;
    return scopeNotes
      .filter((n) => devNotesMeta[n.id]?.role === 'handoff')
      .sort((a, b) => b.updated_at - a.updated_at);
  }, [project, collections, notes, devNotesMeta]);

  const buildCurrentDraftCopy = () => {
    const rawMd = formatHandoffNoteMarkdown({ done, nextSteps, issues, importantInfo }, labels);
    const title = `${t.projectTools.handoffTitlePrefix} — ${formatHandoffTimestamp()}`;
    return formatHandoffForAgentCopy({
      projectName: project?.name,
      noteTitle: title,
      content: rawMd,
      headerPrefix: t.projectTools.handoffDocPrefix,
    });
  };

  const handleSaveAsNote = async () => {
    setSaving(true);
    try {
      const title = `${t.projectTools.handoffTitlePrefix} — ${formatHandoffTimestamp()}`;
      const content = formatHandoffNoteMarkdown({ done, nextSteps, issues, importantInfo }, labels);
      const created = await onCreateNote(project?.id ?? null, title, content, 'handoff');
      setDone('');
      setNextSteps('');
      setIssues('');
      setImportantInfo('');
      onCloseModal();
      onOpenNoteInEditor(created.id);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCurrent = async () => {
    const text = buildCurrentDraftCopy();
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey('draft');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleCopySavedHandoff = async (noteSummary: NoteSummary) => {
    const full = await api.getNoteById(noteSummary.id);
    if (!full) return;
    const formatted = formatHandoffForAgentCopy({
      projectName: project?.name,
      noteTitle: full.title,
      content: full.content,
      headerPrefix: t.projectTools.handoffDocPrefix,
    });
    await navigator.clipboard.writeText(formatted || full.content);
    setCopiedKey(noteSummary.id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const hasAnyInput = !!(done.trim() || nextSteps.trim() || issues.trim() || importantInfo.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-main)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {t.projectTools.handoffNewTitle}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t.projectTools.handoffOptionalNote}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="nook-field-label">{t.projectTools.handoffFieldDone}</label>
            <textarea
              rows={3}
              value={done}
              onChange={(e) => setDone(e.target.value)}
              placeholder={t.projectTools.handoffFieldDonePh}
              className="nook-textarea"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="nook-field-label">{t.projectTools.handoffFieldNext}</label>
            <textarea
              rows={3}
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder={t.projectTools.handoffFieldNextPh}
              className="nook-textarea"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="nook-field-label">{t.projectTools.handoffFieldIssues}</label>
            <textarea
              rows={2}
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder={t.projectTools.handoffFieldIssuesPh}
              className="nook-textarea"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="nook-field-label">{t.projectTools.handoffFieldImportant}</label>
            <textarea
              rows={2}
              value={importantInfo}
              onChange={(e) => setImportantInfo(e.target.value)}
              placeholder={t.projectTools.handoffFieldImportantPh}
              className="nook-textarea"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
          <button
            type="button"
            onClick={handleCopyCurrent}
            disabled={!hasAnyInput}
            className="nook-btn-secondary"
          >
            {copiedKey === 'draft' ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copiedKey === 'draft'
                ? t.common.copiedExclamation
                : t.projectTools.handoffCopyContinueBtn}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSaveAsNote}
            disabled={saving}
            className="nook-btn-primary"
          >
            <FilePlus size={14} />
            <span>{t.projectTools.handoffSaveNoteBtn}</span>
          </button>
        </div>
      </div>

      {/* Previous Handoffs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {t.projectTools.handoffRecentTitle}
        </div>

        {projectHandoffs.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
            {t.projectTools.handoffEmptyRecent}
          </div>
        ) : (
          projectHandoffs.map((h) => (
            <div
              key={h.id}
              style={{
                border: '1px solid var(--border-subtle)',
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
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.title || t.common.untitled}
                </div>
                {h.snippet && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.snippet.replace(/\s+/g, ' ').trim()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleCopySavedHandoff(h)}
                  className="nook-btn-secondary"
                >
                  {copiedKey === h.id ? <Check size={13} /> : <Copy size={13} />}
                  <span>
                    {copiedKey === h.id
                      ? t.common.copiedExclamation
                      : t.projectTools.handoffCopyContinueBtn}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseModal();
                    onOpenNoteInEditor(h.id);
                  }}
                  className="nook-tool-chip"
                >
                  <ExternalLink size={12} />
                  <span>{t.projectTools.handoffOpenBtn}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
