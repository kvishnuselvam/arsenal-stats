"""Fetch Premier League player data from the official Fantasy Premier League API.

Gives xG, xA and defensive actions (tackles, clearances/blocks/interceptions, recoveries)
per player per match for the current season, plus past-season totals (xG from 2022-23).
Files: data/fpl/{season}/core.json, data/fpl/{season}/matches.json, data/fpl/history_past.json
"""
import argparse

from common import get_json, load, save
from fetch_espn import current_season

F = "https://fantasy.premierleague.com/api"
EL_KEYS = ["id", "code", "first_name", "second_name", "web_name", "team", "element_type", "minutes",
           "starts", "goals_scored", "assists", "expected_goals", "expected_assists",
           "expected_goal_involvements", "tackles", "clearances_blocks_interceptions", "recoveries",
           "defensive_contribution", "saves", "clean_sheets", "expected_goals_conceded"]
ROW_KEYS = ["fixture", "minutes", "goals_scored", "assists", "expected_goals", "expected_assists",
            "tackles", "clearances_blocks_interceptions", "recoveries", "defensive_contribution",
            "saves", "was_home", "kickoff_time", "opponent_team", "starts"]
PAST_KEYS = ["season_name", "minutes", "starts", "goals_scored", "assists", "expected_goals",
             "expected_assists", "tackles", "clearances_blocks_interceptions", "recoveries",
             "defensive_contribution"]


def num(v):
    try:
        f = float(v)
        return int(f) if f.is_integer() else round(f, 2)
    except (TypeError, ValueError):
        return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    season = current_season()
    boot = get_json(F + "/bootstrap-static/")
    if not boot:
        print("FPL bootstrap unavailable; skipping")
        return
    fixtures = get_json(F + "/fixtures/") or []
    finished = [e["id"] for e in boot["events"] if e.get("finished") and e.get("data_checked")]
    last_event = max(finished) if finished else 0
    core = {
        "season": season,
        "last_event": last_event,
        "teams": [{"id": t["id"], "name": t["name"], "short": t["short_name"]} for t in boot["teams"]],
        "elements": [{k: num(e.get(k)) for k in EL_KEYS} for e in boot["elements"]],
        "fixtures": [{k: f.get(k) for k in ["id", "event", "kickoff_time", "team_h", "team_a", "finished",
                                            "team_h_score", "team_a_score"]} for f in fixtures],
    }
    prev = load(f"fpl/{season}/core.json", {})
    save(f"fpl/{season}/core.json", core)

    matches = load(f"fpl/{season}/matches.json", {"last_event": -1, "rows": {}})
    past = load("fpl/history_past.json", {})
    need_rows = a.force or matches.get("last_event") != last_event
    played = [e for e in boot["elements"] if e.get("minutes", 0) > 0 or str(e["code"]) not in past]
    if not need_rows:
        played = [e for e in played if str(e["code"]) not in past]
    print(f"FPL season {season}: last finished gameweek {last_event} "
          f"(stored {matches.get('last_event')}), fetching {len(played)} player summaries")
    for i, e in enumerate(played, 1):
        j = get_json(f"{F}/element-summary/{e['id']}/", delay=0.15)
        if not j:
            continue
        if need_rows:
            matches["rows"][str(e["id"])] = [{k: num(r.get(k)) for k in ROW_KEYS} for r in j.get("history", [])
                                             if r.get("minutes", 0) > 0]
        past[str(e["code"])] = [{k: num(r.get(k)) for k in PAST_KEYS} for r in j.get("history_past", [])]
        if i % 200 == 0:
            print(f"  {i}/{len(played)}")
    if need_rows:
        matches["last_event"] = last_event
        save(f"fpl/{season}/matches.json", matches)
    save("fpl/history_past.json", past)
    print("FPL done", "(gameweek data refreshed)" if need_rows else "", "prev last event", prev.get("last_event"))


if __name__ == "__main__":
    main()
