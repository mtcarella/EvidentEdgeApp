import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface DialogState {
  type: 'confirm' | 'alert' | 'prompt';
  message: string;
  title?: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'danger';
  defaultValue?: string;
}

interface DialogContextType {
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  alert: (message: string, options?: Pick<DialogOptions, 'title'>) => Promise<void>;
  prompt: (message: string, defaultValue?: string, options?: Pick<DialogOptions, 'title'>) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const resolveRef = useRef<((value: any) => void) | null>(null);

  const confirm = useCallback((message: string, options?: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        type: 'confirm',
        message,
        title: options?.title,
        confirmLabel: options?.confirmLabel || 'Confirm',
        cancelLabel: options?.cancelLabel || 'Cancel',
        variant: options?.variant || 'default',
      });
    });
  }, []);

  const alert = useCallback((message: string, options?: Pick<DialogOptions, 'title'>): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        type: 'alert',
        message,
        title: options?.title,
        confirmLabel: 'OK',
        cancelLabel: '',
        variant: 'default',
      });
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue?: string, options?: Pick<DialogOptions, 'title'>): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setPromptValue(defaultValue || '');
      setDialog({
        type: 'prompt',
        message,
        title: options?.title,
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        variant: 'default',
        defaultValue: defaultValue || '',
      });
    });
  }, []);

  const handleConfirm = () => {
    if (dialog?.type === 'prompt') {
      resolveRef.current?.(promptValue);
    } else if (dialog?.type === 'confirm') {
      resolveRef.current?.(true);
    } else {
      resolveRef.current?.(undefined);
    }
    setDialog(null);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    if (dialog?.type === 'confirm') {
      resolveRef.current?.(false);
    } else if (dialog?.type === 'prompt') {
      resolveRef.current?.(null);
    } else {
      resolveRef.current?.(undefined);
    }
    setDialog(null);
    resolveRef.current = null;
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {dialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className={`px-6 py-4 border-b border-slate-200 flex items-center justify-between rounded-t-xl ${
              dialog.variant === 'danger' ? 'bg-red-50' : 'bg-slate-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  dialog.variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  <AlertCircle className={`w-5 h-5 ${
                    dialog.variant === 'danger' ? 'text-red-600' : 'text-blue-600'
                  }`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {dialog.title || (dialog.type === 'alert' ? 'Notice' : dialog.type === 'prompt' ? 'Input Required' : 'Confirm Action')}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{dialog.message}</p>

              {dialog.type === 'prompt' && (
                <input
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                  className="mt-4 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                />
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
              {dialog.type !== 'alert' && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                onClick={handleConfirm}
                autoFocus={dialog.type !== 'prompt'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DialogContext.Provider>
  );
}
