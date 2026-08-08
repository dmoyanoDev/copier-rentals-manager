import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children, footer }: ModalProps) => {
  if (!isOpen || typeof document === 'undefined') return null;

  // Rendered via a portal straight into <body>. Any ancestor with a
  // non-"none" `transform` creates a new containing block for `position:
  // fixed` descendants — page wrappers using `.animate-fade-in` used to keep
  // one after their entrance animation ended (fixed separately in
  // globals.css), which sized/positioned this modal relative to the PAGE's
  // box instead of the real viewport. The portal sidesteps that entirely
  // regardless of what any ancestor's CSS does, now or in the future.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider min-w-0 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-slate-300 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 bg-slate-950/40 border-t border-slate-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
