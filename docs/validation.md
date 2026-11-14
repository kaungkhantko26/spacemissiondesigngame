# Validation notes

These are checks the game's model passes, plus a traceable example. They show the physics is anchored to published numbers. They do **not** validate the game against a real mission.

## Reference cases (`src/__tests__/validation.test.ts`)
| Check | Expected | Source |
|---|---|---|
| Circular speed at 200 km altitude | 7.77 to 7.80 km/s | sqrt(mu/r), Earth mu and radius from the dataset |
| Burn from a 185 km parking orbit to the Moon's distance | 3.0 to 3.2 km/s | Apollo translunar injection was about 3.1 km/s |
| Moon distance | 384,000 to 385,000 km | NASA planetary fact sheet |
| Rocket equation, Isp 300 s, mass ratio 3 | 3.2 to 3.26 km/s | Tsiolkovsky equation |
| Game Moon transfer | departure 2.5 to 4 km/s, 2 to 10 days | the game's Hohmann-based plan |

## Traceable example: one instrument through to the design review
1. **Source:** NASA NSSDCA entry for the Lunar Prospector magnetometer and electron reflectometer: they share one electronics box, combined mass 5 kg and 4.5 W (`dataset.json`, ids `nmc_exp_1998_001a_05` and `_06`).
2. **Curation:** `src/game/instruments.ts` marks both as one shared package (`lp-mager`), so `hardware()` counts 5 kg and 4.5 W once.
3. **Design review:** the Architect adds the structure and margin factors to every kilogram. The test checks the dry-mass increase for adding both instruments is more than 5 kg and less than 12.5 kg.
4. **Operations:** the same package power and data rate feed the Mission Control power and downlink model, so the Architect's readiness check and the operations run use the same numbers.

## Known limits
- The ascent is 2-D with a simplified atmosphere and fixed guidance rules.
- Operations (coverage, anomalies, scoring) are game-balanced.
- The survey map is archived NASA data at 37 km altitude; the coverage model is not a physical ground-track simulation.
- No learner study has been run.
