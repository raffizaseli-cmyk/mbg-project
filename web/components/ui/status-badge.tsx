import * as React from "react";

interface StatusBadgeProps {
    status: string;
    className?: string;
    pulse?: boolean;
}

const STATUS_MAP: Record<string, { label: string; className: string; icon?: string }> = {
    // Hijau
    confirmed: { label: "Dikonfirmasi", className: "bg-green-50 text-green-700 ring-green-500/20", icon: "✓" },
    paid: { label: "Lunas", className: "bg-green-50 text-green-700 ring-green-500/20", icon: "✓" },
    ready: { label: "Siap", className: "bg-green-50 text-green-700 ring-green-500/20", icon: "✓" },
    active: { label: "Aktif", className: "bg-green-50 text-green-700 ring-green-500/20", icon: "●" },
    dipotong: { label: "Dipotong", className: "bg-green-50 text-green-700 ring-green-500/20", icon: "✂" },

    // Kuning / Amber
    processing: { label: "Diproses", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "⟳" },
    pending: { label: "Menunggu", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "⏳" },
    pending_confirm: { label: "Siap Dikonfirmasi", className: "bg-blue-50 text-blue-700 ring-blue-500/20", icon: "⏳" },
    unmapped_hold: { label: "Mapping Tertunda", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "⚠️" },
    pending_regenerate: { label: "Diperbarui", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "⟳" },
    generating: { label: "Diproses", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "⟳" },
    unpaid: { label: "Belum Lunas", className: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: "!" },

    // Merah
    failed: { label: "Gagal", className: "bg-red-50 text-red-700 ring-red-500/20", icon: "✕" },
    overdue: { label: "Terlambat", className: "bg-red-50 text-red-700 ring-red-500/20 text-red-animation", icon: "⚠" },
    error: { label: "Error", className: "bg-red-50 text-red-700 ring-red-500/20", icon: "✕" },
    cancelled: { label: "Dibatalkan", className: "bg-gray-50 text-gray-500 ring-gray-500/20", icon: "✕" },
    tidak_ada_menu: { label: "Tdk Ada Menu", className: "bg-red-50 text-red-700 ring-red-500/20", icon: "⚠" },

    // Abu / Indigo
    draft: { label: "Draft", className: "bg-slate-50 text-slate-600 ring-slate-500/20" },
    not_generated: { label: "Belum Dibuat", className: "bg-slate-50 text-slate-600 ring-slate-500/20" },
    manual: { label: "Manual", className: "bg-indigo-50 text-indigo-700 ring-indigo-500/20", icon: "⚙" },
};

export function StatusBadge({ status, className = "", pulse = false }: StatusBadgeProps) {
    const key = (status || "").toLowerCase();
    const mapped = STATUS_MAP[key] ?? {
        label: status,
        className: "bg-gray-50 text-gray-600 ring-gray-400/20",
    };
    
    // Auto detect urgent statuses for pulsing
    const shouldPulse = pulse || key === "overdue" || key === "error";

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset shadow-xs ${mapped.className} ${className}`}
        >
            {shouldPulse && (
                <span className="relative flex w-1.5 h-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mapped.className.split(" ")[0].replace('50', '400')}`}></span>
                    <span className={`relative inline-flex rounded-full w-1.5 h-1.5 ${mapped.className.split(" ")[0].replace('50', '500')}`}></span>
                </span>
            )}
            {mapped.icon && !shouldPulse && <span className="text-[10px]">{mapped.icon}</span>}
            {mapped.label}
        </span>
    );
}
