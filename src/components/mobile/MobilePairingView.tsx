import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Shield, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { NookIdleMascot } from '../mascot/NookMascot';

interface MobilePairingViewProps {
  pairCode: string;
  onPairSuccess: () => void;
}

export const MobilePairingView: React.FC<MobilePairingViewProps> = ({
  pairCode,
  onPairSuccess,
}) => {
  const [status, setStatus] = useState<'requesting' | 'waiting_desktop' | 'approved' | 'rejected' | 'error'>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  const getDeviceName = () => {
    if (typeof navigator === 'undefined') return 'Dispositivo Móvel';
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';
    if (/Android/i.test(ua)) {
      const match = ua.match(/Android[^;]+;\s*([^;)]+)/);
      if (match && match[1]) {
        return match[1].replace(/Build\/.*/, '').trim();
      }
      return 'Smartphone Android';
    }
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Computador Windows';
    return 'Navegador Web';
  };

  const startPairing = async () => {
    setStatus('requesting');
    setErrorMessage(null);

    try {
      const deviceName = getDeviceName();
      const res = await api.requestMobilePairing(pairCode, deviceName);
      if (res && res.request_id) {
        setRequestId(res.request_id);
        setStatus('waiting_desktop');
      } else {
        setStatus('error');
        setErrorMessage('Não foi possível registrar solicitação de pareamento.');
      }
    } catch (err: any) {
      console.error('Pairing request error:', err);
      setStatus('error');
      setErrorMessage(
        err?.message?.includes('400')
          ? 'Código de pareamento inválido ou expirado.'
          : 'Erro ao conectar ao Nook Desktop. Verifique se o aplicativo está aberto no PC.'
      );
    }
  };

  useEffect(() => {
    if (pairCode) {
      startPairing();
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pairCode]);

  useEffect(() => {
    if (status !== 'waiting_desktop' || !requestId) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const poll = await api.pollMobilePairing(requestId);
        if (poll.approved) {
          clearInterval(pollTimerRef.current);
          setStatus('approved');
          // Clean URL params
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            const cleanUrl = window.location.pathname + '?mobile=true';
            window.history.replaceState({}, '', cleanUrl);
          }
          setTimeout(() => {
            onPairSuccess();
          }, 1200);
        } else if (poll.error) {
          clearInterval(pollTimerRef.current);
          setStatus('rejected');
          setErrorMessage(poll.error);
        }
      } catch (err: any) {
        console.warn('Poll error:', err);
      }
    }, 1800);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [status, requestId, onPairSuccess]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: 'var(--bg-main, #0D0E11)',
        color: 'var(--text-primary, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        {/* Mascot */}
        <div style={{ transform: 'scale(1.1)', marginBottom: '8px' }}>
          <NookIdleMascot size={88} />
        </div>

        {/* Title & Status */}
        <div>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Nook Mobile
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-secondary, #9CA3AF)',
              lineHeight: 1.45,
            }}
          >
            {status === 'approved'
              ? 'Conexão autorizada com sucesso!'
              : status === 'waiting_desktop'
              ? 'Confirme a solicitação no seu computador.'
              : status === 'rejected'
              ? 'Pareamento não autorizado.'
              : 'Conectando ao Nook Desktop...'}
          </p>
        </div>

        {/* Status Card */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-elevated, #18191E)',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            padding: '20px 16px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {status === 'waiting_desktop' && (
            <>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60A5FA',
                  position: 'relative',
                }}
              >
                <Smartphone size={22} />
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    border: '2px solid #18191E',
                    animation: 'pulse 2s infinite',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Aguardando Aprovação</div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted, #9CA3AF)',
                    marginTop: '4px',
                    lineHeight: 1.4,
                  }}
                >
                  Um aviso apareceu na tela do seu computador. Clique em <strong>Permitir Conexão</strong> para autorizar este smartphone.
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'var(--text-muted, #6B7280)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                }}
              >
                <Shield size={12} style={{ color: '#10B981' }} />
                <span>Criptografia de Ponta a Ponta</span>
              </div>
            </>
          )}

          {status === 'approved' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={44} style={{ color: '#10B981' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#10B981' }}>
                Dispositivo Pareado!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #9CA3AF)' }}>
                Carregando suas anotações...
              </div>
            </div>
          )}

          {status === 'rejected' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={44} style={{ color: '#EF4444' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444' }}>
                Solicitação Recusada
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #9CA3AF)' }}>
                {errorMessage || 'A conexão foi rejeitada no computador ou o código expirou.'}
              </div>
              <button
                onClick={startPairing}
                style={{
                  marginTop: '8px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} />
                <span>Tentar Novamente</span>
              </button>
            </div>
          )}

          {status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={44} style={{ color: '#EF4444' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444' }}>
                Erro de Conexão
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #9CA3AF)' }}>
                {errorMessage}
              </div>
              <button
                onClick={startPairing}
                style={{
                  marginTop: '8px',
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} />
                <span>Tentar Novamente</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
