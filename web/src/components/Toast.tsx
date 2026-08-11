import { useEffect } from 'react';

export interface ToastState {
  /** 같은 문구가 연속으로 떠도 타이머가 새로 시작되도록 하는 값 */
  key: number;
  message: string;
  undo?: { label: string; run: () => void };
}

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ toast, onDismiss, duration = 6000 }: Props) {
  const key = toast?.key;

  useEffect(() => {
    if (key === undefined) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [key, duration, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onDismiss();
            toast.undo?.run();
          }}
        >
          {toast.undo.label}
        </button>
      )}
    </div>
  );
}
