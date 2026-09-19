"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CategoryPieChartProps {
    data: any[];
}

const DEFAULT_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#E2E8F0"];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 w-full flex flex-col items-center justify-center text-slate-400 text-sm">
                <span className="text-2xl mb-1 opacity-50">🍩</span>
                <span>Belum ada data alokasi anggaran</span>
            </div>
        );
    }
    
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={92}
                    paddingAngle={4}
                    cornerRadius={6}
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                            stroke="#FFFFFF"
                            strokeWidth={2}
                        />
                    ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ 
                        borderRadius: '16px', 
                        border: '1px solid rgba(226, 232, 240, 0.8)', 
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        padding: '10px 14px'
                    }}
                    formatter={(value: any) => [`Rp${Number(value).toLocaleString("id-ID")}`, "Alokasi"]}
                />
                <Legend 
                    verticalAlign="bottom" 
                    height={40} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-semibold text-slate-600 ml-1">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

