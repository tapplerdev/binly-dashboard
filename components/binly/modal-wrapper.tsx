'use client';

import { useState, useCallback, useEffect, ReactNode } from 'react';

interface ModalWrapperProps {
  children: ReactNode;
  onClose: () => void;
  /** Backdrop opacity. Default: "bg-black/50" */
  backdrop?: string;
}

/**
 * Shared modal wrapper with consistent open/close animations.
 * Handles: fade-in/scale-in on mount, fade-out/scale-out on close with 300ms delay.
 *
 * Usage:
 * ```tsx
 * <ModalWrapper onClose={onClose}>
 *   <div className="fixed inset-4 z-50 ...">
 *     {/* modal content *\/}
 *   </div>
 * </ModalWrapper>
 * ```
 */
export function ModalWrapper({ children, onClose, backdrop = 'bg-black/50' }: ModalWrapperProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 ${backdrop} z-50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />
      {/* Modal content — clone children with isClosing and handleClose */}
      <div className={`${isClosing ? 'animate-scale-out animate-fade-out' : 'animate-scale-in animate-fade-in'}`}>
        {typeof children === 'function'
          ? (children as any)({ isClosing, handleClose })
          : children}
      </div>
    </>
  );
}

/**
 * Hook for modal close animation. Use this in modals that manage their own backdrop.
 *
 * Usage:
 * ```tsx
 * const { isClosing, handleClose } = useModalClose(onClose);
 * ```
 */
export function useModalClose(onClose: () => void, open?: boolean) {
  const [isClosing, setIsClosing] = useState(false);

  // Reset isClosing when modal reopens (component may not unmount between close/open cycles)
  useEffect(() => {
    if (open) setIsClosing(false);
  }, [open]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  return { isClosing, handleClose };
}
