import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: string;
  shortcut?: string | string[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  children: React.ReactElement;
  className?: string;
}

const isCoarseTouchOnly = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  position = 'bottom',
  delay = 240,
  disabled = false,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 6;
    const padding = 8;

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 120;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 28;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;

    let effectivePos = position;
    if (effectivePos === 'top' && rect.top - tooltipHeight - gap < padding) {
      effectivePos = 'bottom';
    } else if (effectivePos === 'bottom' && rect.bottom + tooltipHeight + gap > vh - padding) {
      effectivePos = 'top';
    } else if (effectivePos === 'left' && rect.left - tooltipWidth - gap < padding) {
      effectivePos = 'right';
    } else if (effectivePos === 'right' && rect.right + tooltipWidth + gap > vw - padding) {
      effectivePos = 'left';
    }

    let top = 0;
    let left = 0;

    switch (effectivePos) {
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // Viewport edge collision guards
    const maxLeft = Math.max(padding, vw - tooltipWidth - padding);
    left = Math.max(padding, Math.min(left, maxLeft));

    const maxTop = Math.max(padding, vh - tooltipHeight - padding);
    top = Math.max(padding, Math.min(top, maxTop));

    setCoords({ top, left });
  }, [position]);

  const hideNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  }, []);

  const handleMouseEnter = () => {
    if (disabled || !content || isCoarseTouchOnly()) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    hideNow();
  };

  const handleMouseDown = () => {
    hideNow();
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (disabled || !content || isCoarseTouchOnly()) return;
    let isKeyboardFocus = true;
    try {
      isKeyboardFocus = e.currentTarget.matches(':focus-visible');
    } catch {
      isKeyboardFocus = true;
    }
    if (!isKeyboardFocus) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 120);
  };

  const handleBlur = () => {
    hideNow();
  };

  useLayoutEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, content, shortcut, updatePosition]);

  useEffect(() => {
    if (isVisible) {
      const handleScroll = () => setIsVisible(false);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          hideNow();
        }
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isVisible, updatePosition, hideNow]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Format shortcut pills
  const renderShortcuts = () => {
    if (!shortcut) return null;
    const parts = Array.isArray(shortcut)
      ? shortcut
      : shortcut.split('+').map((s) => s.trim());

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '3px' }}>
        {parts.map((p, i) => (
          <kbd
            key={i}
            style={{
              padding: '1px 5px',
              fontSize: '10px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '3px',
              color: 'var(--text-secondary)',
              lineHeight: 1.3,
              boxShadow: '0 1px 1px rgba(0, 0, 0, 0.2)',
            }}
          >
            {p}
          </kbd>
        ))}
      </span>
    );
  };

  // Clone child with ref and event listeners
  const trigger = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const { ref } = children as any;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      handleMouseEnter();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      handleMouseLeave();
    },
    onMouseDown: (e: React.MouseEvent) => {
      children.props.onMouseDown?.(e);
      handleMouseDown();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(e);
      handleFocus(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(e);
      handleBlur();
    },
  });

  return (
    <>
      {trigger}
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={`nook-tooltip ${className}`}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              pointerEvents: 'none',
              maxWidth: 'calc(100vw - 16px)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.55)',
              fontSize: '11.5px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              animation: 'tooltipFade 110ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <span>{content}</span>
            {renderShortcuts()}
          </div>,
          document.body
        )}
    </>
  );
};
