"""Turn stored ESPN and FPL data into the small JSON files the website reads (site/data/)."""
import datetime as dt
import glob
import json
import os
from collections import Counter, defaultdict

from common import DATA, ROOT, load, norm, season_label
from fetch_espn import ARSENAL, COMPS, current_season

OUT = os.path.join(ROOT, "site", "data")

P_MAP = {"totalGoals": "g", "goalAssists": "a", "totalShots": "sh", "shotsOnTarget": "sot",
         "foulsCommitted": "fc", "foulsSuffered": "fs", "yellowCards": "yc", "redCards": "rc",
         "ownGoals": "og", "saves": "sv", "shotsFaced": "sf", "goalsConceded": "gc"}
T_MAP = {"totalShots": "sh", "shotsOnTarget": "sot", "totalPasses": "pass", "accuratePasses": "passacc",
         "totalCrosses": "cross", "accurateCrosses": "crossacc", "totalLongBalls": "lb",
         "accurateLongBalls": "lbacc", "totalTackles": "tkl", "effectiveTackles": "tklw",
         "interceptions": "int", "totalClearance": "clr", "blockedShots": "blk", "wonCorners": "cor",
         "foulsCommitted": "fc", "offsides": "off", "saves": "sv", "yellowCards": "yc", "redCards": "rc",
         "penaltyKickGoals": "pkg", "penaltyKickShots": "pks"}
FPL_MAP = {"expected_goals": "xg", "expected_assists": "xa", "tackles": "ptkl",
           "clearances_blocks_interceptions": "cbi", "recoveries": "rec", "defensive_contribution": "dc"}
DEF_STATS = ["ptkl", "cbi", "rec", "dc"]
GROUPS = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)


def rnd(x):
    return round(x, 2) if isinstance(x, float) else x


def pos_group(abbr):
    a = (abbr or "").upper()
    if not a or a == "SUB":
        return None
    if a.startswith("G"):
        return "GK"
    if a.startswith(("CD", "LB", "RB", "D", "LWB", "RWB", "SW")):
        return "DEF"
    if a.startswith(("F", "CF", "ST", "LW", "RW", "S")):
        return "FWD"
    return "MID"


def load_espn():
    """All stored matches keyed by (comp, season)."""
    out = {}
    for code in COMPS:
        for path in sorted(glob.glob(os.path.join(DATA, "espn", code, "*.json"))):
            season = int(os.path.basename(path)[:4])
            with open(path) as f:
                out[(code, season)] = list(json.load(f)["events"].values())
    return out


# ---------- FPL to ESPN mapping (current season) ----------

def map_fpl_teams(core, espn_events):
    """Match FPL team ids to ESPN team ids using fixtures that share a date."""
    by_date = defaultdict(list)
    for ev in espn_events:
        home = next(t for t in ev["teams"] if t["ha"] == "home")
        away = next(t for t in ev["teams"] if t["ha"] == "away")
        by_date[ev["date"][:10]].append((home, away))
    names = {t["id"]: t["name"] for t in core["teams"]}
    score = defaultdict(Counter)
    for fx in core["fixtures"]:
        if not fx.get("finished") or not fx.get("kickoff_time"):
            continue
        day = fx["kickoff_time"][:10]
        cands = by_date.get(day, [])
        for home, away in cands:
            w = 1 / len(cands)
            if home["score"] == fx.get("team_h_score") and away["score"] == fx.get("team_a_score"):
                w += 1
            score[fx["team_h"]][home["id"]] += w
            score[fx["team_a"]][away["id"]] += w
    espn_names = {t["id"]: t["name"] for ev in espn_events for t in ev["teams"]}
    out = {}
    for fid, c in score.items():
        fn = norm(names[fid]).split()
        for eid in list(c):
            en = norm(espn_names.get(eid, ""))
            if fn and en.startswith(fn[0][:4]):
                c[eid] += 2
        out[fid] = c.most_common(1)[0][0]
    return out


