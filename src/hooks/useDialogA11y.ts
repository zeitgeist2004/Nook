import { useEffect, useRef } from 'react';

interface UseDialogA11yOptions {
  isOpen: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
}

/**
 * Manages modal accessibility: captures trigger focus, supports Escape dismissal,
 * and restores focus cleanly back to the triggering control on close.
 */
export function useDialogA11y({
  isOpen,
  onClose,
  closeOnEscape = true,
}: UseDialogA11yOptions): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const active = document.activeElement;
      previousFocusRef.current = active instanceof HTMLElement ? active : null;
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && prev.isConnected && typeof prev.focus === 'function') {
        requestAnimationFrame(() => {
          try {
            prev.focus({ preventScroll: true });
          } catch {
            // Ignore non-focusable elements
          }
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape]);

  useEffect(() => {
    return () => {
      if (wasOpenRef.current) {
        const prev = previousFocusRef.current;
        previousFocusRef.current = null;
        wasOpenRef.current = false;
        if (prev && prev.isConnected && typeof prev.focus === 'function') {
          try {
            prev.focus({ preventScroll: true });
          } catch {
            // Ignore
          }
        }
      }
    };
  }, []);
}
