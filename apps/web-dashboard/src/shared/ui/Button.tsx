import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: ReactNode;
};

const variants = {
  primary: "border-transparent bg-mint text-black hover:bg-[color:var(--x-blue-hover)]",
  secondary: "border-line bg-panel-soft text-slate-200 hover:border-line hover:bg-panel-hover hover:text-white",
  danger: "border-rose/40 bg-rose/10 text-rose hover:border-rose hover:bg-rose/20",
  ghost: "border-transparent bg-transparent text-slate-300 hover:bg-panel-hover hover:text-white"
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm"
};

export function Button({ className, variant = "secondary", size = "md", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
