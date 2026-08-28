import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "elevated" | "glass" | "hover";
    children: React.ReactNode;
}

const variantClasses = {
    default: "card",
    elevated: "card-elevated",
    glass: "card-glass",
    hover: "card-hover",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ variant = "default", className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`${variantClasses[variant]} ${className || ""}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={`pb-4 border-b border-gray-100 ${className || ""}`} {...props}>
            {children}
        </div>
    )
);

CardHeader.displayName = "CardHeader";

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, children, ...props }, ref) => (
        <h2 ref={ref} className={`text-lg font-semibold text-gray-900 ${className || ""}`} {...props}>
            {children}
        </h2>
    )
);

CardTitle.displayName = "CardTitle";

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
    ({ className, children, ...props }, ref) => (
        <p ref={ref} className={`text-sm text-gray-500 mt-1 ${className || ""}`} {...props}>
            {children}
        </p>
    )
);

CardDescription.displayName = "CardDescription";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={`pt-4 ${className || ""}`} {...props}>
            {children}
        </div>
    )
);

CardContent.displayName = "CardContent";

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className, children, ...props }, ref) => (
        <div ref={ref} className={`pt-4 border-t border-gray-100 flex gap-2 justify-end ${className || ""}`} {...props}>
            {children}
        </div>
    )
);

CardFooter.displayName = "CardFooter";
