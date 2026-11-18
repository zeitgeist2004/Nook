import React from 'react';
import { Collection } from '../../types';
import { Folder, Briefcase, FileText, X } from 'lucide-react';

interface MoveNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  currentCollectionId: string | null;
  onSelectDestination: (collectionId: string | null) => void;
}

export const MoveNoteDialog: React.FC<MoveNoteDialogProps> = ({
  isOpen,
  onClose,
  collections,
  currentCollectionId,
  onSelectDestination,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          maxHeight: '420px',
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
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Mover Nota Para...</span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {/* Quick Notes destination */}
          <div
            onClick={() => {
              onSelectDestination(null);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              backgroundColor: currentCollectionId === null ? 'var(--bg-selected)' : 'transparent',
              color: 'var(--text-primary)',
              fontWeight: currentCollectionId === null ? 500 : 400,
              fontSize: '13px',
              borderLeft: currentCollectionId === null ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            className="move-option"
          >
            <FileText size={15} style={{ opacity: currentCollectionId === null ? 1 : 0.6 }} />
            <span>Notas Rápidas (Sem pasta)</span>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

          {/* Collections */}
          {collections.map((c) => {
            const isSelected = currentCollectionId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  onSelectDestination(c.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: isSelected ? 500 : 400,
                  fontSize: '13px',
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                className="move-option"
              >
                {c.collection_type === 'project' ? (
                  <Briefcase size={15} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                ) : (
                  <Folder size={15} style={{ color: 'var(--text-muted)' }} />
                )}
                <span>{c.name}</span>
              </div>
            );
          })}
        </div>

        <style>{`
          .move-option:hover {
            background-color: var(--bg-hover) !important;
          }
        `}</style>
      </div>
    </div>
  );
};
