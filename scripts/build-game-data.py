#!/usr/bin/env python3
"""Extract the slice of kaungkhantko26/space-mission-dataset the game uses -> src/game/dataset.json.
Usage: python3 scripts/build-game-data.py /path/to/space-mission-dataset
Only dataset-verified numbers are copied; anything the dataset lacks is a labelled GAME value in src/game/data.ts."""
import json, sys, pathlib
root = pathlib.Path(sys.argv[1]) / "verified"
L = lambda f: json.load(open(root / f))["records"]
planets = {r["id"]: r for r in L("planets.json")}
moons = {r["id"]: r for r in L("moons.json")}

def irr(r):
    n = (r.get("nssdc_fact_sheet") or {}).get("numeric") or {}
    return n.get("Solar irradiance (W/m 2 )")

def body(r, parent=None):
    d = {"id": r["id"], "name": r["name"], "mu": r["mu_m3_s2"], "radius_m": r["mean_radius_m"],
         "gravity": r.get("surface_gravity_m_s2"), "sma_m": r.get("semi_major_axis_m"), "parent": parent}
    i = irr(r)
    if i: d["irradiance_w_m2"] = i
    return d

bodies = [body(planets[i]) for i in ["sun", "mercury", "venus", "earth", "mars", "jupiter"]] + [body(moons["moon"], "earth")]
VEH = ["ll2_cfg_93", "ll2_cfg_26", "ll2_cfg_43", "ll2_cfg_127", "ll2_cfg_134", "ll2_cfg_16", "ll2_cfg_121", "ll2_cfg_50", "ll2_cfg_164", "ll2_cfg_21", "ll2_cfg_161"]
cfg = {r["id"]: r for r in L("launch_vehicle_configs.json")}
vehicles = [{k: cfg[i][k] for k in ["id", "name", "manufacturer", "manufacturer_country", "leo_capacity_kg", "gto_capacity_kg",
            "launch_cost_usd", "total_launches", "successful_launches", "reusable",
            "launch_mass_t", "liftoff_thrust_kn", "diameter_m", "length_m", "min_stage", "max_stage"]} for i in VEH]
ep = [{"id": r["id"], "name": r["name"], "type": r["type"], "thrust_n": r["thrust_vac_n"], "power_w": r["power_w"], "isp_s": r["isp_vac_s"]} for r in L("electric_propulsion.json")]
TAGS = [("radar", "radar"), ("imag", "imager"), ("camera", "imager"), ("magnetometer", "fields"), ("electric field", "fields"), ("plasma", "plasma"),
        ("ion mass", "plasma"), ("retarding", "plasma"), ("spectrometer", "spectrometer"), ("infrared", "spectrometer"), ("ultraviolet", "spectrometer"),
        ("gamma", "particles"), ("dust", "particles"), ("reflectometer", "particles"), ("photopolarimeter", "imager")]
def tag(n):
    n = n.lower()
    return next((t for k, t in TAGS if k in n), "other")
seen, inst = set(), []
for r in L("nasa_instruments.json"):
    if r["mass_kg_from_text"] is None: continue
    key = (r["name"], r["mass_kg_from_text"])
    if key in seen: continue
    seen.add(key)
    inst.append({"id": r["id"], "name": r["name"], "mission": r["mission_name"], "mass_kg": r["mass_kg_from_text"],
                 "power_w": r["power_w_from_text"], "tag": tag(r["name"]), "source": r["mass_sentence"]})
SITES = ["ll2_pad_87", "ll2_pad_16", "ll2_pad_124", "ll2_pad_50", "ll2_pad_32", "ll2_pad_22"]
pads = {r["id"]: r for r in L("launch_pads.json")}
sites = [{"id": i, "name": pads[i]["name"], "location": pads[i]["location"], "country": pads[i]["country_code"], "lat": pads[i]["latitude_deg"],
          "lon": pads[i]["longitude_deg"], "launches": pads[i]["launches_in_dataset"], "rotation_boost_m_s": pads[i]["earth_rotation_boost_m_s"]} for i in SITES]
# Saturn V: verified stage masses/engines (rocket_stages.json, rocket_engines.json) + Apollo 11 spacecraft mass (missions.json)
eng = {e["id"]: e for e in L("rocket_engines.json")}
stages = [{"stage": r["stage"], "dry_kg": r["dry_mass_kg"], "prop_kg": r["propellant_mass_kg"], "engines": r["n_engines"], "engine": r["engine_id"],
           "engine_thrust_n": eng[r["engine_id"]].get("thrust_sl_n") or eng[r["engine_id"]].get("thrust_vac_n")} for r in L("rocket_stages.json") if r["vehicle_id"] == "saturn_v"]
apollo = next(m for m in L("missions.json") if m["id"] == "apollo11")
for v in vehicles:
    if v["id"] == "ll2_cfg_93":
        v["stages"] = stages; v["tli_payload_kg"] = apollo["launch_mass_kg"]
        v["launch_cost_usd"] = v["launch_cost_usd"] or 185_000_000; v["launch_cost_is_game"] = True  # LL2 has no price: 1960s programme cost, a game value
json.dump({"provenance": {"dataset": "https://github.com/kaungkhantko26/space-mission-dataset", "note": "Launch Library 2 capacities state no reference orbit; instrument masses are parsed from NASA NSSDC prose."},
           "bodies": bodies, "vehicles": vehicles, "electric_propulsion": ep, "instruments": inst, "launch_sites": sites},
          open("src/game/dataset.json", "w"), indent=1)
print(len(bodies), len(vehicles), len(ep), len(inst))
