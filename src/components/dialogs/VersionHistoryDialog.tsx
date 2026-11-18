import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, Clock, Plus, Check } from 'lucide-react';
import { Note, NoteVersion } from '../../types';
import { api } from '../../services/api';

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
  currentTitle: string;
  currentContent: string;
  onVersionRestored: (restoredNote: Note) => void;
}

export const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({
  isOpen,
  onClose,
  noteId,
  currentTitle,
  currentContent,
  onVersionRestored,
}) => {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [saveVersionFeedback, setSaveVersionFeedback] = useState(false);

  useEffect(() => {
    if (!isOpen || !noteId) return;

    let isMounted = true;
    setIsLoading(true);

    api.getNoteVersions(noteId)
      .then((vers) => {
        if (!isMounted) return;
        setVersions(vers);
        if (vers.length > 0) {
          setSelectedVersionId(vers[0].id);
        } else {
          setSelectedVersionId(null);
        }
      })
      .catch((err) => {
        console.error('Failed to load note versions:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, noteId]);

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

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const handleSaveCurrentVersion = async () => {
    if (!noteId) return;
    try {
      const created = await api.createNoteVersion(noteId, currentTitle, currentContent);
      setVersions((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
      setSelectedVersionId(created.id);
      setSaveVersionFeedback(true);
      setTimeout(() => setSaveVersionFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to save current version:', err);
    }
  };

  const handleRestore = async () => {
    if (!noteId || !selectedVersionId) return;
    setIsRestoring(true);
    try {
      const restored = await api.restoreNoteVersion(noteId, selectedVersionId);
      if (restored) {
        onVersionRestored(restored);
        onClose();
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn var(--transition-fast) ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '840px',
          maxWidth: '95vw',
          height: '560px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.55)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            height: '52px',
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Versões Anteriores
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Volte para qualquer versão salva desta nota sempre que precisar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSaveCurrentVersion}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Guardar uma cópia da versão atual da nota"
            >
              {saveVersionFeedback ? <Check size={14} style={{ color: 'var(--text-primary)' }} /> : <Plus size={14} />}
              {saveVersionFeedback ? 'Versão Salva!' : 'Salvar Versão Atual'}
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar list + Main Preview */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Versions List */}
          <div
            style={{
              width: '260px',
              borderRight: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-sidebar)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              VERSÕES SALVAS ({versions.length})
            </div>

            {isLoading && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                Carregando versões...
              </div>
            )}

            {!isLoading && versions.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Clock size={28} style={{ opacity: 0.45, margin: '0 auto 6px auto', display: 'block' }} />
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Nenhuma versão anterior</span>
                <span style={{ lineHeight: 1.4 }}>O Nook guarda cópias automáticas a cada 5 minutos de escrita para você nunca perder nada.</span>
              </div>
            )}

            {!isLoading &&
              versions.map((v, idx) => {
                const isSelected = v.id === selectedVersionId;
                const isLatest = idx === 0;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersionId(v.id)}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {formatTimestamp(v.created_at)}
                      </span>
                      {isLatest && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-main)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Mais recente
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.title || 'Sem título'} • {v.content.length} caracteres
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Version Preview Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-main)',
              overflow: 'hidden',
            }}
          >
            {selectedVersion ? (
              <>
                <div
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedVersion.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Salva em {formatTimestamp(selectedVersion.created_at)}
                    </div>
                  </div>

                  <button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isRestoring ? 'not-allowed' : 'pointer',
                      opacity: isRestoring ? 0.7 : 1,
                    }}
                  >
                    <RotateCcw size={13} />
                    {isRestoring ? 'Restaurando...' : 'Restaurar esta versão'}
                  </button>
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: '20px 24px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedVersion.content || <em style={{ color: 'var(--text-muted)' }}>Nota vazia nesta versão</em>}
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                Selecione uma versão na lista ao lado para ver o texto salvo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
