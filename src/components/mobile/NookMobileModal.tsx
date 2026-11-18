import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Smartphone,
  ShieldCheck,
  Copy,
  Check,
  Power,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { AuthorizedDevice, MobileAccessInfo } from '../../types';
import { api } from '../../services/api';
import { QRCodeSvg } from './QRCodeSvg';

interface NookMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NookMobileModal: React.FC<NookMobileModalProps> = ({ isOpen, onClose }) => {
  const [mobileInfo, setMobileInfo] = useState<MobileAccessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await api.getMobileStatus();
      setMobileInfo(status);
    } catch (err: any) {
      console.error('Failed to get mobile status:', err);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    loadStatus();
    setActionError(null);

    let isCancelled = false;
    let unlistenUpdated: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        if (isCancelled) return;
        listen<MobileAccessInfo>('mobile-access-updated', (event) => {
          if (!isCancelled && event.payload) {
            setMobileInfo(event.payload);
          }
        }).then((un) => {
          if (isCancelled) un();
          else unlistenUpdated = un;
        });

        listen<any>('mobile-tunnel-status', (event) => {
          if (!isCancelled && event.payload) {
            if (event.payload.error) {
              setActionError(event.payload.error);
            }
            loadStatus();
          }
        }).then((un) => {
          if (isCancelled) un();
          else unlistenStatus = un;
        });
      });
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('keydown', handleKeyDown);
      if (unlistenUpdated) unlistenUpdated();
      if (unlistenStatus) unlistenStatus();
    };
  }, [isOpen, loadStatus, onClose]);

  if (!isOpen) return null;

  const handleStart = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const info = await api.startMobileAccess();
      setMobileInfo(info);
    } catch (err: any) {
      console.error('Failed to start mobile access:', err);
      setActionError(err?.message || 'Falha ao iniciar o túnel Cloudflare');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setActionError(null);
    try {
      await api.stopMobileAccess();
      await loadStatus();
    } catch (err: any) {
      console.error('Failed to stop mobile access:', err);
      setActionError(err?.message || 'Falha ao desativar o túnel');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    setActionError(null);
    try {
      await api.stopMobileAccess();
      const info = await api.startMobileAccess();
      setMobileInfo(info);
    } catch (err: any) {
      console.error('Failed to restart mobile access:', err);
      setActionError(err?.message || 'Falha ao reiniciar o túnel Cloudflare');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!mobileInfo?.qr_payload && !mobileInfo?.url) return;
    const link = mobileInfo.qr_payload || mobileInfo.url || '';
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!mobileInfo?.pair_code) return;
    navigator.clipboard.writeText(mobileInfo.pair_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      await api.revokeMobileDevice(deviceId);
      await loadStatus();
    } catch (err: any) {
      console.error('Failed to revoke device:', err);
      setActionError(err?.message || 'Erro ao revogar dispositivo');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await api.deleteMobileDevice(deviceId);
      await loadStatus();
    } catch (err: any) {
      console.error('Failed to delete device:', err);
      setActionError(err?.message || 'Erro ao remover dispositivo');
    }
  };

  const formatTimestamp = (ts: number) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const isActive = mobileInfo?.active && !!mobileInfo?.url;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-elevated, #1A1C22)',
          border: '1px solid var(--border-color, #2D3039)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? '#10B981' : 'var(--text-secondary, #9CA3AF)',
                transition: 'all 0.2s ease',
              }}
            >
              <Smartphone size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #FFFFFF)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Nook Mobile
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#10B981' : 'var(--text-muted, #6B7280)',
                    border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.25)' : 'transparent'}`,
                  }}
                >
                  {isActive ? 'Túnel Ativo' : 'Desconectado'}
                </span>
              </div>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-secondary, #9CA3AF)',
                }}
              >
                Acesse e edite suas notas pelo celular com túnel seguro Cloudflare
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #6B7280)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = 'var(--text-primary, #FFFFFF)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted, #6B7280)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {actionError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#EF4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{actionError}</span>
            </div>
          )}

          {!isActive ? (
            /* Inactive State: Onboarding & Start CTA */
            <div
              style={{
                backgroundColor: 'var(--bg-main, #121316)',
                borderRadius: '14px',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                padding: '28px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary, #FFFFFF)',
                }}
              >
                <Smartphone size={28} />
              </div>

              <div>
                <h3
                  style={{
                    margin: '0 0 6px',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #FFFFFF)',
                  }}
                >
                  Suas anotações no seu bolso
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--text-secondary, #9CA3AF)',
                    maxWidth: '460px',
                  }}
                >
                  Conecte seu celular diretamente a este computador usando a rede global da Cloudflare. Sem
                  abertura de portas, sem contas e com criptografia de ponta a ponta.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  width: '100%',
                  marginTop: '6px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #9CA3AF)',
                  }}
                >
                  <strong style={{ display: 'block', color: 'var(--text-primary, #FFF)', marginBottom: '4px' }}>
                    Wi-Fi & 5G
                  </strong>
                  Funciona em qualquer rede externa
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #9CA3AF)',
                  }}
                >
                  <strong style={{ display: 'block', color: 'var(--text-primary, #FFF)', marginBottom: '4px' }}>
                    100% Privado
                  </strong>
                  Seus dados não saem do seu PC
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.04))',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #9CA3AF)',
                  }}
                >
                  <strong style={{ display: 'block', color: 'var(--text-primary, #FFF)', marginBottom: '4px' }}>
                    Pareamento 2FA
                  </strong>
                  Apenas celulares aprovados
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={loading}
                style={{
                  marginTop: '10px',
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#10B981';
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Iniciando túnel seguro Cloudflare...</span>
                  </>
                ) : (
                  <>
                    <Power size={16} />
                    <span>Ativar Nook Mobile</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Active State: QR Code & Pairing Info */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '24px',
                  backgroundColor: 'var(--bg-main, #121316)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  padding: '24px',
                  alignItems: 'center',
                }}
              >
                {/* QR Code */}
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <QRCodeSvg value={mobileInfo?.qr_payload || mobileInfo?.url || ''} size={180} />
                  <span
                    style={{
                      display: 'block',
                      marginTop: '8px',
                      fontSize: '11px',
                      color: 'var(--text-muted, #6B7280)',
                    }}
                  >
                    Escaneie com a câmera
                  </span>
                </div>

                {/* Info & Copy Actions */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Conexão Pronta
                    </span>
                    <h4
                      style={{
                        margin: '2px 0 0',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #FFFFFF)',
                      }}
                    >
                      Aponte a câmera do seu celular
                    </h4>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '12px',
                        lineHeight: 1.45,
                        color: 'var(--text-secondary, #9CA3AF)',
                      }}
                    >
                      O link contém um código único de autorização válido por 5 minutos.
                    </p>
                  </div>

                  {mobileInfo?.pair_code && (
                    <div
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #6B7280)' }}>
                          Código de Pareamento
                        </div>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '16px',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: '#10B981',
                          }}
                        >
                          {mobileInfo.pair_code}
                        </div>
                      </div>

                      <button
                        onClick={handleCopyCode}
                        style={{
                          height: '30px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                          backgroundColor: 'transparent',
                          color: copiedCode ? '#10B981' : 'var(--text-secondary, #9CA3AF)',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCopyLink}
                      style={{
                        flex: 1,
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: copiedLink ? '#10B981' : 'var(--text-primary, #FFFFFF)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link Completo'}</span>
                    </button>

                    <button
                      onClick={handleRestart}
                      disabled={loading}
                      title="Gerar novo link seguro do Cloudflare Tunnel"
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-secondary, #9CA3AF)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: loading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      <span>{loading ? 'Reiniciando...' : 'Novo Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Authorized Devices Section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #FFFFFF)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Dispositivos Autorizados ({mobileInfo?.authorized_devices?.length || 0})
                  </h4>

                  <button
                    onClick={loadStatus}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #6B7280)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RefreshCw size={11} />
                    <span>Atualizar</span>
                  </button>
                </div>

                {mobileInfo?.authorized_devices && mobileInfo.authorized_devices.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {mobileInfo.authorized_devices.map((device: AuthorizedDevice) => (
                      <div
                        key={device.id}
                        style={{
                          backgroundColor: 'var(--bg-main, #121316)',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: device.is_revoked
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(16, 185, 129, 0.1)',
                              color: device.is_revoked ? '#EF4444' : '#10B981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Smartphone size={16} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: 'var(--text-primary, #FFFFFF)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {device.name}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted, #6B7280)',
                              }}
                            >
                              {device.is_revoked ? (
                                <span style={{ color: '#EF4444' }}>Acesso Revogado</span>
                              ) : (
                                <span>Conectado em {formatTimestamp(device.created_at)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!device.is_revoked ? (
                            <button
                              onClick={() => handleRevokeDevice(device.id)}
                              style={{
                                height: '28px',
                                padding: '0 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                color: '#EF4444',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                              }}
                            >
                              Revogar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteDevice(device.id)}
                              style={{
                                height: '28px',
                                width: '28px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                backgroundColor: 'transparent',
                                color: 'var(--text-muted, #6B7280)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Remover histórico deste dispositivo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border-subtle, rgba(255,255,255,0.06))',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: 'var(--text-muted, #6B7280)',
                    }}
                  >
                    Nenhum celular conectado ainda. Escaneie o QR Code acima para parear.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            backgroundColor: 'var(--bg-main, #121316)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: '#10B981' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary, #9CA3AF)' }}>
              Acesso restrito à sua chave local no Windows
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isActive && (
              <button
                onClick={handleStop}
                disabled={loading}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#EF4444',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Power size={13} />
                <span>Desativar Túnel</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary, #FFFFFF)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
