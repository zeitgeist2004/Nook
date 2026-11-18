import React, { useState } from 'react';
import { Smartphone, Shield, Check, X } from 'lucide-react';
import { PendingPairRequest } from '../../types';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface MobilePairApprovalDialogProps {
  request: PendingPairRequest | null;
  onClose: () => void;
  onApproved?: () => void;
}

export const MobilePairApprovalDialog: React.FC<MobilePairApprovalDialogProps> = ({
  request,
  onClose,
  onApproved,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDialogA11y({ isOpen: !!request, onClose });

  if (!request) return null;

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.approveMobilePairing(request.request_id);
      onApproved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to approve mobile pairing:', err);
      setError(err?.message || t.mobile.approvalError);
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.rejectMobilePairing(request.request_id);
    } catch (err) {
      console.error('Failed to reject mobile pairing:', err);
    } finally {
      onClose();
    }
  };

  const isApple = /iPhone|iPad|Macintosh/i.test(request.user_agent);
  const isAndroid = /Android/i.test(request.user_agent);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.mobile.approvalTitle}
        style={{
          width: 'min(94vw, 440px)',
          maxHeight: 'min(90dvh, var(--nook-viewport-height, 90dvh))',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-elevated, #1A1C22)',
          border: '1px solid var(--border-color, #2D3039)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60A5FA',
              flexShrink: 0,
            }}
          >
            <Smartphone size={22} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary, #FFFFFF)',
                letterSpacing: '-0.01em',
              }}
            >
              {t.mobile.approvalTitle}
            </h3>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '12px',
                color: 'var(--text-secondary, #9CA3AF)',
              }}
            >
              {t.mobile.approvalSubtitle}
            </p>
          </div>
        </div>

        {/* Device Information Card */}
        <div style={{ padding: '20px 24px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-main, #121316)',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #6B7280)' }}>
                {t.mobile.approvalDevice}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #FFFFFF)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {request.device_name || (isApple ? 'Apple iPhone' : isAndroid ? 'Android' : t.mobile.pairingDefaultDevice)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #6B7280)' }}>
                {t.mobile.approvalBrowser}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary, #D1D5DB)',
                  maxWidth: '220px',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={request.user_agent}
              >
                {request.user_agent ? request.user_agent.split(' ')[0] : t.mobile.pairingWebBrowser}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #6B7280)' }}>
                {t.mobile.approvalPairCode}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                {request.pair_code}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            <Shield size={16} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: 'var(--text-secondary, #D1D5DB)' }}>
              {t.mobile.approvalWarning}
            </p>
          </div>

          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '14px 20px 18px',
            backgroundColor: 'var(--bg-main, #121316)',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button
            onClick={handleReject}
            disabled={loading}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary, #9CA3AF)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'var(--text-primary, #FFFFFF)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary, #9CA3AF)';
            }}
          >
            <X size={15} />
            <span>{t.mobile.approvalReject}</span>
          </button>

          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              height: '36px',
              padding: '0 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10B981';
            }}
          >
            <Check size={16} />
            <span>{loading ? t.mobile.approvalAuthorizing : t.mobile.approvalAllowConnection}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
