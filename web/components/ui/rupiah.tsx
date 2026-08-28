"use client";

import * as React from "react";

interface RupiahProps {
    amount: number | string;
    className?: string;
    showSign?: boolean;
}

export function Rupiah({ amount, className = "", showSign = false }: RupiahProps) {
    const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount || 0;

    const formatted = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })
        .format(Math.abs(num))
        .replace("IDR", "Rp")
        .replace(/\./g, ".");

    const sign = showSign ? (num >= 0 ? "+" : "-") : num < 0 ? "-" : "";
    const colorClass = num < 0 ? "text-red-500" : "";

    return (
        <span className={`font-medium tabular-nums ${colorClass} ${className}`}>
            {sign}
            {formatted}
        </span>
    );
}

/** Utility: format rupiah to string (non-component) */
export function formatRupiah(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    })
        .format(num)
        .replace("IDR", "Rp");
}
