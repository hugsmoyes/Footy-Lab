# Club Lab (Footy Lab) · Beta

Team Lab and Opponent Lab in one workspace. Two modes, switched at the top of the page:

- **Our team:** your club across a season. Team and player season numbers, completed matches reviewed with the evidence (data coverage first), findings with follow-ups, and a match review or season review report.
- **Opponent:** the club you play next. Form, team and player numbers, their games coded and clipped, and an opposition brief.

Matches, players, stats, coded events, video links and clips are shared by both modes, so a game coded once serves your own review and the scouting job when you play that club.

## Open it
Open `index.html` in a browser. It runs from the file system or any static host. No server or login.

## Where data lives (nothing is uploaded)
- **Our team** records: browser local storage, key `footylab.teamLab.v1` (the key Team Lab used).
- **Opponent** fixtures, briefs and their findings, plus the shared match library: key `dam.opponentLab.v3` (the key Opponent Lab used).
- Because the keys are the same, work done in the old Team Lab and Opponent Lab pages on the same site appears here automatically, and briefs written here still open in the old Opponent Lab page.
- Opponent-mode findings keep Opponent Lab's fields (analyst read, coaching point, confidence, Draft / Reviewed on video / Final). Our-team findings use the match review fields (observation, evidence, interpretation, review question, follow-up, evidence status).
- **Backup:** Data > Download backup saves both modes in one `.json`. Old Opponent Lab backups can be restored too (they replace the fixtures, briefs and library only).
- Video files are never stored: only links, file names and timestamps.

## Built-in data
- **AFL 2026:** results with quarter scores, per-game player stats (team match totals are summed from them), team season stats, ratings, lists, Footy Lab WAR.
- **VFL 2026:** results with quarter scores, team season stats, player season averages, lists, ladder, Footy Lab WAR. No per-game team or player stats: import them for match-level review.

## Structure
```
index.html
css/lab.css, css/team.css
data/                 built-in season packs and WAR
js/core/*.js          util, library, model (two modes, two stores), analysis, importer, season, pack, matchdata
js/views/*.js         Home, Team, Players, Matches, Match review, Code, Video, Explore, Findings, Report/Brief, Data
js/app.js             shell, mode switch, tabs, routing
```
