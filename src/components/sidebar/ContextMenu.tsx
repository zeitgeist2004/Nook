import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  CopyPlus,
  Pin,
  Download,
  FolderInput,
  Layers,
} from 'lucide-react';
import { ContextMenuState, NoteSummary, Collection } from '../../types';
import { useTranslation } from '../../i18n';

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
  onOpenProjectTools?: (collectionId: string) => void;
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
  onOpenProjectTools,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: menu.x,
    top: menu.y,
  });

  useLayoutEffect(() => {
    if (!menu.isOpen) return;
    const padding = 8;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const el = menuRef.current;
    const width = el ? el.offsetWidth : 196;
    const height = el ? el.offsetHeight : 220;

    const clampedLeft = Math.max(padding, Math.min(menu.x, vw - width - padding));
    const clampedTop = Math.max(padding, Math.min(menu.y, vh - height - padding));
    setCoords({ left: clampedLeft, top: clampedTop });
  }, [menu.isOpen, menu.x, menu.y, menu.type]);

  useEffect(() => {
    if (!menu.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const buttons = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('button.menu-item') ?? []
        );
        if (buttons.length === 0) return;
        e.preventDefault();
        const curIdx = buttons.findIndex((b) => b === document.activeElement);
        const nextIdx =
          e.key === 'ArrowDown'
            ? (curIdx + 1) % buttons.length
            : (curIdx - 1 + buttons.length) % buttons.length;
        buttons[nextIdx]?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu.isOpen, onClose]);

  if (!menu.isOpen) return null;

  const note = menu.type === 'note' ? (menu.targetItem as NoteSummary) : null;
  const collection = menu.type === 'collection' ? (menu.targetItem as Collection) : null;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        zIndex: 9999,
        minWidth: '188px',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100dvh - 16px)',
        overflowY: 'auto',
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
            <span>{t.contextMenu.rename}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onTogglePinNote(note.id);
            }}
            className="menu-item"
          >
            <Pin size={14} />
            <span>{note.is_pinned ? t.contextMenu.unpin : t.contextMenu.pinTop}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onDuplicateNote(note.id);
            }}
            className="menu-item"
          >
            <CopyPlus size={14} />
            <span>{t.contextMenu.duplicate}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onMoveNotePrompt(note.id);
            }}
            className="menu-item"
          >
            <FolderInput size={14} />
            <span>{t.contextMenu.moveTo}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onExportNote(note.id);
            }}
            className="menu-item"
          >
            <Download size={14} />
            <span>{t.contextMenu.exportMd}</span>
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
            <span>{t.contextMenu.moveToTrash}</span>
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
            <span>{t.contextMenu.newNoteHere}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onCreateFolderInCollection(collection.id);
            }}
            className="menu-item"
          >
            <FolderPlus size={14} />
            <span>{t.contextMenu.newSubfolder}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onRename(collection.id, collection.name, 'collection');
            }}
            className="menu-item"
          >
            <Edit2 size={14} />
            <span>{collection.collection_type === 'project' ? t.contextMenu.renameProject : t.contextMenu.renameFolder}</span>
          </button>

          {onOpenProjectTools && (
            <button
              onClick={() => {
                onClose();
                onOpenProjectTools(collection.id);
              }}
              className="menu-item"
            >
              <Layers size={14} />
              <span>{t.contextMenu.projectTools}</span>
            </button>
          )}

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

          <button
            onClick={() => {
              onClose();
              onDeleteCollection(collection.id);
            }}
            className="menu-item text-danger"
          >
            <Trash2 size={14} />
            <span>{collection.collection_type === 'project' ? t.contextMenu.deleteProject : t.contextMenu.deleteFolder}</span>
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
