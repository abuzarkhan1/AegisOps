import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <section className="w-full max-w-xl rounded-lg border border-line bg-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <IconButton label="Close modal" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70">
      <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-line bg-black p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <IconButton label="Close drawer" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        {children}
      </aside>
    </div>,
    document.body
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span title={label}>{children}</span>;
}

export function ConfirmDialog({
  open,
  title,
  detail,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  detail?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {detail ? <p className="text-sm text-slate-400">{detail}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="danger" onClick={onConfirm}>Confirm</Button>
      </div>
    </Modal>
  );
}

export function DrawerPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-line bg-panel-soft p-4", className)}>{children}</div>;
}
