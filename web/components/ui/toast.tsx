"use client";

import { createContext, useCallback, useContext, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue>({
    showToast: () => { },
});

export function useToast() {
    return useContext(ToastContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).slice(2);
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => {
            setToasts(t => t.filter(toast => toast.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast container — bottom-right */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onDismiss={() => setToasts(t => t.filter(t2 => t2.id !== toast.id))}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ─── Toast Item ───────────────────────────────────────────────────────────────
const TOAST_STYLES: Record<ToastType, { bg: string; icon: string }> = {
    success: { bg: "bg-green-600", icon: "✅" },
    error: { bg: "bg-red-600", icon: "❌" },
    warning: { bg: "bg-yellow-500", icon: "⚠️" },
    info: { bg: "bg-blue-600", icon: "ℹ️" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const { bg, icon } = TOAST_STYLES[toast.type];
    return (
        <div
            className={`
        ${bg} text-white rounded-xl shadow-xl px-4 py-3
        flex items-start gap-3 animate-in slide-in-from-bottom-2
        duration-300 cursor-pointer
      `}
            onClick={onDismiss}
            role="alert"
        >
            <span className="flex-shrink-0 text-base">{icon}</span>
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
            <button className="ml-auto flex-shrink-0 text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
    );
}
