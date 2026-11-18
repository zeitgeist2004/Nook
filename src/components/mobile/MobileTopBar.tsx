import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  Search,
  Sliders,
  Mic,
  Trash2,
  MoreVertical,
  HelpCircle,
} from 'lucide-react';
import { SaveStatus } from '../../types';
import type { ConnectionState } from '../../services/api';
import { useTranslation } from '../../i18n';

interface MobileTopBarProps {
  onToggleDrawer: () => void;
  onNewNote: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenVoice?: () => void;
  onOpenHelp?: () => void;
  onOpenTrash?: () => void;
  onDeleteNote?: () => void;
  activeNoteTitle: string;
  saveStatus: SaveStatus;
  connectionState?: ConnectionState;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  onToggleDrawer,
  onNewNote,
  onOpenSearch,
  onOpenSettings,
  onOpenVoice,
  onOpenHelp,
  onOpenTrash,
  activeNoteTitle,
  saveStatus,
  connectionState = 'connected',
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const isConnIssue = connectionState !== 'connected';

  return (
    <header
      style={{
        height: 'calc(48px + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(6px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(6px, env(safe-area-inset-right, 0px))',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        userSelect: 'none',
        flexShrink: 0,
        zIndex: 50,
        position: 'relative',
      }}
    >
      {/* Left: Menu Hamburger */}
      <button
        type="button"
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
          flexShrink: 0,
        }}
        aria-label={t.mobile.openMenuAria}
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
          justifyContent: 'flex-start',
          gap: '6px',
          padding: '0 4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {activeNoteTitle ? activeNoteTitle : 'Nook'}
        </div>

        {/* Save / Connection Status Dot */}
        {(saveStatus === 'saving' || isConnIssue) && (
          <span
            title={isConnIssue ? t.ux.connReconnecting : t.mobile.savingStatus}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: connectionState === 'disconnected' || connectionState === 'unauthorized' ? '#EF4444' : '#F59E0B',
              flexShrink: 0,
              animation: 'pulse 1.2s infinite',
            }}
          />
        )}
        {saveStatus === 'saved' && !isConnIssue && (
          <span
            title={t.mobile.savedStatus}
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

      {/* Right Priority Actions (Search, New Note, Voice, More Menu) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
        {onOpenVoice && (
          <button
            type="button"
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
            aria-label={t.mobile.newVoiceNote}
            title={t.mobile.newVoiceNote}
          >
            <Mic size={18} />
          </button>
        )}

        <button
          type="button"
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
          aria-label={t.mobile.createNoteAria}
        >
          <Plus size={20} />
        </button>

        <button
          type="button"
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
          aria-label={t.mobile.searchNotesAria}
        >
          <Search size={18} />
        </button>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={t.ux.moreActionsAria}
            style={{
              width: '40px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: menuOpen ? 'var(--bg-hover)' : 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'fixed',
                top: 'calc(48px + env(safe-area-inset-top, 0px) + 4px)',
                right: 'max(8px, env(safe-area-inset-right, 8px))',
                minWidth: '196px',
                maxWidth: 'calc(100vw - 16px)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                zIndex: 9999,
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
                  setMenuOpen(false);
                  onOpenSettings();
                }}
                className="menu-item"
                style={{ minHeight: '42px', fontSize: '13px' }}
              >
                <Sliders size={15} />
                <span>{t.ux.settingsMenuAction}</span>
              </button>

              {onOpenHelp && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenHelp();
                  }}
                  className="menu-item"
                  style={{ minHeight: '42px', fontSize: '13px' }}
                >
                  <HelpCircle size={15} />
                  <span>{t.ux.helpMenuAction}</span>
                </button>
              )}

              {onOpenTrash && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenTrash();
                  }}
                  className="menu-item"
                  style={{ minHeight: '42px', fontSize: '13px' }}
                >
                  <Trash2 size={15} />
                  <span>{t.ux.trashMenuAction}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
