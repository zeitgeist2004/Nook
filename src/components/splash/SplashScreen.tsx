import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { t } = useTranslation();
  const [isBlinking, setIsBlinking] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. First discrete mascot wink at 780ms (reduced by 20% from 980ms)
    const winkTimer1 = setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 90);
    }, 780);

    // 2. Second friendly blink at 1400ms (reduced by 20% from 1750ms)
    const winkTimer2 = setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 80);
    }, 1400);

    // 3. Status text update at 1735ms (reduced by 20% from 2170ms)
    const statusTimer = setTimeout(() => {
      setIsReady(true);
    }, 1735);

    // 4. Initiate smooth fade-out exit at 1960ms (reduced by 20% from 2450ms)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1960);

    // 5. Complete transition and reveal workspace at 2160ms (exact 20% reduction from 2700ms)
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2160);

    // Optional intentional skip only via Escape key (prevents accidental mouse click skips)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExiting(true);
        setTimeout(onFinish, 145);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(winkTimer1);
      clearTimeout(winkTimer2);
      clearTimeout(statusTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: 'var(--nook-viewport-height, 100vh)',
        zIndex: 999999,
        backgroundColor: '#0D0E11',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.99)' : 'scale(1)',
        transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isExiting ? 'none' : 'auto',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {/* Mascot Container */}
      <div
        style={{
          position: 'relative',
          width: '124px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'splashMascotEnter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards, splashMascotBreathe 2.4s ease-in-out infinite 250ms',
          willChange: 'transform, opacity',
        }}
      >
        <img
          src="/brand/mascot/nook-idle-open.png"
          alt="Nook"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 10px 28px rgba(255, 255, 255, 0.08)) drop-shadow(0 14px 40px rgba(0, 0, 0, 0.65))',
          }}
        />

        <img
          src="/brand/mascot/nook-idle-blink.png"
          alt={t.splash.winkAlt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: isBlinking ? 1 : 0,
            transition: 'opacity 60ms ease-out',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Typography: Nook */}
      <div
        style={{
          fontSize: '30px',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#FFFFFF',
          marginTop: '18px',
          fontFamily: 'var(--font-sans)',
          animation: 'splashWordmarkEnter 225ms cubic-bezier(0.16, 1, 0.3, 1) 80ms forwards',
          opacity: 0,
          willChange: 'transform, opacity',
        }}
      >
        Nook
      </div>

      {/* Progress Rail */}
      <div
        style={{
          width: '180px',
          height: '2.5px',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '9999px',
          marginTop: '22px',
          overflow: 'hidden',
          position: 'relative',
          animation: 'splashProgressEnter 170ms ease-out 110ms forwards',
          opacity: 0,
          willChange: 'opacity',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '9999px',
            boxShadow: '0 0 12px rgba(255, 255, 255, 0.9)',
            animation: 'splashProgressBar 1680ms cubic-bezier(0.16, 0.85, 0.25, 1) 110ms forwards',
            willChange: 'width',
          }}
        />
      </div>

      {/* Subtle Status Text */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.02em',
          color: 'rgba(255, 255, 255, 0.45)',
          marginTop: '12px',
          fontFamily: 'var(--font-sans)',
          transition: 'color 240ms ease, opacity 240ms ease',
        }}
      >
        {isReady ? t.splash.ready : t.splash.loading}
      </div>

      <style>{`
        @keyframes splashMascotEnter {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes splashMascotBreathe {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-2px) scale(1.015);
          }
        }

        @keyframes splashWordmarkEnter {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes splashProgressEnter {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes splashProgressBar {
          0% {
            width: 0%;
          }
          15% {
            width: 25%;
          }
          45% {
            width: 55%;
          }
          75% {
            width: 82%;
          }
          90% {
            width: 95%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