def name_score(el, espn_name):
    en = norm(espn_name)
    toks = en.split()
    full = norm(f"{el['first_name']} {el['second_name']}")
    if en == full:
        return 3.0
    sec = norm(el["second_name"]).split()
    first = norm(el["first_name"]).split()
    web = norm(el["web_name"])
    if sec and toks and toks[-1] == sec[-1] and first and toks[0][:1] == first[0][:1]:
        return 2.5
    if web and (web == en or web in toks or (len(web) > 3 and web.replace(" ", "") in en.replace(" ", ""))):
        return 2.0
    if sec and toks and toks[-1] == sec[-1]:
        return 1.5
    if set(toks) & set(sec + first) and len(set(toks) & set(sec + first)) >= 1 and len(toks) == 1:
        return 1.5
    return 0.0


def map_fpl_players(core, rows, team_map, espn_players_by_team):
    """FPL element id -> ESPN athlete id, using each player's teams this season."""
    el_by_id = {e["id"]: e for e in core["elements"]}
    fx = {f["id"]: f for f in core["fixtures"]}
    teams_of = defaultdict(set)
    for eid, rs in rows.items():
        for r in rs:
            f = fx.get(r["fixture"])
            if f:
                teams_of[int(eid)].add(f["team_h"] if r["was_home"] else f["team_a"])
    out, taken = {}, set()
    cands = []
    for eid, ts in teams_of.items():
        el = el_by_id.get(eid)
        if not el:
            continue
        for ft in ts:
            for aid, name in espn_players_by_team.get(team_map.get(ft), {}).items():
                s = name_score(el, name)
                if s >= 1.5:
                    cands.append((s, eid, aid))
    for s, eid, aid in sorted(cands, reverse=True):
        if eid in out or aid in taken:
            continue
        out[eid] = aid
        taken.add(aid)
    return out


# ---------- aggregation ----------

def add(d, k, v):
    if v is None:
        return
    d[k] = d.get(k, 0) + v


