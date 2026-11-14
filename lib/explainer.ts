import { XMLValidator } from "fast-xml-parser";
import {
  EXPLAINER_ACTIONS,
  type Explainer,
  type ExplainerAction,
  type ExplainerBeat,
  type ExplainerPart,
  type ExplainerStep,
} from "./plan";

/** Stage size in SVG units: Shorts are portrait, long videos landscape. */
export const STAGE_DIMS = { short: [1080, 1920], long: [1920, 1080] } as const;

const SVGNS = "http://www.w3.org/2000/svg";
const XLINKNS = "http://www.w3.org/1999/xlink";
const MAX_STAGE_BYTES = 400_000;

/** Actions that animate a part of the drawing and therefore need a real element id. */
const NEEDS_STAGE_ID = new Set(["show", "hide", "pop", "wipe", "move", "scale", "fill"]);

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isColor = (c: unknown): c is string => typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

function numArray(v: unknown, len: number): number[] | null {
  if (!Array.isArray(v) || v.length < len) return null;
  const out = v.slice(0, len).map(Number);
  return out.every((n) => Number.isFinite(n)) ? out : null;
}

/* ------------------------------------------------------------------ */
/* SVG                                                                  */
/* ------------------------------------------------------------------ */

function removeElements(s: string, tags: string[]) {
  for (const t of tags) {
    s = s.replace(new RegExp(`<${t}\\b[^>]*\\/>`, "gi"), "");
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\/?${t}\\b[^>]*>`, "gi"), ""); // stray open/close tags
  }
  return s;
}

/**
 * Clean an AI-drawn SVG so the engine (Python ElementTree + resvg) can parse and render it safely.
 * Throws a teacher-friendly error if it isn't usable at all.
 */
export function sanitizeStage(
  input: string,
  format: "long" | "short",
  label = "The drawing",
): { svg: string; ids: Set<string>; warnings: string[] } {
  const warnings: string[] = [];
  let s = String(input ?? "").trim();
  s = s.replace(/^```(?:svg|xml|html)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.search(/<svg\b/i);
  const end = s.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < 0 || end < start) throw new Error(`${label} is missing or isn't an SVG picture.`);
  s = s.slice(start, end + 6);
  if (s.length > MAX_STAGE_BYTES)
    throw new Error(`${label} is too detailed (${Math.round(s.length / 1000)} KB) — please regenerate the script.`);

  // declarations, comments, doctype
  s = s.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // unsafe / unsupported elements
  const before = s.length;
  s = removeElements(s, ["script", "foreignObject", "image", "iframe", "video", "audio", "object", "embed", "animate", "animateTransform", "animateMotion", "set"]);
  s = s.replace(/<\/?a\b[^>]*>/gi, ""); // keep link contents, drop the link
  if (s.length !== before) warnings.push(`${label}: removed some parts the animation engine can't use (scripts, photos or built-in animations).`);
  s = s.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (m, css: string) =>
    /@import|url\(\s*['"]?(?:https?:|\/\/|data:)/i.test(css) ? "" : m,
  );

  // attributes: event handlers, external links, foreign namespaces
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  s = s.replace(/\s+((?:xlink:)?href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, _a, _q, d1, d2) =>
    String(d1 ?? d2 ?? "").trim().startsWith("#") ? m : "",
  );
  s = s.replace(/url\(\s*['"]?(?:https?:|\/\/|data:)[^)]*\)/gi, "none");
  s = s.replace(/\s+([A-Za-z_][\w.-]*):([\w.-]+)\s*=\s*("[^"]*"|'[^']*')/g, (m, prefix: string) =>
    ["xlink", "xml", "xmlns"].includes(prefix) ? m : "",
  );
  // editor metadata elements like <sodipodi:namedview/>
  s = s.replace(/<([A-Za-z_][\w.-]*):[\w.-]+\b[^>]*\/>/g, "");
  s = s.replace(/<([A-Za-z_][\w.-]*:[\w.-]+)\b[^>]*>[\s\S]*?<\/\1\s*>/g, "");
  s = s.replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, "");

  // HTML entities that aren't valid XML
  s = s.replace(/&nbsp;/g, "&#160;");
  s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");

  // root element
  const [W, H] = STAGE_DIMS[format];
  s = s.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs.replace(/\/\s*$/, "");
    a = a.replace(/\s+(width|height|x|y|style|class)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    if (!/\sxmlns\s*=/.test(a)) a = ` xmlns="${SVGNS}"` + a;
    if (/xlink:/.test(s) && !/xmlns:xlink\s*=/.test(a)) a += ` xmlns:xlink="${XLINKNS}"`;
    const vb = a.match(/\sviewBox\s*=\s*["']([^"']*)["']/i);
    if (!vb) {
      a += ` viewBox="0 0 ${W} ${H}"`;
    } else {
      const n = vb[1].trim().split(/[\s,]+/).map(Number);
      if (n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[2] <= 0 || n[3] <= 0) {
        a = a.replace(vb[0], ` viewBox="0 0 ${W} ${H}"`);
      } else if (Math.abs(n[2] / n[3] - W / H) > 0.04) {
        warnings.push(`${label} isn't the shape of the video frame, so its edges may be cut off.`);
      }
    }
    return `<svg${a}>`;
  });

  const v = XMLValidator.validate(s);
  if (v !== true) {
    const e = v.err;
    throw new Error(`${label} has a drawing error (line ${e.line}: ${e.msg}). Please regenerate the script.`);
  }

  const ids = new Set<string>();
  for (const m of s.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  return { svg: s, ids, warnings };
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */

function cleanAction(raw: ExplainerAction, ids: Set<string>, drop: (why: string) => void): ExplainerAction | null {
  const a: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const kind = a.do as string;
  if (!(EXPLAINER_ACTIONS as readonly string[]).includes(kind)) {
    drop(`an unknown animation "${String(kind)}"`);
    return null;
  }
  if (typeof a.id === "string") a.id = a.id.trim();
  if (NEEDS_STAGE_ID.has(kind)) {
    if (typeof a.id !== "string" || !ids.has(a.id)) {
      drop(`a "${kind}" animation for a part that isn't in the drawing ("${String(a.id ?? "")}")`);
      return null;
    }
  }

  // timing
  if (a.at != null) a.at = isNum(a.at) ? clamp(a.at, 0, 30) : 0;
  if (a.word != null && typeof a.word !== "string") delete a.word;
  if (a.at == null && a.word == null) a.at = 0;
  if (a.dur != null) {
    if (isNum(a.dur)) a.dur = clamp(a.dur, 0.1, 40);
    else delete a.dur;
  }
  if (a.sfx != null && !["pop", "whoosh", "sparkle", "ding", "tick", "plop", "blip"].includes(String(a.sfx))) delete a.sfx;

  switch (kind) {
    case "wipe": {
      if (!["up", "down", "left", "right"].includes(String(a.dir))) a.dir = "up";
      const b = numArray(a.box, 4);
      if (b && b[2] > 0 && b[3] > 0) a.box = b;
      else delete a.box;
      break;
    }
    case "move": {
      const t = Array.isArray(a.to) ? numArray(a.to, 2) : null;
      if (!t) {
        drop(`a move animation with no target`);
        return null;
      }
      a.to = t;
      break;
    }
    case "scale": {
      const f = isNum(a.to) ? a.to : Array.isArray(a.to) ? Number(a.to[0]) : NaN;
      if (!Number.isFinite(f)) {
        drop(`a resize animation with no size`);
        return null;
      }
      a.to = clamp(f, 0.05, 6);
      break;
    }
    case "fill":
      if (!isColor(a.color)) {
        drop(`a colour change with no valid colour`);
        return null;
      }
      break;
    case "camera": {
      if (a.box === null || a.box === undefined) {
        a.box = null;
      } else {
        const b = numArray(a.box, 3);
        if (!b || b[2] <= 0) {
          drop(`a camera move with an invalid frame`);
          return null;
        }
        a.box = b;
      }
      break;
    }
    case "label": {
      const p = numArray(a.point, 2);
      const text = typeof a.text === "string" ? a.text.replace(/\s+/g, " ").trim() : "";
      if (!p || !text || typeof a.id !== "string" || !a.id) {
        drop(`a label with no text or position`);
        return null;
      }
      const words = text.split(" ");
      a.text = words.slice(0, 3).join(" ").slice(0, 28);
      a.point = p;
      if (!["left", "right"].includes(String(a.side))) a.side = "right";
      if (a.len != null) a.len = isNum(a.len) ? clamp(a.len, 20, 600) : 150;
      if (a.dy != null) a.dy = isNum(a.dy) ? clamp(a.dy, -400, 400) : 0;
      if (isColor(a.color) === false) delete a.color;
      break;
    }
    case "unlabel":
      if (typeof a.id !== "string" || !a.id) a.id = "*";
      break;
    case "flow": {
      const pts = Array.isArray(a.path) ? a.path.map((q) => numArray(q, 2)).filter((q): q is number[] => !!q) : [];
      if (pts.length < 2) {
        drop(`a flow animation with no path`);
        return null;
      }
      a.path = pts.slice(0, 60);
      a.count = isNum(a.count) ? Math.round(clamp(a.count, 1, 20)) : 7;
      a.speed = isNum(a.speed) ? clamp(a.speed, 0.5, 15) : 2.5;
      if (a.r != null) a.r = isNum(a.r) ? clamp(a.r, 2, 60) : 9;
      if (a.shape != null && !["dot", "steam"].includes(String(a.shape))) delete a.shape;
      if (a.layer != null && (typeof a.layer !== "string" || !ids.has(a.layer))) delete a.layer;
      if (!isColor(a.color)) delete a.color;
      if (a.wiggle != null) a.wiggle = isNum(a.wiggle) ? clamp(a.wiggle, 0, 40) : 0;
      if (a.dur == null) a.dur = 6;
      break;
    }
    case "pulse": {
      const p = numArray(a.point, 2);
      if (!p) {
        drop(`a highlight with no position`);
        return null;
      }
      a.point = p;
      if (a.r != null) a.r = isNum(a.r) ? clamp(a.r, 5, 400) : 50;
      if (!isColor(a.color)) delete a.color;
      break;
    }
    case "pop": {
      const o = numArray(a.origin, 2);
      if (o) a.origin = o;
      else delete a.origin;
      break;
    }
  }
  if (kind === "scale" || kind === "pop") {
    const o = numArray(a.origin, 2);
    if (o) a.origin = o;
    else delete a.origin;
  }
  return a as ExplainerAction;
}

/* ------------------------------------------------------------------ */
/* Whole explainer                                                      */
/* ------------------------------------------------------------------ */

/**
 * Make an AI-written (or hand-edited) explainer safe and consistent for the engine.
 * Returns plain-language warnings for the teacher. Throws if a drawing is unusable.
 */
export function sanitizeExplainer(
  e: Explainer,
  format: "long" | "short",
): { explainer: Explainer; warnings: string[] } {
  const warnings: string[] = [];
  if (!e?.parts?.length) throw new Error("The diagram script has no parts.");
  const multi = e.parts.length > 1;

  const parts: ExplainerPart[] = e.parts.map((part, pi) => {
    const label = multi ? `Diagram ${pi + 1}` : "The drawing";
    const { svg, ids, warnings: w } = sanitizeStage(part.stage, format, label);
    warnings.push(...w);

    const hidden = Array.from(new Set((part.hidden ?? []).map((h) => String(h).trim()))).filter((h) => ids.has(h));
    const dropped = (part.hidden ?? []).length - hidden.length;
    if (dropped > 0) warnings.push(`${label}: ignored ${dropped} hidden part name(s) that aren't in the drawing.`);

    let droppedActions = 0;
    const reasons = new Set<string>();
    const drop = (why: string) => {
      droppedActions++;
      if (reasons.size < 3) reasons.add(why);
    };
    const revealed = new Set<string>();

    const steps: ExplainerStep[] = (part.steps ?? [])
      .map((st): ExplainerStep | null => {
        const beats: ExplainerBeat[] = (st.beats ?? [])
          .map((b): ExplainerBeat | null => {
            const say = String(b?.say ?? "").replace(/\s+/g, " ").trim();
            if (!say) return null;
            const actions = (b.actions ?? [])
              .map((a) => cleanAction(a, ids, drop))
              .filter((a): a is ExplainerAction => !!a);
            for (const a of actions) if (["show", "pop", "wipe"].includes(a.do) && a.id) revealed.add(a.id);
            const out: ExplainerBeat = { say, actions };
            const cap = typeof b.caption === "string" ? b.caption.replace(/\s+/g, " ").trim() : "";
            if (cap && cap !== say) out.caption = cap;
            if (isNum(b.pause)) out.pause = clamp(b.pause, 0, 4);
            return out;
          })
          .filter((b): b is ExplainerBeat => !!b);
        if (!beats.length) return null;
        const title = String(st.title ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
        const step: ExplainerStep = { title, beats };
        const tag = typeof st.tag === "string" ? st.tag.trim().slice(0, 20) : "";
        if (tag) step.tag = tag;
        if (typeof st.highlight === "string" && st.highlight.trim()) step.highlight = st.highlight.trim();
        return step;
      })
      .filter((s): s is ExplainerStep => !!s);

    if (!steps.length) throw new Error(`${label} has no narration.`);
    if (droppedActions)
      warnings.push(`${label}: skipped ${droppedActions} animation(s) — ${Array.from(reasons).join("; ")}.`);
    const never = hidden.filter((h) => !revealed.has(h));
    if (never.length)
      warnings.push(`${label}: ${never.length} part(s) start hidden and are never shown (${never.slice(0, 4).join(", ")}).`);

    let camera: number[] | null = null;
    const c = numArray(part.camera, 3);
    if (c && c[2] > 0) camera = c;
    return { stage: svg, hidden, camera, steps };
  });

  const theme = e.theme
    ? Object.fromEntries(Object.entries(e.theme).filter(([, v]) => isColor(v)))
    : undefined;
  return { explainer: { ...(theme && Object.keys(theme).length ? { theme } : {}), parts }, warnings };
}
