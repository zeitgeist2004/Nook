import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, FileText, Folder, X } from 'lucide-react';
import { NoteSummary, Collection } from '../../types';
import { api } from '../../services/api';
import { NookCleanTrashMascot } from '../mascot/NookMascot';
import { useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface TrashViewProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const { t } = useTranslation();
  const [trashNotes, setTrashNotes] = useState<NoteSummary[]>([]);
  const [trashCollections, setTrashCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const [notes, collections] = await Promise.all([
        api.getTrashNotes(),
        api.getTrashCollections(),
      ]);
      setTrashNotes(notes);
      setTrashCollections(collections);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
      setConfirmEmpty(false);
    }
  }, [isOpen]);

  useDialogA11y({ isOpen, onClose });

  if (!isOpen) return null;

  const handleRestoreNote = async (id: string) => {
    try {
      await api.restoreNote(id);
      await loadTrash();
      onRestoreSuccess();
    } catch (err) {
      console.error('Failed to restore note:', err);
    }
  };

  const handleRestoreCollection = async (id: string) => {
    try {
      await api.restoreCollection(id);
      await loadTrash();
      onRestoreSuccess();
    } catch (err) {
      console.error('Failed to restore collection:', err);
    }
  };

  const handlePermanentDeleteNote = async (id: string) => {
    try {
      await api.permanentDeleteNote(id);
      await loadTrash();
      onRestoreSuccess();
    } catch (err) {
      console.error('Failed to delete note permanently:', err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      await loadTrash();
      setConfirmEmpty(false);
      onRestoreSuccess();
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  };

  const totalItems = trashNotes.length + trashCollections.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'env(safe-area-inset-top, 16px) 12px env(safe-area-inset-bottom, 16px) 12px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.trash.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(94vw, 560px)',
          maxHeight: 'min(88dvh, 620px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="animate-modal-pop"
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={18} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: '15px', fontWeight: 600 }}>{t.trash.title}</span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-main)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
              }}
            >
              {totalItems} {totalItems === 1 ? t.trash.itemSingular : t.trash.itemPlural}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {totalItems > 0 && !confirmEmpty && (
              <button
                onClick={() => setConfirmEmpty(true)}
                style={{
                  fontSize: '12px',
                  color: 'var(--danger)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--danger-muted)',
                }}
              >
                {t.trash.emptyTrash}
              </button>
            )}

            {confirmEmpty && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{t.trash.confirmDelete}</span>
                <button
                  onClick={handleEmptyTrash}
                  style={{
                    fontSize: '11px',
                    color: '#fff',
                    backgroundColor: 'var(--danger)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {t.trash.confirmEmptyBtn}
                </button>
                <button
                  onClick={() => setConfirmEmpty(false)}
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-hover)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {t.trash.cancel}
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              style={{ color: 'var(--text-muted)', padding: '4px' }}
              aria-label={t.common.close}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t.trash.loadingItems}
            </div>
          ) : totalItems === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <NookCleanTrashMascot size={104} />
              <div style={{ maxWidth: '280px' }}>
                <p style={{ fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {t.trash.cleanTitle}
                </p>
                <p style={{ fontSize: '12px', lineHeight: 1.4 }}>
                  {t.trash.cleanDesc}
                </p>
              </div>
            </div>
          ) : (
            <>
              {trashCollections.map((col) => (
                <div
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Folder size={15} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{col.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ({col.collection_type === 'project' ? t.trash.projectLabel : t.trash.folderLabel})
                    </span>
                  </div>

                  <button
                    onClick={() => handleRestoreCollection(col.id)}
                    title={t.trash.restoreFolderTooltip}
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <RotateCcw size={13} />
                    {t.trash.restore}
                  </button>
                </div>
              ))}

              {trashNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <FileText size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title || t.common.untitled}
                      </span>
                      {note.snippet && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.snippet}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => handleRestoreNote(note.id)}
                      title={t.trash.restoreNoteTooltip}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <RotateCcw size={13} />
                      {t.trash.restore}
                    </button>

                    <button
                      onClick={() => handlePermanentDeleteNote(note.id)}
                      title={t.trash.permanentDeleteTooltip}
                      style={{
                        padding: '5px',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
