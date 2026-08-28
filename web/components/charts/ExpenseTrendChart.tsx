"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ExpenseTrendChartProps {
    data: any[];
}

export function ExpenseTrendChart({ data }: ExpenseTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                Belum ada data pengeluaran
            </div>
        );
    }
    
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "#6B7280" }} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10} 
                />
                <YAxis
                    tickFormatter={(val) => `Rp${val / 1000}k`}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                />
                <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    formatter={(value: any) => [`Rp${Number(value).toLocaleString("id-ID")}`, "Pengeluaran"]}
                    labelStyle={{ color: "#6B7280", fontWeight: 500, marginBottom: "4px" }}
                />
                <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
