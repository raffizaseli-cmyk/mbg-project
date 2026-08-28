import * as React from "react";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    backHref?: string;
    backLabel?: string;
    breadcrumbs?: Array<{ label: string, href?: string }>;
}

export function PageHeader({
    title,
    subtitle,
    actions,
    backHref,
    backLabel = "Kembali",
    breadcrumbs,
}: PageHeaderProps) {
    return (
        <div className="mb-0 animate-in">
            {/* Optional Breadcrumbs or Back button */}
            {(backHref || breadcrumbs) && (
                 <nav className="flex items-center text-sm text-gray-500 mb-2 gap-1">
                     {backHref && (
                        <a href={backHref} className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors font-medium">
                            ← {backLabel}
                        </a>
                     )}
                     {breadcrumbs && breadcrumbs.map((crumb, idx) => (
                         <div key={idx} className="flex items-center gap-1">
                             {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                             {crumb.href ? (
                                <a href={crumb.href} className="hover:text-blue-600 transition-colors font-medium">
                                    {crumb.label}
                                </a>
                             ) : (
                                <span className="text-gray-900 font-medium">{crumb.label}</span>
                             )}
                         </div>
                     ))}
                 </nav>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 shadow-transparent p-0 pb-0.5">{title}</h1>
                    {subtitle && <p className="text-sm font-medium text-gray-500 mt-1 sm:mt-1.5">{subtitle}</p>}
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>
                )}
            </div>
        </div>
    );
}
