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
        ? "border-transparent bg-transparent text-text-soft hover:bg-white/10 hover:text-white"
        : "border-white/10 bg-white/5 text-text-soft backdrop-blur-[2px] hover:border-white/30 hover:bg-white/10 hover:text-white";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("grid h-9 w-9 place-items-center rounded-full border transition disabled:opacity-50", variantClass, className)}
      {...props}
    >
      {children}
    </button>
  );
}
