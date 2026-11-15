"use client";
import { BackButton, GlassPanel, ScreenContainer } from "@/components/ui";

const GLOSSARY: [string, string][] = [
  ["Delta-v (Δv)", "How much the speed of a spacecraft can change using its propellant. Every manoeuvre has a Δv price, and the rocket equation links it to fuel mass."],
  ["Parking orbit", "A low orbit around Earth where the spacecraft waits for the right moment to head to the Moon."],
  ["Max-Q", "The moment of greatest air pressure on the rocket during the climb. Throttling down through it protects the vehicle."],
  ["TLI (translunar injection)", "The engine burn that sends the spacecraft from Earth orbit onto a path to the Moon. It must start inside a window when the Moon is in the right place."],
  ["Lunar-orbit insertion (LOI)", "The braking burn that lets the Moon's gravity capture the spacecraft into orbit instead of flying past."],
  ["Eclipse", "Time spent in the Moon's shadow. Solar arrays make no power then, so the battery carries the spacecraft."],
  ["RTG", "A nuclear power source that makes steady power in sunlight or shadow. It costs mass and money."],
  ["Downlink", "Sending recorded data to Earth. It only works while Earth is in view of a ground station and the antenna points at it."],
  ["Safe mode", "A protective state: science stops and the arrays point at the Sun until the problem is cleared."],
  ["Brownout", "The battery runs flat, so the spacecraft drops into safe mode."],
  ["Magnetometer", "Measures the strength and direction of a magnetic field."],
  ["Electron reflectometer", "Counts solar-wind electrons that bounce off magnetised crust, a second way to find magnetic regions."],
  ["Nanotesla (nT)", "A billionth of a tesla. Earth's surface field is about 30,000 to 60,000 nT; the lunar crustal fields in the survey map are a few nT."],
  ["Survey region", "A 10° x 10° patch of the Moon you choose to observe. Only cells with archived data can be chosen."],
];

const SOURCES: [string, string, string][] = [
  ["Lunar Prospector magnetometer map (37 km)", "NASA Planetary Data System, Planetary Plasma Interactions node: data set LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0", "https://pds-ppi.igpp.ucla.edu/data/LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0/"],
  ["Instrument masses and powers", "NASA NSSDCA catalog entries (extracted into the dataset; each card links its entry)", "https://nssdc.gsfc.nasa.gov/nmc/"],
  ["Launch vehicles", "Launch Library 2 (The Space Devs). Not a NASA source.", "https://thespacedevs.com/llapi"],
  ["Dataset used to build the game", "kaungkhantko26/space-mission-dataset", "https://github.com/kaungkhantko26/space-mission-dataset"],
];

/** Project page: what the game is, how it works, where the data comes from, what is simplified, and a glossary. */
export function AboutScreen() {
  return (
    <ScreenContainer title="About and glossary" subtitle="Space Mission Design Game, built for the NASA Space Apps Challenge 2026." actions={<BackButton href="/menu" label="Main menu" />}>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl font-bold">What it is</h2>
          <p className="mt-2 text-sm text-ink2">Students often learn rocket facts without seeing why spacecraft design choices decide what science gets back to Earth. In this game you design a Moon orbiter, launch it, fly it to lunar orbit, run its science, and then see what your choices did.</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink2">
            <li><b className="text-ink">Design</b> a spacecraft with real instruments and pick survey regions on a map of real NASA data.</li>
            <li><b className="text-ink">Launch</b> from a real spaceport. Cadet has an autopilot; Pilot and Commander are manual.</li>
            <li><b className="text-ink">Operate</b> in lunar orbit: power, pointing, downlink and anomalies.</li>
            <li><b className="text-ink">Learn</b> from the report: your survey on the real map, what your design did, and a same-scenario comparison with one choice changed.</li>
          </ol>
        </GlassPanel>
        <GlassPanel className="p-5">
          <h2 className="font-display text-xl font-bold">What is real, and what is simplified</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink2">
            <li><b className="text-ink">Real data:</b> the archived Lunar Prospector magnetic field, instrument masses and powers quoted from NASA, planetary constants, launch vehicle data and Saturn V stage data.</li>
            <li><b className="text-ink">Game rules:</b> prices other than launch, array and battery masses, the reliability model, science points, the coverage model and the operations balance. They are marked in the interface.</li>
            <li><b className="text-ink">Physics:</b> a 2-D ascent and simplified operations. It teaches trade-offs; it is not flight software and is not validated against a real mission.</li>
            <li><b className="text-ink">Your survey:</b> you are practising a historical survey with archived data. You are not collecting new NASA observations.</li>
            <li><b className="text-ink">Not built yet:</b> landing, Mars operations and the telescope mission. No learner study has been run yet.</li>
          </ul>
        </GlassPanel>
        <GlassPanel className="p-5 lg:col-span-2">
          <h2 className="font-display text-xl font-bold">Data sources</h2>
          <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">{SOURCES.map(([name, by, url]) => (
            <li key={name} className="rounded-lg bg-white/5 p-3"><p className="font-semibold">{name}</p><p className="text-xs text-ink2">{by}</p><a className="text-xs text-cyan underline" href={url} target="_blank" rel="noreferrer">{url}</a></li>))}</ul>
        </GlassPanel>
        <GlassPanel className="p-5 lg:col-span-2" id="glossary">
          <h2 className="font-display text-xl font-bold">Glossary</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-3 md:grid-cols-2">{GLOSSARY.map(([t, d]) => <div key={t}><dt className="font-semibold text-ink">{t}</dt><dd className="text-sm text-ink2">{d}</dd></div>)}</dl>
        </GlassPanel>
      </div>
    </ScreenContainer>
  );
}
