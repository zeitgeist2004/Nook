import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FilePlus,
  FolderPlus,
  Search,
  Settings as SettingsIcon,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Pin,
  FileText,
  X,
} from 'lucide-react';
import { Collection, NoteSummary } from '../../types';
import { ProjectTree } from './ProjectTree';
import { QuickNotesList } from './QuickNotesList';
import { Tooltip } from '../ui/Tooltip';

interface SidebarProps {
  collections: Collection[];
  notes: NoteSummary[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateQuickNote: () => void;
  onCreateProjectPrompt: () => void;
  onCreateNoteInCollection: (collectionId: string) => void;
  onCreateFolderInCollection: (collectionId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, type: 'note' | 'collection', item: NoteSummary | Collection) => void;
  onMoveNote: (noteId: string, targetCollectionId: string | null) => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onImportFile?: (file: File, collectionId?: string | null) => void;
  onReorderCollections?: (orderedIds: string[]) => void;
  isMobile?: boolean;
}

const SidebarComponent: React.FC<SidebarProps> = ({
  collections,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateQuickNote,
  onCreateProjectPrompt,
  onCreateNoteInCollection,
  onCreateFolderInCollection,
  onOpenContextMenu,
  onMoveNote,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenTrash,
  isCollapsed,
  onToggleCollapse,
  onImportFile,
  onReorderCollections,
  isMobile = false,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('nook_sidebar_width') || localStorage.getItem('lumina_sidebar_width');
    return saved ? parseInt(saved, 10) : 260;
  });

  const [isQuickNotesDragOver, setIsQuickNotesDragOver] = useState(false);
  const isResizingRef = useRef(false);

  const pinnedNotes = useMemo(() => notes.filter((n) => n.is_pinned), [notes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 450);
      setWidth(newWidth);
      localStorage.setItem('nook_sidebar_width', newWidth.toString());
      localStorage.setItem('lumina_sidebar_width', newWidth.toString());
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (isCollapsed) {
    return (
      <div
        style={{
          width: '44px',
          height: '100%',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: '12px',
        }}
      >
        <Tooltip content="Expandir barra lateral" shortcut="Ctrl+B" position="right">
          <button
            onClick={onToggleCollapse}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <PanelLeft size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Nova nota rápida" shortcut="Ctrl+N" position="right">
          <button
            onClick={onCreateQuickNote}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent)',
              backgroundColor: 'var(--accent-muted)',
            }}
          >
            <FilePlus size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Buscar ou comandos" shortcut="Ctrl+K" position="right">
          <button
            onClick={onOpenCommandPalette}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Search size={18} />
          </button>
        </Tooltip>

        <div style={{ flex: 1 }} />

        <Tooltip content="Configurações" shortcut="Ctrl+," position="right">
          <button
            onClick={onOpenSettings}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <SettingsIcon size={18} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      style={{
        width: isMobile ? '100%' : `${width}px`,
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '48px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/brand/nook-mark.svg"
            alt="Nook"
            style={{
              width: '24px',
              height: '24px',
              objectFit: 'contain',
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Nook
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isMobile ? (
            <button
              onClick={onToggleCollapse}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          ) : (
            <Tooltip content="Recolher barra lateral" shortcut="Ctrl+B" position="bottom">
              <button
                onClick={onToggleCollapse}
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <PanelLeftClose size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Quick Search Bar */}
      <div style={{ padding: '10px 12px 6px 12px' }}>
        <button
          onClick={onOpenCommandPalette}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-muted)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Search size={14} />
            <span>{isMobile ? 'Buscar notas...' : 'Buscar ou comandos...'}</span>
          </div>
          {!isMobile && (
            <kbd
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '4px',
              }}
            >
              Ctrl+K
            </kbd>
          )}
        </button>
      </div>

      {/* Quick Actions (Nova nota / Novo projeto) */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: '6px' }}>
        <Tooltip content="Nova nota rápida" shortcut="Ctrl+N" position="bottom">
          <button
            onClick={onCreateQuickNote}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 8px',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              border: 'none',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <FilePlus size={14} />
            Nova Nota
          </button>
        </Tooltip>

