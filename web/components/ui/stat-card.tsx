import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Trend = "up" | "down" | "neutral";
type AccentColor = "blue" | "emerald" | "amber" | "purple" | "rose" | "cyan";

interface StatCardProps {
    title: string;
    value: string | React.ReactNode;
    subtitle?: string;
    icon: string | React.ReactNode;
    trend?: Trend;
    trendValue?: string;
    accentColor?: AccentColor;
    className?: string;
}

export function StatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    accentColor = "blue",
    className = "",
}: StatCardProps) {
    const trendConfig = {
        up: { colors: "text-emerald-700 bg-emerald-50 ring-emerald-200/60", Icon: TrendingUp },
        down: { colors: "text-rose-600 bg-rose-50 ring-rose-200/60", Icon: TrendingDown },
        neutral: { colors: "text-slate-600 bg-slate-50 ring-slate-200/60", Icon: Minus }
    };
    
    const glowConfig: Record<AccentColor, { glow: string; iconBg: string }> = {
        blue: { glow: "bg-blue-500/10", iconBg: "from-blue-500/10 to-indigo-500/15 text-blue-600 border-blue-200/60" },
        emerald: { glow: "bg-emerald-500/10", iconBg: "from-emerald-500/10 to-teal-500/15 text-emerald-600 border-emerald-200/60" },
        amber: { glow: "bg-amber-500/10", iconBg: "from-amber-500/10 to-orange-500/15 text-amber-600 border-amber-200/60" },
        purple: { glow: "bg-purple-500/10", iconBg: "from-purple-500/10 to-violet-500/15 text-purple-600 border-purple-200/60" },
        rose: { glow: "bg-rose-500/10", iconBg: "from-rose-500/10 to-pink-500/15 text-rose-600 border-rose-200/60" },
        cyan: { glow: "bg-cyan-500/10", iconBg: "from-cyan-500/10 to-blue-500/15 text-cyan-600 border-cyan-200/60" },
    };

    const currentTrend = trendConfig[trend || "neutral"] || trendConfig.neutral;
    const TrendIcon = currentTrend.Icon;
    const accent = glowConfig[accentColor] || glowConfig.blue;

    return (
        <div
            className={`bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200/80 hover:border-slate-300/90 p-5 sm:p-6 flex flex-col gap-3 hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group ${className}`}
        >
            {/* Ambient Corner Glow */}
            <div className={`absolute -right-8 -top-8 w-32 h-32 ${accent.glow} rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none`} />

            <div className="flex items-start justify-between relative z-10">
                <p className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-500">{title}</p>
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${accent.iconBg} shadow-sm border flex items-center justify-center text-xl shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>

            <div className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mt-1 relative z-10 truncate">
                {value}
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 relative z-10">
                {subtitle && (
                    <p className="text-xs sm:text-sm font-medium text-slate-600 max-w-[65%] truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        {subtitle}
                    </p>
                )}
                {trend && trendValue && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${currentTrend.colors} shrink-0`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        {trendValue}
                    </span>
                )}
            </div>
        </div>
    );
}

