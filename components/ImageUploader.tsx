"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { cx } from "./ui";

export function ImageUploader({ value, onChange, max = 8 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);

  async function add(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Please choose image files (photos or screenshots).");
    const room = max - value.length;
    if (room <= 0) return toast.error(`You can attach up to ${max} pages.`);
    const pick = list.slice(0, room);
    setBusy((b) => b + pick.length);
    const urls: string[] = [];
    await Promise.all(
      pick.map(async (f) => {
        try {
          const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
          const blob = await upload(`pages/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, f, {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: f.type,
          });
          urls.push(blob.url);
        } catch (e) {
          toast.error(`Couldn't upload ${f.name}: ${e instanceof Error ? e.message : "error"}`);
        } finally {
          setBusy((b) => b - 1);
        }
      }),
    );
    if (urls.length) onChange([...value, ...urls]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={cx(
          "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-9 text-center transition duration-300",
          drag ? "scale-[1.01] bg-brand-500/[0.12]" : "bg-white/[0.025] hover:bg-white/[0.045]",
        )}
      >
        {/* animated dashed border */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <rect
            x="1"
            y="1"
            rx="22"
            style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
            fill="none"
            strokeWidth="1.5"
            strokeDasharray="8 8"
            className={cx("transition-colors [animation:dash_1.2s_linear_infinite]", drag ? "stroke-brand-300" : "stroke-white/20 group-hover:stroke-brand-400/70")}
          />
        </svg>
        <style>{`@keyframes dash { to { stroke-dashoffset: -32; } }`}</style>
        <div
          className={cx(
            "relative mb-3 grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-inset ring-white/10 transition duration-300",
            drag ? "scale-110 bg-brand-500/30 text-brand-800" : "bg-white/[0.06] text-brand-300 group-hover:-translate-y-1",
          )}
        >
          {busy > 0 ? <Loader2 className="h-6 w-6 animate-spin" /> : drag ? <UploadCloud className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
        </div>
        <div className="relative font-display text-base font-semibold text-fg">
          {busy > 0 ? `Uploading ${busy} page${busy === 1 ? "" : "s"}…` : drag ? "Drop to upload" : "Drop textbook pages here"}
        </div>
        <div className="relative mt-1 text-sm text-fg-subtle">
          or <span className="text-brand-300 underline-offset-2 group-hover:underline">browse photos</span> · up to {max} pages · Claude follows them closely
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <AnimatePresence initial={false}>
            {value.map((u, i) => (
              <motion.div
                key={u}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Page ${i + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  Page {i + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove page ${i + 1}`}
                  onClick={() => onChange(value.filter((x) => x !== u))}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition hover:bg-red-500 group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
