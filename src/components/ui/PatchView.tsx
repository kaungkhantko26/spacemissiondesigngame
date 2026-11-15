"use client";
import { useEffect, useRef } from "react";
import { drawPatch, useFlag } from "@/game/flags";

/** The real emblem of a chest patch, drawn on a canvas. */
export function PatchView({ kind, color, accent, size = 80, label }: { kind: string; color: string; accent: string; size?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null), custom = useFlag((s) => s.custom);
  useEffect(() => {
    const c = ref.current, ctx = c?.getContext("2d"); if (!c || !ctx) return;
    const draw = () => drawPatch(ctx, c.width, kind, color, accent, custom, draw);
    draw();
  }, [kind, color, accent, custom, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} role="img" aria-label={label ?? "patch"} style={{ width: size, height: size }} />;
}
