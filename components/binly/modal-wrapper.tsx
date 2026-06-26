'use client';

import { useState, useCallback, useEffect, ReactNode } from 'react';

interface ModalWrapperProps {
  children: ReactNode;
  onClose: () => void;
  backdrop?: string;
}

/**
 * Shared modal wrapper with consistent open/close animations.
 *
 * Usage:
 * ```tsx
 * <ModalWrapper onClose={onClose}>
 *   <div className="modal-container">
 *     <div className="modal-content modal-full">
 *       {/* modal content */}
 *     </div>
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
      <div
        className={`fixed inset-0 ${backdrop} z-50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />
      <div className={`${isClosing ? 'animate-scale-out animate-fade-out' : 'animate-scale-in animate-fade-in'}`}>
        {typeof children === 'function'
          ? (children as any)({ isClosing, handleClose })
          : children}
      </div>
    </>
  );
}

/**
 * Hook for modal close animation. Returns isClosing state, handleClose function,
 * and pre-built className strings for backdrop and container.
 *
 * Usage:
 * ```tsx
 * const { isClosing, handleClose, backdropClass, containerClass } = useModalClose(onClose);
 *
 * <div className={backdropClass} onClick={handleClose} />
 * <div className={containerClass}>
 *   <div className="modal-content modal-full">
 *     ...
 *   </div>
 * </div>
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

  const backdropClass = `modal-backdrop ${isClosing ? 'closing' : 'opening'}`;
  const containerClass = `modal-container ${isClosing ? 'closing' : 'opening'}`;

  return { isClosing, handleClose, backdropClass, containerClass };
}