def main():
    espn = load_espn()
    cur = current_season()
    core = load(f"fpl/{cur}/core.json")
    fpl_rows = (load(f"fpl/{cur}/matches.json") or {}).get("rows", {})
    past = load("fpl/history_past.json", {})

    # FPL mapping for the current PL season
    cur_pl = espn.get(("PL", cur), [])
    fpl_by_match = {}  # (espn event id, espn athlete id) -> fpl stats
    team_xg = defaultdict(lambda: defaultdict(float))  # espn event id -> espn team id -> xg
    group_by_aid = {}
    fpl_aid = {}
    if core and cur_pl:
        team_map = map_fpl_teams(core, cur_pl)
        players_by_team = defaultdict(dict)
        for ev in cur_pl:
            for p in ev["players"]:
                players_by_team[p["tid"]][p["id"]] = p["name"]
        fpl_aid = map_fpl_players(core, fpl_rows, team_map, players_by_team)
        el_by_id = {e["id"]: e for e in core["elements"]}
        for eid, aid in fpl_aid.items():
            group_by_aid[aid] = GROUPS.get(el_by_id[eid]["element_type"])
        fx = {f["id"]: f for f in core["fixtures"]}
        ev_by_key = {}
        for ev in cur_pl:
            ids = frozenset(t["id"] for t in ev["teams"])
            ev_by_key[(ev["date"][:10], ids)] = ev["id"]
        for eid, rs in fpl_rows.items():
            aid = fpl_aid.get(int(eid))
            for r in rs:
                f = fx.get(r["fixture"])
                if not f or not f.get("kickoff_time"):
                    continue
                ids = frozenset([team_map.get(f["team_h"]), team_map.get(f["team_a"])])
                evid = ev_by_key.get((f["kickoff_time"][:10], ids))
                if not evid:
                    continue
                own = team_map.get(f["team_h"] if r["was_home"] else f["team_a"])
                team_xg[evid][own] += float(r.get("expected_goals") or 0)
                if aid:
                    fpl_by_match[(evid, aid)] = {v: r.get(k) for k, v in FPL_MAP.items()}

    # FPL past-season totals, by season start year -> list of (element code, row)
    past_by_season = defaultdict(list)
    el_names = {}
    if core:
        for e in core["elements"]:
            el_names[str(e["code"])] = e
    for code, rs in past.items():
        for r in rs:
            try:
                y = int(r["season_name"][:4])
            except (TypeError, ValueError):
                continue
            if y >= 2022 and code in el_names:
                past_by_season[y].append((code, r))

    meta = {"updated": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"), "current": cur, "seasons": {}}
    arsenal_matches, league_players, league_teams = [], {}, {}
    arsenal = {}  # espn athlete id -> player record

    for (code, season), events in sorted(espn.items()):
        if not events:
            continue
        events.sort(key=lambda e: e["date"])
        label = season_label(season)
        meta["seasons"].setdefault(code, []).append(label)
        teams = {}
        players = {}
        for ev in events:
            if len(ev["teams"]) != 2:
                continue
            a_, b_ = ev["teams"]
            xg_avail = ev["id"] in team_xg
            for t, o in ((a_, b_), (b_, a_)):
                rec = teams.setdefault(t["id"], {"id": t["id"], "name": t["name"], "abbr": t["abbr"],
                                                 "mp": 0, "w": 0, "d": 0, "l": 0, "f": {}, "a": {},
                                                 "poss": 0.0, "xgm": 0})
                rec["mp"] += 1
                rec["w" if t["score"] > o["score"] else "d" if t["score"] == o["score"] else "l"] += 1
                add(rec["f"], "goals", t["score"])
                add(rec["a"], "goals", o["score"])
                for k, s in T_MAP.items():
                    add(rec["f"], s, t["stats"].get(k))
                    add(rec["a"], s, o["stats"].get(k))
                rec["poss"] += t["stats"].get("possessionPct") or 0
                if xg_avail:
                    rec["xgm"] += 1
                    add(rec["f"], "xg", team_xg[ev["id"]].get(t["id"], 0.0))
                    add(rec["a"], "xg", team_xg[ev["id"]].get(o["id"], 0.0))
            if ARSENAL in (a_["id"], b_["id"]):
                us = a_ if a_["id"] == ARSENAL else b_
                them = b_ if us is a_ else a_
                m = {"id": ev["id"], "date": ev["date"], "comp": code, "season": label, "ha": us["ha"],
                     "opp": {"id": them["id"], "name": them["name"], "abbr": them["abbr"]},
                     "gf": us["score"], "ga": them["score"],
                     "res": "W" if us["score"] > them["score"] else "D" if us["score"] == them["score"] else "L",
                     "f": {T_MAP[k]: v for k, v in us["stats"].items() if k in T_MAP},
                     "a": {T_MAP[k]: v for k, v in them["stats"].items() if k in T_MAP},
                     "poss": us["stats"].get("possessionPct")}
                if xg_avail:
                    m["f"]["xg"] = round(team_xg[ev["id"]].get(us["id"], 0.0), 2)
                    m["a"]["xg"] = round(team_xg[ev["id"]].get(them["id"], 0.0), 2)
                arsenal_matches.append(m)
            for p in ev["players"]:
                key = f"{p['id']}|{p['tid']}"
                pr = players.setdefault(key, {"id": p["id"], "name": p["name"], "tid": p["tid"], "apps": 0,
                                              "starts": 0, "min": 0, "fmin": 0, "pos": Counter()})
                pr["apps"] += 1
                pr["starts"] += 1 if p["start"] else 0
                pr["min"] += p["min"]
                g = pos_group(p["pos"])
                if g:
                    pr["pos"][g] += 1
                for k, s in P_MAP.items():
                    add(pr, s, p["s"].get(k))
                fs = fpl_by_match.get((ev["id"], p["id"]))
                if fs:
                    pr["fmin"] += p["min"]
                    for k, v in fs.items():
                        add(pr, k, float(v or 0))
                if p["tid"] == ARSENAL:
                    ar = arsenal.setdefault(p["id"], {"id": p["id"], "name": p["name"], "pos": Counter(),
                                                      "matches": []})
                    ar["name"] = p["name"]
                    if g:
                        ar["pos"][g] += 1
                    row = {"m": ev["id"], "min": p["min"], "st": 1 if p["start"] else 0}
                    for k, s in P_MAP.items():
                        if p["s"].get(k):
                            row[s] = p["s"][k]
                    if fs:
                        for k, v in fs.items():
                            if v:
                                row[k] = rnd(float(v))
                        row["f"] = 1
                    ar["matches"].append(row)

        # past-season FPL totals (xG, xA) for single-team players in PL seasons
        if code == "PL" and season < cur and past_by_season.get(season):
            by_name = defaultdict(list)
            for key, pr in players.items():
                by_name[norm(pr["name"])].append(key)
                by_name[norm(pr["name"]).split()[-1] if pr["name"] else ""].append(key)
            for elcode, r in past_by_season[season]:
                el = el_names[elcode]
                best = None
                for key in set(by_name.get(norm(f"{el['first_name']} {el['second_name']}"), []) +
                               by_name.get(norm(el["second_name"]).split()[-1] if el["second_name"] else "", [])):
                    pr = players[key]
                    s = name_score(el, pr["name"])
                    mins = r.get("minutes") or 0
                    if s < 1.5 or not mins:
                        continue
                    gap = abs(pr["min"] - mins) / max(mins, 1)
                    if gap <= 0.15 and (best is None or (s, -gap) > best[0]):
                        best = ((s, -gap), key)
                if best:
                    pr = players[best[1]]
                    # only attach when the player had one team in this season
                    if sum(1 for k in players if k.startswith(pr["id"] + "|")) == 1:
                        pr["fmin"] = pr["min"]
                        pr["xg"] = float(r.get("expected_goals") or 0)
                        pr["xa"] = float(r.get("expected_assists") or 0)
                        pr["fpl_past"] = 1
                        group_by_aid.setdefault(pr["id"], GROUPS.get(el["element_type"]))

        tlist = []
        for t in teams.values():
            t["poss"] = round(t["poss"] / t["mp"], 1) if t["mp"] else None
            t["f"] = {k: rnd(v) for k, v in t["f"].items()}
            t["a"] = {k: rnd(v) for k, v in t["a"].items()}
            if not t["xgm"]:
                t["f"].pop("xg", None)
                t["a"].pop("xg", None)
            t["pts"] = 3 * t["w"] + t["d"]
            tlist.append(t)
        league_teams[f"{code}|{label}"] = sorted(tlist, key=lambda t: (-t["pts"], -(t["f"].get("goals", 0) - t["a"].get("goals", 0))))
        team_names = {t["id"]: t["name"] for t in tlist}
        plist = []
        for pr in players.values():
            g = group_by_aid.get(pr["id"]) or (pr["pos"].most_common(1)[0][0] if pr["pos"] else "MID")
            row = {k: rnd(v) for k, v in pr.items() if k not in ("pos",) and v not in (0, None) or k in ("min", "apps")}
            row["grp"] = g
            row["team"] = team_names.get(pr["tid"], "")
            plist.append(row)
        league_players[f"{code}|{label}"] = plist
        write(f"league_{code}_{label}.json", {"teams": league_teams[f"{code}|{label}"], "players": plist})

    # Arsenal players: add past-season FPL xG (Arsenal-only when minutes match the Arsenal minutes)
    match_meta = {m["id"]: m for m in arsenal_matches}
    for aid, ar in arsenal.items():
        ar["grp"] = group_by_aid.get(aid) or (ar["pos"].most_common(1)[0][0] if ar["pos"] else "MID")
        del ar["pos"]
        ar["matches"].sort(key=lambda r: match_meta[r["m"]]["date"])
        ar["past_xg"] = {}
        for key, plist in league_players.items():
            code, label = key.split("|")
            if code != "PL":
                continue
            for row in plist:
                if row["id"] == aid and row.get("tid") == ARSENAL and row.get("fpl_past"):
                    ar["past_xg"][label] = {"xg": row.get("xg", 0), "xa": row.get("xa", 0), "min": row["min"]}

    arsenal_matches.sort(key=lambda m: m["date"])
    meta["last_match"] = arsenal_matches[-1]["date"] if arsenal_matches else None
    meta["fpl_last_gw"] = core.get("last_event") if core else None
    meta["fpl_mapped_players"] = len(fpl_aid)
    write("meta.json", meta)
    write("arsenal_matches.json", arsenal_matches)
    write("arsenal_players.json", sorted(arsenal.values(), key=lambda a: -sum(r["min"] for r in a["matches"])))
    print("built:", len(arsenal_matches), "Arsenal matches,", len(arsenal), "Arsenal players,",
          len(league_players), "competition-seasons; FPL players mapped:", len(fpl_aid))


if __name__ == "__main__":
    main()
