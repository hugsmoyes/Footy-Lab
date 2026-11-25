"""Add VFL per-game team and player stats to lab/data/vfl-2026-pack.js.

Usage: python3 tools/add_vfl_match_stats.py TEAM_CSV PLAYER_CSV
Source: AFLM Stats. Team rows are kept as supplied (they include rushed behinds),
player rows go into each player's game log. Names are mapped to the club lists.
"""
import csv, json, sys, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'lab', 'data', 'vfl-2026-pack.js')
STATS = ['Disposals', 'Kicks', 'Handballs', 'Marks', 'Hitouts', 'Tackles', 'Goals', 'Behinds']
GAME_COLS = STATS + ['DreamTeamPoints']
NAMES = {  # match-file spelling -> club-list spelling
    'Alixzander Tauru': 'Alix Tauru', 'Benjamin Seers': 'Ben Seers', 'Bradley McDonald': 'Brad McDonald',
    'Callum M. Brown': 'Callum Brown', 'Cameron Polson': 'Cam Polson', 'Damien Hollow': 'Damon Hollow',
    'Darcy MacPherson': 'Darcy Macpherson', "Finbar O'Dwyer": "Finn O'Dwyer", 'Harrison Podmore-Taylor': 'Harrison Podmore Taylor',
    'Hewago Paul Oea': 'Hewago Oea', 'Jacob Watts': 'Jake Watts', 'Jett Peckett': 'Jet Peckett', 'Josh Clarke': 'Joshua Clarke',
    'Joshua Gibcus': 'Josh Gibcus', 'Joshua Goater': 'Josh Goater', 'Joshua Sparkman': 'Josh Sparkman', 'Lachie Gollant': 'Lachlan Gollant',
    'Lachie Riley': 'Lachlan Riley', 'Lachie Sharp': 'Lachlan Sharp', 'Liam Coughlan': 'Liam Coghlan', 'Lochlan Reidy': 'Lachlan Reidy',
    'Mathew Keast': 'Matthew Keast', 'Matt Gahan': 'Matthew Gahan', 'Matthew Hollier': 'Matt Hollier', 'Mitchell Podhajski': 'Mitch Podhajski',
    'Nelson Beikoff-Smart': 'Nelson Beikoff Smart', 'Nick Francis': 'Nicholas Francis', 'Nick Madden': 'Nicholas Madden',
    'Nick Newton': 'Nicholas Newton', 'Nick Shipley': 'Nicholas Shipley', 'Oscar Vandam': 'Oscar van Dam', 'Sam Cilmi': 'Samuel Cilmi',
    'Samuel Paea': 'Sam Paea', 'Solly McKay': 'Solomon McKay', 'Stuart Horner': 'Stu Horner', 'Thomas Burton': 'Tom Burton',
    'Thomas Hofert': 'Tom Hofert', 'Thomas Sims': 'Tom Sims', 'Tom Howard': 'Thomas Howard', 'Tony Sinnema': 'Toby Sinnema',
    'Tyler McGinnis': 'Tyler McGinniss', 'Will Derrington': 'William Derrington', 'Will Elliot': 'Will Elliott', 'Will Papley': 'William Papley',
    'William Bella': 'Will Bella', 'William Kliszewski': 'Wil Kliszewski'}

team_csv, player_csv = sys.argv[1], sys.argv[2]
src = open(PACK).read()
head, tail = src.index('.push(') + 6, src.rindex(');')
pack = json.loads(src[head:tail])
mi = {}
for i, m in enumerate(pack['matches']):
    mi[(m[1], m[5], m[6])] = mi[(m[1], m[6], m[5])] = i

team = {}
for r in csv.DictReader(open(team_csv)):
    i = mi[(r['Round'], r['Team'], r['Opponent'])]
    team[f"{i}|{r['Team']}"] = [int(r[c]) for c in STATS]
assert len(team) == 2 * len(pack['matches']), 'team file must cover every match'

players, unknown = pack['players'], set()
for p in players.values(): p['g'] = []
by_name = collections.defaultdict(list)
for k in players: by_name[k.split('|')[0]].append(k)
n = 0
for r in csv.DictReader(open(player_csv)):
    name = NAMES.get(r['Player'], r['Player']); key = f"{name}|{r['Team']}"
    if key not in players:
        if not by_name.get(name): unknown.add(key)
        # Played for a second club: a game log under that club, season averages stay on the main entry.
        players[key] = {'g': [], 's': None, 'pos': '', 'role': None, 'other': True}
        by_name[name].append(key)
    i = mi[(r['Round'], r['Team'], r['Opponent'])]
    players[key]['g'].append([i] + [int(r[c]) for c in STATS] + [int(r['Fantasy points']), 0]); n += 1
for p in players.values(): p['g'].sort(key=lambda g: (pack['matches'][g[0]][3], g[0]))
if unknown: print('Not in the club lists (added as game logs only):', sorted(unknown))

pack['gameCols'] = GAME_COLS
pack['teamGameCols'] = STATS
pack['teamGames'] = team
pack['source'] = 'VFL 2026 season: results, team season stats, player season averages and club lists. Per-game team and player stats: AFLM Stats.'
pack['matchRolesNote'] = 'Per-game roles need time on ground and contested stats, which the VFL match files do not include.'
pack['checks']['playerGames'] = n
open(PACK, 'w').write(src[:head] + json.dumps(pack, separators=(',', ':'), ensure_ascii=False) + src[tail:])
print(f'{len(team)} team rows, {n} player games added')
