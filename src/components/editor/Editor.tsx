import React, { useMemo, useState, useEffect } from 'react';
import { EditorHeader, ViewMode } from './EditorHeader';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownViewer } from './MarkdownViewer';
import { NookIdleMascot } from '../mascot/NookMascot';
import { SaveStatus, AppSettings, NoteWorkflowRole } from '../../types';
import { Plus, Command, HelpCircle, BookOpen, Menu } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useTranslation } from '../../i18n';

interface EditorProps {
  noteId: string | null;
  title: string;
  content: string;
  onTitleChange: (newTitle: string) => void;
  onContentChange: (newContent: string) => void;
  breadcrumbs: Array<{ id: string; name: string }>;
  saveStatus: SaveStatus;
  isPinned: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onCopyContent: () => void;
  onCreateQuickNote: () => void;
  onOpenCommandPalette: () => void;
  settings: AppSettings;
  isExternal?: boolean;
  externalPath?: string;
  onNavigateWikilink?: (targetName: string) => void;
  onOpenVersionHistory?: () => void;
  onOpenOnboarding?: () => void;
  noteWorkflowRole?: NoteWorkflowRole | null;
  onUsePromptTemplate?: () => void;
  onCopyHandoffContinue?: () => void;
  isMobile?: boolean;
  onToggleDrawer?: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  noteId,
  title,
  content,
  onTitleChange,
  onContentChange,
  breadcrumbs,
  saveStatus,
  isPinned,
  onTogglePin,
  onDelete,
  onDuplicate,
  onExport,
  onCopyContent,
  onCreateQuickNote,
  onOpenCommandPalette,
  settings,
  isExternal,
  externalPath,
  onNavigateWikilink,
  onOpenVersionHistory,
  onOpenOnboarding,
  noteWorkflowRole,
  onUsePromptTemplate,
  onCopyHandoffContinue,
  isMobile = false,
  onToggleDrawer,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const effectiveViewMode: ViewMode = isMobile && viewMode === 'split' ? 'edit' : viewMode;

