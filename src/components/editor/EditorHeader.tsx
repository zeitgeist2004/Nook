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
} from 'lucide-react';
import { SaveStatus } from '../../types';
import { NookSaveMicroMark } from '../mascot/NookMascot';
import { Tooltip } from '../ui/Tooltip';

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
  isMobile = false,
}) => {
  return (
    <div
      style={{
        padding: isMobile ? '12px 16px 6px 16px' : '16px 40px 8px 40px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '8px' : '12px',
        maxWidth: viewMode === 'split' ? '100%' : '940px',
        width: '100%',
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
                Arquivo Externo: {externalPath}
              </span>
            ) : (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>Nook</span>
                {breadcrumbs.map((b) => (
                  <React.Fragment key={b.id}>
                    <ChevronRight size={13} style={{ opacity: 0.6 }} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Folder size={12} />
                      {b.name}
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
            gap: isMobile ? '4px' : '8px',
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
            <Tooltip content="Modo Edição" position="bottom">
              <button
                onClick={() => onViewModeChange('edit')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: isMobile ? '4px 9px' : '2px 7px',
                  borderRadius: '4px',
                  fontSize: isMobile ? '12px' : '11px',
                  fontWeight: 500,
                  backgroundColor: viewMode === 'edit' ? 'var(--bg-selected)' : 'transparent',
                  color: viewMode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Edit3 size={12} />
                <span>Editar</span>
              </button>
            </Tooltip>

            {!isMobile && (
              <Tooltip content="Visualização Dividida" position="bottom">
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
                  <span>Dividir</span>
                </button>
              </Tooltip>
            )}

            <Tooltip content="Modo Leitura" position="bottom">
              <button
                onClick={() => onViewModeChange('preview')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: isMobile ? '4px 9px' : '2px 7px',
                  borderRadius: '4px',
                  fontSize: isMobile ? '12px' : '11px',
                  fontWeight: 500,
                  backgroundColor: viewMode === 'preview' ? 'var(--bg-selected)' : 'transparent',
                  color: viewMode === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <BookOpen size={12} />
                <span>Leitura</span>
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
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Salvo</span>
            )}
            {saveStatus === 'saving' && <span>Salvando...</span>}
            {saveStatus === 'unsaved' && <span>Pendente</span>}
            {saveStatus === 'error' && (
              <span style={{ color: 'var(--text-primary)' }}>Falha ao salvar</span>
            )}
          </div>

          {/* Action buttons */}
          {!isExternal && (
            <Tooltip content={isPinned ? 'Desafixar nota' : 'Fixar nota'} position="bottom" disabled={isMobile}>
              <button
                onClick={onTogglePin}
                style={{
                  padding: isMobile ? '6px 8px' : '4px',
                  minWidth: isMobile ? '36px' : 'auto',
                  minHeight: isMobile ? '36px' : 'auto',
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

          <Tooltip content="Copiar texto da nota" position="bottom" disabled={isMobile}>
            <button
              onClick={onCopyContent}
              style={{
                padding: isMobile ? '6px 8px' : '4px',
                minWidth: isMobile ? '36px' : 'auto',
                minHeight: isMobile ? '36px' : 'auto',
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
                <Tooltip content="Histórico de versões da nota" position="bottom" disabled={isMobile}>
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
                <Tooltip content="Duplicar nota" position="bottom" disabled={isMobile}>
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
                <Tooltip content="Exportar como arquivo (.md)" position="bottom" disabled={isMobile}>
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

              <Tooltip content="Mover para lixeira" position="bottom" disabled={isMobile}>
                <button
                  onClick={onDelete}
                  style={{
                    padding: isMobile ? '6px 10px' : '4px',
                    minWidth: isMobile ? '40px' : 'auto',
                    minHeight: isMobile ? '40px' : 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    color: isMobile ? '#EF4444' : 'var(--text-muted)',
                    backgroundColor: isMobile ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                    border: isMobile ? '1px solid rgba(239, 68, 68, 0.25)' : 'none',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isMobile ? '#EF4444' : 'var(--text-muted)')}
                  aria-label="Excluir nota"
                >
                  <Trash2 size={16} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Title input field */}
      <input
        type="text"
        value={title}
        placeholder="Sem título"
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
