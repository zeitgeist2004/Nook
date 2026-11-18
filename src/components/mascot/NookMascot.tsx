import React, { useState, useEffect } from 'react';

/**
 * 1. NookIdleMascot:
 * Idle state mascot with gentle sinusoidal breathing and periodic natural eye-blinking.
 * Engineered for zero layout thrashing: uses fixed dimensions and composite-only GPU transform.
 */
export const NookIdleMascot: React.FC<{ size?: number; className?: string }> = ({
  size = 120,
  className = '',
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    let endTimeout: ReturnType<typeof setTimeout> | null = null;

    // Natural human-like blink loop without overlapping timers
    const scheduleNextBlink = () => {
      const delay = 3400 + Math.random() * 1200;
      blinkTimeout = setTimeout(() => {
        if (isCancelled) return;
        setIsBlinking(true);
        endTimeout = setTimeout(() => {
          if (isCancelled) return;
          setIsBlinking(false);
          scheduleNextBlink();
        }, 160);
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      isCancelled = true;
      if (blinkTimeout) clearTimeout(blinkTimeout);
      if (endTimeout) clearTimeout(endTimeout);
    };
  }, []);

  return (
    <div
      className={`animate-nook-breathe ${className}`}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.95)' : undefined,
        transition: 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
      }}
      title="Nook"
    >
      {/* Idle Open Eyes */}
      <img
        src="/brand/mascot/nook-idle-open.png"
        alt="Nook"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          position: 'absolute',
          inset: 0,
          opacity: isBlinking ? 0 : 1,
          transition: 'opacity 60ms ease-out',
          filter: 'drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))',
          pointerEvents: 'none',
        }}
      />
      {/* Idle Blinking Eyes */}
      <img
        src="/brand/mascot/nook-idle-blink.png"
        alt="Nook Piscando"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          position: 'absolute',
          inset: 0,
          opacity: isBlinking ? 1 : 0,
          transition: 'opacity 60ms ease-out',
          filter: 'drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

/**
 * 2. NookSaveMicroMark:
 * Micro-feedback mark for editor header or status bar.
 * Rest state: nook-head-open.png.
 * On save: brief 260ms wink (nook-head-wink.png) with a subtle scale pop.
 */
export const NookSaveMicroMark: React.FC<{
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
}> = ({ saveStatus }) => {
  const [showWink, setShowWink] = useState(false);

  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowWink(true);
      const timer = setTimeout(() => {
        setShowWink(false);
      }, 380);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  return (
    <div
      style={{
        width: '18px',
        height: '18px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
      title={
        saveStatus === 'saved'
          ? 'Salvo com sucesso'
          : saveStatus === 'saving'
          ? 'Salvando alterações...'
          : 'Alterações pendentes'
      }
    >
      <img
        src={showWink ? '/brand/mascot/nook-head-wink.png' : '/brand/mascot/nook-head-open.png'}
        alt="Nook"
        className={showWink ? 'animate-nook-wink' : ''}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity: saveStatus === 'unsaved' ? 0.6 : 0.95,
          transition: 'opacity 140ms ease-out',
        }}
      />
    </div>
  );
};

/**
 * 3. NookWelcomeMascot:
 * Welcoming Nook with friendly arm wave and pop-in entrance.
 */
export const NookWelcomeMascot: React.FC<{ size?: number }> = ({ size = 72 }) => {
  return (
    <div
      className="animate-nook-pop"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/brand/mascot/nook-welcome-wave.png"
        alt="Bem-vindo ao Nook"
        className="animate-nook-wave"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 16px rgba(255, 255, 255, 0.08))',
        }}
      />
    </div>
  );
};

/**
 * 4. NookCleanTrashMascot:
 * Zen peaceful Nook sitting beside clean sparkling wastebasket.
 */
export const NookCleanTrashMascot: React.FC<{ size?: number }> = ({ size = 96 }) => {
  return (
    <div
      className="animate-nook-pop"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <img
        src="/brand/mascot/nook-trash-clean.png"
        alt="Lixeira Limpa"
        className="animate-nook-zen"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 16px rgba(255, 255, 255, 0.05))',
        }}
      />
    </div>
  );
};

/**
 * 5. NookDropZoneVisual:
 * Drop target cue with dashed border and attentive Nook looking up.
 */
export const NookDropZoneVisual: React.FC = () => {
  return (
    <div
      className="animate-nook-drop-pulse"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px 32px',
        borderRadius: 'var(--radius-lg)',
        border: '2px dashed var(--accent)',
        backgroundColor: 'rgba(23, 23, 23, 0.88)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65)',
        maxWidth: '380px',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <img
        src="/brand/mascot/nook-drag-alert.png"
        alt="Solte aqui"
        style={{
          width: '110px',
          height: '110px',
          objectFit: 'contain',
          filter: 'drop-shadow(0 6px 20px rgba(0, 0, 0, 0.4))',
        }}
      />
      <div>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}
        >
          Solte para abrir no Editor
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Solte aqui para abrir em uma nova aba, ou arraste sobre uma pasta na barra lateral para salvar no projeto.
        </p>
      </div>
    </div>
  );
};

/**
 * 6. NookImportSuccessToast:
 * Transient confirmation toast showing Nook with markdown success badge.
 */
export const NookImportSuccessToast: React.FC<{
  filename: string;
  onClose: () => void;
}> = ({ filename, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="animate-nook-pop"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
      }}
    >
      <img
        src="/brand/mascot/nook-drag-success.png"
        alt="Sucesso"
        style={{
          width: '36px',
          height: '36px',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Markdown importado
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            maxWidth: '220px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </span>
      </div>
    </div>
  );
};
