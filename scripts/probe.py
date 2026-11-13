"""Probe data sources from a GitHub runner and dump samples to probe_out/."""
import json, os, re, sys, time, traceback
import requests

OUT = "probe_out"
os.makedirs(OUT, exist_ok=True)
SS = "https://www.sofascore.com/api/v1"
UA = {"User-Agent": "arsenal-stats personal tracker (+https://github.com/kvishnuselvam/arsenal-stats)"}
report = []


def save(name, obj):
    with open(f"{OUT}/{name}.json", "w") as f:
        json.dump(obj, f, indent=1)


def get_ss(path, name=None, client="requests"):
    url = SS + path
    try:
        r = requests.get(url, headers=UA, timeout=30)
        report.append(f"{client} {r.status_code} {path}")
        if r.status_code == 200:
            j = r.json()
            if name:
                save(name, j)
            return j
        report.append("   body: " + r.text[:200].replace("\n", " "))
    except Exception as e:
        report.append(f"{client} ERR {path} {e}")
    return None


def main():
    pl = get_ss("/unique-tournament/17/seasons", "pl_seasons")
    ucl = get_ss("/unique-tournament/7/seasons", "ucl_seasons")
    last = get_ss("/team/42/events/last/0", "arsenal_last0")
    get_ss("/team/42/events/last/3", "arsenal_last3")
    ev = None
    if last:
        fin = [e for e in last["events"] if e.get("status", {}).get("type") == "finished"]
        ev = fin[-1]["id"]
        get_ss(f"/event/{ev}/lineups", "event_lineups_recent")
        get_ss(f"/event/{ev}/statistics", "event_stats_recent")
    if pl:
        seasons = {s["year"]: s["id"] for s in pl["seasons"]}
        report.append("PL seasons: " + json.dumps(dict(list(seasons.items())[:8])))
        cur = pl["seasons"][0]["id"]
        old = seasons.get("20/21")
        for sid, tag in [(cur, "cur"), (old, "2021")]:
            if not sid:
                continue
            for grp in ["summary", "attack", "defence", "passing"]:
                get_ss(f"/unique-tournament/17/season/{sid}/statistics?limit=20&offset=0&order=-rating&accumulation=total&group={grp}", f"league_players_{tag}_{grp}")
            get_ss(f"/team/42/unique-tournament/17/season/{sid}/statistics/overall", f"team_season_{tag}")
            get_ss(f"/unique-tournament/17/season/{sid}/standings/total", f"standings_{tag}")
            get_ss(f"/team/42/unique-tournament/17/season/{sid}/top-players/overall", f"team_top_players_{tag}")
        # find a 2020/21 Arsenal match via season events
        if old:
            j = get_ss(f"/unique-tournament/17/season/{old}/team/42/events/last/0", "old_team_events")
            if not j:
                j = get_ss(f"/team/42/events/last/40", "arsenal_last40")
            if j and j.get("events"):
                oev = j["events"][0]["id"]
                get_ss(f"/event/{oev}/lineups", "event_lineups_old")
                get_ss(f"/event/{oev}/statistics", "event_stats_old")
    # a player season stats (Saka id 934235)
    get_ss("/player/934235/statistics/seasons", "saka_seasons")

    # Understat
    H = dict(UA, **{"X-Requested-With": "XMLHttpRequest", "Referer": "https://understat.com/"})
    for path, name in [("/getLeagueData/EPL/2020", "us_league_2020"), ("/getTeamData/Arsenal/2020", "us_team_2020")]:
        try:
            r = requests.get("https://understat.com" + path, headers=H, timeout=30)
            report.append(f"understat {r.status_code} {path} len={len(r.text)}")
            if r.status_code == 200:
                try:
                    save(name, r.json())
                except Exception:
                    report.append("   not json: " + r.text[:200])
        except Exception as e:
            report.append(f"understat ERR {path} {e}")
    try:
        r = requests.get("https://understat.com/team/Arsenal/2020", headers=UA, timeout=30)
        found = re.findall(r"var (\w+)\s*=\s*JSON.parse", r.text)
        report.append(f"understat html {r.status_code} len={len(r.text)} vars={found}")
    except Exception as e:
        report.append(f"understat html ERR {e}")
    # match data
    try:
        j = json.load(open(f"{OUT}/us_team_2020.json"))
        mid = [d for d in j.get("dates", []) if d.get("isResult")][0]["id"]
        r = requests.get(f"https://understat.com/getMatchData/{mid}", headers=H, timeout=30)
        report.append(f"understat match {r.status_code} len={len(r.text)}")
        if r.status_code == 200:
            save("us_match", r.json())
    except Exception as e:
        report.append(f"understat match ERR {e}")

    with open(f"{OUT}/report.txt", "w") as f:
        f.write("\n".join(report))
    print("\n".join(report))


if __name__ == "__main__":
    main()
