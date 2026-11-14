import { describe, expect, it } from "vitest";
import { Box3, Vector3, type Mesh, type Object3D } from "three";
import { ANTENNAS, DATASET, type InstrumentTag } from "@/game/data";
import { makeAntenna, makeInstrument, makeRocket, makeRTG, makeSolarArray, makeSpacecraft, makeThruster } from "@/game/parts3d";

const size = (g: Object3D) => new Box3().setFromObject(g).getSize(new Vector3());
const meshes = (g: Object3D) => { let n = 0; g.traverse((o) => { if ((o as Mesh).isMesh) n++; }); return n; };

describe("3-D component models", () => {
  it("builds a rocket for every dataset vehicle, taller than wide, with strap-on boosters where they exist", () => {
    for (const v of DATASET.vehicles) {
      const r = makeRocket(v.id, v.length_m ?? 40, v.diameter_m ?? 3.5), s = size(r);
      expect(s.y).toBeGreaterThan(s.x); expect(meshes(r)).toBeGreaterThan(6);
    }
    const heavy = makeRocket("ll2_cfg_161", 70, 3.7), single = makeRocket("ll2_cfg_164", 70, 3.7);
    expect(size(heavy).x).toBeGreaterThan(size(single).x * 2); // Falcon Heavy has side cores
  });
  it("builds every thruster, antenna, instrument tag, solar array and RTG", () => {
    for (const k of ["chem", ...DATASET.electric_propulsion.map((e) => e.id)]) expect(meshes(makeThruster(k))).toBeGreaterThan(3);
    for (const a of ANTENNAS) expect(meshes(makeAntenna(a.id, a.dishM))).toBeGreaterThan(0);
    for (const i of DATASET.instruments) expect(meshes(makeInstrument(i.tag, i.mass_kg))).toBeGreaterThan(1);
    expect(meshes(makeRTG())).toBeGreaterThan(10); expect(meshes(makeSolarArray(20))).toBeGreaterThan(2);
  });
  it("bigger dishes and solar arrays are physically bigger; heavier instruments are scaled up", () => {
    expect(size(makeAntenna("large", 4)).x).toBeGreaterThan(size(makeAntenna("medium", 1)).x * 3);
    expect(size(makeSolarArray(80)).x).toBeGreaterThan(size(makeSolarArray(8)).x);
    expect(size(makeInstrument("imager", 40)).y).toBeGreaterThan(size(makeInstrument("imager", 1)).y);
  });
  it("assembles the selected parts into one spacecraft", () => {
    const tags: InstrumentTag[] = ["fields", "radar"];
    const empty = makeSpacecraft({ solarAreaM2: 0, rtgUnits: 0, antennaId: "patch", dishM: 0.3, thruster: "chem", thrusters: 1, instruments: [] });
    const full = makeSpacecraft({ solarAreaM2: 30, rtgUnits: 2, antennaId: "high", dishM: 2.5, thruster: "next", thrusters: 3, instruments: tags.map((t) => ({ tag: t, massKg: 5 })) });
    expect(meshes(full)).toBeGreaterThan(meshes(empty) + 20);
    expect(size(full).x).toBeGreaterThan(size(empty).x * 2);
  });
});
