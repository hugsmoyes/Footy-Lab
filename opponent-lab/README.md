# Opponent Lab (Footy Lab)

Opposition analysis for your next AFL or VFL game: scout the opponent's team and players, code their matches, then build the brief for coaches.

## Open it
Open `index.html` in a browser. It runs from the file system or any static host. No server or login.

## Workflow
1. **Fixtures.** Create the next game: our club, opponent, round, venue, date.
2. **Opponent > Team.** Record, ladder spot, ratings and last-5 form. Results with quarter margins, filterable (last 5, last 10, home, away, wins, losses, within 12 points, finals). Match stats per game for and against, with a chart for any stat. Where they stand out (strengths, weaknesses, style), all season stats with league ranks, a comparison club, team ratings and head to head.
3. **Opponent > Players.** The opponent's list with season averages per game and Footy Lab WAR, in column sets by what they measure (Overview, Ball use, Contested, Attacking, Defensive, Ruck). Each number has a bar showing where the player sits in the league. Sort and search. Click a player for his league ranks, a by-game chart and his game log.
4. **Coding > Matches.** Pick the opponent games to review straight from the season results, or add one manually.
5. **Coding > Code, Video, Explore.** Code events with templates and the keyboard, link vision and cut clips, explore patterns.
6. **Report.** Any team or player stat can go in the report: use **+** on the Team and Players tabs, **+ Add chart to report** in a player's profile, **+ Finding** in Explore, or the Add a stat panel. Preview, print or save as PDF, download Markdown or present.

The playing lists of both clubs in the fixture are added to the coding rosters automatically.

## Season data
The build scripts and source files (`tools/`, `data-src/`) are kept locally, not in the site repo.

Each fixture is AFL or VFL (set in the fixture). The Lab loads the matching built-in season:
- `data/afl-2026-pack.js`: AFL 2026. Results, team and player match stats, club lists, team season stats and ratings. Built by `tools/build_pack.py` (needs the per-round match files in `data-src/afl-2026/match/`).
- `data/vfl-2026-pack.js`: VFL 2026. Results with quarter scores, team season stats, player season averages, club lists and the official ladder. Built by `tools/build_vfl_pack.py` from `data-src/vfl-2026/`. There are no per-game player stats for the VFL, so VFL players have season averages and league ranks but no game log, and per-game team trends cover scoring only. VFL-listed players have no position. AFL-listed players take height, position and jumper number from the AFL list (marked "A"). Players who played for two clubs are listed at both, with their combined season numbers marked "2 clubs".

`data/war-2026.js` adds Footy Lab WAR (v37) for 2026 to both, built by `tools/build_war.py` from `data-src/war/war-2026.json` (copied from the live AFL and VFL WAR dashboards). AFL WAR counts home-and-away games only.

Both packs are read-only and aren't written to browser storage. Load a newer season file on the Data tab to replace the team season stats. The builds stop if a check fails (scores, games per club, goals, ladder).

## Where data lives
Fixtures, matches, coded events, video links, clips, playlists and report items are kept in the browser's local storage (`dam.opponentLab.v3`). Nothing is uploaded. Use Data > Export to back up or move to another computer. Video files play from disk and are never uploaded.

## Structure
```
index.html
css/lab.css
data/afl-2026-pack.js   built-in season data
js/core/*.js            util, library, model, analysis, importer, season, pack
js/views/*.js           Fixtures, Team, Players, Matches, Code, Video, Explore, Report, Data
js/app.js               shell, tabs, routing
tools/build_pack.py     rebuilds the season pack
```
