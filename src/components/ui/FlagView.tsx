"use client";
import { useEffect, useRef } from "react";
import { drawFlag, type CustomFlag } from "@/game/flags";

/** A flag drawn on a canvas (used for previews, chips and patches). */
export function FlagView({ id, custom, width = 120, label }: { id: string; custom: CustomFlag; width?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = Math.round(width * 0.65);
  useEffect(() => {
    const c = ref.current, ctx = c?.getContext("2d"); if (!c || !ctx) return;
    const draw = () => drawFlag(ctx, c.width, c.height, id, custom, draw);
    draw();
  }, [id, custom, width]);
  return <canvas ref={ref} width={width * 2} height={h * 2} role="img" aria-label={label ?? `${id} flag`} className="rounded-sm shadow" style={{ width, height: h }} />;
}