  // Toggle Edit/Preview with Ctrl+E or Cmd+E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'edit' ? 'preview' : 'edit'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Word and character count stats (optimized zero-allocation, Unicode & Portuguese support)
  const stats = useMemo(() => {
    if (!content) return { chars: 0, words: 0, lines: 0 };
    let chars = 0;
    let lines = 1;
    for (const _ of content) {
      chars++;
    }
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
    }
    const regex = /[\p{L}\p{N}]+/gu;
    let words = 0;
    while (regex.exec(content) !== null) {
      words++;
    }
    return { chars, words, lines };
  }, [content]);

  // Empty state when no note is open
  if (!noteId && !isExternal) {
    if (isMobile) {
      return (
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            gap: '16px',
            color: 'var(--text-muted)',
            padding: '24px 20px',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          <div style={{ transform: 'scale(0.95)', marginBottom: '4px' }}>
            <NookIdleMascot size={110} />
          </div>

          <div style={{ maxWidth: '300px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              {t.editor.noNoteSelected}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              {t.editor.noNoteSelectedDesc}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '240px', marginTop: '8px' }}>
            <button
              onClick={onCreateQuickNote}
              style={{
                height: '44px',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              }}
            >
              <Plus size={18} />
              <span>{t.editor.newNoteMobile}</span>
            </button>

            {onToggleDrawer && (
              <button
                onClick={onToggleDrawer}
                style={{
                  height: '42px',
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <BookOpen size={16} />
                <span>{t.editor.viewMyNotes}</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          gap: '20px',
          color: 'var(--text-muted)',
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px',
          }}
        >
          <NookIdleMascot size={124} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: '340px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            {t.editor.noNoteOpen}
          </h2>
          <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
            {t.editor.noNoteOpenDesc}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Tooltip content={t.editor.newQuickNoteTooltip} shortcut="Ctrl+N" position="top" disabled={isMobile}>
            <button
              onClick={onCreateQuickNote}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              {t.editor.newQuickNoteBtn}
              {!isMobile && (
                <kbd
                  style={{
                    fontSize: '10px',
                    padding: '2px 5px',
                    backgroundColor: 'rgba(0, 0, 0, 0.12)',
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    color: 'inherit',
                    borderRadius: '4px',
                    marginLeft: '4px',
                  }}
                >
                  Ctrl+N
                </kbd>
              )}
            </button>
          </Tooltip>

          {isMobile ? (
            onToggleDrawer && (
              <button
                onClick={onToggleDrawer}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Menu size={14} />
                {t.editor.openNotesMenu}
              </button>
            )
          ) : (
            <Tooltip content={t.editor.commandsTooltip} shortcut="Ctrl+K" position="top">
              <button
                onClick={onOpenCommandPalette}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <Command size={14} />
                {t.editor.commands}
                <kbd
                  style={{
                    fontSize: '10px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    marginLeft: '4px',
                  }}
                >
                  Ctrl+K
                </kbd>
              </button>
            </Tooltip>
          )}

          {!isMobile && onOpenOnboarding && (
            <Tooltip content={t.editor.quickGuideTooltip} shortcut="Ctrl+/" position="top">
              <button
                onClick={onOpenOnboarding}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <HelpCircle size={14} />
                {t.editor.quickGuide}
                <kbd
                  style={{
                    fontSize: '10px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    marginLeft: '4px',
                  }}
                >
                  Ctrl+/
                </kbd>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <EditorHeader
        title={title}
        onTitleChange={onTitleChange}
        breadcrumbs={breadcrumbs}
        saveStatus={saveStatus}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onExport={onExport}
        onCopyContent={onCopyContent}
        isExternal={isExternal}
        externalPath={externalPath}
        viewMode={effectiveViewMode}
        onViewModeChange={setViewMode}
        onOpenVersionHistory={onOpenVersionHistory}
        noteWorkflowRole={noteWorkflowRole}
        onUsePromptTemplate={onUsePromptTemplate}
        onCopyHandoffContinue={onCopyHandoffContinue}
        readingWidth={settings.readingWidth || 'comfortable'}
        isMobile={isMobile}
      />

      {/* Editor / Reading Content Area */}
      {effectiveViewMode === 'edit' && (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const cmContent = (e.currentTarget as HTMLElement).querySelector('.cm-content') as HTMLElement | null;
              cmContent?.focus();
            }
          }}
        >
          <div
            className={isMobile ? undefined : `nook-measure-${settings.readingWidth || 'comfortable'}`}
            style={{
              width: '100%',
              maxWidth: '940px',
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ErrorBoundary scope="editor">
              <CodeMirrorEditor
                key={`edit-${noteId || externalPath || 'none'}`}
                content={content}
                onChange={onContentChange}
                showLineNumbers={settings.showLineNumbers}
                lineWrapping={settings.lineWrapping}
                fontSize={settings.editorFontSize}
                fontFamily={settings.editorFont}
                lineHeight={settings.lineHeight}
                readingWidth={isMobile ? 'full' : (settings.readingWidth || 'comfortable')}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {effectiveViewMode === 'preview' && (
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <ErrorBoundary scope="editor">
            <MarkdownViewer
              content={content}
              onContentChange={onContentChange}
              onNavigateWikilink={onNavigateWikilink}
              fontSize={settings.editorFontSize}
              fontFamily={settings.editorFont}
              lineHeight={settings.lineHeight}
              readingWidth={isMobile ? 'full' : (settings.readingWidth || 'comfortable')}
              paragraphSpacing={settings.paragraphSpacing || 'comfortable'}
            />
          </ErrorBoundary>
        </div>
      )}

      {effectiveViewMode === 'split' && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              overflow: 'hidden',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <ErrorBoundary scope="editor">
              <CodeMirrorEditor
                key={`edit-${noteId || externalPath || 'none'}`}
                content={content}
                onChange={onContentChange}
                showLineNumbers={settings.showLineNumbers}
                lineWrapping={settings.lineWrapping}
                fontSize={settings.editorFontSize}
                fontFamily={settings.editorFont}
                lineHeight={settings.lineHeight}
                readingWidth="full"
              />
            </ErrorBoundary>
          </div>
          <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <ErrorBoundary scope="editor">
              <MarkdownViewer
                content={content}
                onContentChange={onContentChange}
                onNavigateWikilink={onNavigateWikilink}
                fontSize={settings.editorFontSize}
                fontFamily={settings.editorFont}
                lineHeight={settings.lineHeight}
                readingWidth="full"
                paragraphSpacing={settings.paragraphSpacing || 'comfortable'}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Discreet Bottom status bar */}
      <div
        className="nook-editor-statusbar"
        style={{
          minHeight: isMobile ? '28px' : '24px',
          padding: isMobile
            ? '3px max(14px, env(safe-area-inset-right, 14px)) max(4px, env(safe-area-inset-bottom, 4px)) max(14px, env(safe-area-inset-left, 14px))'
            : '0 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-main)',
          flexShrink: 0,
        }}
      >
        {isMobile ? (
          onOpenOnboarding ? (
            <button
              type="button"
              onClick={onOpenOnboarding}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-muted)',
                fontSize: '11px',
                padding: '2px 4px',
                minHeight: '24px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <HelpCircle size={12} />
              <span>{t.ux.helpAndShortcutsBtn}</span>
            </button>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {effectiveViewMode === 'preview' ? t.editor.readBadge : t.editor.editBadge}
            </span>
          )
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {effectiveViewMode === 'preview'
              ? t.editor.readBadge
              : effectiveViewMode === 'split'
              ? t.editor.splitBadge
              : t.editor.editBadge}{' '}
            {t.editor.ctrlEToToggle}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>
            {stats.words} {stats.words === 1 ? t.editor.wordSingular : t.editor.wordPlural} · {stats.chars} {stats.chars === 1 ? t.editor.charSingular : t.editor.charPlural}
          </span>
        </div>
      </div>
    </div>
  );
};
