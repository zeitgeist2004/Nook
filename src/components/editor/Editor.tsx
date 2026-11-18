import React, { useMemo, useState, useEffect } from 'react';
import { EditorHeader, ViewMode } from './EditorHeader';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownViewer } from './MarkdownViewer';
import { NookIdleMascot } from '../mascot/NookMascot';
import { SaveStatus, AppSettings } from '../../types';
import { Plus, Command, HelpCircle, BookOpen, Menu, Trash2 } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

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
  isMobile = false,
  onToggleDrawer,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

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
            backgroundColor: 'var(--bg-main)',
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
              Nenhuma nota selecionada
            </h2>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              Toque em Nova Nota para escrever ou abra o menu lateral para escolher uma anotação existente.
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
              <span>Nova Anotação</span>
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
                <span>Ver Minhas Notas</span>
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
          backgroundColor: 'var(--bg-main)',
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
            Nenhuma nota aberta
          </h2>
          <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
            Selecione uma nota na barra lateral ou crie uma nova nota rápida para começar a escrever imediatamente.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Tooltip content="Criar nova anotação" shortcut="Ctrl+N" position="top" disabled={isMobile}>
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
              Nova Nota Rápida
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
                Abrir Menu de Notas
              </button>
            )
          ) : (
            <Tooltip content="Pesquisar e executar ações" shortcut="Ctrl+K" position="top">
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
                Comandos
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
            <Tooltip content="Guia de atalhos e introdução" shortcut="Ctrl+/" position="top">
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
                Guia Rápido
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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-main)',
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenVersionHistory={onOpenVersionHistory}
        isMobile={isMobile}
      />

      {/* Editor / Reading Content Area */}
      {viewMode === 'edit' && (
        <div
          style={{
            flex: 1,
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
            style={{
              width: '100%',
              maxWidth: '940px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CodeMirrorEditor
              key={`edit-${noteId || externalPath || 'none'}`}
              content={content}
              onChange={onContentChange}
              showLineNumbers={settings.showLineNumbers}
              lineWrapping={settings.lineWrapping}
              fontSize={settings.editorFontSize}
              fontFamily={settings.editorFont}
            />
          </div>
        </div>
      )}

      {viewMode === 'preview' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MarkdownViewer
            content={content}
            onContentChange={onContentChange}
            onNavigateWikilink={onNavigateWikilink}
            fontSize={settings.editorFontSize}
            fontFamily={settings.editorFont}
          />
        </div>
      )}

      {viewMode === 'split' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              height: '100%',
              overflow: 'hidden',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <CodeMirrorEditor
              key={`edit-${noteId || externalPath || 'none'}`}
              content={content}
              onChange={onContentChange}
              showLineNumbers={settings.showLineNumbers}
              lineWrapping={settings.lineWrapping}
              fontSize={settings.editorFontSize}
              fontFamily={settings.editorFont}
            />
          </div>
          <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
            <MarkdownViewer
              content={content}
              onContentChange={onContentChange}
              onNavigateWikilink={onNavigateWikilink}
              fontSize={settings.editorFontSize}
              fontFamily={settings.editorFont}
            />
          </div>
        </div>
      )}

      {/* Discreet Bottom status bar */}
      <div
        style={{
          height: isMobile ? '32px' : '24px',
          padding: isMobile ? '0 14px' : '0 24px',
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
          <button
            onClick={() => {
              if (window.confirm('Deseja mover esta nota para a lixeira?')) {
                onDelete();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '11px',
              fontWeight: 500,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            aria-label="Excluir nota aberta"
          >
            <Trash2 size={12} />
            <span>Excluir Nota</span>
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {viewMode === 'preview'
              ? 'Leitura'
              : viewMode === 'split'
              ? 'Dividido'
              : 'Edição'}{' '}
            • Ctrl+E para alternar
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>
            {stats.words} {stats.words === 1 ? 'palavra' : 'palavras'} · {stats.chars} {stats.chars === 1 ? 'caractere' : 'caracteres'}
          </span>
        </div>
      </div>
    </div>
  );
};
