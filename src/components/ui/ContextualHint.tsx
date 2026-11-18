import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import {
  ContextualTipId,
  dismissContextualTip,
  hasSeenContextualTip,
} from '../../utils/onboardingUtils';
import { useTranslation } from '../../i18n';

interface ContextualHintProps {
  tipId: ContextualTipId;
  title: string;
  description: string;
  compact?: boolean;
}

/**
 * Single-appearance, user-dismissible contextual hint for Onboarding 2.0.
 * Appears only when the user actually interacts with that feature for the first time.
 */
export const ContextualHint: React.FC<ContextualHintProps> = ({
  tipId,
  title,
  description,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState<boolean>(() => !hasSeenContextualTip(tipId));

  useEffect(() => {
    setVisible(!hasSeenContextualTip(tipId));
  }, [tipId]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissContextualTip(tipId);
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '10px',
        padding: compact ? '8px 10px' : '9px 12px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--bg-main)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
        fontSize: compact ? '11.5px' : '12px',
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0, flex: 1 }}>
        <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}: </span>
          <span>{description}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t.ux.dismissTipAria}
        style={{
          padding: '2px',
          minHeight: '24px',
          minWidth: '24px',
          borderRadius: '4px',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <X size={13} />
      </button>
    </div>
  );
};
