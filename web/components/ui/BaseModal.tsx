"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g., "max-w-md", "max-w-xl", "max-w-2xl", "max-w-4xl"
  maxWidthClassName?: string; // alias for backwards compatibility
  className?: string;
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-2xl",
  maxWidthClassName,
  className = "",
  closeOnOutsideClick = true,
  showCloseButton = true,
}: BaseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, mounted]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const widthClass = maxWidthClassName || maxWidth;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 w-screen h-screen bg-black/60 backdrop-blur-sm transition-opacity duration-200 z-[9999]"
        onClick={closeOnOutsideClick ? onClose : undefined}
      />

      {/* Modal Content Window */}
      <div
        className={`relative w-full ${widthClass} transform rounded-2xl bg-white p-5 sm:p-6 shadow-2xl transition-all max-h-[90vh] flex flex-col z-[10000] my-auto animate-in zoom-in-95 duration-150 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 shrink-0">
            {title ? (
              typeof title === "string" ? (
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {title}
                </h3>
              ) : (
                <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {title}
                </div>
              )
            ) : <div />}

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 rounded-xl p-1.5 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 my-3 pr-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-100 pt-4 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default BaseModal;
