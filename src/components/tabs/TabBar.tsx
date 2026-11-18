import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, FileCode, Pin, Globe, Monitor, Smartphone, Mic } from 'lucide-react';
import { TabItem } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { api, isTauri } from '../../services/api';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewExternalTab: () => void;
  maxTabs?: number;
  onOpenMobile?: () => void;
  isMobileActive?: boolean;
  onOpenVoice?: () => void;
}

const TabBarComponent: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewExternalTab,
  maxTabs = 5,
  onOpenMobile,
  isMobileActive = false,
  onOpenVoice,
}) => {
  const isMaxReached = tabs.length >= maxTabs;
  const isDesktop = isTauri();
  const [webLaunching, setWebLaunching] = useState(false);
  const [webConnected, setWebConnected] = useState(api.isWebConnected());
  const [restoredNotice, setRestoredNotice] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      const unsub = api.onStatusChange((status) => {
        setWebConnected(status);
      });
      return unsub;
    }
  }, [isDesktop]);

  const handleRestoreApp = async () => {
    await api.restoreDesktopApp();
    setRestoredNotice(true);
    setTimeout(() => setRestoredNotice(false), 2500);
  };

  const handleOpenWeb = async () => {
    if (webLaunching) return;
    setWebLaunching(true);
    try {
      await api.openNookWeb();
    } catch (err) {
      console.error('Failed to open Nook Web:', err);
      alert('Não foi possível iniciar o Nook Web. Verifique se o navegador padrão está disponível.');
    } finally {
      setWebLaunching(false);
    }
  };

  return (
    <div
      style={{
        height: '38px',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '2px',
        userSelect: 'none',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
      }}
    >
      {/* Tabs List */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '100%' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isExternal = tab.type === 'external';

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              title={tab.externalPath ? `${tab.title}\n${tab.externalPath}` : tab.title}
              style={{
                height: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0 8px 0 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-main)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
                border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--bg-main)' : '1px solid transparent',
                boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
                maxWidth: '180px',
                minWidth: '80px',
                transition: 'all var(--transition-fast)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              {/* Tab Icon */}
              {tab.isPinned ? (
                <Pin size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
              ) : isExternal ? (
                <FileCode size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
              ) : (
                <FileText size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
              )}

              {/* Title */}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  fontSize: '12px',
                }}
              >
                {tab.title || 'Sem título'}
              </span>

              {/* Close Button X */}
              <Tooltip content="Fechar aba" position="bottom">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    opacity: isActive ? 0.8 : 0.5,
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.opacity = isActive ? '0.8' : '0.5';
                  }}
                >
                  <X size={11} />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {/* New External Markdown Tab Button (+) */}
      <Tooltip
        content={
          isMaxReached
            ? `Limite máximo de ${maxTabs} abas atingido`
            : 'Abrir arquivo Markdown (.md)'
        }
        shortcut={isMaxReached ? undefined : 'Ctrl+O'}
        position="bottom"
      >
        <button
          onClick={onNewExternalTab}
          disabled={isMaxReached}
          style={{
            width: '26px',
            height: '26px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: 'transparent',
            color: isMaxReached ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: isMaxReached ? 'not-allowed' : 'pointer',
            opacity: isMaxReached ? 0.35 : 0.75,
            marginLeft: '4px',
            transition: 'all var(--transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isMaxReached) {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.opacity = '1';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMaxReached) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.opacity = '0.75';
            }
          }}
        >
          <Plus size={14} />
        </button>
      </Tooltip>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Nook Web Action Button (Desktop) or Sync Pill (Browser) */}
      {isDesktop ? (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          {onOpenMobile && (
            <Tooltip
              content={
                isMobileActive
                  ? 'Nook Mobile ativo (túnel conectado) — Clique para ver QR Code ou gerenciar'
                  : 'Nook Mobile — Acessar suas notas pelo celular via Wi-Fi/5G'
              }
              position="bottom"
            >
              <button
                onClick={onOpenMobile}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isMobileActive ? 'var(--accent-border, rgba(0, 255, 157, 0.35))' : 'var(--border-subtle)'}`,
                  backgroundColor: isMobileActive ? 'var(--accent-muted, rgba(0, 255, 157, 0.08))' : 'transparent',
                  color: isMobileActive ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  marginRight: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isMobileActive
                    ? 'var(--accent-muted, rgba(0, 255, 157, 0.16))'
                    : 'var(--bg-hover)';
                  e.currentTarget.style.color = isMobileActive ? 'var(--accent, #00FF9D)' : 'var(--text-primary)';
                  e.currentTarget.style.borderColor = isMobileActive
                    ? 'var(--accent, #00FF9D)'
                    : 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isMobileActive
                    ? 'var(--accent-muted, rgba(0, 255, 157, 0.08))'
                    : 'transparent';
                  e.currentTarget.style.color = isMobileActive ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = isMobileActive
                    ? 'var(--accent-border, rgba(0, 255, 157, 0.35))'
                    : 'var(--border-subtle)';
                }}
              >
                <Smartphone size={12} style={{ opacity: 0.85 }} />
                <span>Mobile</span>
                {isMobileActive && (
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent, #00FF9D)',
                      boxShadow: '0 0 6px var(--accent, #00FF9D)',
                    }}
                  />
                )}
              </button>
            </Tooltip>
          )}

          {onOpenVoice && (
            <Tooltip content="Criar nova nota por voz (Nook Voice)" position="bottom">
              <button
                onClick={onOpenVoice}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <Mic size={12} style={{ opacity: 0.85 }} />
                <span>Voz</span>
              </button>
            </Tooltip>
          )}

          <Tooltip
            content={webLaunching ? 'Iniciando Nook Web...' : 'Abrir o Nook no seu navegador?'}
            position="bottom"
          >
            <button
              onClick={handleOpenWeb}
              disabled={webLaunching}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: webLaunching ? 'wait' : 'pointer',
                transition: 'all var(--transition-fast)',
                marginRight: '8px',
              }}
              onMouseEnter={(e) => {
                if (!webLaunching) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }
              }}
              onMouseLeave={(e) => {
                if (!webLaunching) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }
              }}
            >
              <Globe size={12} style={{ opacity: 0.85 }} />
              <span>Web</span>
            </button>
          </Tooltip>
        </div>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
          {onOpenVoice && (
            <Tooltip content="Criar nova nota por voz (Nook Voice)" position="bottom">
              <button
                onClick={onOpenVoice}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '24px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <Mic size={12} style={{ opacity: 0.85 }} />
                <span>Voz</span>
              </button>
            </Tooltip>
          )}

          <Tooltip
            content="Restaurar e exibir a janela do Nook Desktop na sua tela"
            position="bottom"
          >
            <button
              onClick={handleRestoreApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: restoredNotice ? 'var(--bg-selected)' : 'rgba(255, 255, 255, 0.04)',
                color: restoredNotice ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-default)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = restoredNotice ? 'var(--bg-selected)' : 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = restoredNotice ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <Monitor size={12} style={{ opacity: 0.85 }} />
              <span>{restoredNotice ? 'App Restaurado!' : 'Voltar ao App'}</span>
            </button>
          </Tooltip>

          <Tooltip
            content={
              webConnected
                ? 'Nook Web conectado e sincronizado em tempo real com seu SQLite local'
                : 'Conexão local perdida. Tentando reconectar com o Nook Desktop...'
            }
            position="bottom"
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '22px',
                padding: '0 8px',
                fontSize: '11px',
                borderRadius: '11px',
                backgroundColor: webConnected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${webConnected ? 'var(--border-subtle)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: webConnected ? 'var(--text-secondary)' : '#F87171',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: webConnected ? 'var(--accent, #00FF9D)' : '#EF4444',
                  boxShadow: webConnected ? '0 0 6px var(--accent, #00FF9D)' : 'none',
                }}
              />
              <span>{webConnected ? 'Conectado ao Desktop' : 'Reconectando...'}</span>
            </div>
          </Tooltip>
        </div>
      )}

      {/* Discrete tab counter / capacity indicator */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          opacity: 0.6,
          paddingRight: '6px',
        }}
      >
        {tabs.length}/{maxTabs} abas
      </div>
    </div>
  );
};

export const TabBar = React.memo(TabBarComponent);
