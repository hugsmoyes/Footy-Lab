/* Club Lab: data model and local storage. Nothing is uploaded.
   Two modes share one match library:
   - Our team: team seasons, match reviews, findings and playlists in footylab.teamLab.v1
     (the same key Team Lab used, so its work carries over).
   - Opponent: fixtures, findings and playlists in dam.opponentLab.v3, the same records Opponent Lab used,
     so existing fixtures and briefs open here unchanged.
   - dam.opponentLab.v3 also holds the shared library: matches, players, stat definitions and values,
     templates, coded events, video links and clips.
   Video files are never stored: only links, local file names and timestamps.
   Missing values are absent (null), never zero. */
(function (Lab) {
  'use strict';
  const U = Lab.U;
  const KEY = 'dam.opponentLab.v3';
  const TKEY = 'footylab.teamLab.v1';
  const blankTL = () => ({ version: 1, app: 'Footy Lab Club Lab', mode: 'team', workspaces: [], workspaceId: '', oppId: '', reviews: [], findings: [], playlists: [] });

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

  let state = blank(), tl = blankTL(), persistOk = true;
  const listeners = [];

  function load() {
    try { const raw = localStorage.getItem(KEY); state = raw ? Object.assign(blank(), JSON.parse(raw)) : blank(); } catch (e) { persistOk = false; }
    try { const raw = localStorage.getItem(TKEY); const o = raw ? JSON.parse(raw) : null; tl = o && o.version === 1 ? Object.assign(blankTL(), o) : blankTL(); } catch (e) { persistOk = false; }
    if (!state.seeded) { state.metrics = Lab.Library.metrics(); state.templates = Lab.Library.templates(); state.seeded = true; save(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(TKEY, JSON.stringify(tl)); persistOk = true; } catch (e) { persistOk = false; }
  }
  function emit(reason) { save(); listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }
  const bytes = k => { try { return (localStorage.getItem(k === 'tl' ? TKEY : KEY) || '').length; } catch (e) { return 0; } };

  /* ---------- workspaces ----------
     kind 'team': a team season (our club). kind 'opp': a fixture against an upcoming opponent.
     Every workspace gets two read-only, unsaved properties: kind, and focus = the club being analysed. */
  function deco(w, kind) {
    if (w && !Object.prototype.hasOwnProperty.call(w, 'kind')) {
      Object.defineProperty(w, 'kind', { value: kind, enumerable: false });
      Object.defineProperty(w, 'focus', { get() { return kind === 'opp' ? this.opponent : this.team; }, enumerable: false });
    }
    return w;
  }
  const mode = () => tl.mode === 'opp' ? 'opp' : 'team';
  function workspaces(kind) { return kind === 'opp' ? (state.workspaces || []).map(w => deco(w, 'opp')) : tl.workspaces.map(w => deco(w, 'team')); }
  function findWs(id) { return workspaces('team').find(w => w.id === id) || workspaces('opp').find(w => w.id === id) || null; }
  function ws() { return mode() === 'opp' ? workspaces('opp').find(w => w.id === tl.oppId) || null : workspaces('team').find(w => w.id === tl.workspaceId) || null; }
  /* Switching mode reopens that mode's last workspace (for fixtures, Opponent Lab's last selected one). */
  function setMode(m) {
    tl.mode = m === 'opp' ? 'opp' : 'team';
    if (tl.mode === 'opp' && !(state.workspaces || []).some(w => w.id === tl.oppId)) { const l = state.workspaces || []; tl.oppId = l.some(w => w.id === state.workspaceId) ? state.workspaceId : (l[l.length - 1] || {}).id || ''; }
    if (tl.mode === 'team' && !tl.workspaces.some(w => w.id === tl.workspaceId)) tl.workspaceId = (tl.workspaces[tl.workspaces.length - 1] || {}).id || '';
    emit('ws');
  }
  function addWorkspace(f, kind) {
    if ((kind || mode()) === 'opp') {
      const w = Object.assign({ id: U.uid('ws'), createdAt: new Date().toISOString(), ourTeam: '', opponent: '', competition: 'AFL', season: '', round: '', venue: '', date: '', note: '', excluded: [], done: {}, report: { title: '', intro: '', items: [] } }, f);
      state.workspaces.push(w); tl.oppId = w.id; tl.mode = 'opp'; emit('ws'); return deco(w, 'opp');
    }
    const w = Object.assign({ id: U.uid('tw'), createdAt: new Date().toISOString(), team: '', competition: 'VFL', season: '', note: '', excluded: [], done: {}, report: { title: '', intro: '' } }, f);
    tl.workspaces.push(w); tl.workspaceId = w.id; tl.mode = 'team'; emit('ws'); return deco(w, 'team');
  }
  function updateWorkspace(id, patch) { const w = findWs(id); if (w) { Object.assign(w, patch); emit('ws'); } }
  function removeWorkspace(id) {
    const w = findWs(id); if (!w) return;
    if (w.kind === 'opp') {
      state.workspaces = state.workspaces.filter(x => x.id !== id);
      state.findings = state.findings.filter(x => x.workspaceId !== id);
      state.playlists = state.playlists.filter(x => x.workspaceId !== id);
      if (tl.oppId === id) tl.oppId = '';
      tl.reviews = tl.reviews.filter(x => x.workspaceId !== id);
      if (state.workspaceId === id) state.workspaceId = '';
    } else {
      tl.workspaces = tl.workspaces.filter(x => x.id !== id);
      tl.findings = tl.findings.filter(x => x.workspaceId !== id);
      tl.reviews = tl.reviews.filter(x => x.workspaceId !== id);
      tl.playlists = tl.playlists.filter(x => x.workspaceId !== id);
      if (tl.workspaceId === id) tl.workspaceId = '';
    }
    emit('ws');
  }
  function selectWorkspace(id) {
    const w = id ? findWs(id) : null;
    if (!w) { if (mode() === 'opp') tl.oppId = ''; else tl.workspaceId = ''; }
    else if (w.kind === 'opp') { tl.mode = 'opp'; tl.oppId = id; } else { tl.mode = 'team'; tl.workspaceId = id; }
    emit('ws');
  }

  /* Matches in scope: games the focus club played, minus any the analyst left out. */
  function involves(m, team) { return m.home === team || m.away === team; }
  function wsMatches(w) {
    w = w || ws();
    if (!w || !w.focus) return [];
    return sortMatches(state.matches.filter(m => involves(m, w.focus) && !(w.excluded || []).includes(m.id)));
  }
  /* Opponent mode: our own games (not against the opponent), for comparison. */
  function ourMatches(w) {
    w = w || ws();
    if (!w || w.kind !== 'opp' || !w.ourTeam) return [];
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
    tl.workspaces.forEach(w => s.add(w.team));
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
    state.playlists.concat(tl.playlists).forEach(p => { p.clipIds = p.clipIds.filter(x => !gone.has(x)); });
    const revs = new Set(tl.reviews.filter(r => r.matchId === id).map(r => r.id));
    tl.reviews = tl.reviews.filter(r => !revs.has(r.id));
    tl.findings.forEach(f => { if (revs.has(f.reviewId)) f.reviewId = ''; if (f.week === id) f.week = ''; f.matchIds = (f.matchIds || []).filter(x => x !== id); });
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
    state.findings.concat(tl.findings).forEach(f => { f.eventIds = (f.eventIds || []).filter(x => x !== id); });
    emit('events');
  }

  /* ---------- video ---------- */
  function setVideo(matchId, patch) { state.videos[matchId] = Object.assign({ url: '', fileName: '', offsets: {} }, state.videos[matchId] || {}, patch); emit('video'); }
  function addClip(c) { const x = Object.assign({ id: U.uid('clip'), createdAt: new Date().toISOString(), title: '', tags: [], playerIds: [], eventId: '', note: '' }, c); state.clips.push(x); emit('clips'); return x; }
  function updateClip(id, patch) { const c = state.clips.find(x => x.id === id); if (c) { Object.assign(c, patch); emit('clips'); } }
  function removeClip(id) {
    state.clips = state.clips.filter(c => c.id !== id);
    state.playlists.concat(tl.playlists).forEach(p => { p.clipIds = p.clipIds.filter(x => x !== id); });
    state.findings.concat(tl.findings).forEach(f => { f.clipIds = (f.clipIds || []).filter(x => x !== id); });
    emit('clips');
  }
  const pstore = () => mode() === 'opp' ? state.playlists : tl.playlists;
  const curId = () => (ws() || {}).id || '';
  function playlists(wid) { return pstore().filter(p => p.workspaceId === (wid || curId())); }
  function playlist(id) { return tl.playlists.concat(state.playlists).find(p => p.id === id) || null; }
  function addPlaylist(p) { const x = Object.assign({ id: U.uid('tpl'), workspaceId: curId(), name: 'Playlist', clipIds: [] }, p); pstore().push(x); emit('playlists'); return x; }
  function updatePlaylist(id, patch) { const p = playlist(id); if (p) { Object.assign(p, patch); emit('playlists'); } }
  function removePlaylist(id) { tl.playlists = tl.playlists.filter(p => p.id !== id); state.playlists = state.playlists.filter(p => p.id !== id); emit('playlists'); }

  /* ---------- match reviews (one per completed match in a team season) ---------- */
  /* Match reviews belong to a workspace: our team's season, or an opponent (analysing their games). */
  function reviews(w) { w = w || ws(); return w ? tl.reviews.filter(r => r.workspaceId === w.id) : []; }
  function review(id) { return tl.reviews.find(r => r.id === id) || null; }
  function reviewFor(matchId, w) { return reviews(w).find(r => r.matchId === matchId) || null; }
  function addReview(r) {
    const x = Object.assign({ id: U.uid('rv'), workspaceId: curId(), createdAt: new Date().toISOString(), matchId: '', quarters: null, focus: [], note: '', keyStats: null, done: {}, report: { title: '', intro: '' } }, r);
    tl.reviews.push(x); emit('reviews'); return x;
  }
  function updateReview(id, patch) { const r = review(id); if (r) { Object.assign(r, patch); emit('reviews'); } }
  function removeReview(id) { tl.reviews = tl.reviews.filter(r => r.id !== id); tl.findings = tl.findings.filter(f => f.reviewId !== id); emit('reviews'); }

  /* ---------- findings ----------
     Two horizons. Weekly: tied to one match week, either through its match review (reviewId) or
     as a note for that week (week = the match id). Season: neither, so a longer-term finding.
     Observation and evidence (what the data shows) are kept apart from interpretation (opinion),
     the review question (what to check or discuss) and the follow-up focus. */
  const FSTATUS = ['Draft', 'Ready for report'];
  const EVIDENCE = [
    ['', 'Not set', ''],
    ['data', 'Data only', 'Supported by the stats or coded events. Not yet checked on footage.'],
    ['video', 'Checked on video', 'The analyst has watched the linked clips or passages and they match the observation.'],
    ['more', 'Needs more evidence', 'Small sample, a part-coded match or mixed signals. Treat it as a question, not a finding.']
  ];
  const FOLLOW = ['Open', 'Discussed', 'Done'];
  /* Opponent mode keeps Opponent Lab's finding fields (coaching, confidence, statuses) so its briefs stay compatible. */
  const OSTATUS = ['Draft', 'Reviewed on video', 'Final'];
  const CONF = ['', 'Low', 'Medium', 'High'];
  /* Findings live with their workspace: our team season (tl.findings) or an opponent (state.findings).
     Both sets show together in Findings and Report: an opponent belongs to the team season with the
     same club, competition and season. */
  const isOppF = f => state.findings.includes(f);
  const storeOf = f => isOppF(f) ? state.findings : tl.findings;
  function findingsOf(w) { if (!w) return []; return (w.kind === 'opp' ? state.findings : tl.findings).filter(f => f.workspaceId === w.id); }
  function teamFor(w) {
    if (!w) return null; if (w.kind === 'team') return w;
    const n = x => String(x || '').toLowerCase();
    return workspaces('team').find(t => n(t.team) === n(w.ourTeam) && n(t.competition) === n(w.competition) && String(t.season) === String(w.season)) || null;
  }
  function oppsFor(t) {
    if (!t) return [];
    const n = x => String(x || '').toLowerCase();
    return workspaces('opp').filter(o => n(o.ourTeam) === n(t.team) && n(o.competition) === n(t.competition) && String(o.season) === String(t.season));
  }
  function wsFindings(reviewId, w) {
    w = w || ws(); if (!w) return [];
    if (w.kind === 'opp') { const r = reviewId && review(reviewId); return findingsOf(w).filter(f => !r || (f.matchIds || []).includes(r.matchId)); }
    return findingsOf(w).filter(f => reviewId === undefined || ((f.reviewId || '') === reviewId && (reviewId !== '' || !f.week)));
  }
  /* The match week a team finding belongs to: a match id, or '' for a season finding. */
  function weekOf(f) {
    if (isOppF(f)) return '';
    if (f.reviewId) { const r = review(f.reviewId); return r ? r.matchId : ''; }
    return f.week || '';
  }
  function weekFindings(matchId, w) { return wsFindings(undefined, w || teamFor(ws())).filter(f => weekOf(f) === matchId); }
  function finding(id) { return tl.findings.find(x => x.id === id) || state.findings.find(x => x.id === id) || null; }
  function addFinding(f) {
    const w = (f.workspaceId && findWs(f.workspaceId)) || ws();
    if (w && w.kind === 'opp') {
      const o = Object.assign({ id: U.uid('fd'), workspaceId: w.id, createdAt: new Date().toISOString(), title: '', observation: '', stat: '', n: null, matchIds: [], source: '', chart: null, eventIds: [], clipIds: [], interpretation: '', coaching: '', confidence: '', limitations: '', status: 'Draft', inReport: true }, f);
      delete o.reviewId; delete o.week; state.findings.push(o); emit('findings'); return o;
    }
    const x = Object.assign({
      id: U.uid('tf'), workspaceId: w ? w.id : tl.workspaceId, reviewId: '', createdAt: new Date().toISOString(),
      title: '', observation: '', stat: '', n: null, matchIds: [], source: '', chart: null, hideChart: false,
      eventIds: [], clipIds: [], interpretation: '', question: '', followUp: '', followOwner: '', followWhen: '', followStatus: 'Open',
      evidenceStatus: '', focus: '', limitations: '', status: 'Draft', inReport: true, week: ''
    }, f);
    if (x.reviewId) x.week = '';
    tl.findings.push(x); emit('findings'); return x;
  }
  function updateFinding(id, patch) { const f = finding(id); if (f) { Object.assign(f, patch); emit('findings'); } }
  function removeFinding(id) { tl.findings = tl.findings.filter(f => f.id !== id); state.findings = state.findings.filter(f => f.id !== id); emit('findings'); }
  function moveFinding(id, dir) {
    const f0 = finding(id); if (!f0) return;
    const arr = storeOf(f0), list = arr.filter(f => f.workspaceId === f0.workspaceId && (isOppF(f0) || weekOf(f) === weekOf(f0))), i = list.indexOf(f0), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = arr.indexOf(list[i]), b = arr.indexOf(list[j]);
    [arr[a], arr[b]] = [arr[b], arr[a]];
    emit('findings');
  }

  /* ---------- backup ----------
     A Club Lab backup holds the our-team records and the shared library (which includes opponent fixtures and briefs).
     An Opponent Lab backup file can also be restored: it replaces the library only. */
  function exportAll(withLibrary) {
    const o = { app: 'Footy Lab Club Lab', kind: 'team-lab-backup', version: 1, exportedAt: new Date().toISOString(), teamLab: tl };
    if (withLibrary !== false) o.library = state;
    return JSON.stringify(o, null, 2);
  }
  function readBackup(text) {
    const o = JSON.parse(text);
    if (o && o.version === 3 && Array.isArray(o.events)) return { kind: 'team-lab-backup', teamLab: null, library: o, oppOnly: true };
    if (!o || o.kind !== 'team-lab-backup' || !o.teamLab || o.teamLab.version !== 1) throw new Error('Not a Club Lab, Team Lab or Opponent Lab backup file.');
    return o;
  }
  function restore(o, withLibrary) {
    if (o.teamLab) tl = Object.assign(blankTL(), o.teamLab);
    if (withLibrary && o.library && o.library.version === 3) state = Object.assign(blank(), o.library);
    emit('all');
  }
  /* Clears the our-team records only (team seasons, reviews, findings, playlists). The library and opponent fixtures stay. */
  function reset() { tl = blankTL(); emit('all'); }
  function libraryInfo() { return { fixtures: (state.workspaces || []).length, matches: state.matches.length, events: state.events.length, clips: state.clips.length, players: state.players.length }; }

  Lab.Model = {
    KEY, TKEY, FSTATUS, EVIDENCE, FOLLOW, OSTATUS, CONF, mode, setMode, workspaces, findWs,
    load, save, on, emit, bytes, get state() { return state; }, get tl() { return tl; }, get persistOk() { return persistOk; }, libraryInfo,
    ws, addWorkspace, updateWorkspace, removeWorkspace, selectWorkspace, wsMatches, ourMatches, involves, sortMatches, roundOrder,
    teams, roster, addPlayer, updatePlayer, removePlayer, player, playerName, findPlayer,
    match, addMatch, updateMatch, removeMatch, matchUsage, opponentIn, matchLabel, parseScore, result, quarterSecs,
    metric, saveMetric, removeMetric, setTeamStat, setPlayerStat, teamValue, playerValue, hasTeamStats, tsKey, psKey,
    template, saveTemplate, removeTemplate, restoreStarters, event, addEvent, updateEvent, removeEvent,
    setVideo, addClip, updateClip, removeClip, playlists, playlist, addPlaylist, updatePlaylist, removePlaylist,
    reviews, review, reviewFor, addReview, updateReview, removeReview,
    wsFindings, weekOf, weekFindings, findingsOf, teamFor, oppsFor, isOppFinding: isOppF, finding, addFinding, updateFinding, removeFinding, moveFinding,
    exportAll, readBackup, restore, reset
  };
})(window.Lab);
