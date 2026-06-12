import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: ReactNode;
  loading?: boolean;
};

const variants = {
  primary: "border-transparent bg-gradient-to-br from-gray-100 to-gray-300 text-black hover:from-white hover:to-gray-200",
  secondary: "border-white/10 bg-white/5 text-text-primary backdrop-blur-[2px] hover:border-white/30 hover:bg-white/10 hover:text-white",
  danger: "border-rose/40 bg-rose/10 text-rose hover:border-rose hover:bg-rose/20",
  ghost: "border-transparent bg-transparent text-text-soft hover:bg-white/10 hover:text-white"
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm"
};

export function Button({ className, variant = "secondary", size = "md", icon, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
