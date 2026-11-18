import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarPlus, ExternalLink } from 'lucide-react';
import { Collection, DevNotesMetaMap, Note, NoteSummary } from '../../types';
import { useTranslation } from '../../i18n';
import {
  formatJournalEntryMarkdown,
  formatJournalEntryTitle,
  getNotesInCollectionSubtree,
} from '../../utils/workflowUtils';

interface DevJournalPanelProps {
  project: Collection | null;
  collections: Collection[];
  notes: NoteSummary[];
  devNotesMeta: DevNotesMetaMap;
  onCreateNote: (
    collectionId: string | null,
    title: string,
    content: string,
    role: 'journal'
  ) => Promise<Note>;
  onOpenNoteInEditor: (noteId: string) => void;
  onCloseModal: () => void;
}

export const DevJournalPanel: React.FC<DevJournalPanelProps> = ({
  project,
  collections,
  notes,
  devNotesMeta,
  onCreateNote,
  onOpenNoteInEditor,
  onCloseModal,
}) => {
  const { t, format } = useTranslation();
  const [creating, setCreating] = useState(false);

  const entries = useMemo(() => {
    const scopeNotes = project
      ? getNotesInCollectionSubtree(project.id, collections, notes)
      : notes;
    return scopeNotes
      .filter((n) => devNotesMeta[n.id]?.role === 'journal')
      .sort((a, b) => b.created_at - a.created_at);
  }, [project, collections, notes, devNotesMeta]);

  const handleCreateEntry = async () => {
    setCreating(true);
    try {
      const title = formatJournalEntryTitle(t.projectTools.journalTitlePrefix);
      const content = formatJournalEntryMarkdown({
        whatChanged: t.projectTools.journalFieldChanged,
        whyChanged: t.projectTools.journalFieldWhy,
        problemsFound: t.projectTools.journalFieldProblems,
        decisions: t.projectTools.journalFieldDecisions,
        nextSteps: t.projectTools.journalFieldNext,
      });
      const created = await onCreateNote(project?.id ?? null, title, content, 'journal');
      onCloseModal();
      onOpenNoteInEditor(created.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {format(t.projectTools.journalEntriesCount, { count: entries.length })}
        </span>

        <button
          type="button"
          onClick={handleCreateEntry}
          disabled={creating}
          className="nook-btn-primary"
        >
          <CalendarPlus size={14} />
          <span>{t.projectTools.journalNewEntryBtn}</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.length === 0 ? (
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
            <BookOpen size={22} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t.projectTools.journalEmptyTitle}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.45 }}>
              {t.projectTools.journalEmptyDesc}
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                onCloseModal();
                onOpenNoteInEditor(entry.id);
              }}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-main)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {entry.title || t.common.untitled}
                </div>
                {entry.snippet && (
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
                    {entry.snippet.replace(/\s+/g, ' ').trim()}
                  </div>
                )}
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {new Date(entry.created_at).toLocaleString(t.meta.dateLocale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          ))
        )}
      </div>
    </div>
  );
};
