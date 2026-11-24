/* Opponent Lab: preloaded season packs (data/*-pack.js). Read-only and never written to local storage.
   Each pack gives a fixture the opponent's results, form, team season stats, ratings (where supplied),
   club list and player season averages, plus per-game team and player rows where the competition has them.
   Lab.Packs holds every pack by "COMP|SEASON"; Lab.Pack is the one for the selected fixture. */
(function (Lab) {
  'use strict';
  const U = Lab.U, S = Lab.Season;
  Lab.Packs = {};
  const RAW = [window.LAB_PACK].concat(window.LAB_PACKS || []).filter(Boolean);
  RAW.forEach(P => { P.season = String(P.season); const X = build(P); Lab.Packs[X.season.key] = X; });
  /* The pack for a fixture: same competition, the fixture's season if loaded, otherwise the latest. */
  Lab.packFor = function (ws) {
    const comp = String((ws && ws.competition) || 'AFL').toUpperCase();
    const list = Object.values(Lab.Packs).filter(x => x.raw.competition.toUpperCase() === comp).sort((a, b) => b.raw.season.localeCompare(a.raw.season));
    return list.find(x => ws && x.raw.season === String(ws.season)) || list[0] || null;
  };
  Lab.Pack = Lab.Packs['AFL|2026'] || Object.values(Lab.Packs)[0] || { ok: false };

  function build(P) {
  const X = { ok: true, raw: P };
  /* Footy Lab WAR (data/war-2026.js) joins as one more season column. */
  const WAR = (window.LAB_WAR || {})[P.competition];
  if (WAR && P.season === '2026' && !P.seasonCols.includes('WAR')) {
    P.seasonCols = P.seasonCols.concat(['WAR', 'WAR_Games']);
    Object.entries(P.players).forEach(([k, p]) => { const w = WAR.p[k]; if (p.s) p.s.push(w ? w[0] : null, w ? w[1] : null); });
    X.warOf = WAR.of;
  }
  /* ---------- season object, same shape as an imported one ---------- */
  X.SOURCE = P.gameCols && P.gameCols.length ? `${P.competition} ${P.season} season: match results, team and player match statistics, club lists and team ratings` : `${P.competition} ${P.season} season: match results, team season stats, player season averages and club lists`;
  X.hasGames = !!(P.gameCols && P.gameCols.length);
  const opts = { competition: P.competition, season: P.season, source: X.SOURCE };
  const team = S.readTeamSeason(P.teamStatsCsv, Object.assign({ file: 'built-in' }, opts));
  const rat = P.ratingsCsv ? S.readRatings(P.ratingsCsv, Object.assign({ file: 'built-in' }, opts)) : { ratings: null, checks: null };
  const lists = S.readPlayerList(P.listsCsv, Object.assign({ file: 'built-in' }, opts));
  X.season = {
    key: P.competition + '|' + P.season, competition: P.competition, season: P.season, builtin: true,
    teams: team.teams, league: team.league, basis: team.meta.basis, ratings: rat.ratings,
    sources: { teamStats: { source: X.SOURCE }, ratings: { source: X.SOURCE }, players: { source: X.SOURCE } },
    checks: { teamStats: team.checks, ratings: rat.checks, players: lists.checks, cross: [] }, importedAt: {}
  };
  /* The pack season shows up in Season profile like an imported one. An imported season with the
     same competition and year takes its place, so the analyst can always override it. */
  const sSeasons = S.seasons, sGet = S.getSeason;
  S.seasons = function () {
    const l = sSeasons();
    if (!l.some(x => x.key === X.season.key && x.teams)) { S.ensureMetrics(); l.push(X.season); }
    return l.filter(x => x.teams || x.ratings).sort((a, b) => String(b.season).localeCompare(String(a.season)));
  };
  S.getSeason = function (comp, season) { return sGet(comp, season) || ((comp || 'AFL') + '|' + season === X.season.key ? X.season : null); };

  /* ---------- matches ---------- */
  const M = P.matches.map((m, i) => ({ i, id: m[0], rd: m[1], final: m[2], date: m[3], venue: m[4], home: m[5], away: m[6], hq: m[7], aq: m[8], hs: m[9], as: m[10] }));
  const qpts = s => { const [g, b] = String(s).split('.').map(Number); return 6 * g + b; };
  X.matches = M;
  X.teams = [...new Set(M.flatMap(m => [m.home, m.away]))].sort();
  const GC = P.gameCols, GI = {}; GC.forEach((k, i) => { GI[k] = i; });
  X.gameCols = GC;
  X.seasonCols = P.seasonCols;

  /* A team's games, from its own point of view. */
  X.teamGames = function (t) {
    return M.filter(m => m.home === t || m.away === t).map(m => {
      const h = m.home === t;
      const q = (h ? m.hq : m.aq).map(qpts), oq = (h ? m.aq : m.hq).map(qpts);
      const qf = q.map((v, i) => v - (i ? q[i - 1] : 0)), qa = oq.map((v, i) => v - (i ? oq[i - 1] : 0));
      const us = h ? m.hs : m.as, them = h ? m.as : m.hs;
      return { m, rd: m.rd, final: m.final, date: m.date, venue: m.venue, home: h, opp: h ? m.away : m.home, us, them, margin: us - them, res: us > them ? 'W' : us < them ? 'L' : 'D', qf, qa };
    });
  };

  /* Per-game team totals from player rows (for and against). Cached. */
  let totals = null;
  function buildTotals() {
    totals = {};
    Object.entries(P.players).forEach(([key, p]) => {
      const t = key.split('|')[1];
      p.g.forEach(r => {
        const k = r[0] + '|' + t, o = totals[k] = totals[k] || { n: 0, effDisp: 0 };
        o.n++;
        GC.forEach((c, i) => { const v = r[1 + i]; if (v == null || c === 'TimeOnGround' || c === 'CentreBounceAttendancePercentage' || c === 'DisposalEfficiency' || c === 'RatingPoints') return; o[c] = (o[c] || 0) + v; });
        if (r[1 + GI.DisposalEfficiency] != null && r[1 + GI.Disposals]) o.effDisp += r[1 + GI.DisposalEfficiency] * r[1 + GI.Disposals] / 100;
      });
    });
    Object.values(totals).forEach(o => { o.DisposalEfficiency = o.Disposals ? o.effDisp / o.Disposals * 100 : null; });
  }
  X.total = function (matchIndex, t) { if (!totals) buildTotals(); return totals[matchIndex + '|' + t] || null; };

  /* Stats shown in trends: [key, label, better]. Points come from the result, not the players. */
  const SCORE_TREND = [['Points', 'Points', 'high'], ['Goals', 'Goals', 'high'], ['Behinds', 'Behinds', ''], ['ScoringShots', 'Scoring shots', 'high']];
  X.TREND = !X.hasGames ? SCORE_TREND : [
    ['Points', 'Points', 'high'], ['Goals', 'Goals', 'high'], ['ShotsAtGoal', 'Shots at goal', 'high'], ['xScore', 'Expected score', 'high'],
    ['Disposals', 'Disposals', 'high'], ['DisposalEfficiency', 'Disposal efficiency %', 'high'], ['ContestedPossessions', 'Contested possessions', 'high'],
    ['TotalClearances', 'Clearances', 'high'], ['Inside50s', 'Inside 50s (summed from players)', 'high'], ['MetresGained', 'Metres gained', 'high'],
    ['Marks', 'Marks', ''], ['ContestedMarks', 'Contested marks', 'high'], ['Intercepts', 'Intercept possessions', 'high'], ['InterceptMarks', 'Intercept marks', 'high'],
    ['Tackles', 'Tackles', 'high'], ['PressureActs', 'Pressure acts', 'high'], ['Turnovers', 'Turnovers', 'low'], ['GroundBallGets', 'Ground ball gets', 'high'],
    ['Hitouts', 'Hitouts', 'high'], ['HitoutsToAdvantage', 'Hitouts to advantage', 'high'], ['ScoreLaunches', 'Score launches', 'high'], ['KickIns', 'Kick-ins', '']
  ];
  X.gameValue = function (g, t, k) {
    if (k === 'Points') return t === 'for' ? g.us : g.them;
    if (!X.hasGames) {
      const q = (t === 'for') === g.home ? g.m.hq[3] : g.m.aq[3], [gl, bh] = String(q).split('.').map(Number);
      return k === 'Goals' ? gl : k === 'Behinds' ? bh : k === 'ScoringShots' ? gl + bh : null;
    }
    const tot = X.total(g.m.i, t === 'for' ? (g.home ? g.m.home : g.m.away) : g.opp);
    return tot && tot[k] != null ? tot[k] : null;
  };

  /* ---------- ladder (home-and-away rounds only) ---------- */
  X.ladder = function () {
    if (P.ladder) return P.ladder.map((r, i) => ({ t: r[0], p: r[1], w: r[2], l: r[3], d: r[4], pf: r[5], pa: r[6], pts: r[7], pct: r[6] ? r[5] / r[6] * 100 : null, pos: i + 1, official: true }));
    const L = {};
    X.teams.forEach(t => { L[t] = { t, p: 0, w: 0, l: 0, d: 0, pf: 0, pa: 0, pts: 0 }; });
    M.filter(m => !m.final).forEach(m => {
      [[m.home, m.hs, m.as], [m.away, m.as, m.hs]].forEach(([t, f, a]) => { const o = L[t]; o.p++; o.pf += f; o.pa += a; if (f > a) { o.w++; o.pts += 4; } else if (f < a) o.l++; else { o.d++; o.pts += 2; } });
    });
    return Object.values(L).map(o => Object.assign(o, { pct: o.pa ? o.pf / o.pa * 100 : null })).sort((a, b) => b.pts - a.pts || b.pct - a.pct).map((o, i) => Object.assign(o, { pos: i + 1 }));
  };

  /* ---------- players ---------- */
  const bio = {}; lists.players.forEach(p => { bio[p.name + '|' + p.team] = p; });
  const SI = {}; P.seasonCols.forEach((k, i) => { SI[k] = i; });
  X.SI = SI; X.GI = GI;
  X.roster = function (t) {
    const keys = new Set(Object.keys(P.players).filter(k => k.split('|')[1] === t));
    lists.players.filter(p => p.team === t).forEach(p => keys.add(p.name + '|' + t));
    return [...keys].map(k => X.player(k)).sort((a, b) => (b.games || 0) - (a.games || 0) || a.name.localeCompare(b.name));
  };
  X.player = function (key) {
    const [name, t] = key.split('|'), p = P.players[key] || { g: [] }, b = bio[key] || {};
    const s = p.s ? Object.fromEntries(P.seasonCols.map((k, i) => [k, p.s[i]])) : null;
    return { key, name, team: t, number: b.number || '', position: p.pos || b.position || '', bio: b.bio || {}, form: b.form || {}, s, games: s ? s.Matches : 0, role: p.role || null, g: p.g, multi: p.multi || '', afl: p.afl || '' };
  };
  X.roleName = id => { const r = P.seasonRoles.find(x => x.id === id); return r ? r.name : id; };
  X.roleFam = id => { const r = P.seasonRoles.find(x => x.id === id); return r ? r.family : null; };
  X.roleLabel = function (p) {
    const r = p.role; if (!r) return { kind: 'none', text: 'Not in the season file' };
    const t = r.top, n = X.roleName;
    if (r.kind === 'small') return { kind: 'small', text: 'Small sample' + (t[0] ? ' · ' + n(t[0][0]) : '') };
    if (r.kind === 'none' || !t.length) return { kind: 'none', text: 'No clear role' };
    if (r.kind === 'weak') return { kind: 'weak', text: 'Leans ' + n(t[0][0]), id: t[0][0] };
    if (r.kind === 'blend') return { kind: 'blend', text: n(t[0][0]) + ' / ' + n(t[1][0]), id: t[0][0] };
    return { kind: 'clear', text: n(t[0][0]), id: t[0][0] };
  };
  /* Per-game rows for a player with roles resolved. */
  X.games = function (p) {
    if (!p.g || !p.g.length) return [];
    const L = GC.length, R = P.matchRoles, tg = {}; X.teamGames(p.team).forEach(g => { tg[g.m.i] = g; });
    return p.g.map(x => {
      const v = {}; GC.forEach((k, i) => { v[k] = x[1 + i]; });
      const mask = x[1 + L], sc = x.slice(2 + L); let top = -1, ts = -1, sec = -1, ss = -1;
      sc.forEach((s, i) => { if ((mask >> i) & 1) { if (s > ts) { sec = top; ss = ts; top = i; ts = s; } else if (s > ss) { sec = i; ss = s; } } });
      return { tg: tg[x[0]], v, full: (v.TimeOnGround || 0) >= P.minTog, top, ts, sec, ss, sc, mask, roleId: top >= 0 ? R[top].id : null };
    });
  };
  X.matchRoleName = i => { const r = P.matchRoles[i]; return r.name || X.roleName(r.id); };
  X.ABBR = { inside: 'IN', outside: 'OUT', twoway: '2W', hhf: 'HHF', pressfwd: 'PF', groundfwd: 'GT', leadkf: 'KF', intercept: 'INT', contestdef: 'CD', rebound: 'RB', ruck: 'RK', ruckfwd: 'RF' };

  /* Match a fixture's team name to a pack club. */
  const ALIAS = P.competition === 'VFL' ? { boxhillhawks: 'Box Hill', caseydemons: 'Casey', casey: 'Casey', footscraybulldogs: 'Footscray', bulldogs: 'Footscray', southportsharks: 'Southport', sharks: 'Southport', tasmaniadevils: 'Tasmania', devils: 'Tasmania', sydneyswans: 'Sydney', swans: 'Sydney', gws: 'Greater Western Sydney', gwsgiants: 'Greater Western Sydney', giants: 'Greater Western Sydney', goldcoastsuns: 'Gold Coast', suns: 'Gold Coast', brisbanelions: 'Brisbane', lions: 'Brisbane', geelongcats: 'Geelong', cats: 'Geelong', williamstownseagulls: 'Williamstown', seagulls: 'Williamstown', portmelbourneborough: 'Port Melbourne', borough: 'Port Melbourne', coburglions: 'Coburg', frankstondolphins: 'Frankston', dolphins: 'Frankston', werribeetigers: 'Werribee', sandringhamzebras: 'Sandringham', zebras: 'Sandringham', northmelb: 'North Melbourne', kangaroos: 'North Melbourne', stkilda: 'St Kilda', saints: 'St Kilda', magpies: 'Collingwood', blues: 'Carlton', bombers: 'Essendon', tigers: 'Richmond' } : { brisbanelions: 'Brisbane', gws: 'Greater Western Sydney', gwsgiants: 'Greater Western Sydney', giants: 'Greater Western Sydney', bulldogs: 'Western Bulldogs', footscray: 'Western Bulldogs', kangaroos: 'North Melbourne', northmelb: 'North Melbourne', goldcoastsuns: 'Gold Coast', suns: 'Gold Coast', geelongcats: 'Geelong', cats: 'Geelong', sydneyswans: 'Sydney', swans: 'Sydney', westcoasteagles: 'West Coast', eagles: 'West Coast', adelaidecrows: 'Adelaide', crows: 'Adelaide', portadelaidepower: 'Port Adelaide', power: 'Port Adelaide', hawks: 'Hawthorn', magpies: 'Collingwood', blues: 'Carlton', bombers: 'Essendon', dockers: 'Fremantle', demons: 'Melbourne', tigers: 'Richmond', saints: 'St Kilda', stkilda: 'St Kilda', lions: 'Brisbane' };
  X.resolve = function (name) {
    if (!name) return '';
    if (X.teams.includes(name)) return name;
    const n = U.norm(name), hit = X.teams.find(t => U.norm(t) === n);
    return hit || (X.teams.includes(ALIAS[n]) ? ALIAS[n] : '');
  };

  /* ---------- player stats (season averages) ---------- */
  /* [key, full name, column heading, better] */
  X.PSTATS = [
    ['Matches', 'Games', 'Games', ''], ['WAR', 'Footy Lab WAR', 'WAR', 'high'], ['TimeOnGround', 'Time on ground %', 'Time on ground', ''],
    ['CentreBounceAttendancePercentage', 'Centre bounce attendance %', 'Centre bounces', ''],
    ['Disposals', 'Disposals', 'Disposals', 'high'], ['Kicks', 'Kicks', 'Kicks', 'high'], ['Handballs', 'Handballs', 'Handballs', ''],
    ['DisposalEfficiency', 'Disposal efficiency %', 'Disposal eff.', 'high'], ['KickingEfficiency', 'Kicking efficiency %', 'Kicking eff.', 'high'],
    ['KickPercentage', 'Kick share of disposals %', 'Kick share', ''], ['UncontestedPossessions', 'Uncontested possessions', 'Uncontested poss.', 'high'],
    ['TotalPossessions', 'Total possessions', 'Possessions', 'high'], ['MetresGained', 'Metres gained', 'Metres gained', 'high'],
    ['Turnovers', 'Turnovers', 'Turnovers', 'low'], ['Clangers', 'Clangers', 'Clangers', 'low'], ['Bounces', 'Bounces', 'Bounces', ''],
    ['ContestedPossessions', 'Contested possessions', 'Contested poss.', 'high'], ['ContestedPossessionRate', 'Contested possession rate %', 'Contested rate', ''],
    ['GroundBallGets', 'Ground ball gets', 'Ground balls', 'high'], ['HardBallGets', 'Hard ball gets', 'Hard balls', 'high'],
    ['TotalClearances', 'Clearances', 'Clearances', 'high'], ['CentreClearances', 'Centre clearances', 'Centre clear.', 'high'], ['StoppageClearances', 'Stoppage clearances', 'Stoppage clear.', 'high'],
    ['ContestedMarks', 'Contested marks', 'Contested marks', 'high'], ['FreesFor', 'Free kicks for', 'Frees for', 'high'], ['FreesAgainst', 'Free kicks against', 'Frees against', 'low'],
    ['Goals_Avg', 'Goals per game', 'Goals', 'high'], ['Goals_Total', 'Goals (season total)', 'Season goals', 'high'], ['Behinds', 'Behinds', 'Behinds', ''],
    ['ShotsAtGoal', 'Shots at goal', 'Shots', 'high'], ['Inside50s', 'Inside 50s', 'Inside 50s', 'high'], ['MarksInside50', 'Marks inside 50', 'Marks in 50', 'high'],
    ['MarksOnLead', 'Marks on lead', 'Leading marks', 'high'], ['GoalAssists', 'Goal assists', 'Goal assists', 'high'], ['ScoreInvolvements', 'Score involvements', 'Score involv.', 'high'],
    ['ScoreInvolvementPercentage', 'Score involvement %', 'Score involv. %', 'high'], ['CrumbingPossessions', 'Crumbing possessions', 'Crumbs', 'high'],
    ['Marks', 'Marks', 'Marks', 'high'], ['Intercepts', 'Intercept possessions', 'Intercepts', 'high'], ['InterceptMarks', 'Intercept marks', 'Intercept marks', 'high'],
    ['Rebound50s', 'Rebound 50s', 'Rebound 50s', 'high'], ['Spoils', 'Spoils', 'Spoils', 'high'], ['OnePercenters', 'One percenters', 'One percenters', 'high'],
    ['ContestDefensiveLossPercentage', 'Defensive one-on-one loss %', 'Def. 1v1 loss', 'low'], ['Tackles', 'Tackles', 'Tackles', 'high'],
    ['TacklesInside50', 'Tackles inside 50', 'Tackles in 50', 'high'], ['PressureActs', 'Pressure acts', 'Pressure acts', 'high'], ['KickIns', 'Kick-ins', 'Kick-ins', ''],
    ['Hitouts', 'Hitouts', 'Hitouts', 'high'], ['HitoutsToAdvantage', 'Hitouts to advantage', 'To advantage', 'high'],
    ['RatingPoints_Avg', 'Rating points', 'Rating pts', 'high'], ['CoachesVotes_Total', 'Coaches votes (season total)', 'Coaches votes', 'high']
  ].filter(x => P.seasonCols.includes(x[0]));
  X.PSTAT = Object.fromEntries(X.PSTATS.map(x => [x[0], { key: x[0], name: x[1], head: x[2], short: x[2], better: x[3] }]));
  /* Column sets by what they measure, not by position. */
  X.PSETS = [
    ['Overview', ['WAR', 'TimeOnGround', 'Disposals', 'ContestedPossessions', 'TotalClearances', 'Inside50s', 'Marks', 'Tackles', 'Goals_Avg', 'RatingPoints_Avg']],
    ['Ball use', ['Disposals', 'Kicks', 'Handballs', 'DisposalEfficiency', 'KickingEfficiency', 'KickPercentage', 'UncontestedPossessions', 'MetresGained', 'Turnovers', 'Clangers']],
    ['Contested', ['ContestedPossessions', 'ContestedPossessionRate', 'GroundBallGets', 'HardBallGets', 'TotalClearances', 'CentreClearances', 'StoppageClearances', 'CentreBounceAttendancePercentage', 'ContestedMarks', 'FreesFor']],
    ['Attacking', ['Goals_Avg', 'Goals_Total', 'Behinds', 'ShotsAtGoal', 'Inside50s', 'MarksInside50', 'MarksOnLead', 'GoalAssists', 'ScoreInvolvements', 'ScoreInvolvementPercentage', 'CrumbingPossessions']],
    ['Defensive', ['Intercepts', 'InterceptMarks', 'Rebound50s', 'Spoils', 'OnePercenters', 'ContestDefensiveLossPercentage', 'Tackles', 'PressureActs', 'TacklesInside50', 'FreesAgainst', 'KickIns']],
    ['Ruck', ['Hitouts', 'HitoutsToAdvantage', 'TotalClearances', 'ContestedPossessions', 'ContestedMarks']]
  ].map(([n, k]) => [n, k.filter(x => X.PSTAT[x])]).filter(x => x[1].length);
  X.MIN_GAMES = P.minGames || 5;
  const rankCache = {};
  /* League rank among players with MIN_GAMES+ games. Ties share the better rank. */
  X.playerRank = function (key, statKey) {
    const p = X.player(key); if (!p.s || p.s[statKey] == null || (p.s.Matches || 0) < X.MIN_GAMES) return null;
    let pool = rankCache[statKey];
    if (!pool) {
      const i = SI[statKey];
      pool = rankCache[statKey] = Object.values(P.players).filter(x => !x.dup && x.s && x.s[SI.Matches] >= X.MIN_GAMES && x.s[i] != null).map(x => x.s[i]);
    }
    const v = p.s[statKey], low = (X.PSTAT[statKey] || {}).better === 'low';
    return { rank: pool.filter(x => low ? x < v : x > v).length + 1, of: pool.length };
  };
  /* Percentile among players with MIN_GAMES+ games (100 = best). */
  X.playerPct = function (key, statKey) { const r = X.playerRank(key, statKey); return r ? { pct: r.of > 1 ? Math.round(100 * (r.of - r.rank) / (r.of - 1)) : 100, rank: r.rank, of: r.of } : null; };
  X.fmtP = (k, v) => v == null ? '–' : k === 'WAR' ? U.round(v, 2).toFixed(2) : (k === 'Matches' || /_Total$/.test(k)) ? String(Math.round(v)) : /Percentage|Efficiency|TimeOnGround/.test(k) ? U.round(v, 1).toFixed(1) + '%' : k === 'MetresGained' ? String(Math.round(v)) : U.round(v, 1).toFixed(1);

  /* Keep the playing lists of the fixture's clubs in the workspace roster, for coding.
     Adds missing players only; never removes or renames anything the analyst entered. */
  X.syncRoster = function (wsTeam) {
    const t = X.resolve ? X.resolve(wsTeam) : (X.teams.includes(wsTeam) ? wsTeam : '');
    if (!t) return 0;
    const M = Lab.Model; let added = 0;
    lists.players.filter(p => p.team === t).forEach(p => {
      let id = M.findPlayer(wsTeam, p.name);
      if (id && U.norm(M.player(id).name) !== U.norm(p.name)) id = null;
      if (!id) { M.addPlayer({ name: p.name, team: wsTeam, number: p.number, position: p.position }, true); added++; }
    });
    return added;
  };
  return X;
  }
})(window.Lab);
