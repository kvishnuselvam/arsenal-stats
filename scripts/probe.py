"""Probe ESPN public soccer API from a GitHub runner."""
import json
import requests

UA = {"User-Agent": "arsenal-stats personal tracker (+https://github.com/kvishnuselvam/arsenal-stats)"}
E = "https://site.api.espn.com/apis/site/v2/sports/soccer"


def get(url):
    r = requests.get(url, headers=UA, timeout=30)
    print(r.status_code, url, len(r.text))
    return r.json() if r.ok else None


for lg in ["eng.1", "uefa.champions"]:
    for season in [2020, 2023, 2026]:
        j = get(f"{E}/{lg}/teams/359/schedule?season={season}")
        if not j:
            continue
        evs = j.get("events", [])
        done = [e for e in evs if e["competitions"][0]["status"]["type"].get("completed")]
        print(f"  {lg} {season}: events={len(evs)} completed={len(done)}", evs[0]["date"] if evs else "")
        if done and season in (2020, 2026) and lg == "eng.1" or (done and lg == "uefa.champions" and season == 2023):
            s = get(f"{E}/{lg}/summary?event={done[0]['id']}")
            if s:
                print("  summary keys", list(s.keys()))
                bs = s.get("boxscore", {}).get("teams", [])
                if bs:
                    print("  team stats:", [(x.get("name"), x.get("displayValue")) for x in bs[0].get("statistics", [])])
                ro = s.get("rosters", [])
                if ro:
                    p = ro[0]["roster"][0]
                    print("  roster player keys", list(p.keys()))
                    print("  player stats:", [(x.get("name"), x.get("value")) for x in p.get("stats", [])])
                    print("  n players", len(ro[0]["roster"]))
j = get(f"{E}/eng.1/teams/359/roster?season=2026")
if j:
    a = j.get("athletes", [])
    print(" roster n", len(a), json.dumps(a[0])[:1200] if a else "")
