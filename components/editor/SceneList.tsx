"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { SCENE_TYPES } from "@/lib/constants";
import { sceneSeconds, type Scene } from "@/lib/plan";
import { cx } from "../ui";

export const typeMeta = (t: string) => SCENE_TYPES.find((s) => s.type === t) ?? SCENE_TYPES[0];

export function sceneLabel(s: Scene): string {
  switch (s.type) {
    case "title":
    case "outro":
      return s.title;
    case "quiz":
      return s.question;
    default:
      return "heading" in s ? s.heading : "";
  }
}

/** A scene has an obvious problem worth a dot in the list. */
export function sceneProblem(s: Scene): string | null {
  if (!s.beats.length || s.beats.some((b) => !b.say.trim())) return "Empty narration";
  if (s.type === "quiz" && s.beats.length !== 2) return "Quiz needs exactly 2 beats";
  if (s.type === "islamic") return "Check the reference";
  return null;
}

const TONES = ["#8B5CF6", "#22D3EE", "#F472B6", "#FBBF24", "#34D399", "#38BDF8", "#FB923C", "#A78BFA", "#FB7185", "#2DD4BF", "#C084FC", "#F59E0B"];
const toneFor = (t: string) => TONES[Math.max(0, SCENE_TYPES.findIndex((s) => s.type === t)) % TONES.length];

function SceneItem({
  id,
  scene,
  index,
  active,
  speed,
  disabled,
  onSelect,
  onDup,
  onDel,
}: {
  id: string;
  scene: Scene;
  index: number;
  active: boolean;
  speed: number;
  disabled?: boolean;
  onSelect: () => void;
  onDup: () => void;
  onDel: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const m = typeMeta(scene.type);
  const tone = toneFor(scene.type);
  const problem = sceneProblem(scene);
  const line = sceneLabel(scene) || scene.beats[0]?.say || "Untitled";
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "group relative flex items-center gap-1.5 rounded-2xl border p-1.5 pr-1 transition duration-200",
        active ? "border-white/15 bg-white/[0.07]" : "border-transparent hover:border-white/10 hover:bg-white/[0.035]",
        isDragging && "z-20 border-brand-400/50 bg-bg-elev shadow-glow",
      )}
    >
      {active && (
        <motion.span
          layoutId="scene-active"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
          style={{ background: tone, boxShadow: `0 0 12px ${tone}` }}
          transition={{ type: "spring", stiffness: 500, damping: 36 }}
        />
      )}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none rounded-lg p-1 text-fg-subtle/60 transition hover:text-fg active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ring-1 ring-inset ring-white/10"
          style={{ background: `linear-gradient(135deg, ${tone}33, ${tone}0d)` }}
        >
          {m.emoji}
          {problem && (
            <span
              title={problem}
              className={cx(
                "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-card",
                scene.type === "islamic" ? "bg-amber-400" : "bg-rose-500",
              )}
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
            <span className="tabular-nums text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
            <span>{m.name}</span>
          </span>
          <span className={cx("block truncate text-[13px] font-semibold", active ? "text-fg" : "text-fg-muted")}>{line}</span>
          <span className="mt-0.5 block text-[10px] tabular-nums text-fg-subtle">
            {scene.beats.length} beat{scene.beats.length === 1 ? "" : "s"} · ~{Math.round(sceneSeconds(scene, speed))}s
          </span>
        </span>
      </button>
      {!disabled && (
        <div className="flex flex-col opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={onDup} aria-label="Duplicate scene" title="Duplicate" className="rounded-lg p-1.5 text-fg-subtle hover:bg-white/[0.08] hover:text-fg">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDel} aria-label="Delete scene" title="Delete" className="rounded-lg p-1.5 text-fg-subtle hover:bg-red-100 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function SceneList({
  scenes,
  keys,
  sel,
  speed,
  locked,
  onSelect,
  onDup,
  onDel,
  onMove,
  onAdd,
}: {
  scenes: Scene[];
  keys: string[];
  sel: number;
  speed: number;
  locked?: boolean;
  onSelect: (i: number) => void;
  onDup: (i: number) => void;
  onDel: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onMove(keys.indexOf(String(e.active.id)), keys.indexOf(String(e.over.id)));
  }
  return (
    <div className="card flex flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <div className="font-display text-sm font-semibold text-fg">Scenes</div>
          <div className="text-[11px] text-fg-subtle">Drag to reorder · {scenes.length} total</div>
        </div>
        <button
          onClick={onAdd}
          disabled={locked}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500/15 px-2.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-400/30 transition hover:bg-brand-500/25 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="scrollbar-thin max-h-[calc(100vh-15rem)] overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {scenes.map((s, i) => (
                <SceneItem
                  key={keys[i] ?? i}
                  id={keys[i] ?? String(i)}
                  scene={s}
                  index={i}
                  speed={speed}
                  active={i === sel}
                  disabled={locked}
                  onSelect={() => onSelect(i)}
                  onDup={() => onDup(i)}
                  onDel={() => onDel(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
