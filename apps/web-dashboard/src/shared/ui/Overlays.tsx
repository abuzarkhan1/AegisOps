import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function useOverlayFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? panel)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  return panelRef;
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const panelRef = useOverlayFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="animate-overlay-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="animate-modal-in w-full max-w-xl aegis-glass rounded-2xl p-5 shadow-glow"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <IconButton label="Close modal" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const panelRef = useOverlayFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="animate-overlay-fade fixed inset-0 z-50 bg-black/70"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="animate-drawer-in aegis-glass ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-white/10 p-5 shadow-glow"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="drawer-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <IconButton label="Close drawer" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </aside>
    </div>,
    document.body
  );
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
      {detail ? <p className="text-sm text-text-soft">{detail}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
}

export function DrawerPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("aegis-glass rounded-2xl p-4", className)}>{children}</div>;
}
