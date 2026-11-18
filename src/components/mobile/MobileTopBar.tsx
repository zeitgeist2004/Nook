import React from 'react';
import { Menu, Plus, Search, Sliders, Mic, Trash2 } from 'lucide-react';
import { SaveStatus } from '../../types';

interface MobileTopBarProps {
  onToggleDrawer: () => void;
  onNewNote: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenVoice?: () => void;
  onDeleteNote?: () => void;
  activeNoteTitle: string;
  saveStatus: SaveStatus;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  onToggleDrawer,
  onNewNote,
  onOpenSearch,
  onOpenSettings,
  onOpenVoice,
  onDeleteNote,
  activeNoteTitle,
  saveStatus,
}) => {
  return (
    <header
      style={{
        height: 'calc(48px + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Menu Hamburger */}
      <button
        onClick={onToggleDrawer}
        style={{
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
        aria-label="Abrir menu de navegação"
      >
        <Menu size={21} />
      </button>

      {/* Center: Title / Logo */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '0 4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '120px',
            textAlign: 'center',
          }}
        >
          {activeNoteTitle ? activeNoteTitle : 'Nook'}
        </div>

        {/* Save Status Dot */}
        {saveStatus === 'saving' && (
          <span
            title="Salvando..."
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#F59E0B',
              flexShrink: 0,
              animation: 'pulse 1s infinite',
            }}
          />
        )}
        {saveStatus === 'saved' && (
          <span
            title="Salvo"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
        {onDeleteNote && (
          <button
            onClick={() => {
              if (window.confirm('Deseja mover esta nota para a lixeira?')) {
                onDeleteNote();
              }
            }}
            style={{
              width: '40px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#EF4444',
              cursor: 'pointer',
              flexShrink: 0,
              marginRight: '2px',
            }}
            aria-label="Excluir nota"
            title="Excluir nota"
          >
            <Trash2 size={17} />
          </button>
        )}

        {onOpenVoice && (
          <button
            onClick={onOpenVoice}
            style={{
              width: '40px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Nova nota por voz"
            title="Nova nota por voz"
          >
            <Mic size={18} />
          </button>
        )}

        <button
          onClick={onNewNote}
          style={{
            width: '40px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Criar nova nota"
        >
          <Plus size={20} />
        </button>

        <button
          onClick={onOpenSearch}
          style={{
            width: '40px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Buscar notas"
        >
          <Search size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          style={{
            width: '40px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Configurações"
        >
          <Sliders size={18} />
        </button>
      </div>
    </header>
  );
};
