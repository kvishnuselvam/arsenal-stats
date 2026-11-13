"""Probe data sources from a GitHub runner and print compact summaries."""
import json
import requests

UA = {"User-Agent": "arsenal-stats personal tracker (+https://github.com/kvishnuselvam/arsenal-stats)"}
US = "https://understat.com"


def show(label, obj, n=1500):
    print(f"=== {label}\n{json.dumps(obj)[:n]}\n")


def main():
    s = requests.Session()
    s.headers.update(UA)
    r = s.get(US + "/robots.txt", timeout=30)
    print("robots", r.status_code, r.text[:400])
    r = s.get(US, timeout=30)
    print("home", r.status_code, "cookies", list(s.cookies.keys()))
    H = {"X-Requested-With": "XMLHttpRequest"}
    for season in [2020, 2026]:
        r = s.get(f"{US}/getLeagueData/EPL/{season}", headers=H, timeout=30)
        print("league", season, r.status_code, r.headers.get("content-type"), len(r.text))
        if r.ok and r.text.startswith("{"):
            j = r.json()
            print(" keys", list(j.keys()))
            show(f"teams sample {season}", list(j["teams"].values())[0], 900)
            show(f"players sample {season}", j["players"][0], 900)
            show(f"dates sample {season}", j["dates"][0], 600)
            print(" n players", len(j["players"]), "n dates", len(j["dates"]))
        else:
            print(r.text[:300])
    r = s.get(f"{US}/getTeamData/Arsenal/2020", headers=H, timeout=30)
    print("team", r.status_code, len(r.text))
    mid = None
    if r.ok and r.text.startswith("{"):
        j = r.json()
        print(" keys", list(j.keys()))
        show("team statistics keys", {k: list(v.keys()) for k, v in j.get("statistics", {}).items()}, 1200)
        mid = [d for d in j["dates"] if d.get("isResult")][0]["id"]
    if mid:
        r = s.get(f"{US}/getMatchData/{mid}", headers=H, timeout=30)
        print("match", r.status_code, len(r.text))
        if r.ok:
            j = r.json()
            print(" keys", list(j.keys()))
            show("roster player", list(j["rosters"]["h"].values())[0], 900)
            show("shot", j["shots"]["h"][0], 900)
    r = s.get(f"{US}/getPlayerData/7322", headers=H, timeout=30)
    print("player", r.status_code, len(r.text))
    if r.ok and r.text.startswith("{"):
        j = r.json()
        print(" keys", list(j.keys()))
        show("player groups", {k: (list(v.keys()) if isinstance(v, dict) else len(v)) for k, v in j.items()}, 900)

    F = "https://fantasy.premierleague.com/api"
    r = requests.get(F + "/bootstrap-static/", headers=UA, timeout=30)
    print("fpl bootstrap", r.status_code, len(r.text))
    if r.ok:
        j = r.json()
        el = [e for e in j["elements"] if e["web_name"] == "Saka"][0]
        print(" element keys", sorted(el.keys()))
        r = requests.get(f"{F}/element-summary/{el['id']}/", headers=UA, timeout=30)
        print("fpl summary", r.status_code)
        if r.ok:
            k = r.json()
            show("fpl history row", k["history"][0], 1500)
            show("fpl history_past", k["history_past"][-3:], 800)


if __name__ == "__main__":
    main()
