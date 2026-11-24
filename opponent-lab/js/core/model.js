/* Opponent Lab: data model and local storage.
   Everything is kept in this browser's localStorage under one key. Nothing is uploaded.
   Video files are never stored: only links, local file names and timestamps.
   Missing values are absent (null), never zero. */
(function (Lab) {
  'use strict';
  const U = Lab.U;
  const KEY = 'dam.opponentLab.v3';

  const blank = () => ({
    version: 3, seeded: false,
    settings: { quarterMins: 20, clockMode: 'countdown' },
    workspaces: [], workspaceId: '',
    players: [],      // {id, team, name, number, position, note}
    matches: [],      // {id, season, round, competition, date, venue, home, away, homeScore, awayScore, quarterMins, note, lineups:{team:[playerId]}}
    metrics: [],      // stat definitions
    teamStats: {},    // `${matchId}|${team}|${period}|${metricId}` -> number
    playerStats: {},  // `${matchId}|${playerId}|${metricId}` -> number
    templates: [],    // coding templates
    events: [],       // {id, matchId, templateId, team, period, clock, v:{}, tags:[], notes, video, source, createdAt}
    videos: {},       // matchId -> {url, fileName, offsets:{1..4:sec}}
    clips: [],        // {id, matchId, start, end, title, tags[], playerIds[], eventId, note}
    playlists: [],    // {id, workspaceId, name, clipIds[]}
    findings: [],     // see addFinding
    seasons: []       // season averages by competition and year: see season.js
  });

  let state = blank(), persistOk = true;
  const listeners = [];

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(blank(), JSON.parse(raw)); } catch (e) { persistOk = false; }
    if (!state.seeded) { state.metrics = Lab.Library.metrics(); state.templates = Lab.Library.templates(); state.seeded = true; save(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); persistOk = true; } catch (e) { persistOk = false; }
  }
  function emit(reason) { save(); listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }
  const bytes = () => { try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; } };

  /* ---------- workspaces (one per fixture) ---------- */
  function ws() { return state.workspaces.find(w => w.id === state.workspaceId) || null; }
  function addWorkspace(f) {
    const w = Object.assign({ id: U.uid('ws'), createdAt: new Date().toISOString(), ourTeam: '', opponent: '', competition: 'AFL', season: '', round: '', venue: '', date: '', note: '', excluded: [], done: {}, report: { title: '', intro: '', items: [] } }, f);
    state.workspaces.push(w); state.workspaceId = w.id; emit('ws'); return w;
  }
  function updateWorkspace(id, patch) { const w = state.workspaces.find(x => x.id === id); if (w) { Object.assign(w, patch); emit('ws'); } }
  function removeWorkspace(id) {
    state.workspaces = state.workspaces.filter(w => w.id !== id);
    state.findings = state.findings.filter(x => x.workspaceId !== id);
    state.playlists = state.playlists.filter(x => x.workspaceId !== id);
    if (state.workspaceId === id) state.workspaceId = '';
    emit('ws');
  }
  function selectWorkspace(id) { state.workspaceId = id; emit('ws'); }

  /* Matches in scope for the workspace: games the opponent played, minus any the analyst excluded. */
  function involves(m, team) { return m.home === team || m.away === team; }
  function wsMatches(w) {
    w = w || ws();
    if (!w) return [];
    return sortMatches(state.matches.filter(m => involves(m, w.opponent) && !(w.excluded || []).includes(m.id)));
  }
  function ourMatches(w) {
    w = w || ws();
    if (!w || !w.ourTeam) return [];
    return sortMatches(state.matches.filter(m => involves(m, w.ourTeam) && !involves(m, w.opponent)));
  }
  function roundOrder(r) {
    const s = String(r || '').trim().toUpperCase();
    const n = s.match(/^(?:R|RD|ROUND)?\s*(\d+)$/);
    if (n) return parseInt(n[1], 10);
    const finals = { WC: 90, EF: 91, QF: 92, SF: 93, PF: 94, GF: 95 };
    return finals[s] != null ? finals[s] : (/^OR|OPENING/.test(s) ? 0 : 80);
  }
  function sortMatches(list) {
    return list.slice().sort((a, b) => String(a.season).localeCompare(String(b.season)) || roundOrder(a.round) - roundOrder(b.round) || String(a.date).localeCompare(String(b.date)));
  }

  /* ---------- teams and players ---------- */
  function teams() {
    const s = new Set();
    state.matches.forEach(m => { s.add(m.home); s.add(m.away); });
    state.players.forEach(p => s.add(p.team));
    state.workspaces.forEach(w => { s.add(w.ourTeam); s.add(w.opponent); });
    s.delete(''); s.delete(undefined);
    return [...s].sort();
  }
  function roster(team) { return state.players.filter(p => p.team === team).sort((a, b) => (+a.number || 999) - (+b.number || 999) || a.name.localeCompare(b.name)); }
  function addPlayer(p, silent) {
    const pl = Object.assign({ id: U.uid('pl'), team: '', name: '', number: '', position: '', note: '' }, p);
    state.players.push(pl); if (!silent) emit('players'); return pl;
  }
  function updatePlayer(id, patch) { const p = state.players.find(x => x.id === id); if (p) { Object.assign(p, patch); emit('players'); } }
  function removePlayer(id) {
    state.players = state.players.filter(p => p.id !== id);
    Object.keys(state.playerStats).forEach(k => { if (k.split('|')[1] === id) delete state.playerStats[k]; });
    state.matches.forEach(m => Object.keys(m.lineups || {}).forEach(t => { m.lineups[t] = m.lineups[t].filter(x => x !== id); }));
    emit('players');
  }
  function player(id) { return state.players.find(p => p.id === id) || null; }
  function playerName(idOrName) { const p = player(idOrName); return p ? p.name : (idOrName || ''); }
  /* Resolve typed text ("12", "#12", "Smith", "J. Smith") to a player on a team; returns id or null. */
  function findPlayer(team, text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const list = team ? roster(team) : state.players;
    const num = t.replace(/^#/, '');
    if (/^\d+$/.test(num)) { const p = list.find(x => String(x.number) === num); if (p) return p.id; }
    const n = U.norm(t);
    let p = list.find(x => U.norm(x.name) === n) || list.find(x => U.norm(x.name).endsWith(n) && n.length > 2) || list.find(x => U.norm(`${x.number}${x.name}`) === n);
    return p ? p.id : null;
  }

  /* ---------- matches ---------- */
  function match(id) { return state.matches.find(m => m.id === id) || null; }
  function addMatch(m, silent) {
    const x = Object.assign({ id: U.uid('m'), season: '', round: '', competition: '', date: '', venue: '', home: '', away: '', homeScore: '', awayScore: '', quarterMins: '', note: '', lineups: {} }, m);
    state.matches.push(x); if (!silent) emit('matches'); return x;
  }
  function updateMatch(id, patch) { const m = match(id); if (m) { Object.assign(m, patch); emit('matches'); } }
  function matchUsage(id) {
    return {
      events: state.events.filter(e => e.matchId === id).length,
      teamStats: Object.keys(state.teamStats).filter(k => k.startsWith(id + '|')).length,
      playerStats: Object.keys(state.playerStats).filter(k => k.startsWith(id + '|')).length,
      clips: state.clips.filter(c => c.matchId === id).length
    };
  }
  function removeMatch(id) {
    state.matches = state.matches.filter(m => m.id !== id);
    state.events = state.events.filter(e => e.matchId !== id);
    Object.keys(state.teamStats).forEach(k => { if (k.startsWith(id + '|')) delete state.teamStats[k]; });
    Object.keys(state.playerStats).forEach(k => { if (k.startsWith(id + '|')) delete state.playerStats[k]; });
    const gone = new Set(state.clips.filter(c => c.matchId === id).map(c => c.id));
    state.clips = state.clips.filter(c => !gone.has(c.id));
    state.playlists.forEach(p => { p.clipIds = p.clipIds.filter(x => !gone.has(x)); });
    delete state.videos[id];
    emit('matches');
  }
  function opponentIn(m, team) { return m.home === team ? m.away : m.away === team ? m.home : ''; }
  /* "R3 v Geelong" from a team's point of view; full label otherwise. */
  function matchLabel(m, team) {
    if (!m) return '';
    const yr = m.season ? ` ${m.season}` : '';
    if (team && involves(m, team)) return `${m.round || '?'}${yr} v ${opponentIn(m, team)}`;
    return `${m.round || '?'}${yr} ${m.home} v ${m.away}`;
  }
  /* Parse "12.10 (82)", "12.10.82" or "82". */
  function parseScore(s) {
    const t = String(s || '').trim();
    if (!t) return null;
    let x = t.match(/^(\d+)\.(\d+)(?:[.\s(]+(\d+)\)?)?$/);
    if (x) return { g: +x[1], b: +x[2], pts: +x[1] * 6 + +x[2] };
    x = t.match(/^(\d+)$/);
    return x ? { g: null, b: null, pts: +x[1] } : null;
  }
  function result(m, team) {
    const a = parseScore(m.home === team ? m.homeScore : m.awayScore), b = parseScore(m.home === team ? m.awayScore : m.homeScore);
    if (!a || !b) return null;
    return { for: a.pts, against: b.pts, margin: a.pts - b.pts, res: a.pts > b.pts ? 'Win' : a.pts < b.pts ? 'Loss' : 'Draw' };
  }
  function quarterSecs(m) { return ((m && +m.quarterMins) || +state.settings.quarterMins || 20) * 60; }

  /* ---------- metrics and stats ---------- */
  function metric(id) { return state.metrics.find(x => x.id === id) || null; }
  function saveMetric(mt) {
    const i = state.metrics.findIndex(x => x.id === mt.id);
    if (i >= 0) state.metrics[i] = mt; else state.metrics.push(Object.assign({ id: U.uid('met') }, mt));
    emit('metrics');
  }
  function removeMetric(id) {
    state.metrics = state.metrics.filter(x => x.id !== id);
    [state.teamStats, state.playerStats].forEach(o => Object.keys(o).forEach(k => { if (k.endsWith('|' + id)) delete o[k]; }));
    emit('metrics');
  }
  const tsKey = (matchId, team, period, metricId) => `${matchId}|${team}|${period || 'Full'}|${metricId}`;
  const psKey = (matchId, playerId, metricId) => `${matchId}|${playerId}|${metricId}`;
  function setTeamStat(matchId, team, period, metricId, val, silent) {
    const k = tsKey(matchId, team, period, metricId);
    if (val === '' || val == null || isNaN(val)) delete state.teamStats[k]; else state.teamStats[k] = +val;
    if (!silent) emit('stats');
  }
  function setPlayerStat(matchId, playerId, metricId, val, silent) {
    const k = psKey(matchId, playerId, metricId);
    if (val === '' || val == null || isNaN(val)) delete state.playerStats[k]; else state.playerStats[k] = +val;
    if (!silent) emit('stats');
  }
  /* Value of a metric for one scope. Returns a number, {num, den} for ratios, or null if anything needed is missing.
     getRaw(metricId) -> number|undefined */
  function evalMetric(mt, getRaw, depth) {
    if (!mt || (depth || 0) > 6) return null;
    if (mt.kind === 'sum') {
      let tot = 0;
      for (const p of mt.parts || []) { const v = evalMetric(metric(p.id), getRaw, (depth || 0) + 1); if (v == null || typeof v === 'object') return null; tot += v * (p.w == null ? 1 : +p.w); }
      return tot;
    }
    if (mt.kind === 'ratio') {
      const n = evalMetric(metric(mt.num), getRaw, (depth || 0) + 1), d = evalMetric(metric(mt.den), getRaw, (depth || 0) + 1);
      if (n == null || d == null || typeof n === 'object' || typeof d === 'object') return null;
      return { num: n, den: d };
    }
    const v = getRaw(mt.id);
    return v == null ? null : v;
  }
  function teamValue(matchId, team, period, metricId) {
    return evalMetric(metric(metricId), id => state.teamStats[tsKey(matchId, team, period, id)]);
  }
  function playerValue(matchId, playerId, metricId) {
    return evalMetric(metric(metricId), id => state.playerStats[psKey(matchId, playerId, id)]);
  }
  function hasTeamStats(matchId, team) { return Object.keys(state.teamStats).some(k => k.startsWith(`${matchId}|${team}|`)); }

  /* ---------- templates and events ---------- */
  function template(id) { return state.templates.find(t => t.id === id) || null; }
  function saveTemplate(t) {
    const i = state.templates.findIndex(x => x.id === t.id);
    if (i >= 0) state.templates[i] = t; else state.templates.push(t);
    emit('templates');
  }
  function removeTemplate(id) { if (state.events.some(e => e.templateId === id)) return false; state.templates = state.templates.filter(t => t.id !== id); emit('templates'); return true; }
  function restoreStarters() {
    const have = new Set(state.templates.map(t => t.id));
    Lab.Library.templates().forEach(t => { if (!have.has(t.id)) state.templates.push(t); });
    const hm = new Set(state.metrics.map(x => x.id));
    Lab.Library.metrics().forEach(x => { if (!hm.has(x.id)) state.metrics.push(x); });
    emit('templates');
  }
  function event(id) { return state.events.find(e => e.id === id) || null; }
  function addEvent(e, silent) {
    const x = Object.assign({ id: U.uid('ev'), matchId: '', templateId: '', team: '', period: 1, clock: '', v: {}, tags: [], notes: '', video: null, source: 'coded', createdAt: new Date().toISOString() }, e);
    state.events.push(x); if (!silent) emit('events'); return x;
  }
  function updateEvent(id, patch) { const e = event(id); if (e) { Object.assign(e, patch, { editedAt: new Date().toISOString() }); emit('events'); } }
  function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    state.clips.forEach(c => { if (c.eventId === id) c.eventId = ''; });
    state.findings.forEach(f => { f.eventIds = (f.eventIds || []).filter(x => x !== id); });
    emit('events');
  }

  /* ---------- video ---------- */
  function setVideo(matchId, patch) { state.videos[matchId] = Object.assign({ url: '', fileName: '', offsets: {} }, state.videos[matchId] || {}, patch); emit('video'); }
  function addClip(c) { const x = Object.assign({ id: U.uid('clip'), createdAt: new Date().toISOString(), title: '', tags: [], playerIds: [], eventId: '', note: '' }, c); state.clips.push(x); emit('clips'); return x; }
  function updateClip(id, patch) { const c = state.clips.find(x => x.id === id); if (c) { Object.assign(c, patch); emit('clips'); } }
  function removeClip(id) {
    state.clips = state.clips.filter(c => c.id !== id);
    state.playlists.forEach(p => { p.clipIds = p.clipIds.filter(x => x !== id); });
    state.findings.forEach(f => { f.clipIds = (f.clipIds || []).filter(x => x !== id); });
    emit('clips');
  }
  function addPlaylist(p) { const x = Object.assign({ id: U.uid('pl'), workspaceId: state.workspaceId, name: 'Playlist', clipIds: [] }, p); state.playlists.push(x); emit('playlists'); return x; }
  function updatePlaylist(id, patch) { const p = state.playlists.find(x => x.id === id); if (p) { Object.assign(p, patch); emit('playlists'); } }
  function removePlaylist(id) { state.playlists = state.playlists.filter(p => p.id !== id); emit('playlists'); }

  /* ---------- findings ---------- */
  function wsFindings() { return state.findings.filter(f => f.workspaceId === state.workspaceId); }
  function addFinding(f) {
    const x = Object.assign({
      id: U.uid('fd'), workspaceId: state.workspaceId, createdAt: new Date().toISOString(),
      title: '', observation: '', stat: '', n: null, matchIds: [], source: '', chart: null,
      eventIds: [], clipIds: [], interpretation: '', coaching: '', confidence: '', limitations: '', status: 'Draft', inReport: true
    }, f);
    state.findings.push(x); emit('findings'); return x;
  }
  function updateFinding(id, patch) { const f = state.findings.find(x => x.id === id); if (f) { Object.assign(f, patch); emit('findings'); } }
  function removeFinding(id) { state.findings = state.findings.filter(f => f.id !== id); emit('findings'); }
  function moveFinding(id, dir) {
    const list = wsFindings(), i = list.findIndex(f => f.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = state.findings.indexOf(list[i]), b = state.findings.indexOf(list[j]);
    [state.findings[a], state.findings[b]] = [state.findings[b], state.findings[a]];
    emit('findings');
  }

  function exportAll() { return JSON.stringify(Object.assign({ app: 'DAM Opponent Lab', exportedAt: new Date().toISOString() }, state), null, 2); }
  function importAll(text) {
    const o = JSON.parse(text);
    if (!o || o.version !== 3 || !Array.isArray(o.events)) throw new Error('Not an Opponent Lab (v3) backup file');
    state = Object.assign(blank(), o); emit('all');
  }
  function reset() { state = blank(); load(); emit('all'); }

  Lab.Model = {
    load, save, on, emit, bytes, get state() { return state; }, get persistOk() { return persistOk; },
    ws, addWorkspace, updateWorkspace, removeWorkspace, selectWorkspace, wsMatches, ourMatches, involves, sortMatches, roundOrder,
    teams, roster, addPlayer, updatePlayer, removePlayer, player, playerName, findPlayer,
    match, addMatch, updateMatch, removeMatch, matchUsage, opponentIn, matchLabel, parseScore, result, quarterSecs,
    metric, saveMetric, removeMetric, setTeamStat, setPlayerStat, teamValue, playerValue, hasTeamStats, tsKey, psKey,
    template, saveTemplate, removeTemplate, restoreStarters, event, addEvent, updateEvent, removeEvent,
    setVideo, addClip, updateClip, removeClip, addPlaylist, updatePlaylist, removePlaylist,
    wsFindings, addFinding, updateFinding, removeFinding, moveFinding,
    exportAll, importAll, reset
  };
})(window.Lab);
