import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-text-primary outline-none backdrop-blur-[2px] placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-text-primary outline-none backdrop-blur-[2px] focus:border-white/30 focus:ring-2 focus:ring-white/10",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-primary outline-none backdrop-blur-[2px] placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10",
        className
      )}
      {...props}
    />
  );
}
