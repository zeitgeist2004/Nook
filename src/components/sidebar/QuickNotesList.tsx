import React from 'react';
import { FileText, Pin, MoreHorizontal } from 'lucide-react';
import { NoteSummary, Collection } from '../../types';
import { useTranslation } from '../../i18n';

interface QuickNotesListProps {
  notes: NoteSummary[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, type: 'note' | 'collection', item: NoteSummary | Collection) => void;
  isMobile?: boolean;
}

export const QuickNotesList: React.FC<QuickNotesListProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onOpenContextMenu,
  isMobile = false,
}) => {
  const { t } = useTranslation();
  // Quick notes have no collection_id
  const quickNotes = notes.filter((n) => !n.collection_id);

  if (quickNotes.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        {t.sidebar.noQuickNotes}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {quickNotes.map((note) => {
        const isSelected = activeNoteId === note.id;

        return (
          <div
            key={note.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', note.id);
              e.dataTransfer.setData('application/x-nook-note', note.id);
              e.dataTransfer.setData('application/x-lumina-note', note.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onContextMenu={(e) => onOpenContextMenu(e, 'note', note)}
            onClick={() => onSelectNote(note.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            className="quick-note-item"
          >
            <FileText size={14} style={{ opacity: isSelected ? 1 : 0.6, flexShrink: 0 }} />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                flex: 1,
              }}
            >
              <span
                style={{
                  fontWeight: isSelected ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {note.title || t.common.untitled}
              </span>

              {note.snippet && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '1px',
                  }}
                >
                  {note.snippet}
                </span>
              )}
            </div>

            {note.is_pinned && (
              <Pin size={12} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
            )}

            {isMobile && (
              <button
                type="button"
                aria-label={t.ux.itemMenuAria}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenContextMenu(e, 'note', note);
                }}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        );
      })}

      <style>{`
        .quick-note-item:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
