# Arsenal Stats

A personal tracker for Arsenal team and player stats in the Premier League (2020-21 onward) and the Champions League (2023-24 onward), with comparisons against other players and teams.

Site: https://kvishnuselvam.github.io/arsenal-stats/

## How it updates

A GitHub Actions workflow (`.github/workflows/update.yml`) runs twice a day (05:00 and 12:00 IST). It fetches any newly finished matches, refreshes Fantasy Premier League data after each gameweek, rebuilds the site data and republishes the site. A weekly heartbeat commit keeps the schedule alive through the off-season.

To run it by hand: **Actions → update-and-deploy → Run workflow**, then choose:
- `update`: current season only (what the schedule does)
- `backfill`: every season from 2020-21 (slow, about an hour)
- `rebuild`: no fetching; just rebuild the site from stored data

## Data sources

| Source | What it gives |
|---|---|
| ESPN public match data | Results; team stats (shots, shots on target, possession, passing, crosses, long balls, tackles, interceptions, clearances, blocks, corners, fouls, offsides); player stats (minutes, goals, assists, shots, shots on target, fouls, cards, saves) for PL and UCL |
| Official Fantasy Premier League API | xG, xA, tackles, clearances/blocks/interceptions, recoveries, defensive contributions (PL only; per match for the current season, xG/xA season totals from 2022-23) |

Not available from free sources: big chances, duels, dribbles, aerial duels, Champions League xG, Premier League xG before 2022-23. Sofascore and Understat block automated access, so they are not used.

## Layout

- `scripts/fetch_espn.py`: match data, stored in `data/espn/{PL,UCL}/{season}.json`
- `scripts/fetch_fpl.py`: FPL data, stored in `data/fpl/`
- `scripts/build_site_data.py`: builds the JSON files in `site/data/`
- `site/`: the static website (no build step)

Personal, non-commercial project.
