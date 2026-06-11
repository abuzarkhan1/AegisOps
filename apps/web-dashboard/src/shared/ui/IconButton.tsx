import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  variant?: "default" | "danger" | "ghost";
};

export function IconButton({ label, children, className, variant = "default", ...props }: IconButtonProps) {
  const variantClass =
    variant === "danger"
      ? "border-rose/40 bg-rose/10 text-rose hover:bg-rose/20"
      : variant === "ghost"
        ? "border-transparent bg-transparent text-slate-400 hover:bg-panel-hover hover:text-white"
        : "border-line bg-panel-soft text-slate-300 hover:bg-panel-hover hover:text-white";

  return (
    <button
      aria-label={label}
      title={label}
      className={cn("grid h-9 w-9 place-items-center rounded-md border transition disabled:opacity-50", variantClass, className)}
      {...props}
    >
      {children}
    </button>
  );
}
