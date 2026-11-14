#!/usr/bin/env python3
"""Builds public/data/lp-mag-37km-2deg.json from NASA PDS PPI data set LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0.
Source files: the eight *_TOT.TAB tables (total field, nT, 0.25 x 0.25 degree bins at a common altitude of 37 km).
Usage: python3 scripts/build_lp_field.py <dir-with-the-8-TOT.TAB-files>
Each game cell (2 x 2 degrees) is the count-weighted mean of the 0.25-degree bins inside it that contain data; cells with too few bins are marked missing."""
import sys, glob, os, json, base64, struct, datetime
src = sys.argv[1]
ROWS, COLS, CELL = 90, 180, 2.0
sum_bn = [0.0] * (ROWS * COLS); sum_n = [0.0] * (ROWS * COLS); bins = [0] * (ROWS * COLS)
files = sorted(glob.glob(os.path.join(src, "B_*_TOT.TAB")))
assert len(files) == 8, files
for f in files:
    for line in open(f):
        p = line.split()
        if len(p) != 4: continue
        lat, lon, b, n = float(p[0]), float(p[1]), float(p[2]), float(p[3])
        if n <= 0: continue
        r = int((lat + 90) // CELL); c = int((lon % 360) // CELL)
        if not (0 <= r < ROWS): continue
        k = r * COLS + c; sum_bn[k] += b * n; sum_n[k] += n; bins[k] += 1
MISSING = 0xFFFF; vals = []; stats = []
for k in range(ROWS * COLS):
    if bins[k] >= 6 and sum_n[k] > 0:
        v = sum_bn[k] / sum_n[k]; vals.append(min(0xFFFE, int(round(v * 100)))); stats.append(v)  # 0.01 nT steps
    else: vals.append(MISSING)
stats.sort()
meta = {
  "dataset": "LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0", "title": "Lunar Prospector magnetometer (MAG) Level 4 data: large-scale vector field maps at a common altitude of 37 km (total field files)",
  "source": "NASA Planetary Data System, Planetary Plasma Interactions node (UCLA IGPP)", "url": "https://pds-ppi.igpp.ucla.edu/data/LP-L-MAG-5-SURFACE-FIELD-MAP-V1.0/",
  "altitudeKm": 37, "units": "nT", "sourceResolutionDeg": 0.25, "gameResolutionDeg": CELL, "coordinates": "selenographic latitude, east longitude (0-360)",
  "processing": "Count-weighted mean of the 0.25-degree bins that contain data inside each 2-degree cell; a cell needs at least 6 populated bins, otherwise it is marked missing. Values stored in 0.01 nT steps, 65535 = missing.",
  "caveat": "This is the archived field at 37 km altitude (not a surface map). It is a simulation input: players are practising a historical survey, not collecting new NASA observations.",
  "retrieved": datetime.date.today().isoformat(), "rows": ROWS, "cols": COLS,
  "stats": {"cells": len(stats), "missing": ROWS * COLS - len(stats), "minNT": round(stats[0], 3), "medianNT": round(stats[len(stats)//2], 3), "p95NT": round(stats[int(len(stats)*0.95)], 3), "maxNT": round(stats[-1], 3)},
}
meta["data"] = base64.b64encode(struct.pack("<%dH" % len(vals), *vals)).decode()
json.dump(meta, open(os.path.join(os.path.dirname(__file__), "..", "public", "data", "lp-mag-37km-2deg.json"), "w"), separators=(",", ":"))
print(meta["stats"])
