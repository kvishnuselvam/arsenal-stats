"""Fetch match data (team and player box scores) from ESPN's public site API.

Stores one file per competition and season: data/espn/{COMP}/{season}.json
  {"events": {event_id: compact_match}, "complete": bool, "teams": [...]}
Past seasons are marked complete once every finished match is stored and are skipped afterwards.
"""
import argparse
import datetime as dt

from common import get_json, load, save

E = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ARSENAL = "359"
COMPS = {"PL": {"slug": "eng.1", "first": 2020}, "UCL": {"slug": "uefa.champions", "first": 2023}}
SKIP_STATS = {"appearances", "subIns"}


def current_season(today=None):
    today = today or dt.date.today()
    return today.year if today.month >= 7 else today.year - 1


def schedule(slug, team_id, season):
    j = get_json(f"{E}/{slug}/teams/{team_id}/schedule?season={season}")
    return (j or {}).get("events", [])


def discover_events(slug, season, arsenal_only=False):
    """Walk team schedules outward from Arsenal to find every match of the season."""
    seen_teams, queue, events = set(), [ARSENAL], {}
    while queue:
        tid = queue.pop(0)
        if tid in seen_teams:
            continue
        seen_teams.add(tid)
        for ev in schedule(slug, tid, season):
            c = ev["competitions"][0]
            done = c.get("status", {}).get("type", {}).get("completed", False)
            events[ev["id"]] = {"done": done, "date": ev.get("date")}
            if arsenal_only:
                continue
            for comp in c.get("competitors", []):
                oid = comp.get("id") or comp.get("team", {}).get("id")
                if oid and oid not in seen_teams:
                    queue.append(oid)
        if arsenal_only:
            break
    return events, sorted(seen_teams)


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def extract(summary, comp_code, season):
    header = summary["header"]
    comp = header["competitions"][0]
    status = comp.get("status", {}).get("type", {})
    key_events = summary.get("keyEvents", []) or []
    detail = (status.get("detail") or "") + " " + (status.get("shortDetail") or "")
    extra_time = "AET" in detail or "Pen" in detail or any(
        (k.get("period") or {}).get("number", 0) >= 3 for k in key_events)
    end = 120 if extra_time else 90

    teams = {}
    for c in comp["competitors"]:
        t = c["team"]
        teams[t["id"]] = {
            "id": t["id"], "name": t.get("displayName"), "abbr": t.get("abbreviation"),
            "ha": c.get("homeAway"), "score": int(_num(c.get("score")) or 0), "stats": {},
        }
    for bt in summary.get("boxscore", {}).get("teams", []):
        tid = bt["team"]["id"]
        if tid in teams:
            teams[tid]["stats"] = {s["name"]: _num(s.get("displayValue")) for s in bt.get("statistics", [])
                                   if _num(s.get("displayValue")) is not None}

    sub_in, sub_out = {}, {}
    for k in key_events:
        typ = (k.get("type") or {}).get("type", "") or ""
        text = (k.get("type") or {}).get("text", "") or ""
        minute = min(end, round((k.get("clock") or {}).get("value", 0) / 60))
        parts = [p["athlete"]["id"] for p in k.get("participants", []) if p.get("athlete")]
        if typ == "substitution" or text == "Substitution":
            if len(parts) >= 2:
                sub_in[parts[0]] = minute
                sub_out[parts[1]] = minute
        elif "red" in text.lower() and parts:
            sub_out.setdefault(parts[0], minute)

    players = []
    for r in summary.get("rosters", []) or []:
        tid = (r.get("team") or {}).get("id")
        for p in r.get("roster", []):
            starter, came_on = bool(p.get("starter")), bool(p.get("subbedIn"))
            if not (starter or came_on):
                continue
            aid = p["athlete"]["id"]
            start = 0 if starter else sub_in.get(aid)
            if start is None:
                start = end - 20
            stop = sub_out.get(aid, end)
            mins = max(1, stop - start) if stop >= start else 1
            stats = {s["name"]: s.get("value") for s in p.get("stats", [])
                     if s.get("name") not in SKIP_STATS and isinstance(s.get("value"), (int, float))}
            players.append({
                "id": aid, "name": p["athlete"].get("displayName"), "tid": tid,
                "pos": (p.get("position") or {}).get("abbreviation"), "start": starter,
                "min": mins, "s": {k: v for k, v in stats.items() if v},
            })
    return {
        "id": comp["id"], "date": comp.get("date"), "comp": comp_code, "season": season,
        "teams": list(teams.values()), "players": players,
    }


def run(comp_code, season, arsenal_only=False):
    slug = COMPS[comp_code]["slug"]
    path = f"espn/{comp_code}/{season}.json"
    store = load(path, {"events": {}, "complete": False, "teams": []})
    if store.get("complete") and not (arsenal_only is False and store.get("arsenal_only")):
        print(f"{comp_code} {season}: complete, skipping")
        return False
    events, team_ids = discover_events(slug, season, arsenal_only)
    store["teams"] = sorted(set(store.get("teams", [])) | set(team_ids))
    todo = [eid for eid, e in events.items() if e["done"] and eid not in store["events"]]
    print(f"{comp_code} {season}: {len(events)} matches found, {len(todo)} to fetch")
    changed = False
    for i, eid in enumerate(todo, 1):
        s = get_json(f"{E}/{slug}/summary?event={eid}")
        if not s or "header" not in s:
            continue
        try:
            store["events"][eid] = extract(s, comp_code, season)
            changed = True
        except (KeyError, IndexError, TypeError) as e:
            print(f"  could not parse {eid}: {e}")
        if i % 50 == 0:
            print(f"  {i}/{len(todo)}")
            save(path, store)
    all_done = all(e["done"] for e in events.values()) and all(
        eid in store["events"] for eid, e in events.items() if e["done"])
    store["complete"] = bool(season < current_season() and all_done and events)
    store["arsenal_only"] = arsenal_only
    save(path, store)
    return changed or bool(todo)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--comp", choices=list(COMPS), action="append")
    ap.add_argument("--season", type=int, action="append", help="start year, e.g. 2020 for 2020-21")
    ap.add_argument("--current", action="store_true", help="only the current season")
    ap.add_argument("--arsenal-only", action="store_true")
    a = ap.parse_args()
    cur = current_season()
    for code in a.comp or list(COMPS):
        if a.current:
            seasons = [cur]
        elif a.season:
            seasons = a.season
        else:
            seasons = range(COMPS[code]["first"], cur + 1)
        for season in seasons:
            if season >= COMPS[code]["first"]:
                run(code, season, a.arsenal_only)


if __name__ == "__main__":
    main()
