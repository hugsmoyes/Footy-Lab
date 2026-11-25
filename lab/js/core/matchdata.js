/* Team Lab: match-level data for one completed match, from the built-in season data and from imports.
   Every value says where it came from. Missing data is reported as missing, never as zero.
   Season averages are only ever returned as context, labelled as such, never as a match value. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis;
  const MD = {};
  const PERIODS = ['Full', 'Q1', 'Q2', 'Q3', 'Q4'];
  MD.PERIODS = PERIODS;

  /* ---------- built-in results ---------- */
  const X = () => (Lab.Pack && Lab.Pack.ok ? Lab.Pack : null);
  MD.packMatch = function (m) {
    const P = X(); if (!P || !m || String(m.season) !== P.raw.season) return null;
    if (m.packId) { const hit = P.matches.find(x => x.id === m.packId); if (hit) return hit; }
    const h = P.resolve(m.home), a = P.resolve(m.away), rd = String(m.round || '').toUpperCase();
    return P.matches.find(x => String(x.rd).toUpperCase() === rd && ((x.home === h && x.away === a) || (x.home === a && x.away === h))) || null;
  };
  const gb = s => { const [g, b] = String(s).split('.').map(Number); return isNaN(g) || isNaN(b) ? null : { g, b, pts: 6 * g + b }; };
  const perQ = cum => cum.map((c, i) => c && (i === 0 || cum[i - 1]) ? c.pts - (i ? cum[i - 1].pts : 0) : null);

  /* Result from our point of view, with quarter scores where known. */
  MD.result = function (m, team, rv) {
    const pm = MD.packMatch(m), P = X();
    if (pm) {
      const weHome = P.resolve(team) === pm.home;
      const cu = (weHome ? pm.hq : pm.aq).map(gb), ct = (weHome ? pm.aq : pm.hq).map(gb);
      const us = weHome ? pm.hs : pm.as, them = weHome ? pm.as : pm.hs;
      return { us, them, margin: us - them, res: us > them ? 'Win' : us < them ? 'Loss' : 'Draw', cumUs: cu, cumThem: ct, qUs: perQ(cu), qThem: perQ(ct), quarters: true, src: `${P.raw.competition} ${P.raw.season} results (built in)` };
    }
    const r = M.result(m, team);
    const q = rv && rv.quarters, weHome = m.home === team;
    const cu = q ? (weHome ? q.home : q.away).map(x => x ? gb(x) : null) : [null, null, null, null];
    const ct = q ? (weHome ? q.away : q.home).map(x => x ? gb(x) : null) : [null, null, null, null];
    const quarters = cu.every(Boolean) && ct.every(Boolean);
    if (!r) return quarters ? { us: cu[3].pts, them: ct[3].pts, margin: cu[3].pts - ct[3].pts, res: cu[3].pts > ct[3].pts ? 'Win' : cu[3].pts < ct[3].pts ? 'Loss' : 'Draw', cumUs: cu, cumThem: ct, qUs: perQ(cu), qThem: perQ(ct), quarters, src: 'Quarter scores entered in the review' } : null;
    return { us: r.for, them: r.against, margin: r.margin, res: r.res, cumUs: cu, cumThem: ct, qUs: perQ(cu), qThem: perQ(ct), quarters, src: 'Score entered with the match' + (quarters ? '; quarter scores entered in the review' : '') };
  };
  MD.fmtGB = c => c ? `${c.g}.${c.b} (${c.pts})` : '–';

  /* Record going into the match, from built-in results (context, not this match's output). */
  MD.before = function (m, team) {
    const P = X(), pm = MD.packMatch(m); if (!P || !pm) return null;
    const one = t => {
      const G = P.teamGames(t).filter(g => g.m.i !== pm.i && (g.date < pm.date || (g.date === pm.date && g.m.i < pm.i)));
      const w = G.filter(g => g.res === 'W').length, l = G.filter(g => g.res === 'L').length;
      return { n: G.length, wld: w + '-' + l + (G.length - w - l ? '-' + (G.length - w - l) : ''), margin: G.length ? G.reduce((a, g) => a + g.margin, 0) / G.length : null, last5: G.slice(-5).map(g => g.res).join('') };
    };
    const t = P.resolve(team), o = t === pm.home ? pm.away : pm.home;
    return { us: one(t), them: one(o), opp: o };
  };

  /* ---------- team match stats ---------- */
  /* Built-in AFL team totals are summed from player stat lines, full game only. */
  const PACK_TEAM = [
    ['Scoring', [['Goals', 'Goals'], ['Behinds', 'Behinds'], ['ShotsAtGoal', 'Shots at goal'], ['xScore', 'Expected score'], ['GoalAssists', 'Goal assists'], ['ScoreLaunches', 'Score launches']]],
    ['Possession', [['Disposals', 'Disposals'], ['Kicks', 'Kicks'], ['Handballs', 'Handballs'], ['DisposalEfficiency', 'Disposal efficiency', '%'], ['ContestedPossessions', 'Contested possessions'], ['GroundBallGets', 'Ground ball gets'], ['HandballReceives', 'Handball receives'], ['Marks', 'Marks']]],
    ['Contest & stoppage', [['TotalClearances', 'Clearances'], ['FirstPossessions', 'First possessions'], ['RuckContests', 'Ruck contests'], ['Hitouts', 'Hitouts'], ['HitoutsToAdvantage', 'Hitouts to advantage'], ['ContestedMarks', 'Contested marks']]],
    ['Territory', [['Inside50s', 'Inside 50s'], ['MetresGained', 'Metres gained', 'm'], ['KickIns', 'Kick-ins']]],
    ['Pressure & defence', [['Tackles', 'Tackles'], ['PressureActs', 'Pressure acts'], ['Turnovers', 'Turnovers'], ['Intercepts', 'Intercept possessions'], ['InterceptMarks', 'Intercept marks']]]
  ];
  const PACK_DEF = ['Disposals', 'ContestedPossessions', 'TotalClearances', 'Inside50s', 'ShotsAtGoal', 'MetresGained', 'Tackles', 'PressureActs', 'Turnovers', 'Intercepts'];
  const IMP_DEF = ['m-disposals', 'm-cp', 'm-clearances', 'm-i50', 'm-shots', 'm-mgained', 'm-tackles', 'm-pressure', 'm-turnovers', 'm-intercepts', 'm-marks', 'm-cm'];
  /* VFL team match stats are a short list, so the default key stats add the ones it has. */
  Object.defineProperty(MD, 'DEFAULT_KEYS', { get() { const P = X(); return PACK_DEF.concat(P && P.teamDirect ? ['Goals', 'Kicks', 'Handballs', 'Marks', 'Hitouts'] : []).map(k => 'pack:' + k).concat(IMP_DEF.map(k => 'met:' + k)); } });

  MD.fmt = function (unit, v, opts) {
    if (v == null || isNaN(v)) return '–';
    if (unit === '%' || unit === 'ratio') return (unit === 'ratio' ? U.round(v * 100, 1) : U.round(v, 1)).toFixed(1) + '%';
    if (unit === 'm') return Math.round(v).toLocaleString('en-AU') + (opts && opts.noUnit ? '' : 'm');
    return Number.isInteger(v) ? String(v) : U.round(v, 1).toFixed(1);
  };
  const mean = a => { const b = a.filter(v => v != null && !isNaN(v)); return b.length ? { v: b.reduce((x, y) => x + y, 0) / b.length, n: b.length } : { v: null, n: 0 }; };

  /* Imported metrics that have a value for this match (either team), at a period. */
  function importRows(m, team, period) {
    const opp = M.opponentIn(m, team);
    const sea = Lab.Season && Lab.Season.getSeason ? Lab.Season.getSeason(m.competition || (M.ws() || {}).competition, m.season) : null;
    const others = M.state.matches.filter(x => x.id !== m.id && M.involves(x, team));
    return M.state.metrics.filter(mt => mt.level !== 'player').map(mt => {
      const us = M.teamValue(m.id, team, period, mt.id), them = M.teamValue(m.id, opp, period, mt.id);
      if (us == null && them == null) return null;
      const unit = mt.kind === 'ratio' ? 'ratio' : mt.unit;
      const bf = A.aggregate(mt, others.map(x => M.teamValue(x.id, team, period, mt.id)));
      const ba = A.aggregate(mt, others.map(x => M.teamValue(x.id, M.opponentIn(x, team), period, mt.id)));
      let base = bf.n ? { f: bf.value, a: ba.n ? ba.value : null, n: bf.n, label: `our other imported matches (${bf.n})`, note: 'Average of our other matches with this stat imported.' } : null;
      if (!base && period === 'Full' && sea && sea.teams && sea.teams[team] && mt.kind !== 'ratio') {
        const S = Lab.Season, f = S.value(sea, team, 'for', mt.id), a = S.value(sea, team, 'against', mt.id);
        if (f != null) base = { f, a, n: sea.teams[team].games, label: `season average (${sea.teams[team].games} games)`, note: `${sea.competition} ${sea.season} team season stats. Includes this match, so it isn't an independent comparison.`, season: true };
      }
      return { id: 'met:' + mt.id, key: mt.id, label: mt.name, group: mt.group || 'Imported', unit, src: 'import', srcLabel: 'Imported match stats', us: A.asNumber(us), them: A.asNumber(them), rawUs: us, rawThem: them, base };
    }).filter(Boolean);
  }
  function packRows(m, team) {
    const P = X(), pm = MD.packMatch(m); if (!P || !P.hasGames || !pm) return [];
    const t = P.resolve(team), o = t === pm.home ? pm.away : pm.home;
    const tu = P.total(pm.i, t), to = P.total(pm.i, o); if (!tu && !to) return [];
    const G = P.teamGames(t).filter(g => g.m.i !== pm.i);
    const rows = [];
    PACK_TEAM.forEach(([grp, list]) => list.forEach(([k, label, unit]) => {
      const us = tu && tu[k] != null ? tu[k] : null, them = to && to[k] != null ? to[k] : null;
      if (us == null && them == null) return;
      const bf = mean(G.map(g => P.gameValue(g, 'for', k))), ba = mean(G.map(g => P.gameValue(g, 'against', k)));
      rows.push({ id: 'pack:' + k, key: k, label, group: grp, unit: unit || 'count', src: 'pack', srcLabel: P.teamDirect && (P.raw.teamGameCols || []).includes(k) ? `${P.raw.competition} ${P.raw.season} team match stats` : `${P.raw.competition} ${P.raw.season} player stats, summed by team`, us, them,
        base: bf.n ? { f: bf.v, a: ba.v, n: bf.n, label: `our other ${P.raw.season} games (${bf.n})`, note: `Average of our other ${P.raw.season} games in the built-in data, this match excluded.` } : null });
    }));
    return rows;
  }
  /* All team stat rows for a match. period applies to imported stats; built-in stats are full game only. */
  MD.teamRows = function (m, team, period) {
    period = period || 'Full';
    return (period === 'Full' ? packRows(m, team) : []).concat(importRows(m, team, period));
  };
  MD.teamRow = function (m, team, id, period) { return MD.teamRows(m, team, period).find(r => r.id === id) || null; };
  MD.importPeriods = function (m, team) { return PERIODS.filter(p => Object.keys(M.state.teamStats).some(k => k.startsWith(`${m.id}|${team}|${p}|`) || k.startsWith(`${m.id}|${M.opponentIn(m, team)}|${p}|`))); };

  /* ---------- player match stats ---------- */
  const PACK_PLAYER_SETS = [
    ['Overview', ['TimeOnGround', 'Disposals', 'ContestedPossessions', 'TotalClearances', 'Inside50s', 'Kicks', 'Handballs', 'Marks', 'Tackles', 'Hitouts', 'Goals', 'Behinds', 'ScoreInvolvements', 'RatingPoints', 'DreamTeamPoints']],
    ['Ball use', ['Disposals', 'Kicks', 'Handballs', 'DisposalEfficiency', 'MetresGained', 'HandballReceives', 'Turnovers']],
    ['Contested', ['ContestedPossessions', 'GroundBallGets', 'TotalClearances', 'FirstPossessions', 'CentreBounceAttendancePercentage', 'ContestedMarks']],
    ['Attacking', ['Goals', 'Behinds', 'ShotsAtGoal', 'xScore', 'GoalAssists', 'Inside50s', 'ScoreInvolvements', 'ScoreLaunches']],
    ['Defensive', ['Intercepts', 'InterceptMarks', 'Tackles', 'PressureActs', 'KickIns']],
    ['Ruck', ['RuckContests', 'Hitouts', 'HitoutsToAdvantage', 'ContestedPossessions', 'TotalClearances']]
  ];
  const PNAME = { TimeOnGround: ['Time on ground %', 'TOG', '%'], CentreBounceAttendancePercentage: ['Centre bounce attendance %', 'CBA', '%'], Disposals: ['Disposals', 'Disp'], Kicks: ['Kicks', 'K'], Handballs: ['Handballs', 'HB'], DisposalEfficiency: ['Disposal efficiency %', 'DE', '%'], ContestedPossessions: ['Contested possessions', 'CP'], GroundBallGets: ['Ground ball gets', 'GBG'], TotalClearances: ['Clearances', 'Clr'], FirstPossessions: ['First possessions', 'FP'], Inside50s: ['Inside 50s', 'I50'], MetresGained: ['Metres gained', 'MG', 'm'], Marks: ['Marks', 'Mk'], ContestedMarks: ['Contested marks', 'CM'], InterceptMarks: ['Intercept marks', 'IM'], Intercepts: ['Intercept possessions', 'Int'], Tackles: ['Tackles', 'Tk'], PressureActs: ['Pressure acts', 'PA'], Turnovers: ['Turnovers', 'TO'], KickIns: ['Kick-ins', 'KI'], HandballReceives: ['Handball receives', 'HBR'], RuckContests: ['Ruck contests', 'RC'], Hitouts: ['Hitouts', 'HO'], HitoutsToAdvantage: ['Hitouts to advantage', 'HOA'], ShotsAtGoal: ['Shots at goal', 'Shots'], Goals: ['Goals', 'G'], Behinds: ['Behinds', 'B'], xScore: ['Expected score', 'xS'], GoalAssists: ['Goal assists', 'GA'], ScoreInvolvements: ['Score involvements', 'SI'], ScoreLaunches: ['Score launches', 'SL'], RatingPoints: ['Rating points', 'Rtg'], DreamTeamPoints: ['Fantasy points', 'AF'] };
  const seasonKeyFor = k => k === 'Goals' ? 'Goals_Avg' : k === 'RatingPoints' ? 'RatingPoints_Avg' : k === 'DreamTeamPoints' ? 'DreamTeamPoints_Avg' : k;

  /* {src, srcLabel, sets:[[name,[col]]], cols:{k:{label,head,unit}}, rows:[{id, key, name, number, v:{}, season:{}}]} or null */
  MD.players = function (m, team) {
    const P = X(), pm = MD.packMatch(m);
    if (P && P.hasGames && pm) {
      const t = P.resolve(team);
      const rows = P.roster(t).map(p => { const g = P.games(p).find(x => x.tg && x.tg.m.i === pm.i); return g ? { id: p.key, key: p.key, name: p.name, number: p.number, v: g.v, s: p.s || {}, games: p.games } : null; }).filter(Boolean);
      if (rows.length) {
        const cols = {}; Object.keys(PNAME).forEach(k => { cols[k] = { label: PNAME[k][0], head: PNAME[k][1], unit: PNAME[k][2] || 'count', seasonKey: P.PSTAT[seasonKeyFor(k)] ? seasonKeyFor(k) : null }; });
        return { src: 'pack', srcLabel: `${P.raw.competition} ${P.raw.season} per-game player stats (built in)`, sets: PACK_PLAYER_SETS.map(([n, ks]) => [n, ks.filter(k => P.gameCols.includes(k))]).filter(([n, ks]) => ks.length > 1 && (n === 'Overview' || P.gameCols.length > 12)), cols, rows };
      }
    }
    const ps = M.state.playerStats, pre = m.id + '|';
    const ids = [...new Set(Object.keys(ps).filter(k => k.startsWith(pre)).map(k => k.split('|')[1]))].filter(id => { const p = M.player(id); return p && p.team === team; });
    if (!ids.length) return null;
    const mets = M.state.metrics.filter(mt => mt.level !== 'team' && ids.some(id => M.playerValue(m.id, id, mt.id) != null));
    const cols = {}; mets.forEach(mt => { cols[mt.id] = { label: mt.name, head: mt.name.length > 12 ? mt.name.slice(0, 11) + '…' : mt.name, unit: mt.kind === 'ratio' ? 'ratio' : mt.unit }; });
    const groups = [...new Set(mets.map(mt => mt.group || 'Imported'))];
    const sets = [['All', mets.map(mt => mt.id)]].concat(groups.length > 1 ? groups.map(g => [g, mets.filter(mt => (mt.group || 'Imported') === g).map(mt => mt.id)]) : []);
    const rows = ids.map(id => { const p = M.player(id), v = {}; mets.forEach(mt => { v[mt.id] = A.asNumber(M.playerValue(m.id, id, mt.id)); }); return { id, name: p.name, number: p.number, v }; });
    return { src: 'import', srcLabel: 'Imported player match stats', sets, cols, rows };
  };

  /* ---------- coverage ---------- */
  MD.lineup = function (m, team) {
    const l = (m.lineups || {})[team] || [];
    if (l.length) return { n: l.length, src: 'Entered or imported line-up' };
    const pl = MD.players(m, team);
    if (pl && pl.src === 'pack') return { n: pl.rows.length, src: 'Players with a stat line in the built-in data (not an official team sheet)', derived: true };
    return null;
  };
  MD.videoStatus = function (m) {
    const v = M.state.videos[m.id] || {}, local = Lab.localVideos[m.id];
    const evs = M.state.events.filter(e => e.matchId === m.id), timed = evs.filter(e => e.video && e.video.time != null).length;
    const clips = M.state.clips.filter(c => c.matchId === m.id).length;
    const parts = [];
    if (local) parts.push(`Playing a local file (${local.name}) from this computer for this session. Not uploaded or stored.`);
    else if (v.fileName) parts.push(`Last local file: ${v.fileName}. Only the name is saved; choose the file again to play it.`);
    if (v.url) parts.push(/youtu/.test(v.url) ? 'YouTube link saved. The video stays on YouTube.' : /\.(mp4|m4v|webm|mov|ogg)(\?|#|$)/i.test(v.url) ? 'Direct video link saved. The file stays where it is hosted.' : 'Link saved (opens in a new tab). The video stays where it is hosted.');
    if (timed) parts.push(`${timed} coded event${timed === 1 ? '' : 's'} with a confirmed video time.`);
    if (clips) parts.push(`${clips} clip${clips === 1 ? '' : 's'} (in and out points only; no new video file is made).`);
    return { any: !!(local || v.fileName || v.url || timed || clips), linked: !!v.url, local: !!local, timed, clips, text: parts.join(' ') || 'No video linked. Club Lab never hosts or edits video: it saves links, file names and timestamps.' };
  };
  /* Six rows: what this match has, and what to do when something is missing. */
  MD.coverage = function (m, team, rv) {
    const P = X(), pm = MD.packMatch(m), opp = M.opponentIn(m, team);
    const comp = (M.ws() || {}).competition || m.competition || '';
    const packName = P ? `${P.raw.competition} ${P.raw.season}` : `${comp} ${m.season}`;
    const out = [];
    const r = MD.result(m, team, rv);
    out.push(r && r.quarters ? { id: 'result', label: 'Result and quarter scores', state: 'ok', text: `${r.res} ${U.signed(r.margin)}, ${r.us}-${r.them}, with quarter-by-quarter scores.`, src: r.src }
      : r ? { id: 'result', label: 'Result and quarter scores', state: 'part', text: `Final score only: ${r.res} ${U.signed(r.margin)}, ${r.us}-${r.them}. No quarter scores.`, src: r.src, acts: [['quarters', 'Add quarter scores']] }
      : { id: 'result', label: 'Result and quarter scores', state: 'none', text: 'No score for this match.', acts: [['editMatch', 'Enter the final score'], ['quarters', 'Add quarter scores']] });
    const pr = packRows(m, team), ir = importRows(m, team, 'Full'), per = MD.importPeriods(m, team).filter(p => p !== 'Full');
    const impTeams = [team, opp].filter(t => M.hasTeamStats(m.id, t));
    const tsActs = [['import:teamstats', 'Import team stats'], ['tpl:team', 'Pre-filled template'], ['manual', 'Enter stats by hand']];
    if (pr.length || ir.length) {
      const bits = [];
      if (pr.length) bits.push(`${pr.length} stats for both teams, full game, ${P.teamDirect ? 'from team match stats' : 'summed from player stat lines'} (${packName}). No quarter splits.`);
      if (ir.length) bits.push(`${ir.length} imported stat${ir.length === 1 ? '' : 's'} for ${impTeams.length === 2 ? 'both teams' : impTeams[0] || 'one team'}${per.length ? `, with ${per.join(', ')} splits` : ', full game'}.`);
      out.push({ id: 'teamstats', label: 'Team match statistics', state: impTeams.length === 1 && !pr.length ? 'part' : 'ok', text: bits.join(' '), src: [pr.length && `${packName} built-in`, ir.length && 'Imported'].filter(Boolean).join(' + '), acts: pr.length ? [] : tsActs.slice(0, 1) });
    } else out.push({ id: 'teamstats', label: 'Team match statistics', state: 'none', text: P && !P.hasGames && pm ? `The ${packName} built-in data has team season averages only, not per-game team stats.` : 'No team stats for this match.', acts: tsActs });
    const pu = MD.players(m, team), po = MD.players(m, opp);
    if (pu) out.push({ id: 'playerstats', label: 'Player match statistics', state: 'ok', text: `${pu.rows.length} of our players${po ? `, ${po.rows.length} of theirs` : ''}.`, src: pu.srcLabel });
    else out.push({ id: 'playerstats', label: 'Player match statistics', state: 'none', text: P && !P.hasGames ? `The ${packName} built-in data has player season averages only, not per-game stats. Season averages are shown as context and never as this match.` : 'No player stats for this match.', acts: [['import:playerstats', 'Import player stats'], ['tpl:player', 'Pre-filled template']] });
    const lu = MD.lineup(m, team);
    out.push(lu ? { id: 'lineups', label: 'Line-ups', state: lu.derived ? 'part' : 'ok', text: `${lu.n} players for ${team}.`, src: lu.src, acts: lu.derived ? [['lineups', 'Tick the team sheet']] : [] }
      : { id: 'lineups', label: 'Line-ups', state: 'none', text: 'Who played is not recorded.', acts: [['lineups', 'Tick who played']] });
    const ev = M.state.events.filter(e => e.matchId === m.id), evUs = ev.filter(e => e.team === team).length, tpls = new Set(ev.map(e => e.templateId)).size;
    out.push(ev.length ? { id: 'events', label: 'Coded events', state: 'ok', text: `${ev.length} events (${evUs} coded for us, ${ev.length - evUs} for ${opp}) across ${tpls} template${tpls === 1 ? '' : 's'}.`, src: 'Coded by staff in Club Lab' }
      : { id: 'events', label: 'Coded events', state: 'opt', text: 'Nothing coded. Optional: the review works from stats alone.', acts: [['code', 'Code this match'], ['import:events', 'Import events']] });
    const vs = MD.videoStatus(m);
    out.push({ id: 'video', label: 'Video links and timestamps', state: vs.any ? 'ok' : 'opt', text: vs.text, src: vs.any ? 'Saved in this browser' : '', acts: [['video', vs.any ? 'Open video' : 'Add a link or local file']] });
    return out;
  };
  MD.STATE_LABEL = { ok: 'Available', part: 'Partial', none: 'Missing', opt: 'Not added (optional)' };
  MD.coverageTable = function (items) {
    return `<div class="covtab">${items.map(c => `<div class="covrow cv-${c.state}"><div class="cv-h"><b>${U.esc(c.label)}</b><span class="cvs cvs-${c.state}">${MD.STATE_LABEL[c.state]}</span></div><p>${U.esc(c.text)}</p>${c.src ? `<p class="cv-src">Source: ${U.esc(c.src)}</p>` : ''}${(c.acts || []).length ? `<div class="ctl">${c.acts.map(([a, l], i) => `<button class="btn sm${i === 0 && c.state !== 'opt' ? ' g' : ''}" data-act="${a}">${U.esc(l)}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
  };
  /* Small badges for the Matches table. */
  MD.badges = function (m, team) {
    const ts = packRows(m, team).length || M.hasTeamStats(m.id, team), pl = !!MD.players(m, team);
    return `<span class="cov${ts ? ' on' : ''}" data-tip="${ts ? 'Team match stats available' : 'No team match stats'}">Stats</span><span class="cov${pl ? ' on' : ''}" data-tip="${pl ? 'Player match stats available' : 'No player match stats'}">Players</span>`;
  };

  /* ---------- pre-filled import templates for one match ---------- */
  /* Starter stat definitions and ones imported earlier; season-file columns are left out. */
  MD.entryMetrics = level => M.state.metrics.filter(mt => mt.kind === 'value' && (mt.level === 'both' || mt.level === level) && (mt.starter || mt.group === 'Imported'));
  const tplMetrics = MD.entryMetrics;
  MD.templateCSV = function (m, team, kind) {
    const opp = M.opponentIn(m, team);
    if (kind === 'team') {
      const mets = tplMetrics('team');
      return U.toCSV(['Season', 'Round', 'Team', 'Opponent', 'Period'].concat(mets.map(x => x.name)), [[m.season, m.round, team, opp, 'Full'], [m.season, m.round, opp, team, 'Full']].map(r => r.concat(mets.map(() => ''))));
    }
    const mets = tplMetrics('player');
    const list = t => { const lu = (m.lineups || {})[t] || []; const ros = lu.length ? lu.map(M.player).filter(Boolean) : M.roster(t); return ros.map(p => [m.season, m.round, t, M.opponentIn(m, t), p.name, p.number].concat(mets.map(() => ''))); };
    const rows = list(team).concat(list(opp));
    return U.toCSV(['Season', 'Round', 'Team', 'Opponent', 'Player', 'Number'].concat(mets.map(x => x.name)), rows.length ? rows : [[m.season, m.round, team, opp, '', ''].concat(mets.map(() => ''))]);
  };

  /* ---------- charts for findings and the report (re-drawn from current data) ---------- */
  const C = () => Lab.Charts;
  MD.chart = function (spec) {
    const m = M.match(spec.matchId), w = M.ws(); if (!m || !w) return '';
    const team = w.focus, opp = M.opponentIn(m, team), Ch = C();
    if (spec.kind === 'mQuarters') {
      const r = MD.result(m, team, M.reviewFor(m.id)); if (!r || !r.quarters) return '';
      return Ch.grouped(['Q1', 'Q2', 'Q3', 'Q4'], [{ name: team, color: Ch.COL.opp, values: r.qUs, tips: r.qUs.map(v => v + ' pts') }, { name: opp, color: Ch.COL.their, values: r.qThem, tips: r.qThem.map(v => v + ' pts') }], { fmt: v => U.round(v, 0), aria: 'Points scored in each quarter' })
        + `<p class="sub">Points in each quarter. ${[0, 1, 2, 3].map(i => `Q${i + 1} ${r.qUs[i]}-${r.qThem[i]}`).join(', ')}.</p>`;
    }
    if (spec.kind === 'mTeamStat') {
      const row = MD.teamRow(m, team, spec.id, spec.period); if (!row) return '';
      const cats = ['This match'].concat(row.base ? [row.base.season ? 'Season average' : 'Our other games (avg)'] : []);
      const f = v => MD.fmt(row.unit, v);
      return Ch.grouped(cats, [{ name: team, color: Ch.COL.opp, values: [row.us].concat(row.base ? [row.base.f] : []), tips: [f(row.us)].concat(row.base ? [f(row.base.f)] : []) }, { name: row.base ? `${opp} / opponents` : opp, color: Ch.COL.their, values: [row.them].concat(row.base ? [row.base.a] : []), tips: [f(row.them)].concat(row.base ? [f(row.base.a)] : []) }], { fmt: v => MD.fmt(row.unit, v, { noUnit: true }), aria: row.label })
        + `<p class="sub">${U.esc(row.label)}${spec.period && spec.period !== 'Full' ? ' (' + spec.period + ')' : ''}: ${U.esc(team)} ${f(row.us)}, ${U.esc(opp)} ${f(row.them)}${row.base ? `; ${U.esc(row.base.label)}: ${f(row.base.f)} for, ${f(row.base.a)} against` : ''}. Source: ${U.esc(row.srcLabel)}.</p>`;
    }
    if (spec.kind === 'mPlayers') {
      const pl = MD.players(m, spec.team || team); if (!pl || !pl.cols[spec.col]) return '';
      const c = pl.cols[spec.col], rows = pl.rows.filter(r => r.v[spec.col] != null).sort((a, b) => b.v[spec.col] - a.v[spec.col]).slice(0, spec.top || 8);
      return Ch.bars(rows.map(r => ({ label: r.name, value: r.v[spec.col], n: 99 })), { fmt: v => MD.fmt(c.unit, v) }) + `<p class="sub">${U.esc(c.label)}, top ${rows.length} for ${U.esc(spec.team || team)} in this match. Source: ${U.esc(pl.srcLabel)}.</p>`;
    }
    return '';
  };

  Lab.MD = MD;
})(window.Lab);
