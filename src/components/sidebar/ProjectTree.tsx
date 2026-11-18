import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  FolderPlus,
  Briefcase,
  Pin,
  Layers,
  MoreHorizontal,
} from 'lucide-react';
import { Collection, DevProjectsConfigMap, NoteSummary } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';

interface ProjectTreeProps {
  collections: Collection[];
  notes: NoteSummary[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNoteInCollection: (collectionId: string) => void;
  onCreateFolderInCollection: (collectionId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, type: 'note' | 'collection', item: NoteSummary | Collection) => void;
  onMoveNote: (noteId: string, targetCollectionId: string | null) => void;
  onImportFile?: (file: File, collectionId?: string | null) => void;
  onReorderCollections?: (orderedIds: string[]) => void;
  devWorkflowEnabled?: boolean;
  devProjectsConfig?: DevProjectsConfigMap;
  onOpenProjectTools?: (collectionId: string) => void;
  isMobile?: boolean;
}

interface DropIndicator {
  id: string;
  position: 'before' | 'after';
  slot: number;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  collections,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNoteInCollection,
  onCreateFolderInCollection,
  onOpenContextMenu,
  onMoveNote,
  onImportFile,
  onReorderCollections,
  devWorkflowEnabled = false,
  devProjectsConfig,
  onOpenProjectTools,
  isMobile = false,
}) => {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return new Set(collections.filter((c) => !c.parent_id).map((c) => c.id));
  });

  // Pointer-based collection reordering state (immune to Windows WebView2 OLE IDropTarget blocks)
  const [draggingCol, setDraggingCol] = useState<Collection | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<DropIndicator | null>(null);

  // Track external file or note drag-over folder
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const treeContainerRef = useRef<HTMLDivElement>(null);
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  const onReorderRef = useRef(onReorderCollections);
  onReorderRef.current = onReorderCollections;

  const suppressClickRef = useRef(false);
  const cleanupDragListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupDragListenersRef.current) {
        cleanupDragListenersRef.current();
      }
    };
  }, []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start smooth Pointer-Event drag-and-drop for reordering folders/projects
  const handleCollectionPointerDown = (e: React.PointerEvent, collection: Collection) => {
    // Only primary mouse/pen button; allow normal touch scrolling on mobile drawers
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') return;

    // Don't hijack clicks on quick-action buttons (+ Note / + Subfolder)
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button')) return;

    // Must have >1 sibling to reorder
    const siblingsSnapshot = collectionsRef.current
      .filter((c) => (c.parent_id ?? null) === (collection.parent_id ?? null))
      .sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

    if (siblingsSnapshot.length <= 1) return;

    const currentIndex = siblingsSnapshot.findIndex((c) => c.id === collection.id);
    if (currentIndex === -1) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragActive = false;
    let latestTarget: DropIndicator | null = null;

    const computeDropTarget = (clientY: number): DropIndicator | null => {
      const container = treeContainerRef.current;
      if (!container) return null;

      const midpoints: number[] = [];
      for (const sib of siblingsSnapshot) {
        const rowEl = container.querySelector(`[data-collection-row-id="${sib.id}"]`);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          midpoints.push(rect.top + rect.height / 2);
        } else {
          midpoints.push(Infinity);
        }
      }

      // Find insertion slot 0..siblingsSnapshot.length across sibling vertical midpoints
      let slot = siblingsSnapshot.length;
      for (let i = 0; i < midpoints.length; i++) {
        if (clientY < midpoints[i]) {
          slot = i;
          break;
        }
      }

      // Suppress no-op slots (before/after self leaves order unchanged)
      if (slot === currentIndex || slot === currentIndex + 1) {
        return null;
      }

      if (slot < siblingsSnapshot.length) {
        return {
          id: siblingsSnapshot[slot].id,
          position: 'before',
          slot,
        };
      }
      return {
        id: siblingsSnapshot[siblingsSnapshot.length - 1].id,
        position: 'after',
        slot,
      };
    };

    const handlePointerMove = (moveE: PointerEvent) => {
      const dx = moveE.clientX - startX;
      const dy = moveE.clientY - startY;

      if (!dragActive) {
        if (Math.hypot(dx, dy) < 5) return;
        dragActive = true;
        suppressClickRef.current = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        setDraggingCol(collection);
      }

      setDragCursor({ x: moveE.clientX, y: moveE.clientY });

      // Gentle auto-scroll when dragging near sidebar viewport edges
      const scrollParent = treeContainerRef.current?.closest('[data-sidebar-scroll="true"]') as HTMLElement | null;
      if (scrollParent) {
        const sr = scrollParent.getBoundingClientRect();
        if (moveE.clientY < sr.top + 32) {
          scrollParent.scrollTop -= 6;
        } else if (moveE.clientY > sr.bottom - 32) {
          scrollParent.scrollTop += 6;
        }
      }

      const nextTarget = computeDropTarget(moveE.clientY);
      latestTarget = nextTarget;
      setDragTarget((prev) => {
        if (prev?.id === nextTarget?.id && prev?.position === nextTarget?.position && prev?.slot === nextTarget?.slot) {
          return prev;
        }
        return nextTarget;
      });
    };

    const teardown = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handlePointerCancel);
      cleanupDragListenersRef.current = null;

      if (dragActive) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDraggingCol(null);
        setDragCursor(null);
        setDragTarget(null);
        // Clear click suppression after current event tick
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
      }
    };

    const handlePointerUp = () => {
      const finalTarget = latestTarget;
      const wasActive = dragActive;
      teardown();

      if (wasActive && finalTarget) {
        const filtered = siblingsSnapshot.filter((c) => c.id !== collection.id);
        const insertIndex = finalTarget.slot > currentIndex ? finalTarget.slot - 1 : finalTarget.slot;
        filtered.splice(Math.max(0, Math.min(filtered.length, insertIndex)), 0, collection);
        const orderedIds = filtered.map((c) => c.id);
        onReorderRef.current?.(orderedIds);
      }
    };

    const handlePointerCancel = () => {
      teardown();
    };

    if (cleanupDragListenersRef.current) {
      cleanupDragListenersRef.current();
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handlePointerCancel);
    cleanupDragListenersRef.current = teardown;
  };

  // HTML5 Drag Handlers reserved cleanly for External Explorer Files & Note drops
  const handleRowDragOver = (e: React.DragEvent, collection: Collection) => {
    const hasFilesOrNote =
      e.dataTransfer.types?.includes('Files') ||
      e.dataTransfer.types?.includes('application/x-nook-note') ||
      e.dataTransfer.types?.includes('application/x-lumina-note') ||
      e.dataTransfer.types?.includes('text/plain');

    if (!hasFilesOrNote) return;

    e.preventDefault();
    e.stopPropagation();

    const isFileDrag = e.dataTransfer.types?.includes('Files');
    e.dataTransfer.dropEffect = isFileDrag ? 'copy' : 'move';
    if (dragOverFolderId !== collection.id) {
      setDragOverFolderId(collection.id);
    }
  };

  const handleRowDragLeave = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverFolderId === collectionId) {
        setDragOverFolderId(null);
      }
    }
  };

  const handleRowDrop = (e: React.DragEvent, targetCollection: Collection) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // 1. External files dropped from Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => onImportFile?.(file, targetCollection.id));
      setExpandedIds((prev) => new Set(prev).add(targetCollection.id));
      return;
    }

    // 2. Internal note dropped into this collection
    const plainData = e.dataTransfer.getData('text/plain') || '';
    const noteId = plainData.startsWith('nook-note:')
      ? plainData.replace('nook-note:', '')
      : (e.dataTransfer.getData('application/x-nook-note') ||
         e.dataTransfer.getData('application/x-lumina-note') ||
         plainData);

    if (noteId) {
      onMoveNote(noteId, targetCollection.id);
      setExpandedIds((prev) => new Set(prev).add(targetCollection.id));
    }
  };

  // Render a single collection node (project or folder) and its children
  const renderCollection = (collection: Collection, depth: number = 0) => {
    const isExpanded = expandedIds.has(collection.id);
    const isProject = collection.collection_type === 'project';
    const isDragOverFolder = dragOverFolderId === collection.id;
    const isDraggingThis = draggingCol?.id === collection.id;

    const isDropBefore = dragTarget?.id === collection.id && dragTarget.position === 'before';
    const isDropAfter = dragTarget?.id === collection.id && dragTarget.position === 'after';

    // Sub-collections sorted by sort_order
    const subCollections = collections
      .filter((c) => c.parent_id === collection.id)
      .sort((a, b) => {
        const orderA = a.sort_order ?? 0;
        const orderB = b.sort_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

    // Notes in this collection
    const collectionNotes = notes.filter((n) => n.collection_id === collection.id);

    return (
      <div
        key={collection.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          opacity: isDraggingThis ? 0.4 : 1,
          transition: 'opacity var(--transition-fast)',
        }}
      >
        {/* Visual drop indicator line (Before) */}
        {isDropBefore && (
          <div
            style={{
              position: 'absolute',
              top: '-1px',
              left: `${8 + depth * 14}px`,
              right: '8px',
              height: '2px',
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent)',
              zIndex: 30,
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '-3px',
                top: '-3px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                boxShadow: '0 0 6px var(--accent)',
              }}
            />
          </div>
        )}

        {/* Collection Row (Reorders via Pointer Events, accepts Files/Notes via DragOver/Drop) */}
        <div
          data-collection-id={collection.id}
          data-collection-row-id={collection.id}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpandedIds((prev) => {
                const next = new Set(prev);
                if (next.has(collection.id)) next.delete(collection.id);
                else next.add(collection.id);
                return next;
              });
            }
          }}
          onPointerDown={(e) => handleCollectionPointerDown(e, collection)}
          onContextMenu={(e) => onOpenContextMenu(e, 'collection', collection)}
          onDragOver={(e) => handleRowDragOver(e, collection)}
          onDragLeave={(e) => handleRowDragLeave(e, collection.id)}
          onDrop={(e) => handleRowDrop(e, collection)}
          onClick={(e) => toggleExpand(collection.id, e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `5px 8px 5px ${8 + depth * 14}px`,
            fontSize: '12px',
            fontWeight: isProject ? 600 : 500,
            color: isProject ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            cursor: draggingCol ? 'grabbing' : 'grab',
            backgroundColor: isDragOverFolder ? 'var(--bg-selected)' : 'transparent',
            outline: isDragOverFolder ? '1px solid var(--accent)' : 'none',
            boxShadow: isDragOverFolder ? '0 0 0 1px var(--accent)' : 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            transition: 'background-color var(--transition-fast), color var(--transition-fast)',
            position: 'relative',
          }}
          className="tree-item"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', pointerEvents: 'none' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--text-muted)',
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>

            <span style={{ color: isProject ? 'var(--text-primary)' : 'var(--text-muted)', display: 'inline-flex' }}>
              {isProject ? (
                <Briefcase size={14} />
              ) : isExpanded ? (
                <FolderOpen size={14} />
              ) : (
                <Folder size={14} />
              )}
            </span>

            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: isProject ? 600 : 500,
              }}
            >
              {collection.name}
            </span>
          </div>

          {isDragOverFolder ? (
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: '#000000',
                backgroundColor: 'var(--accent, #FFFFFF)',
                borderRadius: '3px',
                padding: '1px 6px',
                lineHeight: 1.3,
                animation: 'fadeIn 100ms ease-out',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {t.sidebar.dropHere}
            </span>
          ) : (
            /* Quick Hover Add actions */
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {isProject &&
                onOpenProjectTools &&
                (devWorkflowEnabled ||
                  devProjectsConfig?.[collection.id]?.enabled ||
                  devProjectsConfig?.[collection.id]?.linkedFolderPath) && (
                  <Tooltip content={t.contextMenu.projectTools} position="top" disabled={isMobile}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProjectTools(collection.id);
                      }}
                      className={isMobile ? undefined : 'hover-actions'}
                      aria-label={t.contextMenu.projectTools}
                      style={{
                        padding: isMobile ? '6px' : '2px',
                        color: 'var(--text-muted)',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <Layers size={13} />
                    </button>
                  </Tooltip>
                )}
              <div className="hover-actions" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Tooltip content={t.sidebar.newNoteInProject} position="top" disabled={isMobile}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateNoteInCollection(collection.id);
                    }}
                    aria-label={t.sidebar.newNoteInProject}
                    style={{
                      padding: isMobile ? '6px' : '2px',
                      color: 'var(--text-muted)',
                      borderRadius: '3px',
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </Tooltip>
                {!isMobile && (
                  <Tooltip content={t.sidebar.newSubfolder} position="top">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFolderInCollection(collection.id);
                      }}
                      aria-label={t.sidebar.newSubfolder}
                      style={{ padding: '2px', color: 'var(--text-muted)', borderRadius: '3px' }}
                    >
                      <FolderPlus size={13} />
                    </button>
                  </Tooltip>
                )}
              </div>
              {isMobile && (
                <button
                  type="button"
                  aria-label={t.ux.itemMenuAria}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenContextMenu(e, 'collection', collection);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    color: 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Children (if expanded) */}
        {isExpanded && (
          <div
            data-collection-id={collection.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = e.dataTransfer.types?.includes('Files') ? 'copy' : 'move';
              setDragOverFolderId(collection.id);
            }}
            onDrop={(e) => handleRowDrop(e, collection)}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            {subCollections.map((sub) => renderCollection(sub, depth + 1))}

            {collectionNotes.map((note) => {
              const isSelected = activeNoteId === note.id;
              return (
                <div
                  key={note.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `nook-note:${note.id}`);
                    e.dataTransfer.setData('application/x-nook-note', note.id);
                    e.dataTransfer.setData('application/x-lumina-note', note.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(collection.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = e.dataTransfer.types?.includes('Files') ? 'copy' : 'move';
                    setDragOverFolderId(collection.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverFolderId(null);
                    }
                  }}
                  onDrop={(e) => handleRowDrop(e, collection)}
                  onContextMenu={(e) => onOpenContextMenu(e, 'note', note)}
                  onClick={() => onSelectNote(note.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: `5px 8px 5px ${26 + depth * 14}px`,
                    fontSize: '12px',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    transition: 'all var(--transition-fast)',
                    borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                  className="tree-note-item"
                >
                  <FileText size={13} style={{ opacity: isSelected ? 1 : 0.6, flexShrink: 0, pointerEvents: 'none' }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {note.title || t.common.untitled}
                  </span>
                  {note.is_pinned && (
                    <Pin size={11} style={{ color: 'var(--accent)', flexShrink: 0, pointerEvents: 'none' }} />
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
                        width: '30px',
                        height: '30px',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Visual drop indicator line (After entire collection block including children) */}
        {isDropAfter && (
          <div
            style={{
              position: 'absolute',
              bottom: '-1px',
              left: `${8 + depth * 14}px`,
              right: '8px',
              height: '2px',
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent)',
              zIndex: 30,
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '-3px',
                top: '-3px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                boxShadow: '0 0 6px var(--accent)',
              }}
            />
          </div>
        )}
      </div>
    );
  };

  // Top level collections (projects or root folders) sorted by sort_order
  const rootCollections = collections
    .filter((c) => !c.parent_id)
    .sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  if (rootCollections.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        {t.sidebar.noProjects}
      </div>
    );
  }

  return (
    <div
      ref={treeContainerRef}
      style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}
    >
      {rootCollections.map((c) => renderCollection(c, 0))}

      {/* Floating Ghost Pill while Dragging a Project/Folder */}
      {draggingCol &&
        dragCursor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${dragCursor.x + 14}px`,
              top: `${dragCursor.y - 16}px`,
              zIndex: 999999,
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--accent)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), 0 0 12px var(--accent-muted)',
              opacity: 0.95,
              whiteSpace: 'nowrap',
            }}
          >
            {draggingCol.collection_type === 'project' ? (
              <Briefcase size={13} style={{ color: 'var(--accent)' }} />
            ) : (
              <Folder size={13} style={{ color: 'var(--accent)' }} />
            )}
            <span>{draggingCol.name}</span>
          </div>,
          document.body
        )}

      <style>{`
        .tree-item:hover {
          background-color: var(--bg-hover) !important;
        }
        .tree-item .hover-actions {
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .tree-item:hover .hover-actions,
        .tree-item:focus-within .hover-actions {
          opacity: 1;
        }
        .tree-note-item:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
