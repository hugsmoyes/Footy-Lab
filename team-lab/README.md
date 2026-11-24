# Team Lab (Footy Lab) · Beta

Review your own team: season numbers for your club and players, completed matches one at a time, your own coded vision, and a match review report for coaches. Built from Opponent Lab Beta, pointed at your club instead of an opponent.

## Open it
Open `index.html` in a browser. It runs from the file system or any static host. No server or login.

## Workflow
1. **Seasons.** Create a team season: competition, season and your club.
2. **Our team > Team.** Our record, ladder, form, results with quarter margins, per-game trends (scoring only for the VFL), season stats with league ranks, ratings and head to head. Every stat can become a season finding.
3. **Our team > Players.** Our list with season averages, Footy Lab WAR and league percentile bars. Game logs where the competition has per-game data (AFL).
4. **Matches.** Add completed games from the built-in results, or by hand. The Data column shows which games have team and player match stats.
5. **Match review.** Pick a completed match:
   - **Data coverage** first: result and quarter scores, team match stats, player match stats, line-ups, coded events and video. Each shows Available, Partial, Missing or Not added (optional), its source, and the next step (import, pre-filled template, enter by hand, tick the line-up, code, add video).
   - **Overview:** result, quarter table and chart, record going into the game (context), key team stats against our usual.
   - **Team stats:** every team stat for the match with our usual numbers, by quarter where imported, with a chart.
   - **Player stats:** our players or theirs, sortable, with each player's line and, where available, his season average as labelled context.
   - **Events & video:** optional. Timeline of coded events, a breakdown of any template field, and the video status.
   - **Findings** for the match.
6. **Code, Video, Explore.** Same tools as Opponent Lab, scoped to our matches. Coding is optional.
7. **Findings.** Each one separates observation, evidence (stat, count, sample, source), analyst interpretation, review question, follow-up focus (who, when, status) and limitations. Evidence status: Data only, Checked on video or Needs more evidence. Links to coded events, clips and a chart. The follow-up tracker lists them all.
8. **Report.** A match review report for one game, or a season review. Choose and order findings, add a summary, then print or save as PDF, download Markdown or present.

## What the built-in data supports
- **AFL 2026:** results with quarter scores, and per-game player stats for every match. Team match totals are summed from player stat lines, full game only (no quarter splits). Our usual = our average in the other 2026 games.
- **VFL 2026:** results with quarter scores, team season stats, player season averages, club lists and the ladder. **No per-game team or player stats.** Season averages are shown as context only, never as a match value.
- **Anything else:** no built-in data. Everything comes from what you import or enter.

## Importing match-level stats (needed for VFL player and team match analysis)
Data tab, or the buttons in a match's coverage. CSV or TSV, read in the browser.
- **Team stats:** one row per team per match: `Season, Round, Team, Opponent, Period` (Full, Q1 to Q4), then one column per stat.
- **Player stats:** one row per player per match: `Season, Round, Team, Opponent, Player, Number`, then one column per stat.
- **Pre-filled template** (from the coverage panel) fills in the season, round, team names and, for players, the line-up or list.
- Rows join a match when the season, round and both team names match exactly. If they don't, a new match is created and the import summary says so.
- Unknown stat columns can become new stat definitions. Blank cells stay missing, never zero.
- Imported VFL team stats are compared with the club's season average from the built-in season stats. That average includes the match, which the review says.

## Where data lives
- **Team Lab records** (team seasons, match reviews, findings, follow-ups, report settings, playlists): browser local storage, key `footylab.teamLab.v1`.
- **Shared match library** (matches, players, stat definitions and values, templates, coded events, video links, timestamps, clips): key `dam.opponentLab.v3`, the same store Opponent Lab uses. Coding done in either tool appears in both. Team Lab never shows or changes Opponent Lab's fixtures or briefs.
- The two tools share the library only when the browser treats them as the same site: the same web address when hosted, or local files in a browser that shares storage between them (Chrome does; others may not). The Data tab says how many matches and Opponent Lab fixtures it can see.
- Don't edit in both tools at the same moment. Team Lab reloads when Opponent Lab saves in another tab, but Opponent Lab doesn't reload when Team Lab saves.
- Nothing is uploaded. Video files play from disk and are never stored: only links, file names and timestamps.
- **Backup:** Data > Download backup saves Team Lab's records plus a copy of the shared library in one `.json`. Restore asks separately before replacing the library.

## Structure
```
index.html
css/lab.css, css/team.css
data/afl-2026-pack.js, data/vfl-2026-pack.js, data/war-2026.js   built-in season data (from Opponent Lab Beta)
js/core/*.js      util, library, model (two stores), analysis, importer, season, pack, matchdata (match-level data and coverage)
js/views/*.js     Seasons, Team, Players, Matches, Match review, Code, Video, Explore, Findings and Report, Data
js/app.js         shell, tabs, routing
```
The nav link to Opponent Lab points to `../opponent-lab/index.html`. Change it in `index.html` if Opponent Lab sits elsewhere on the site.
