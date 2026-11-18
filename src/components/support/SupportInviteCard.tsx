import React, { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface SupportInviteCardProps {
  isOpen: boolean;
  onSupport: () => void;
  onDismissLater: () => void;
  onDismissNever: () => void;
  onAlreadySupported: () => void;
}

const EXIT_ANIMATION_MS = 210;

export const SupportInviteCard: React.FC<SupportInviteCardProps> = ({
  isOpen,
  onSupport,
  onDismissLater,
  onDismissNever,
  onAlreadySupported,
}) => {
  const { t } = useTranslation();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animState, setAnimState] = useState<'entering' | 'exiting'>(
    isOpen ? 'entering' : 'exiting'
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setAnimState('entering');
      return;
    }

    if (!shouldRender) return;

    setAnimState('exiting');
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const timer = window.setTimeout(
      () => setShouldRender(false),
      prefersReduced ? 95 : EXIT_ANIMATION_MS
    );
    return () => window.clearTimeout(timer);
  }, [isOpen, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const isExiting = animState === 'exiting';

  return (
    <aside
      className="nook-support-invite-card"
      data-state={animState}
      aria-label={t.support.inviteTitle}
      role="region"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isExiting) {
          e.stopPropagation();
          onDismissLater();
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}
      >
        {/* Subtle Nook mascot with single entrance blink */}
        <div
          aria-hidden="true"
          style={{
            width: '30px',
            height: '30px',
            flexShrink: 0,
            position: 'relative',
            marginTop: '1px',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <img
            src="/brand/mascot/nook-idle-open.png"
            alt=""
            className="nook-support-invite-mascot-open"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              position: 'absolute',
              inset: 0,
            }}
          />
          <img
            src="/brand/mascot/nook-idle-blink.png"
            alt=""
            className="nook-support-invite-mascot-blink"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              position: 'absolute',
              inset: 0,
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}
            >
              {t.support.inviteTitle}
            </h3>

            <button
              type="button"
              disabled={isExiting}
              onClick={onDismissLater}
              aria-label={t.support.inviteCloseAria}
              style={{
                padding: '3px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color var(--transition-fast), background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={13} />
            </button>
          </div>

          <p
            style={{
              margin: '4px 0 11px',
              fontSize: '12px',
              lineHeight: 1.45,
              color: 'var(--text-secondary)',
            }}
          >
            {t.support.inviteDesc}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              disabled={isExiting}
              onClick={onSupport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                transition:
                  'background-color var(--transition-fast), border-color var(--transition-fast), transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <Heart size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span>{t.support.invitePrimaryBtn}</span>
            </button>

            <button
              type="button"
              disabled={isExiting}
              onClick={onDismissLater}
              style={{
                padding: '5px 9px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 400,
                transition: 'background-color var(--transition-fast), color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {t.support.inviteLaterBtn}
            </button>
          </div>

          <div
            style={{
              marginTop: '9px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <button
              type="button"
              disabled={isExiting}
              onClick={onDismissNever}
              style={{
                padding: 0,
                fontSize: '11px',
                color: 'var(--text-muted)',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {t.support.inviteNeverBtn}
            </button>
            <span aria-hidden="true" style={{ opacity: 0.5 }}>
              ·
            </span>
            <button
              type="button"
              disabled={isExiting}
              onClick={onAlreadySupported}
              style={{
                padding: 0,
                fontSize: '11px',
                color: 'var(--text-muted)',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {t.support.inviteAlreadyBtn}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
