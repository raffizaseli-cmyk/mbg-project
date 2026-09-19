"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ExpenseTrendChartProps {
    data: any[];
}

export function ExpenseTrendChart({ data }: ExpenseTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 w-full flex flex-col items-center justify-center text-slate-400 text-sm">
                <span className="text-2xl mb-1 opacity-50">📊</span>
                <span>Belum ada data pengeluaran 7 hari terakhir</span>
            </div>
        );
    }
    
    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                <defs>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: "#64748B", fontWeight: 500 }} 
                    tickLine={false} 
                    axisLine={{ stroke: "#E2E8F0" }} 
                    dy={8} 
                />
                <YAxis
                    tickFormatter={(val) => `Rp${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : Math.round(val / 1000) + 'k'}`}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    dx={-5}
                />
                <Tooltip
                    contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid rgba(226, 232, 240, 0.8)', 
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        padding: '10px 14px'
                    }}
                    formatter={(value: any) => [`Rp${Number(value).toLocaleString("id-ID")}`, "Pengeluaran"]}
                    labelStyle={{ color: "#0F172A", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}
                />
                <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#expenseGradient)"
                    dot={{ r: 3, strokeWidth: 2, fill: "#FFFFFF", stroke: "#2563EB" }}
                    activeDot={{ r: 6, strokeWidth: 2, fill: "#2563EB", stroke: "#FFFFFF" }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

