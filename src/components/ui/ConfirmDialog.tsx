import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
            >
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="dialog-title" className="text-lg font-bold text-slate-950">
                {title}
              </h2>
              <p id="dialog-description" className="mt-1 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? "button-danger" : "button-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
