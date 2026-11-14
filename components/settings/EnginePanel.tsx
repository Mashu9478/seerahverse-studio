"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Hammer, RefreshCw, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Badge, Button, Skeleton, cx } from "../ui";

interface EngineInfo {
  engine: {
    status: "none" | "building" | "snapshotting" | "ready" | "failed";
    snapshot_id?: string;
    engine_version?: string;
    build_version?: string;
    log?: string;
    error?: string;
    started_at?: string;
    finished_at?: string;
  };
  deployed_version: string;
  outdated: boolean;
  queued: number;
}

const META: Record<string, { label: string; cls: string; dot: string }> = {
  none: { label: "Not built · optional", cls: "bg-white/[0.06] text-fg-muted", dot: "bg-fg-subtle" },
  building: { label: "Building…", cls: "bg-orange/15 text-[#FED7AA]", dot: "bg-orange animate-pulse" },
  snapshotting: { label: "Saving snapshot…", cls: "bg-sky-400/15 text-sky-300", dot: "bg-sky-300 animate-pulse" },
  ready: { label: "Ready", cls: "bg-emerald-400/15 text-emerald-300", dot: "bg-emerald-300" },
  failed: { label: "Build failed", cls: "bg-rose-500/15 text-rose-300", dot: "bg-rose-400" },
};

export function EnginePanel() {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await api<EngineInfo>("/api/engine"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the engine");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const building = info?.engine.status === "building" || info?.engine.status === "snapshotting";
  useEffect(() => {
    if (!building) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [building, load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [info?.engine.log]);

  async function build() {
    setBusy(true);
    try {
      await api("/api/engine", { method: "POST" });
      toast.success("Building the render engine — this takes a minute or two.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the build");
    } finally {
      setBusy(false);
    }
  }

  const st = info?.engine.status ?? "none";
  const m = META[st] ?? META.none;
  const showLog = building || (!!info?.engine.log && st !== "ready");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Cpu className="h-4 w-4 text-cyan-300" /> Fast-start engine
        </div>
        {info ? (
          <Badge className={m.cls}>
            <span className={cx("h-1.5 w-1.5 rounded-full", m.dot)} />
            {m.label}
          </Badge>
        ) : (
          <Skeleton className="h-6 w-28" />
        )}
      </div>
      <p className="text-[13px] text-fg-muted">
        Videos are drawn and narrated on Vercel Sandbox machines. Rendering works right away; building the engine (≈1–2 min, optional) saves a ready-made copy so each video starts ~30 s faster.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { k: "Deployed engine", v: info?.deployed_version },
          { k: "Built snapshot", v: info?.engine.engine_version ?? "—" },
          { k: "Videos waiting", v: info?.queued },
        ].map((x) => (
          <div key={x.k} className="panel p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{x.k}</div>
            <div className="mt-1 font-display text-lg font-semibold tabular-nums text-fg">{info ? x.v : "…"}</div>
          </div>
        ))}
      </div>

      {info?.outdated && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-[13px] text-amber-200">
          A newer engine version is deployed. Renders always use the newest engine code; rebuild so the saved copy has any new tools too.
        </p>
      )}
      {info?.engine.error && <p className="rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-3 text-[13px] text-rose-200">{info.engine.error}</p>}

      {showLog && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#05050A]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            <span className="ml-2 flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle">
              <TerminalSquare className="h-3.5 w-3.5" /> engine build log
            </span>
            {building && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          </div>
          <pre ref={logRef} className="scrollbar-thin max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-emerald-300/90">
            {info?.engine.log || "Starting…"}
            {building && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-300 align-middle" />}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={st === "ready" && !info?.outdated ? "secondary" : "primary"}
          icon={<Hammer className="h-4 w-4" />}
          loading={busy || building}
          onClick={build}
        >
          {st === "ready" ? "Rebuild engine" : building ? "Building…" : "Build fast-start engine"}
        </Button>
        <Button variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={load}>
          Refresh status
        </Button>
      </div>
    </div>
  );
}
