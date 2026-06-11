import { Copy } from "lucide-react";
import { useState } from "react";
import { IconButton } from "./IconButton";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <IconButton label={copied ? "Copied" : label} onClick={copy}>
      <Copy className="h-4 w-4" />
    </IconButton>
  );
}
