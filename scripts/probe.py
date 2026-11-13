"""Probe ESPN details: substitutions, scoreboard ranges, header."""
import json
import requests

UA = {"User-Agent": "arsenal-stats personal tracker (+https://github.com/kvishnuselvam/arsenal-stats)"}
E = "https://site.api.espn.com/apis/site/v2/sports/soccer"
s = requests.get(f"{E}/eng.1/summary?event=401878760", headers=UA, timeout=30).json()
comp = s["header"]["competitions"][0]
print("header comp keys", list(comp.keys()))
print("competitors", json.dumps([{k: c.get(k) for k in ["id", "homeAway", "score", "winner"]} | {"team": c["team"].get("displayName"), "tid": c["team"].get("id")} for c in comp["competitors"]]))
print("status", json.dumps(comp.get("status"))[:400])
print("season", json.dumps(s["header"].get("season")), s["header"].get("league", {}).get("name"))
for t in s["rosters"]:
    print("roster team", t.get("team", {}).get("displayName"), t.get("homeAway"))
    for p in t["roster"]:
        if p.get("subbedIn") or p.get("subbedOut"):
            print("  ", p["athlete"]["displayName"], "starter", p["starter"], "in", json.dumps(p.get("subbedIn")), "out", json.dumps(p.get("subbedOut")), "pos", p.get("position", {}).get("abbreviation"))
    print("  sample athlete keys", list(t["roster"][0]["athlete"].keys()))
    break
subs = [k for k in s.get("keyEvents", []) if "ubstitution" in json.dumps(k.get("type"))]
print("n key events", len(s.get("keyEvents", [])), "subs", len(subs))
if subs:
    print(json.dumps(subs[0])[:900])
print("key event types", sorted({k.get("type", {}).get("text", "") for k in s.get("keyEvents", [])}))
print("boxscore team keys", list(s["boxscore"]["teams"][0].keys()), s["boxscore"]["teams"][0]["team"]["displayName"], s["boxscore"]["teams"][0].get("homeAway"))
sb = requests.get(f"{E}/eng.1/scoreboard?dates=20200901-20210531&limit=1000", headers=UA, timeout=60).json()
print("scoreboard 20/21 events", len(sb.get("events", [])))
sb = requests.get(f"{E}/uefa.champions/scoreboard?dates=20240701-20250630&limit=1000", headers=UA, timeout=60).json()
ev = sb.get("events", [])
print("ucl 24/25 events", len(ev), ev[0]["season"] if ev else "", ev[0]["competitions"][0].get("type") if ev else "")
print("ucl notes sample", [e["competitions"][0].get("notes") for e in ev[:2]])
