"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, X } from "lucide-react";
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
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-8 text-center transition",
          drag ? "scale-[1.01] border-brand-500 bg-brand-50" : "border-brand-200 bg-white hover:border-brand-400 hover:bg-brand-50/50",
        )}
      >
        {busy > 0 ? <Loader2 className="mb-2 h-9 w-9 animate-spin text-brand-500" /> : <ImagePlus className="mb-2 h-9 w-9 text-brand-500" />}
        <div className="font-display text-lg font-semibold">{busy > 0 ? `Uploading ${busy}…` : "Drop textbook pages here"}</div>
        <div className="text-sm text-slate-500">or click to choose photos · up to {max} pages · Claude will follow them</div>
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
          {value.map((u, i) => (
            <div key={u} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-brand-50 ring-1 ring-brand-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 text-xs font-bold">p{i + 1}</span>
              <button
                type="button"
                aria-label="Remove page"
                onClick={() => onChange(value.filter((x) => x !== u))}
                className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
