import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 rounded-md border border-line bg-panel-soft px-3 text-sm text-slate-100 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-28 rounded-md border border-line bg-panel-soft px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20", className)} {...props} />;
}
