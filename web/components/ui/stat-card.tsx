import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Trend = "up" | "down" | "neutral";

interface StatCardProps {
    title: string;
    value: string | React.ReactNode;
    subtitle?: string;
    icon: string | React.ReactNode;
    trend?: Trend;
    trendValue?: string;
    className?: string;
}

export function StatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    className = "",
}: StatCardProps) {
    const trendConfig = {
        up: { colors: "text-red-500 bg-red-50 ring-red-100", Icon: TrendingUp },  // Adjusted semantic colors if needed
        down: { colors: "text-green-600 bg-green-50 ring-green-100", Icon: TrendingDown },
        neutral: { colors: "text-gray-500 bg-gray-50 ring-gray-100", Icon: Minus }
    };
    
    // Safety check just in case trend isn't strictly typed
    const currentTrend = trendConfig[trend || "neutral"] || trendConfig.neutral;
    const TrendIcon = currentTrend.Icon;

    return (
        <div
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group ${className}`}
        >
            {/* Background Accent Element */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50/50 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500 pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
                <p className="text-[11px] font-bold tracking-wide uppercase text-gray-500">{title}</p>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-gray-50 to-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex items-center justify-center text-xl shrink-0 ring-1 ring-gray-100 ring-inset relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <div className="absolute inset-x-0 top-0 h-px bg-white" />
                    {icon}
                </div>
            </div>

            <div className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-gray-900 leading-tight mt-2 relative z-10 truncate">{value}</div>

            <div className="flex items-center justify-between mt-auto pt-2 relative z-10">
                {subtitle && <p className="text-xs font-medium text-gray-400 max-w-[60%] truncate">{subtitle}</p>}
                {trend && trendValue && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${currentTrend.colors} shrink-0`}>
                        <TrendIcon className="w-3 h-3" />
                        {trendValue}
                    </span>
                )}
            </div>
        </div>
    );
}
