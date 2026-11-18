import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Type,
  Sliders,
  Database,
  Download,
  Upload,
  Check,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Copy,
  Power,
  Trash2,
} from 'lucide-react';
import { open as openFileDialog, save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { AppSettings, AutoBackupInfo, AuthorizedDevice, MobileAccessInfo } from '../../types';
import { api, isTauri } from '../../services/api';
import { QRCodeSvg } from '../mobile/QRCodeSvg';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportLibrary: () => void;
  onBackupSuccess: () => void;
  isMobile?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportLibrary,
  onBackupSuccess,
  isMobile = false,
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'editor' | 'general' | 'data' | 'mobile'>('appearance');
  const [dbPath, setDbPath] = useState<string>('Carregando...');
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupInfo[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Mobile Access State inside Settings
  const [mobileInfo, setMobileInfo] = useState<MobileAccessInfo | null>(null);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadMobileStatus = async () => {
    try {
      const status = await api.getMobileStatus();
      setMobileInfo(status);
    } catch (e) {
      console.warn('Could not load mobile status:', e);
    }
  };

  const loadBackups = async () => {
    try {
      const list = await api.listAutoBackups();
      setAutoBackups(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      api.getDatabasePath().then(setDbPath).catch(() => setDbPath('sqlite local'));
      setDataMessage(null);
      loadBackups();
      loadMobileStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fontOptions = [
    { label: 'Inter (Recomendada)', value: "'Inter', sans-serif" },
    { label: 'Segoe UI Variable (Windows 11)', value: "'Segoe UI Variable', 'Segoe UI', sans-serif" },
    { label: 'JetBrains Mono (Monospace)', value: "'JetBrains Mono', monospace" },
    { label: 'Consolas (Monospace Clássica)', value: "Consolas, 'Courier New', monospace" },
  ];

  const handleBackupExport = async () => {
    if (!isTauri()) {
      setDataMessage('Exportação de backup JSON disponível apenas no aplicativo Desktop.');
      return;
    }
    try {
      const defaultName = `nook_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const selectedPath = await saveFileDialog({
        title: 'Salvar Backup do Nook (.json)',
        defaultPath: defaultName,
        filters: [{ name: 'Backup Nook JSON', extensions: ['json'] }],
      });
      if (!selectedPath) return;

      await api.exportBackupJson(selectedPath);
      setDataMessage(`Backup salvo com sucesso em ${selectedPath}!`);
    } catch (err: any) {
      setDataMessage(`Erro ao exportar backup: ${err?.toString()}`);
    }
  };

  const handleBackupImport = async () => {
    if (!isTauri()) {
      setDataMessage('Restauração de backup JSON disponível apenas no aplicativo Desktop.');
      return;
    }
    try {
      const selected = await openFileDialog({
        title: 'Selecionar Backup do Nook (.json)',
        multiple: false,
        filters: [{ name: 'Backup Nook JSON', extensions: ['json'] }],
      });
      if (!selected || typeof selected !== 'string') return;
      if (!window.confirm('Restaurar este backup substituirá todas as notas e pastas atuais. Continuar?')) {
        return;
      }

      const msg = await api.importBackupJson(selected);
      await loadBackups();
      onBackupSuccess();
      setDataMessage(msg);
    } catch (err: any) {
      setDataMessage(`Erro ao restaurar backup: ${err?.toString()}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? 'min(96vw, 680px)' : '680px',
          height: isMobile ? 'min(92vh, 620px)' : '520px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
        }}
        className="animate-modal-pop"
      >
        {/* Left Tabs Sidebar / Top Bar on Mobile */}
        <div
          style={{
            width: isMobile ? '100%' : '180px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
            borderBottom: isMobile ? '1px solid var(--border-color)' : 'none',
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            overflowX: isMobile ? 'auto' : 'visible',
            padding: isMobile ? '8px 12px' : '16px 8px',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          {!isMobile && (
            <div
              style={{
                padding: '6px 12px 14px 12px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Configurações
            </div>
          )}

          <button
            onClick={() => setActiveTab('appearance')}
            className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
          >
            <Palette size={15} />
            <span>Aparência</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          >
            <Type size={15} />
            <span>Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          >
            <Sliders size={15} />
            <span>Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
          >
            <Database size={15} />
            <span>Dados & Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile')}
            className={`tab-btn ${activeTab === 'mobile' ? 'active' : ''}`}
          >
            <Smartphone size={15} />
            <span>Nook Mobile</span>
            {mobileInfo?.active && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent, #00FF9D)',
                  marginLeft: 'auto',
                }}
              />
            )}
          </button>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/brand/nook-mark.svg" alt="Nook" style={{ width: '16px', height: '16px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nook v1.0 • Offline</span>
          </div>
        </div>

        {/* Right Content Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          {/* Top Bar with Close button */}
          <div
            style={{
              height: '44px',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {activeTab === 'appearance' && 'Personalização Visual'}
              {activeTab === 'editor' && 'Preferências de Escrita'}
              {activeTab === 'general' && 'Comportamento do Aplicativo'}
              {activeTab === 'data' && 'Armazenamento e Portabilidade'}
            </span>
            <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
              <X size={16} />
            </button>
          </div>

          {/* Tab Panes */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* APARÊNCIA */}
            {activeTab === 'appearance' && (
              <div>
                <label className="setting-label">Tema Visual</label>
                <p className="setting-desc">Selecione o esquema de cores oficial do Nook.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginTop: '12px' }}>
                  {[
                    {
                      id: 'gray',
                      label: 'Cinza',
                      bg: '#1E1F24',
                      accent: '#ECECEC',
                      border: '#33363F',
                    },
                    {
                      id: 'dark',
                      label: 'Escuro',
                      bg: '#0D0E11',
                      accent: '#FFFFFF',
                      border: '#22252D',
                    },
                    {
                      id: 'white',
                      label: 'Claro',
                      bg: '#FFFFFF',
                      accent: '#18181B',
                      border: '#E4E5E9',
                    },
                    {
                      id: 'neon',
                      label: 'Neon',
                      bg: '#050505',
                      accent: '#00FF9D',
                      secondary: '#FFFFFF',
                      border: '#1A1A1A',
                    },
                    {
                      id: 'sakura',
                      label: 'Sakura',
                      bg: '#151115',
                      accent: '#F472B6',
                      border: '#2C212D',
                    },
                  ].map((t) => {
                    const isSelected =
                      settings.theme === t.id ||
                      (t.id === 'sakura' && (settings.theme as string) === 'pink') ||
                      (t.id === 'dark' && (settings.theme as string) === 'oled') ||
                      (t.id === 'white' && (settings.theme as string) === 'light');
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onUpdateSettings({ theme: t.id as any })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                          backgroundColor: isSelected ? 'var(--accent-muted)' : 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.bg, border: '1px solid rgba(128, 128, 128, 0.4)' }} />
                            {t.id === 'neon' ? (
                              <>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.4)' }} />
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.accent, boxShadow: isSelected ? `0 0 6px ${t.accent}` : 'none' }} />
                              </>
                            ) : (
                              <>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.accent, boxShadow: isSelected ? `0 0 6px ${t.accent}` : 'none' }} />
                                {(t as any).secondary && (
                                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: (t as any).secondary, boxShadow: isSelected ? `0 0 6px ${(t as any).secondary}` : 'none' }} />
                                )}
                              </>
                            )}
                          </div>
                          {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EDITOR */}
            {activeTab === 'editor' && (
              <>
                <div>
                  <label className="setting-label">Tipografia do Editor</label>
                  <select
                    value={settings.editorFont}
                    onChange={(e) => onUpdateSettings({ editorFont: e.target.value })}
                    className="select-input"
                  >
                    {fontOptions.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="setting-label">
                    Tamanho da Fonte: {settings.editorFontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="22"
                    step="1"
                    value={settings.editorFontSize}
                    onChange={(e) => onUpdateSettings({ editorFontSize: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', marginTop: '6px', accentColor: 'var(--accent)' }}
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">Quebra Automática de Linha</label>
                    <p className="setting-desc">Ajusta o texto continuamente à largura da janela.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lineWrapping}
                    onChange={(e) => onUpdateSettings({ lineWrapping: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">Exibir Números de Linha</label>
                    <p className="setting-desc">Desativado por padrão para preservar o visual de bloco de notas.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showLineNumbers}
                    onChange={(e) => onUpdateSettings({ showLineNumbers: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>
              </>
            )}

            {/* GERAL */}
            {activeTab === 'general' && (
              <>
                <div className="toggle-row">
                  <div>
                    <label className="setting-label">Restaurar Última Nota Aberta</label>
                    <p className="setting-desc">Reabre automaticamente a nota em que você estava trabalhando.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.restoreLastNote}
                    onChange={(e) => onUpdateSettings({ restoreLastNote: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <label className="setting-label">Confirmar Exclusão Permanente</label>
                    <p className="setting-desc">Exige confirmação antes de apagar itens definitivamente da lixeira.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmPermanentDelete}
                    onChange={(e) => onUpdateSettings({ confirmPermanentDelete: e.target.checked })}
                    className="toggle-checkbox"
                  />
                </div>

                <div>
                  <label className="setting-label">Atalho Global do Windows</label>
                  <p className="setting-desc">
                    Pressione <strong>Ctrl + Alt + N</strong> em qualquer lugar do Windows para abrir o Nook e criar uma nova nota rápida.
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <img
                    src="/brand/nook-mark.svg"
                    alt="Nook"
                    style={{ width: '38px', height: '38px', objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Nook v1.0
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Editor de notas e base de conhecimento minimalista, rápido e 100% offline.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* DADOS */}
            {activeTab === 'data' && (
              <>
                <div>
                  <label className="setting-label">Banco de Dados SQLite Local</label>
                  <p className="setting-desc">Seus dados residem integralmente neste computador, sem nuvem ou telemetria.</p>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all',
                      marginTop: '6px',
                    }}
                  >
                    {dbPath}
                  </div>
                </div>

                {/* Backups Automáticos */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div>
                      <label className="setting-label">Backups Locais Automáticos</label>
                      <p className="setting-desc">Cópias diárias com histórico de 7 dias salvas com segurança no seu computador.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!isTauri()) {
                          setDataMessage('Backups locais disponíveis apenas no aplicativo Desktop.');
                          return;
                        }
                        setIsBackingUp(true);
                        try {
                          const created = await api.triggerAutoBackup(true);
                          await loadBackups();
                          setDataMessage(
                            created
                              ? `Backup diário salvo: ${created.filename}`
                              : 'Cópia local atualizada com sucesso!'
                          );
                        } catch (err: any) {
                          setDataMessage(`Erro no backup: ${err?.toString()}`);
                        } finally {
                          setIsBackingUp(false);
                        }
                      }}
                      disabled={isBackingUp}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        cursor: isBackingUp ? 'default' : 'pointer',
                        opacity: isBackingUp ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw size={13} className={isBackingUp ? 'animate-spin' : ''} />
                      <span>{isBackingUp ? 'Salvando...' : 'Fazer Backup Agora'}</span>
                    </button>
                  </div>

                  {autoBackups.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        marginTop: '8px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px',
                        backgroundColor: 'var(--bg-main)',
                      }}
                    >
                      {autoBackups.map((b) => (
                        <div
                          key={b.filename}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            fontSize: '12px',
                            borderRadius: 'var(--radius-xs, 4px)',
                            backgroundColor: 'var(--bg-elevated)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                              {b.filename}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {(b.size_bytes / 1024).toFixed(1)} KB
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {b.created_at
                                ? new Date(b.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                      Nenhum backup automático recente encontrado.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={onExportLibrary}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                  >
                    <Download size={16} />
                    <span>Exportar Biblioteca Completa (Pastas & Arquivos .md)</span>
                  </button>

                  <button
                    onClick={handleBackupExport}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                  >
                    <Download size={16} />
                    <span>Criar Backup Consistente (.json)</span>
                  </button>

                  {isTauri() && (
                    <button
                      onClick={handleBackupImport}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-main)')}
                    >
                      <Upload size={16} />
                      <span>Restaurar Backup (.json)</span>
                    </button>
                  )}
                </div>

                {dataMessage && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-muted)',
                      color: 'var(--accent)',
                      fontSize: '12px',
                    }}
                  >
                    {dataMessage}
                  </div>
                )}
              </>
            )}

            {/* TAB: NOOK MOBILE */}
            {activeTab === 'mobile' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label className="setting-label">Acesso Remoto Nook Mobile</label>
                    <span className="setting-desc">
                      Conecte seu celular ao Nook via túnel Cloudflare seguro (Wi-Fi e 5G)
                    </span>
                  </div>

                  {isTauri() && (
                    <button
                      onClick={async () => {
                        setMobileLoading(true);
                        try {
                          if (mobileInfo?.active) {
                            await api.stopMobileAccess();
                          } else {
                            await api.startMobileAccess();
                          }
                          await loadMobileStatus();
                        } catch (err: any) {
                          setDataMessage(`Erro: ${err?.message || err}`);
                        } finally {
                          setMobileLoading(false);
                        }
                      }}
                      disabled={mobileLoading}
                      style={{
                        height: '32px',
                        padding: '0 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: mobileInfo?.active ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent, #00FF9D)',
                        color: mobileInfo?.active ? '#EF4444' : 'var(--bg-main, #000000)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: mobileLoading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Power size={13} />
                      <span>
                        {mobileLoading
                          ? 'Aguarde...'
                          : mobileInfo?.active
                          ? 'Desativar Acesso'
                          : 'Ativar Acesso'}
                      </span>
                    </button>
                  )}
                </div>

                {mobileInfo?.active ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '20px',
                        padding: '16px',
                        backgroundColor: 'var(--bg-main)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        alignItems: 'center',
                      }}
                    >
                      <QRCodeSvg
                        value={mobileInfo?.qr_payload || mobileInfo?.url || ''}
                        size={140}
                      />

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent, #00FF9D)' }}>
                            TÚNEL ATIVO E SEGURO
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Escaneie o QR Code no seu celular
                          </div>
                        </div>

                        {mobileInfo?.pair_code && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Código:</span>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '14px',
                                color: 'var(--accent, #00FF9D)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              {mobileInfo.pair_code}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            if (mobileInfo?.qr_payload || mobileInfo?.url) {
                              navigator.clipboard.writeText(mobileInfo.qr_payload || mobileInfo.url || '');
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            height: '28px',
                            padding: '0 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'transparent',
                            color: copiedLink ? 'var(--accent, #00FF9D)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '8px',
                        }}
                      >
                        Dispositivos Autorizados ({mobileInfo?.authorized_devices?.length || 0})
                      </div>

                      {mobileInfo?.authorized_devices && mobileInfo.authorized_devices.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {mobileInfo.authorized_devices.map((device: AuthorizedDevice) => (
                            <div
                              key={device.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-main)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {device.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {device.is_revoked ? 'Acesso Revogado' : 'Autorizado'}
                                </div>
                              </div>

                              {!device.is_revoked ? (
                                <button
                                  onClick={async () => {
                                    await api.revokeMobileDevice(device.id);
                                    await loadMobileStatus();
                                  }}
                                  style={{
                                    height: '24px',
                                    padding: '0 8px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    backgroundColor: 'transparent',
                                    color: '#EF4444',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Revogar
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    await api.deleteMobileDevice(device.id);
                                    await loadMobileStatus();
                                  }}
                                  style={{
                                    height: '24px',
                                    width: '24px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Remover histórico"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Nenhum dispositivo conectado ainda.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px',
                      backgroundColor: 'var(--bg-main)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                      textAlign: 'center',
                      marginTop: '12px',
                    }}
                  >
                    <Smartphone size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      O acesso mobile está desativado
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Clique em "Ativar Acesso" para criar um túnel Cloudflare seguro e exibir o QR Code.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--text-secondary);
          width: 100%;
          text-align: left;
        }
        .tab-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }
        .tab-btn.active {
          background-color: var(--bg-selected);
          color: var(--accent);
          font-weight: 500;
        }
        .setting-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .setting-desc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .select-input {
          width: 100%;
          padding: 8px 10px;
          margin-top: 6px;
          background-color: var(--bg-main);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .toggle-checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--accent);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
