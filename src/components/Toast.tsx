import React, { useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-full max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void; key?: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-sky-600" />
  };

  const bgStyles = {
    success: "bg-white border-l-4 border-emerald-500 shadow-md text-emerald-950",
    error: "bg-white border-l-4 border-rose-500 shadow-md text-rose-950",
    warning: "bg-white border-l-4 border-amber-500 shadow-md text-amber-950",
    info: "bg-white border-l-4 border-sky-500 shadow-md text-sky-950"
  };

  return (
    <div
      className={`p-4 rounded-lg flex items-start gap-3 border border-slate-100 pointer-events-auto transition-all duration-300 transform translate-y-0 ease-out ${bgStyles[toast.type]}`}
      id={`toast-${toast.id}`}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-slate-900">{toast.title}</h4>
        {toast.message && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-600 rounded-full p-0.5 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