        <Tooltip content="Criar novo projeto" position="bottom">
          <button
            onClick={onCreateProjectPrompt}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 10px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <FolderPlus size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Scrollable Tree Sections */}
      <div
        data-sidebar-scroll="true"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Section 0: Notas Fixadas */}
        {pinnedNotes.length > 0 && (
          <div>
            <div
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Pin size={12} />
                <span>Fixadas</span>
              </div>
              <span style={{ fontSize: '10px' }}>{pinnedNotes.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
              {pinnedNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                return (
                  <div
                    key={note.id}
                    onClick={() => onSelectNote(note.id)}
                    onContextMenu={(e) => onOpenContextMenu(e, 'note', note)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'var(--bg-selected)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title || 'Sem título'}
                      </span>
                    </div>
                    <Pin size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 1: Notas Rápidas */}
        <div
          data-drop-zone="quick-notes"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const isFileDrag = e.dataTransfer.types?.includes('Files');
            e.dataTransfer.dropEffect = isFileDrag ? 'copy' : 'move';
            if (!isQuickNotesDragOver) setIsQuickNotesDragOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickNotesDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsQuickNotesDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickNotesDragOver(false);

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              Array.from(e.dataTransfer.files).forEach((file) => onImportFile?.(file, null));
              return;
            }

            const noteId =
              e.dataTransfer.getData('application/x-nook-note') ||
              e.dataTransfer.getData('application/x-lumina-note') ||
              e.dataTransfer.getData('text/plain');
            if (noteId) {
              onMoveNote(noteId, null);
            }
          }}
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isQuickNotesDragOver ? 'var(--bg-selected)' : 'transparent',
            outline: isQuickNotesDragOver ? '1.5px solid var(--text-primary)' : 'none',
            boxShadow: isQuickNotesDragOver ? '0 0 0 1px var(--text-primary)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          <div
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Notas Rápidas</span>
              {isQuickNotesDragOver && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: '#000000',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '3px',
                    padding: '1px 5px',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  + Soltar aqui
                </span>
              )}
            </div>
            <span style={{ fontSize: '10px' }}>
              {notes.filter((n) => !n.collection_id).length}
            </span>
          </div>

          <QuickNotesList
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={onSelectNote}
            onOpenContextMenu={onOpenContextMenu}
          />
        </div>

        {/* Section 2: Projetos */}
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types?.includes('Files')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
        >
          <div
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Projetos</span>
            <Tooltip content="Criar novo projeto" position="top">
              <button
                onClick={onCreateProjectPrompt}
                style={{ padding: '2px', color: 'var(--text-muted)', borderRadius: '3px' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Plus size={13} />
              </button>
            </Tooltip>
          </div>

          <ProjectTree
            collections={collections}
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={onSelectNote}
            onCreateNoteInCollection={onCreateNoteInCollection}
            onCreateFolderInCollection={onCreateFolderInCollection}
            onOpenContextMenu={onOpenContextMenu}
            onMoveNote={onMoveNote}
            onImportFile={onImportFile}
            onReorderCollections={onReorderCollections}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Tooltip content="Abrir lixeira" position="top">
          <button
            onClick={onOpenTrash}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Trash2 size={14} />
            <span>Lixeira</span>
          </button>
        </Tooltip>

        <Tooltip content="Configurações e preferências" shortcut="Ctrl+," position="top">
          <button
            onClick={onOpenSettings}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <SettingsIcon size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Resizer Handle */}
      {!isMobile && (
        <div
          onMouseDown={() => (isResizingRef.current = true)}
          style={{
            position: 'absolute',
            top: 0,
            right: '-3px',
            width: '6px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};

export const Sidebar = React.memo(SidebarComponent);
