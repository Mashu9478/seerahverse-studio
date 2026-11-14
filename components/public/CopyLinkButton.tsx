"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { copyText } from "@/lib/client";

export function CopyLinkButton({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(window.location.origin + path);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-fg"
    >
      {done ? <Check className="h-4 w-4 text-emerald-300" /> : <Link2 className="h-4 w-4" />}
      {done ? "Copied!" : "Copy link"}
    </button>
  );
}
