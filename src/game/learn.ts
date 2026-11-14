import type { Evaluation } from "./engine";
import { OPS, downlinkMbps, type OpsState } from "./ops/sim";
import { CELL_DEG, TILE_DEG, cellCentre, placeLabel, tileBounds, type LunarField, type Observation } from "./lunarField";

export interface Learning { found: string[]; design: string[]; ideas: { term: string; text: string }[]; caveat: string }

/** A few well-known lunar magnetic features (approximate centres; general knowledge, NOT taken from the archived data set). */
const LANDMARKS = [
  { name: "Mare Ingenii", lat: -33.7, lon: 163.5, note: "a farside basin with strong magnetic anomalies and bright swirls" },
  { name: "Reiner Gamma", lat: 7.5, lon: 301, note: "the best-known magnetic swirl on the nearside" },
] as const;
const nearLandmark = (lat: number, lon: number) => LANDMARKS.find((l) => Math.abs(l.lat - lat) <= 8 && Math.min(Math.abs(l.lon - lon), 360 - Math.abs(l.lon - lon)) <= 10);

/** What the player can take away from this run: the science they actually returned, why the design did what it did, and the key ideas. */
export function buildLearning(f: LunarField | null, obs: Observation | null, n: OpsState, ev: Evaluation): Learning {
  const found: string[] = [], design: string[] = [];
  const gen = n.stats.generatedGb, retShare = gen > 0 ? Math.min(1, n.stats.returnedGb / gen) : 0;
  if (f && obs && obs.returned.size > 0) {
    let sum = 0, max = -1, maxK = -1;
    obs.returned.forEach((k) => { const v = f.values[k]; sum += v; if (v > max) { max = v; maxK = k; } });
    const mean = sum / obs.returned.size, c = cellCentre(maxK), lm = nearLandmark(c.lat, c.lon);
    found.push(`Your data covers ${obs.returned.size} map cells (each ${CELL_DEG}° x ${CELL_DEG}°). The average archived field in them is ${mean.toFixed(1)} nT. For comparison, the whole archived map has a median of ${f.meta.stats.medianNT} nT and its strongest cell reads ${f.meta.stats.maxNT} nT.`);
    found.push(`The strongest cell you returned is near ${placeLabel(c.lat, c.lon)} at ${max.toFixed(1)} nT${max >= f.meta.stats.p95NT ? ", in the strongest 5 % of all archived cells" : ""}.${lm ? ` That is close to ${lm.name}, ${lm.note} (landmark position approximate, from general knowledge).` : ""}`);
    const hi = obs.perTarget.map((t) => { const b = tileBounds(t.id)!; return { t, label: placeLabel(b.lat0 + TILE_DEG / 2, b.lon0 + TILE_DEG / 2) }; });
    found.push(`Regions you chose: ${hi.map((h, i) => `${i + 1}. ${h.label} (${h.t.returned} of ${h.t.valid} cells returned)`).join("; ")}.`);
  } else if (obs && obs.observed.size > 0) found.push(`The instruments observed ${obs.observed.size} cells, but none of that data reached Earth, so nothing could be mapped. Observing is only half of a survey: the data has to come home.`);
  else found.push("No chosen region was observed, so there is no new map to compare with the archive.");

  const eff = downlinkMbps(ev).toFixed(1);
  design.push(gen > 0 ? `${(retShare * 100).toFixed(0)} % of the recorded data reached Earth. With a ${ev.antenna.name} the downlink rate was about ${eff} Mbps, and a larger share is lost when storage fills before a ground pass.` : "No data was recorded, so the antenna choice made no difference this time.");
  design.push(ev.rtgGenW > 0 ? `RTGs gave ${Math.round(ev.rtgGenW)} W even in eclipse; solar arrays only produce in sunlight, so the battery has to bridge ${Math.round(OPS.eclipseFrac * 100)} % of every orbit.` : "Solar arrays produce nothing in the Moon's shadow, so the battery carried the spacecraft through eclipse. A bigger battery or less instrument power in the dark would help.");
  if (n.stats.blackouts > 0) design.push("A brownout happened: the battery ran flat. Switching instruments off before eclipse is the cheapest fix.");
  if (n.stats.safeS > 0) design.push(`The spacecraft spent ${(n.stats.safeS / 86400).toFixed(1)} days in safe mode. Safe mode protects it, but no science is taken while it lasts.`);
  design.push("The magnetometer and electron reflectometer share one electronics box, so flying both costs the mass and power of one package, not two.");

  const ideas = [
    { term: "Why a magnetometer?", text: "The Moon has no global magnetic field today. Instead, patches of its crust are magnetised, leftovers from an earlier time. A magnetometer in low orbit maps those patches." },
    { term: "Why an electron reflectometer too?", text: "Electrons from the solar wind bounce off magnetised crust. Measuring how many reflect gives a second, independent way to find magnetic regions." },
    { term: "What do nanotesla mean?", text: "A nanotesla (nT) is a billionth of a tesla. Earth's field at the surface is about 30,000 to 60,000 nT, so the lunar crustal fields in this map (a few nT at 37 km altitude) are tiny, which is why the instrument must be sensitive and the orbit low." },
    { term: "Why does altitude matter?", text: "A magnetic field fades quickly with distance. This map is the archived field at 37 km. A higher orbit would blur the same patches into a weaker, smoother signal." },
    { term: "What is real here?", text: "The map is archived NASA Lunar Prospector data. The spacecraft, power, antenna and coverage model are simplified game rules, so the mission shows how trade-offs work, not a certified prediction." },
  ];
  return { found, design, ideas, caveat: "You are practising a historical survey with archived data. You are not collecting new NASA observations." };
}
