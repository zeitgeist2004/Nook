import React from 'react';
import {
  Copy,
  CopyPlus,
  Trash2,
  Pin,
  FileText,
  Folder,
  ChevronRight,
  Download,
  Edit3,
  BookOpen,
  Columns,
  History,
  Sparkles,
  GitCommitHorizontal,
  Check,
  MoreHorizontal,
} from 'lucide-react';
import { NoteWorkflowRole, ReadingWidth, SaveStatus } from '../../types';
import { NookSaveMicroMark } from '../mascot/NookMascot';
import { Tooltip } from '../ui/Tooltip';
import { useTranslation } from '../../i18n';

export type ViewMode = 'edit' | 'preview' | 'split';

interface EditorHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  breadcrumbs: Array<{ id: string; name: string }>;
  saveStatus: SaveStatus;
  isPinned: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onCopyContent: () => void;
  isExternal?: boolean;
  externalPath?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenVersionHistory?: () => void;
  noteWorkflowRole?: NoteWorkflowRole | null;
  onUsePromptTemplate?: () => void;
  onCopyHandoffContinue?: () => void;
  readingWidth?: ReadingWidth;
  isMobile?: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  onTitleChange,
  breadcrumbs,
  saveStatus,
  isPinned,
  onTogglePin,
  onDelete,
  onDuplicate,
  onExport,
  onCopyContent,
  isExternal,
  externalPath,
  viewMode,
  onViewModeChange,
  onOpenVersionHistory,
  noteWorkflowRole,
  onUsePromptTemplate,
  onCopyHandoffContinue,
  readingWidth = 'comfortable',
  isMobile = false,
}) => {
  const { t } = useTranslation();
  const [copiedHandoff, setCopiedHandoff] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!moreOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  return (
    <div
      className={viewMode === 'split' || isMobile ? undefined : `nook-measure-${readingWidth}`}
      style={{
        padding: isMobile ? '10px 14px 6px 14px' : '16px 40px 8px 40px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '8px' : '12px',
        maxWidth: viewMode === 'split' ? '100%' : '940px',
        width: '100%',
        minWidth: 0,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Top row: Breadcrumbs and Status/Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '6px' : '12px',
          minHeight: '28px',
        }}
      >
        {/* Breadcrumbs (Desktop only or truncated on mobile) */}
        {!isMobile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isExternal ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--accent)',
                  backgroundColor: 'var(--accent-muted)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                <FileText size={13} />
                {t.editor.externalFile} {externalPath}
              </span>
            ) : (
              <>
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Nook</span>
                {breadcrumbs.map((b) => (
                  <React.Fragment key={b.id}>
                    <ChevronRight size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--text-secondary)',
                        minWidth: 0,
                      }}
                    >
                      <Folder size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name}
                      </span>
                    </span>
                  </React.Fragment>
                ))}
              </>
            )}
          </div>
        )}

        {/* Save indicator & Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: isMobile ? 1 : 0,
            maxWidth: '100%',
            gap: isMobile ? '4px' : '6px',
            marginLeft: isMobile ? '0' : 'auto',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
          }}
        >
          {/* View Mode Segmented Switcher */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              gap: '1px',
            }}
          >
            <Tooltip content={t.editor.editMode} position="bottom">
              <button
                onClick={() => onViewModeChange('edit')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: isMobile ? '4px 8px' : '2px 7px',
                  borderRadius: '4px',
                  fontSize: isMobile ? '12px' : '11px',
                  fontWeight: 500,
                  backgroundColor: viewMode === 'edit' ? 'var(--bg-selected)' : 'transparent',
                  color: viewMode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Edit3 size={12} />
                <span>{t.editor.edit}</span>
              </button>
            </Tooltip>

            {!isMobile && (
              <Tooltip content={t.editor.splitView} position="bottom">
                <button
                  onClick={() => onViewModeChange('split')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    backgroundColor: viewMode === 'split' ? 'var(--bg-selected)' : 'transparent',
                    color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Columns size={12} />
                  <span>{t.editor.split}</span>
                </button>
              </Tooltip>
            )}

            <Tooltip content={t.editor.readMode} position="bottom">
              <button
                onClick={() => onViewModeChange('preview')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: isMobile ? '4px 8px' : '2px 7px',
                  borderRadius: '4px',
                  fontSize: isMobile ? '12px' : '11px',
                  fontWeight: 500,
                  backgroundColor: viewMode === 'preview' ? 'var(--bg-selected)' : 'transparent',
                  color: viewMode === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <BookOpen size={12} />
                <span>{t.editor.read}</span>
              </button>
            </Tooltip>
          </div>

          {/* Monochromatic Save Status Indicator & Micro Mascot */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <NookSaveMicroMark saveStatus={saveStatus} />
            {saveStatus === 'saved' && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.common.saved}</span>
            )}
            {saveStatus === 'saving' && <span>{t.common.saving}</span>}
            {saveStatus === 'unsaved' && <span>{t.common.unsaved}</span>}
            {saveStatus === 'error' && (
              <span style={{ color: 'var(--text-primary)' }}>{t.common.saveError}</span>
            )}
          </div>

          {/* Action buttons */}
          {!isExternal && noteWorkflowRole === 'prompt' && onUsePromptTemplate && (
            <button
              type="button"
              onClick={onUsePromptTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: 'var(--accent-muted)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={12} />
              <span>{t.editor.useTemplateBtn}</span>
            </button>
          )}

          {!isExternal && noteWorkflowRole === 'handoff' && onCopyHandoffContinue && (
            <button
              type="button"
              onClick={() => {
                onCopyHandoffContinue();
                setCopiedHandoff(true);
                setTimeout(() => setCopiedHandoff(false), 1600);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 500,
                backgroundColor: 'var(--accent-muted)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                cursor: 'pointer',
              }}
            >
              {copiedHandoff ? <Check size={12} /> : <GitCommitHorizontal size={12} />}
              <span>{copiedHandoff ? t.editor.copiedToContinueBtn : t.editor.copyToContinueBtn}</span>
            </button>
          )}

          {!isExternal && !isMobile && (
            <Tooltip content={isPinned ? t.editor.unpinNote : t.editor.pinNote} position="bottom" disabled={isMobile}>
              <button
                onClick={onTogglePin}
                style={{
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  color: isPinned ? 'var(--accent)' : 'var(--text-muted)',
                  backgroundColor: isPinned ? 'var(--accent-muted)' : 'transparent',
                  touchAction: 'manipulation',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Pin size={15} />
              </button>
            </Tooltip>
          )}

          <Tooltip content={t.editor.copyNoteText} position="bottom" disabled={isMobile}>
            <button
              onClick={onCopyContent}
              style={{
                padding: isMobile ? '5px 7px' : '4px',
                minWidth: isMobile ? '34px' : 'auto',
                minHeight: isMobile ? '34px' : 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Copy size={15} />
            </button>
          </Tooltip>

          {!isExternal && (
            <>
              {!isMobile && onOpenVersionHistory && (
                <Tooltip content={t.editor.versionHistoryTooltip} position="bottom" disabled={isMobile}>
                  <button
                    onClick={onOpenVersionHistory}
                    style={{
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <History size={15} />
                  </button>
                </Tooltip>
              )}

              {!isMobile && (
                <Tooltip content={t.editor.duplicateNote} position="bottom" disabled={isMobile}>
                  <button
                    onClick={onDuplicate}
                    style={{
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <CopyPlus size={15} />
                  </button>
                </Tooltip>
              )}

              {!isMobile && (
                <Tooltip content={t.editor.exportMdTooltip} position="bottom" disabled={isMobile}>
                  <button
                    onClick={onExport}
                    style={{
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Download size={15} />
                  </button>
                </Tooltip>
              )}

              {isMobile ? (
                <div ref={moreRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((prev) => !prev)}
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                    aria-label={t.ux.noteActionsAria}
                    style={{
                      minWidth: '34px',
                      minHeight: '34px',
                      padding: '5px 7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      color: moreOpen ? 'var(--text-primary)' : 'var(--text-muted)',
                      backgroundColor: moreOpen ? 'var(--bg-hover)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    <MoreHorizontal size={17} />
                  </button>

                  {moreOpen && (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        minWidth: '188px',
                        maxWidth: 'calc(100vw - 24px)',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '5px',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
                        zIndex: 9998,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      className="animate-fade-in"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false);
                          onTogglePin();
                        }}
                        className="menu-item"
                        style={{ minHeight: '40px', fontSize: '13px' }}
                      >
                        <Pin size={15} />
                        <span>{isPinned ? t.editor.unpinNote : t.editor.pinNote}</span>
                      </button>
                      {onOpenVersionHistory && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMoreOpen(false);
                            onOpenVersionHistory();
                          }}
                          className="menu-item"
                          style={{ minHeight: '40px', fontSize: '13px' }}
                        >
                          <History size={15} />
                          <span>{t.editor.versionHistoryTooltip}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false);
                          onDuplicate();
                        }}
                        className="menu-item"
                        style={{ minHeight: '40px', fontSize: '13px' }}
                      >
                        <CopyPlus size={15} />
                        <span>{t.editor.duplicateNote}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false);
                          onExport();
                        }}
                        className="menu-item"
                        style={{ minHeight: '40px', fontSize: '13px' }}
                      >
                        <Download size={15} />
                        <span>{t.editor.exportMdTooltip}</span>
                      </button>
                      <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '3px 0' }} />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false);
                          onDelete();
                        }}
                        className="menu-item menu-item-danger"
                        style={{ minHeight: '40px', fontSize: '13px' }}
                      >
                        <Trash2 size={15} />
                        <span>{t.editor.moveToTrashTooltip}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Tooltip content={t.editor.moveToTrashTooltip} position="bottom" disabled={isMobile}>
                  <button
                    onClick={onDelete}
                    style={{
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    aria-label={t.mobile.deleteNote}
                  >
                    <Trash2 size={16} />
                  </button>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Title input field */}
      <input
        type="text"
        value={title}
        placeholder={t.editor.titlePlaceholder}
        readOnly={!!isExternal}
        onChange={(e) => {
          if (!isExternal) onTitleChange(e.target.value);
        }}
        style={{
          width: '100%',
          fontSize: isMobile ? '21px' : '26px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          backgroundColor: 'transparent',
          lineHeight: '1.25',
          letterSpacing: '-0.02em',
          cursor: isExternal ? 'default' : 'text',
        }}
      />
    </div>
  );
};
