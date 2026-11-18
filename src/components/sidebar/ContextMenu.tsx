import React, { useEffect, useRef } from 'react';
import {
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  CopyPlus,
  Pin,
  Download,
  FolderInput,
} from 'lucide-react';
import { ContextMenuState, NoteSummary, Collection } from '../../types';

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onRename: (id: string, currentName: string, type: 'note' | 'collection') => void;
  onDeleteNote: (id: string) => void;
  onDeleteCollection: (id: string) => void;
  onDuplicateNote: (id: string) => void;
  onTogglePinNote: (id: string) => void;
  onExportNote: (id: string) => void;
  onCreateNoteInCollection: (collectionId: string) => void;
  onCreateFolderInCollection: (collectionId: string) => void;
  onMoveNotePrompt: (noteId: string) => void;
}

const ContextMenuComponent: React.FC<ContextMenuProps> = ({
  menu,
  onClose,
  onRename,
  onDeleteNote,
  onDeleteCollection,
  onDuplicateNote,
  onTogglePinNote,
  onExportNote,
  onCreateNoteInCollection,
  onCreateFolderInCollection,
  onMoveNotePrompt,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!menu.isOpen) return null;

  const note = menu.type === 'note' ? (menu.targetItem as NoteSummary) : null;
  const collection = menu.type === 'collection' ? (menu.targetItem as Collection) : null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${menu.x}px`,
        top: `${menu.y}px`,
        zIndex: 9999,
        minWidth: '180px',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
      className="animate-fade-in"
    >
      {menu.type === 'note' && note && (
        <>
          <button
            onClick={() => {
              onClose();
              onRename(note.id, note.title, 'note');
            }}
            className="menu-item"
          >
            <Edit2 size={14} />
            <span>Renomear</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onTogglePinNote(note.id);
            }}
            className="menu-item"
          >
            <Pin size={14} />
            <span>{note.is_pinned ? 'Desafixar nota' : 'Fixar no topo'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onDuplicateNote(note.id);
            }}
            className="menu-item"
          >
            <CopyPlus size={14} />
            <span>Duplicar</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onMoveNotePrompt(note.id);
            }}
            className="menu-item"
          >
            <FolderInput size={14} />
            <span>Mover para...</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onExportNote(note.id);
            }}
            className="menu-item"
          >
            <Download size={14} />
            <span>Exportar (.md)</span>
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

          <button
            onClick={() => {
              onClose();
              onDeleteNote(note.id);
            }}
            className="menu-item text-danger"
          >
            <Trash2 size={14} />
            <span>Mover para lixeira</span>
          </button>
        </>
      )}

      {menu.type === 'collection' && collection && (
        <>
          <button
            onClick={() => {
              onClose();
              onCreateNoteInCollection(collection.id);
            }}
            className="menu-item"
          >
            <FilePlus size={14} />
            <span>Nova nota aqui</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onCreateFolderInCollection(collection.id);
            }}
            className="menu-item"
          >
            <FolderPlus size={14} />
            <span>Nova subpasta</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onRename(collection.id, collection.name, 'collection');
            }}
            className="menu-item"
          >
            <Edit2 size={14} />
            <span>Renomear {collection.collection_type === 'project' ? 'projeto' : 'pasta'}</span>
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

          <button
            onClick={() => {
              onClose();
              onDeleteCollection(collection.id);
            }}
            className="menu-item text-danger"
          >
            <Trash2 size={14} />
            <span>Excluir {collection.collection_type === 'project' ? 'projeto' : 'pasta'}</span>
          </button>
        </>
      )}

      <style>{`
        .menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          font-size: 12px;
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          width: 100%;
          text-align: left;
        }
        .menu-item:hover {
          background-color: var(--bg-hover);
        }
        .menu-item.text-danger {
          color: var(--danger);
        }
        .menu-item.text-danger:hover {
          background-color: var(--danger-muted);
        }
      `}</style>
    </div>
  );
};

export const ContextMenu = React.memo(ContextMenuComponent);
