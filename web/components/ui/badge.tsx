import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "primary" | "success" | "warning" | "danger" | "gray";
    size?: "sm" | "md";
    children: React.ReactNode;
}

const variantClasses = {
    primary: "badge-primary",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    gray: "badge-gray",
};

const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={`${variantClasses[variant]} ${sizeClasses[size]} ${className || ""}`}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = "Badge";
