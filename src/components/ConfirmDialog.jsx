import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ConfirmDialog = ({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'primary' | 'danger'
  icon: Icon,
  loading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';

  const iconWrap =
    variant === 'danger'
      ? 'bg-red-100 text-red-600'
      : 'bg-indigo-100 text-indigo-600';

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${iconWrap}`}>
              {Icon ? <Icon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition disabled:opacity-50 ${confirmStyles}`}
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
