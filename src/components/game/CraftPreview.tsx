"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Group, Vector3 } from "three";
import { Scene3D } from "@/components/three/lazy";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/mission";
import type { Evaluation } from "@/game/engine";
import { disposeModel, makeRocket, makeSpacecraft } from "@/game/parts3d";

type Mode = "craft" | "rocket";

/** The selected components assembled into one model, centred and scaled to a fixed size so every design fits the same camera. */
function Model({ ev, mode, fit }: { ev: Evaluation; mode: Mode; fit: number }) {
  const spin = useRef<Group>(null);
  const reduced = useUIStore((s) => s.reducedMotion);
  const key = `${mode}|${ev.vehicle.id}|${ev.design.solarAreaM2}|${ev.design.rtgUnits}|${ev.antenna.id}|${ev.design.propulsionId}|${ev.design.thrusters}|${ev.design.instrumentIds.join(",")}`;
  const built = useMemo(() => {
    const inner = mode === "rocket"
      ? makeRocket(ev.vehicle.id, ev.vehicle.length_m ?? 40, ev.vehicle.diameter_m ?? 3.5)
      : makeSpacecraft({
          solarAreaM2: ev.design.solarAreaM2, rtgUnits: ev.design.rtgUnits, antennaId: ev.antenna.id, dishM: ev.antenna.dishM,
          thruster: ev.design.propulsionId, thrusters: ev.electric ? ev.design.thrusters : 1,
          instruments: ev.instruments.map((i) => ({ tag: i.tag, massKg: i.mass_kg })),
        });
    const box = new Box3().setFromObject(inner), size = box.getSize(new Vector3()), c = box.getCenter(new Vector3());
    const k = fit / Math.max(size.x, size.y, size.z, 0.01);
    inner.position.sub(c); // centre on the origin, then scale the wrapper
    const root = new Group(); root.add(inner); root.scale.setScalar(k);
    return root;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every design input the model depends on
  }, [key, fit]);
  useEffect(() => () => disposeModel(built), [built]);
  useFrame((_, dt) => { if (spin.current && !reduced) spin.current.rotation.y += dt * 0.35; });
  return <group ref={spin}><primitive object={built} /></group>;
}

export function CraftPreview({ ev, className }: { ev: Evaluation; className?: string }) {
  const [mode, setMode] = useState<Mode>("craft");
  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={cn("rounded-sm border px-2.5 py-1 font-display text-xs uppercase tracking-wider", mode === m ? "border-orange bg-orange/15 text-orange" : "border-[var(--border)] text-ink2 hover:text-ink")}>{label}</button>
  );
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-[var(--border)] bg-panel", className)}>
      <div className="absolute left-2 top-2 z-10 flex gap-1" role="tablist" aria-label="3-D preview">{tab("craft", "Spacecraft")}{tab("rocket", "Rocket")}</div>
      <p className="pointer-events-none absolute bottom-2 left-2 z-10 text-[10px] uppercase tracking-widest text-muted">
        {mode === "craft" ? `${ev.instruments.length} instrument${ev.instruments.length === 1 ? "" : "s"} · ${ev.antenna.name} · ${ev.electric ? ev.electric.name : "chemical"}` : `${ev.vehicle.name} · drag to rotate`}
      </p>
      <Scene3D controls light="studio" stars={false} camera={mode === "craft" ? [3.0, 1.7, 3.8] : [2.6, 1.3, 5.2]} label={mode === "craft" ? "3-D model of your spacecraft" : `3-D model of the ${ev.vehicle.name} rocket`}>
        <Model ev={ev} mode={mode} fit={mode === "craft" ? 3.6 : 3.3} />
      </Scene3D>
    </div>
  );
}
