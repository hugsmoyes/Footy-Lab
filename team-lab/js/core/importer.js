/* Opponent Lab: generic CSV/TSV import and export. Runs entirely in the browser.
   Kinds: players, matches, team stats, player stats, coded events (any template).
   Headers are matched by name (case and punctuation ignored); every mapping can be changed. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  /* ---------- parsing ---------- */
  function detectDelimiter(text) {
    const lines = text.slice(0, 5000).split(/\r?\n/).slice(0, 8);
    let best = ',', bestN = -1;
    [',', '\t', ';'].forEach(d => {
      const n = lines.reduce((a, line) => { let c = 0, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) c++; } return a + c; }, 0);
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }
  function parse(text) {
    text = String(text || '').replace(/^﻿/, '');
    const d = detectDelimiter(text);
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    while (rows.length && !rows[rows.length - 1].some(c => String(c).trim())) rows.pop();
    return { rows, delimiter: d };
  }

  /* ---------- kinds ---------- */
  const F = (key, label, aliases, req) => ({ key, label, aliases: [U.norm(label)].concat(aliases || []), required: !!req });
  const MATCH_ID = [F('season', 'Season', ['year']), F('round', 'Round', ['rd', 'rnd'], true), F('team', 'Team', ['teamlogged', 'club', 'teamcoded'], true), F('opponent', 'Opponent', ['opp', 'opposition', 'against'], true)];
  const KINDS = {
    players: { label: 'Players (rosters)', fields: [F('name', 'Player', ['name', 'playername', 'fullname'], true), F('team', 'Team', ['club'], true), F('number', 'Number', ['no', 'jumper', 'guernsey', 'num']), F('position', 'Position', ['pos', 'role'])] },
    matches: { label: 'Matches', fields: [F('season', 'Season', ['year']), F('round', 'Round', ['rd'], true), F('competition', 'Competition', ['comp', 'league']), F('date', 'Date', ['matchdate']), F('venue', 'Venue', ['ground']), F('home', 'Home team', ['home', 'team1', 'team'], true), F('away', 'Away team', ['away', 'team2', 'opponent'], true), F('homeScore', 'Home score', ['homepoints']), F('awayScore', 'Away score', ['awaypoints'])] },
    teamstats: { label: 'Team stats (one row per team per match)', metrics: 'team', fields: MATCH_ID.concat([F('period', 'Period', ['quarter', 'qtr'])]) },
    playerstats: { label: 'Player stats (one row per player per match)', metrics: 'player', fields: MATCH_ID.concat([F('player', 'Player', ['name', 'playername'], true), F('number', 'Number', ['no', 'jumper'])]) },
    events: { label: 'Coded events (choose a template)', fields: MATCH_ID.concat([F('quarter', 'Quarter', ['qtr', 'q', 'period'], true), F('clock', 'Clock (mm:ss)', ['clock', 'time', 'clockmmss']), F('tags', 'Tags', ['tag']), F('notes', 'Notes', ['note', 'comments', 'analystnotes']), F('videoTime', 'Video time', ['timestamp', 'videotimestamp'])]) }
  };
  function fieldsFor(kind, tpl) {
    const k = KINDS[kind];
    let fs = k.fields.slice();
    if (kind === 'events' && tpl) fs = fs.concat(tpl.fields.filter(f => f.key !== 'notes').map(f => F('v:' + f.key, f.label, [U.norm(f.key)], !!f.required)));
    if (k.metrics) fs = fs.concat(M.state.metrics.filter(mt => mt.kind === 'value' && (mt.level === 'both' || mt.level === k.metrics)).map(mt => F('m:' + mt.id, mt.name, [U.norm(mt.id.replace(/^m-/, ''))])));
    return fs;
  }

  function analyse(text, kind, opts) {
    opts = opts || {};
    const tpl = opts.templateId ? M.template(opts.templateId) : null;
    const { rows, delimiter } = parse(text);
    const fields = fieldsFor(kind, tpl);
    const alias = new Map(); fields.forEach(f => f.aliases.forEach(a => { if (!alias.has(a)) alias.set(a, f.key); }));
    let hi = -1, best = 0;
    rows.slice(0, 12).forEach((r, i) => { const n = r.filter(c => alias.has(U.norm(c))).length; if (n > best) { best = n; hi = i; } });
    const res = { kind, delimiter, rows, headerIndex: hi, header: [], mapping: [], fields, notes: [], tpl };
    if (hi < 0 || best < Math.min(2, fields.filter(f => f.required).length)) { res.error = 'No header row found. The first row should name the columns, e.g. ' + fields.filter(f => f.required).map(f => f.label).join(', ') + '.'; return res; }
    res.header = rows[hi].map(h => String(h).trim());
    const used = new Set();
    res.mapping = opts.mapping || res.header.map(h => { const k = alias.get(U.norm(h)); if (k && !used.has(k)) { used.add(k); return k; } return ''; });
    let data = rows.slice(hi + 1);
    if (hi > 0) res.notes.push({ level: 'info', msg: `Skipped ${hi} row(s) above the header.` });
    res.firstRow = data[0] || null;
    res.skipFirst = opts.skipFirst != null ? opts.skipFirst : false;
    if (res.skipFirst) data = data.slice(1);
    res.data = data.filter(r => r.some(c => String(c).trim()));
    const missing = fields.filter(f => f.required && !res.mapping.includes(f.key));
    if (missing.length) res.notes.push({ level: 'warn', msg: 'Map these required columns before importing: ' + missing.map(f => f.label).join(', ') + '.' });
    const unused = res.header.filter((h, i) => h && !res.mapping[i]);
    if (unused.length) res.notes.push({ level: 'info', msg: 'Columns not used: ' + unused.join(', ') + (KINDS[kind].metrics ? '. Tick "create stat definitions" to add numeric ones as new stats.' : '.') });
    res.ok = !missing.length;
    return res;
  }

  function findMatch(season, round, a, b) {
    return M.state.matches.find(m => String(m.season) === String(season || m.season) && String(m.round).toUpperCase() === String(round).toUpperCase() && ((m.home === a && m.away === b) || (m.home === b && m.away === a)));
  }

  /* Commit: returns a summary of what was created. */
  function commit(res, opts) {
    opts = opts || {};
    const get = (r, key) => { const i = res.mapping.indexOf(key); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
    const sum = { rows: 0, players: 0, matches: 0, stats: 0, events: 0, metrics: 0, warnings: [] };
    const matchFor = r => {
      const team = get(r, 'team'), opp = get(r, 'opponent'), season = get(r, 'season'), round = get(r, 'round');
      if (!team || !opp || !round) return null;
      let m = findMatch(season, round, team, opp);
      if (!m) { m = M.addMatch({ season, round, home: team, away: opp, competition: opts.competition || '' }, true); sum.matches++; }
      return m;
    };
    const playerFor = (team, name, number) => {
      let id = M.findPlayer(team, name) || (number ? M.findPlayer(team, number) : null);
      if (!id && (name || number)) { id = M.addPlayer({ team, name: name || '#' + number, number: number || '' }, true).id; sum.players++; }
      return id;
    };
    // New stat definitions for unmapped numeric columns
    if (KINDS[res.kind].metrics && opts.createMetrics) {
      res.header.forEach((h, i) => {
        if (res.mapping[i] || !h) return;
        const nums = res.data.map(r => r[i]).filter(v => String(v).trim() !== '');
        if (nums.length && nums.every(v => !isNaN(parseFloat(String(v).replace('%', ''))))) {
          const id = U.uid('met');
          M.state.metrics.push({ id, name: h, group: 'Imported', level: KINDS[res.kind].metrics, kind: 'value', unit: /%/.test(h) ? '%' : 'count' });
          res.mapping[i] = 'm:' + id; sum.metrics++;
        }
      });
    }
    res.data.forEach((r, ri) => {
      sum.rows++;
      if (res.kind === 'players') {
        const name = get(r, 'name'), team = get(r, 'team');
        if (!name || !team) { sum.warnings.push(`Row ${ri + 1}: missing name or team`); return; }
        const id = M.findPlayer(team, name);
        if (id) M.state.players.find(p => p.id === id).number = get(r, 'number') || M.player(id).number;
        else { M.addPlayer({ name, team, number: get(r, 'number'), position: get(r, 'position') }, true); sum.players++; }
      } else if (res.kind === 'matches') {
        const home = get(r, 'home'), away = get(r, 'away'), round = get(r, 'round');
        if (!home || !away || !round) { sum.warnings.push(`Row ${ri + 1}: missing round or teams`); return; }
        const ex = findMatch(get(r, 'season'), round, home, away);
        const patch = {}; ['season', 'competition', 'date', 'venue', 'homeScore', 'awayScore'].forEach(k => { const v = get(r, k); if (v) patch[k] = v; });
        if (!patch.competition && opts.competition) patch.competition = opts.competition;
        if (ex) Object.assign(ex, patch); else { M.addMatch(Object.assign({ round, home, away }, patch), true); sum.matches++; }
      } else if (res.kind === 'teamstats' || res.kind === 'playerstats') {
        const m = matchFor(r);
        if (!m) { sum.warnings.push(`Row ${ri + 1}: missing round, team or opponent`); return; }
        const team = get(r, 'team');
        let pid = null;
        if (res.kind === 'playerstats') { pid = playerFor(team, get(r, 'player'), get(r, 'number')); if (!pid) { sum.warnings.push(`Row ${ri + 1}: no player`); return; } m.lineups = m.lineups || {}; m.lineups[team] = m.lineups[team] || []; if (!m.lineups[team].includes(pid)) m.lineups[team].push(pid); }
        const period = (get(r, 'period') || 'Full').toUpperCase().replace(/^QUARTER\s*/, 'Q').replace(/^(\d)$/, 'Q$1').replace('FULL', 'Full');
        res.mapping.forEach((k, i) => {
          if (!k.startsWith('m:')) return;
          const raw = String(r[i] == null ? '' : r[i]).trim().replace('%', '');
          if (raw === '' || isNaN(parseFloat(raw))) return;
          if (pid) M.setPlayerStat(m.id, pid, k.slice(2), parseFloat(raw), true); else M.setTeamStat(m.id, team, period, k.slice(2), parseFloat(raw), true);
          sum.stats++;
        });
      } else if (res.kind === 'events') {
        const m = matchFor(r);
        if (!m) { sum.warnings.push(`Row ${ri + 1}: missing round, team or opponent`); return; }
        const team = get(r, 'team'), opp = M.opponentIn(m, team);
        const v = {};
        res.tpl.fields.forEach(f => {
          if (f.key === 'notes') return;
          let x = get(r, 'v:' + f.key);
          if (x === '') return;
          if (f.type === 'choice') { const hit = (f.options || []).find(o => U.norm(o) === U.norm(x)); if (hit) x = hit; else sum.warnings.push(`Row ${ri + 1}: "${x}" is not an option for ${f.label} (kept as typed)`); }
          if (f.type === 'player') x = playerFor(f.side === 'against' ? opp : team, x.replace(/^([A-Z])\.(?=\S)/, '$1. '), /^\d+$/.test(x) ? x : '');
          if (f.type === 'number' || f.type === 'margin' || f.type === 'chain') x = isNaN(parseFloat(x)) ? x : parseFloat(x);
          v[f.key] = x;
        });
        const vt = U.parseVideoTime(get(r, 'videoTime'));
        M.addEvent({ matchId: m.id, templateId: res.tpl.id, team, period: parseInt(get(r, 'quarter'), 10) || 1, clock: get(r, 'clock'), v, tags: get(r, 'tags') ? get(r, 'tags').split(/[;,]/).map(t => t.trim()).filter(Boolean) : [], notes: get(r, 'notes'), video: vt != null ? { time: vt, status: 'confirmed' } : null, source: 'import' }, true);
        sum.events++;
      }
    });
    if (sum.warnings.length > 50) sum.warnings = sum.warnings.slice(0, 50).concat([`…and ${sum.warnings.length - 50} more`]);
    M.emit('import');
    return sum;
  }

  /* ---------- export ---------- */
  function exportKind(kind, opts) {
    opts = opts || {};
    const ws = M.ws();
    const ml = M.wsMatches(ws);
    const mset = opts.allMatches ? M.state.matches : ml;
    if (kind === 'players') return U.toCSV(['Player', 'Team', 'Number', 'Position'], M.state.players.map(p => [p.name, p.team, p.number, p.position]));
    if (kind === 'matches') return U.toCSV(['Season', 'Round', 'Competition', 'Date', 'Venue', 'Home team', 'Away team', 'Home score', 'Away score'], mset.map(m => [m.season, m.round, m.competition, m.date, m.venue, m.home, m.away, m.homeScore, m.awayScore]));
    if (kind === 'teamstats') {
      const mets = M.state.metrics.filter(x => x.kind === 'value' && x.level !== 'player');
      const rows = [];
      mset.forEach(m => [m.home, m.away].forEach(team => ['Full', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(p => {
        const vals = mets.map(x => { const v = M.state.teamStats[M.tsKey(m.id, team, p, x.id)]; return v == null ? '' : v; });
        if (vals.some(v => v !== '')) rows.push([m.season, m.round, team, M.opponentIn(m, team), p].concat(vals));
      })));
      return U.toCSV(['Season', 'Round', 'Team', 'Opponent', 'Period'].concat(mets.map(x => x.name)), rows);
    }
    if (kind === 'playerstats') {
      const mets = M.state.metrics.filter(x => x.kind === 'value' && x.level !== 'team');
      const rows = [];
      mset.forEach(m => M.state.players.forEach(p => {
        const vals = mets.map(x => { const v = M.state.playerStats[M.psKey(m.id, p.id, x.id)]; return v == null ? '' : v; });
        if (vals.some(v => v !== '')) rows.push([m.season, m.round, p.team, M.opponentIn(m, p.team), p.name, p.number].concat(vals));
      }));
      return U.toCSV(['Season', 'Round', 'Team', 'Opponent', 'Player', 'Number'].concat(mets.map(x => x.name)), rows);
    }
    if (kind === 'events') {
      const tpl = M.template(opts.templateId);
      const evs = (opts.events || M.state.events.filter(e => e.templateId === tpl.id));
      const fs = tpl.fields.filter(f => f.key !== 'notes');
      return U.toCSV(['Season', 'Round', 'Team', 'Opponent', 'Quarter', 'Clock (mm:ss)'].concat(fs.map(f => f.label)).concat(['Tags', 'Notes', 'Video time']),
        evs.map(e => { const m = M.match(e.matchId) || {}; return [m.season, m.round, e.team, M.opponentIn(m, e.team), e.period, e.clock].concat(fs.map(f => f.type === 'player' ? M.playerName(e.v[f.key]) : (e.v[f.key] == null ? '' : e.v[f.key]))).concat([(e.tags || []).join('; '), e.notes, e.video && e.video.time != null ? U.fmtVideoTime(e.video.time) : '']); }));
    }
    return '';
  }
  function templateHeaders(kind, templateId) {
    const tpl = templateId ? M.template(templateId) : null;
    return U.toCSV(fieldsFor(kind, tpl).filter(f => !f.key.startsWith('m:') || KINDS[kind].metrics).slice(0, kind === 'events' ? 999 : 60).map(f => f.label), []) + '\r\n';
  }

  Lab.Importer = { KINDS, parse, analyse, commit, exportKind, templateHeaders };
})(window.Lab);
