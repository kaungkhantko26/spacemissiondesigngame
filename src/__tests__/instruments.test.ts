import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, evaluate, type Design } from "@/game/engine";
import { DATASET, DESTINATIONS, GAME } from "@/game/data";
import { catalogUrl, curationOf, hardware, suitability } from "@/game/instruments";
import { useDesignStore } from "@/game/store";

const byName = (n: string) => DATASET.instruments.find((i) => i.name.includes(n))!;
const LP_MAG = byName("Lunar Prospector Magnetometer"), LP_ER = byName("Lunar Prospector Electron Reflectometer"), EFD = byName("Electric Field Detector"), DFMI = byName("Dust Flux Monitor"), MB = byName("Mossbauer");
const moon = (ids: string[]): Design => ({ ...DEFAULT_DESIGN, propellantKg: 1000, solarAreaM2: 30, antennaId: "high", marginPct: 10, instrumentIds: ids });

describe("second review — instruments are matched by measurement, not by broad tag", () => {
  it("the Lunar Prospector magnetometer and electron reflectometer share one package that counts once", () => {
    const both = hardware([LP_MAG, LP_ER]), one = hardware([LP_MAG]);
    expect(both.massKg).toBe(5); expect(both.powerW).toBe(4.5); expect(both.sharedPackages).toEqual(["lp-mager"]);
    expect(both.massKg).toBe(one.massKg); // adding the second instrument does not add the shared box again
  });
  it("an electric-field detector plus a dust monitor do not satisfy the magnetic-field and electron contract", () => {
    const ev = evaluate(moon([EFD.id, DFMI.id]));
    const c = ev.checks.find((x) => x.id === "contract")!;
    expect(c.state).toBe("bad"); expect(c.detail).toMatch(/magnetic-field/); expect(ev.goNoGo).toBe(false);
  });
  it("the magnetometer + electron reflectometer pair meets the contract", () => {
    expect(evaluate(moon([LP_MAG.id, LP_ER.id])).checks.find((x) => x.id === "contract")!.state).toBe("ok");
  });
  it("a rover-arm instrument is flagged as unusable from orbit", () => {
    expect(curationOf(MB).deployment).toBe("contact");
    const moonDest = DESTINATIONS.find((d) => d.id === "moon")!;
    expect(suitability(MB, moonDest).kind).toBe("unsuitable");
    const ev = evaluate(moon([LP_MAG.id, LP_ER.id, MB.id]));
    expect(ev.checks.some((c) => c.state === "bad" && /rover/.test(c.detail))).toBe(true); expect(ev.goNoGo).toBe(false);
  });
  it("the camera mass is the sum of its parts (12 kg), not the periscope alone", () => {
    const cam = byName("Imaging and Navigation Camera");
    expect(hardware([cam]).massKg).toBe(12);
  });
  it("source links are built from the catalogue id", () => {
    expect(catalogUrl(EFD)).toBe("https://nssdc.gsfc.nasa.gov/nmc/experiment/display.action?id=1978-051A-13");
  });
  it("quick start for the Moon picks the magnetometer and electron reflectometer", () => {
    expect(useDesignStore.getState().quickStart("moon")).toBe(true);
    const ids = useDesignStore.getState().design.instrumentIds;
    expect(ids).toContain(LP_MAG.id); expect(ids).toContain(LP_ER.id);
    expect(GAME.defaultInstrumentPowerW).toBeGreaterThan(0);
  });
});
