/* Findings and report (Club Lab, our team): evidence-backed findings, then a weekly report or season report for coaches
   (print/PDF, Markdown, presentation). Season stat helpers add season-level findings. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;

  /* Charts for stat and player findings */
  Lab.statChart = function (ws, spec) {
    const x = M.metric(spec.metricId); if (!x) return '';
    const ser = A.teamSeries(x.id, ws.focus, M.wsMatches(ws), spec.period || 'Full');
    return C.line(ser.map(s => s.m.round), [
      { name: ws.focus, color: C.COL.opp, values: ser.map(s => A.asNumber(s.for)), tips: ser.map(s => A.fmt(x, s.for)) },
      { name: 'Opponents', color: C.COL.their, values: ser.map(s => A.asNumber(s.against)), tips: ser.map(s => A.fmt(x, s.against)) }],
      { fmt: v => x.kind === 'ratio' ? U.pct(v) : U.round(v, 1), aria: x.name, emptyMsg: 'No values entered.' });
  };
  function playerChart(spec) {
    const p = M.player(spec.playerId), x = M.metric(spec.metricId); if (!p || !x) return '';
    const ms = M.sortMatches(M.state.matches.filter(m => M.involves(m, p.team)));
    const vals = ms.map(m => M.playerValue(m.id, p.id, x.id));
    return C.line(ms.map(m => m.round), [{ name: p.name, color: C.COL.opp, values: vals.map(A.asNumber), tips: vals.map(v => A.fmt(x, v)) }], { fmt: v => U.round(v, 1), aria: p.name + ' ' + x.name });
  }
  function packChart(c) {
    const X = Lab.Pack; if (!X || !X.ok) return '';
    if (c.kind === 'packTeam') {
      const G = Lab.teamFilter(X.teamGames(c.team), c.flt || 'all');
      const fv = G.map(g => X.gameValue(g, 'for', c.key)), av = G.map(g => X.gameValue(g, 'against', c.key));
      return C.line(G.map(g => g.rd), [{ name: c.team, color: C.COL.opp, values: fv, tips: G.map((g, i) => `${U.round(fv[i], 1)} v ${g.opp}`) }, { name: 'Opposition', color: C.COL.their, values: av, tips: G.map((g, i) => `${g.opp} ${U.round(av[i], 1)}`) }], { aria: c.key });
    }
    if (c.kind === 'packPlayer') {
      const p = X.player(c.key), G = X.games(p), v = G.map(g => g.v[c.stat]);
      return C.line(G.map(g => g.tg.rd), [{ name: p.name, color: C.COL.opp, values: v, tips: G.map((g, i) => `${v[i] == null ? '–' : U.round(v[i], 1)} v ${g.tg.opp}`) }], { aria: p.name + ' ' + c.stat });
    }
    return '';
  }
  function chartFor(f) {
    if (!f.chart || f.hideChart) return '';
    if (f.chart.kind === 'packTeam' || f.chart.kind === 'packPlayer') return packChart(f.chart);
    if (f.chart.kind === 'player') return playerChart(f.chart);
    if (/^m[A-Z]/.test(f.chart.kind)) return Lab.MD.chart(f.chart, M.findWs(f.workspaceId));
    return Lab.renderSpec(f.chart);
  }

  function autoLimits(f) {
    const ws = M.ws(), out = [];
    const total = M.wsMatches(ws).length;
    if (f.n != null && f.n < U.SMALL_N) out.push(`Small sample (n=${f.n}).`);
    if (f.matchIds && f.matchIds.length && total && f.matchIds.length < total) out.push(`Covers ${f.matchIds.length} of ${total} included matches.`);
    if (f.chart && f.chart.kind && !['stat', 'player', 'packTeam', 'packPlayer'].includes(f.chart.kind) && !/^m[A-Z]/.test(f.chart.kind)) out.push('Hand-coded events; definitions on the Code tab.');
    return out.join(' ');
  }

  /* ---------- season data into the report ---------- */
  const seasonSrc = () => { const X = Lab.Pack; return `${X.raw.competition} ${X.raw.season} season data`; };
  function addStat(partial) { Lab.newFinding(Object.assign({ inReport: true, reviewId: '' }, partial)); }
  Lab.reportSeasonStat = function (team, id, side) {
    const S = Lab.Season, sea = Lab.currentSeason(), c = S.byId.get(id), v = S.value(sea, team, side, id), r = S.rank(sea, team, side, id), lg = S.leagueValue(sea, side, id), t = sea.teams[team];
    const verb = side === 'against' ? 'concede' : 'average';
    addStat({ title: `${team}: ${c.name}${side === 'against' ? ' conceded' : ''}`, stat: `${team} ${verb} ${S.fmt(id, v)} ${c.name.toLowerCase()} per game (league ${S.fmt(id, lg)})${r ? `, ${Lab.ord(r.rank)} of ${r.of}` : ''}. ${sea.season} season, ${t.games} games.`, n: t.games, source: seasonSrc(), limitations: 'Season average: does not show recent form or opponent strength.' });
  };
  Lab.reportMatchStat = function (team, key, flt) {
    const X = Lab.Pack, G = Lab.teamFilter(X.teamGames(team), flt || 'all'), all = X.teamGames(team);
    const mean = (arr, side) => { const v = arr.map(g => X.gameValue(g, side, key)).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const name = (X.TREND.find(x => x[0] === key) || [key, key])[1].replace(' (summed from players)', '');
    const fl = (Lab.TEAM_FILTERS.find(x => x[0] === (flt || 'all')) || [])[1] || 'All';
    const r = v => v == null ? '–' : U.round(v, 1).toFixed(1);
    addStat({ title: `${team}: ${name}${flt && flt !== 'all' ? ' (' + fl.toLowerCase() + ')' : ''}`, stat: `${team} ${r(mean(G, 'for'))} ${name.toLowerCase()} per game, opposition ${r(mean(G, 'against'))}${flt && flt !== 'all' ? ` (${fl.toLowerCase()}, ${G.length} games; season ${r(mean(all, 'for'))})` : ` (${G.length} games)`}. Record in these games ${Lab.wld(G)}.`, n: G.length, source: seasonSrc(), chart: { kind: 'packTeam', team, key, flt: flt || 'all' } });
  };
  Lab.reportPlayerStat = function (key, stat) {
    const X = Lab.Pack, p = X.player(key), d = X.PSTAT[stat], r = X.playerRank(key, stat);
    const per = /_Total$/.test(stat) || stat === 'Matches' || stat === 'WAR' ? '' : ' per game';
    addStat({ title: `${p.name} (${p.team}): ${stat === 'WAR' ? d.name : d.name.toLowerCase()}`, stat: `${p.name} ${X.fmtP(stat, p.s[stat])} ${stat === 'WAR' ? d.name : d.name.toLowerCase()}${per}${r ? `, ${Lab.ord(r.rank)} of ${r.of} players with ${X.MIN_GAMES}+ games` : ''}. ${X.raw.season} season, ${p.games} games.`, n: p.games, source: seasonSrc() });
  };
  Lab.reportPlayerGames = function (key, stat) {
    const X = Lab.Pack, p = X.player(key), G = X.games(p), v = G.map(g => g.v[stat]).filter(x => x != null), nm = Lab.gameStatName(stat).toLowerCase();
    const last5 = G.slice(-5).map(g => g.v[stat]).filter(x => x != null), m = a => a.length ? U.round(a.reduce((x, y) => x + y, 0) / a.length, 1).toFixed(1) : '–';
    addStat({ title: `${p.name} (${p.team}): ${nm} by game`, stat: `${p.name}: ${m(v)} ${nm} per game across ${v.length} games, ${m(last5)} in his last ${last5.length}. Range ${v.length ? Math.min(...v) : '–'} to ${v.length ? Math.max(...v) : '–'}.`, n: v.length, source: seasonSrc(), chart: { kind: 'packPlayer', key, stat } });
  };

  Lab.chartFor = chartFor;
  const EVL = id => (M.EVIDENCE.find(x => x[0] === id) || M.EVIDENCE[0]);
  const evBadge = id => id ? `<span class="evs evs-${id}" data-tip="${U.esc(EVL(id)[2])}">${U.esc(EVL(id)[1])}</span>` : '';

  /* Create a finding and open it. partial: {title, stat, n, matchIds, source, chart, eventIds, clipIds, reviewId} */
  Lab.newFinding = function (partial) {
    partial = Object.assign({ observation: '', limitations: '' }, partial);
    const w = (partial.workspaceId && M.findWs(partial.workspaceId)) || M.ws();
    if (w && w.kind === 'team' && partial.reviewId == null) {
      const ids = partial.matchIds || [], rv = ids.length === 1 ? M.reviewFor(ids[0], w) : null;
      partial.reviewId = rv ? rv.id : '';
      if (!rv && partial.week == null && ids.length === 1 && M.wsMatches(w).some(m => m.id === ids[0])) partial.week = ids[0];
    }
    const f = M.addFinding(partial);
    if (!f.limitations) M.updateFinding(f.id, { limitations: autoLimits(f) });
    Lab.openFinding(f.id);
    U.toast(M.isOppFinding(f) ? `${w.opponent} finding added` : f.reviewId ? 'Finding added to this match review' : f.week ? 'Weekly finding added' : 'Season finding added');
  };

  /* One line describing a coded event: when, what, the coded values and notes. */
  const evLines = f => (f.eventIds || []).map(id => M.event(id)).filter(Boolean).sort((a, b) => a.period - b.period || ((U.parseClock(a.clock) || 0) - (U.parseClock(b.clock) || 0)) * (M.state.settings.clockMode === 'elapsed' ? 1 : -1)).map(e => Lab.eventLine(e));
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const EVCAP = 6;
  const evHTML = f => { const l = evLines(f); return l.length ? `<p class="small"><b>Coded events:</b></p><ul class="small ev-list">${l.slice(0, EVCAP).map(x => `<li>${U.esc(x)}</li>`).join('')}${l.length > EVCAP ? `<li class="muted">and ${l.length - EVCAP} more</li>` : ''}</ul>` : ''; };
  const evMD = (f, L) => { const l = evLines(f); if (l.length) { L.push('Coded events:'); l.slice(0, EVCAP).forEach(x => L.push(`- ${x}`)); if (l.length > EVCAP) L.push(`- and ${l.length - EVCAP} more`); } };
  Lab.eventLine = function (e, withNotes) {
    const tpl = M.template(e.templateId) || { name: 'Event', fields: [] };
    const vals = tpl.fields.filter(f => f.type !== 'text' && e.v[f.key] != null && e.v[f.key] !== '').map(f => `${f.label.toLowerCase()} ${f.type === 'player' ? M.playerName(e.v[f.key]) : String(e.v[f.key])}`);
    return `Q${e.period} ${e.clock} · ${tpl.name} · ${e.team}${vals.length ? ': ' + vals.join(', ') : ''}${withNotes !== false && e.notes ? `. ${e.notes}` : ''}`;
  };

  /* Add coded events or clips to a finding: a new one, or one that already exists.
     what: {eventIds, clipIds, matchId, title, stat, source, n, limitations, label} */
  Lab.addToFinding = function (what) {
    const ws = M.ws(); if (!ws) return;
    const evIds = what.eventIds || [], clIds = (what.clipIds || []).concat(M.state.clips.filter(c => evIds.includes(c.eventId)).map(c => c.id)).filter((x, i, a) => a.indexOf(x) === i);
    const mid = what.matchId, opp = Lab.isOpp(), { T, O } = ctx();
    const all = (T ? M.wsFindings(undefined, T) : []).concat(...O.map(o => M.findingsOf(o)));
    /* Findings first from where you are: this week (our team) or this opponent. */
    const week = opp ? M.findingsOf(ws) : mid && T ? M.weekFindings(mid, T) : [], rest = all.filter(f => !week.includes(f));
    const has = f => evIds.every(x => (f.eventIds || []).includes(x)) && clIds.every(x => (f.clipIds || []).includes(x));
    const where = f => M.isOppFinding(f) ? 'Opponent: ' + ((M.findWs(f.workspaceId) || {}).opponent || '') : M.weekOf(f) ? (M.weekOf(f) === mid ? 'This week' : 'Week: ' + M.matchLabel(M.match(M.weekOf(f)), T ? T.focus : ws.focus)) : 'Season';
    const row = f => `<div class="pick-f"><div><b>${U.esc(f.title)}</b><span class="sub">${U.esc(where(f))} · ${pl((f.eventIds || []).length, 'event')} · ${pl((f.clipIds || []).length, 'clip')}</span></div>${has(f) ? '<span class="tag">Linked</span>' : `<button class="btn sm g" data-addto="${f.id}">Add</button>`}</div>`;
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Add to a finding</span><h2>${U.esc(what.label || what.title)}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b">
        <p class="sub">${evIds.length ? `${evIds.length} coded event${evIds.length === 1 ? '' : 's'}` : ''}${evIds.length && clIds.length ? ' and ' : ''}${clIds.length ? `${clIds.length} clip${clIds.length === 1 ? '' : 's'}` : ''} will be linked. Linked events and clips show under the finding in the report.</p>
        <div class="ctl" style="margin:10px 0 16px"><button class="btn g" id="atNew">+ New finding</button></div>
        ${opp || mid ? `<h3>${opp ? `${U.esc(ws.opponent)} findings` : 'Findings this week'} (${week.length})</h3>${week.length ? week.map(row).join('') : '<p class="muted">None yet.</p>'}` : ''}
        ${rest.length ? `<h3 style="margin-top:14px">${opp || mid ? 'Other findings' : 'Findings'} (${rest.length})</h3>${rest.map(row).join('')}` : ''}
      </div>`, d => {
      U.$('#atNew', d).onclick = () => { Lab.closeDrawer(); Lab.newFinding({ title: what.title, stat: what.stat || '', n: what.n || evIds.length || clIds.length, matchIds: mid ? [mid] : [], eventIds: evIds, clipIds: clIds, source: what.source || '', limitations: what.limitations || '' }); };
      U.$$('[data-addto]', d).forEach(b => b.onclick = () => {
        const f = M.finding(b.dataset.addto), u = (a, x) => (a || []).concat(x.filter(y => !(a || []).includes(y)));
        M.updateFinding(f.id, { eventIds: u(f.eventIds, evIds), clipIds: u(f.clipIds, clIds), matchIds: mid ? u(f.matchIds, [mid]) : f.matchIds });
        Lab.closeDrawer(); U.toast(`Added to “${f.title}”`);
      });
    });
  };

  /* Shortcuts for the + Finding buttons on events and clips. */
  Lab.eventToFinding = function (id) {
    const e = M.event(id); if (!e) return; const m = M.match(e.matchId), tpl = M.template(e.templateId) || { name: 'Event' }, ws = M.ws();
    Lab.addToFinding({ eventIds: [id], matchId: e.matchId, label: Lab.eventLine(e, false), title: `${m.round} Q${e.period} ${e.clock}: ${tpl.name}`, stat: `Coded event: ${Lab.eventLine(e, false)}, ${M.matchLabel(m, ws && ws.focus)}.`, n: 1, source: `Coded event (${tpl.name})`, limitations: 'One passage of play.' });
  };
  Lab.clipToFinding = function (id) {
    const c = M.state.clips.find(x => x.id === id); if (!c) return; const m = M.match(c.matchId), ws = M.ws();
    Lab.addToFinding({ clipIds: [id], eventIds: c.eventId && M.event(c.eventId) ? [c.eventId] : [], matchId: c.matchId, label: c.title, title: c.title, stat: `Clip ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}, ${M.matchLabel(m, ws && ws.focus)}.`, n: 1, source: 'Video clip', limitations: 'One passage of play.' });
  };

  Lab.openFinding = function (id) {
    const f = M.finding(id); if (!f) return;
    if (M.isOppFinding(f)) return oppFinding(f);
    const ws = M.findWs(f.workspaceId) || M.ws(), rv = f.reviewId ? M.review(f.reviewId) : null, rm = rv && M.match(rv.matchId);
    const scopeIds = rm ? [rm.id] : (f.matchIds && f.matchIds.length ? f.matchIds : M.wsMatches(ws).map(m => m.id));
    const ids = new Set(scopeIds);
    const clips = M.state.clips.filter(c => ids.has(c.matchId));
    const evs = M.state.events.filter(e => ids.has(e.matchId)).sort((a, b) => a.period - b.period || (A.derive(a).el ?? 0) - (A.derive(b).el ?? 0));
    const linkedEv = new Set(f.eventIds || []);
    const evRows = evs.filter(e => linkedEv.has(e.id)).concat(evs.filter(e => !linkedEv.has(e.id))).slice(0, 300);
    const evLab = e => `Q${e.period} ${e.clock} · ${(M.template(e.templateId) || {}).name || 'Event'} · ${e.team}`;
    const focusOpts = rv ? rv.focus || [] : [];
    const wk = !rv && f.week ? M.match(f.week) : null;
    const kind = rv ? 'Weekly · match review finding · ' + U.esc(M.matchLabel(rm, ws.focus)) : wk ? 'Weekly finding · ' + U.esc(M.matchLabel(wk, ws.focus)) : 'Season finding';
    const belongs = rv ? '' : `<label class="full">Report it in<select data-ff="week"><option value="">Season report (long-term)</option>${M.wsMatches(ws).slice().reverse().map(m => `<option value="${m.id}" ${m.id === f.week ? 'selected' : ''}>Weekly report: ${U.esc(M.matchLabel(m, ws.focus))}</option>`).join('')}</select></label>`;
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${kind}</span><h2 id="drawerTitle">${U.esc(f.title || 'Untitled')}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b">
        <div class="form"><label class="full">Title<input data-ff="title" value="${U.esc(f.title)}"></label>${belongs}</div>
        <fieldset class="fband fb-obs"><legend><span class="lbl-obs">What the data shows</span></legend><div class="form">
          <label class="full">Observation<textarea data-ff="observation" placeholder="One plain sentence of what happened, e.g. We had fewer inside 50s than usual in the second half.">${U.esc(f.observation)}</textarea></label>
          <label class="full">Evidence: statistic, count and match<textarea data-ff="stat">${U.esc(f.stat)}</textarea></label>
          <label>Sample (n)<input data-ff="n" value="${f.n == null ? '' : f.n}" inputmode="numeric"></label>
          <label>Source<input data-ff="source" value="${U.esc(f.source)}"></label>
        </div></fieldset>
        <fieldset class="fband fb-int"><legend><span class="lbl-int">Analyst view (opinion)</span></legend><div class="form">
          <label class="full">Analyst interpretation<textarea data-ff="interpretation" placeholder="What you think it may mean. Keep it separate from the observation.">${U.esc(f.interpretation)}</textarea></label>
          <label class="full">Review question<textarea data-ff="question" placeholder="What to check in footage or discuss, e.g. Were our wings dropping back at centre bounces after quarter time?">${U.esc(f.question)}</textarea></label>
        </div></fieldset>
        <fieldset class="fband fb-act"><legend><span class="lbl-act">Follow-up</span></legend><div class="form">
          <label class="full">Follow-up focus<textarea data-ff="followUp" placeholder="What staff may want to revisit in training or a later match. A discussion point, not a prescription.">${U.esc(f.followUp)}</textarea></label>
          <label>Who<input data-ff="followOwner" value="${U.esc(f.followOwner)}" placeholder="e.g. Midfield coach"></label>
          <label>When<input data-ff="followWhen" value="${U.esc(f.followWhen)}" placeholder="e.g. Tuesday review, next match"></label>
          <label>Follow-up status<select data-ff="followStatus">${M.FOLLOW.map(s => `<option ${s === f.followStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        </div></fieldset>
        <div class="form" style="margin-top:10px">
          <label class="full">Limitations<textarea data-ff="limitations">${U.esc(f.limitations)}</textarea></label>
          <label>Evidence status<select data-ff="evidenceStatus">${M.EVIDENCE.map(([v, l]) => `<option value="${v}" ${v === f.evidenceStatus ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Finding status<select data-ff="status">${M.FSTATUS.map(s => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          ${focusOpts.length ? `<label>Review focus<select data-ff="focus"><option value="">None</option>${focusOpts.map(x => `<option ${x === f.focus ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select></label>` : ''}
          <label class="cb" style="align-self:end"><input type="checkbox" data-ff="inReport" ${f.inReport ? 'checked' : ''}> Include in report</label>
          ${f.chart ? `<label class="cb full"><input type="checkbox" data-ff="hideChart" ${f.hideChart ? 'checked' : ''}> Leave the chart out of the report</label>` : ''}
        </div>
        <ul class="defs">${M.EVIDENCE.filter(x => x[0]).map(([, l, d]) => `<li><b>${U.esc(l)}</b> ${U.esc(d)}</li>`).join('')}</ul>
        <h3 style="margin-top:12px">Linked clips</h3>${clips.length ? `<div class="chk-grid">${clips.map(c => `<label><input type="checkbox" data-fc value="${c.id}" ${(f.clipIds || []).includes(c.id) ? 'checked' : ''}> ${U.esc(c.title)} <span class="muted small">${U.fmtVideoTime(c.start)}</span></label>`).join('')}</div>` : '<p class="muted">No clips for these matches yet.</p>'}
        <h3 style="margin-top:12px">Linked coded events <span class="muted">(${linkedEv.size})</span></h3>${evRows.length ? `<div class="chk-list scroll-box">${evRows.map(e => `<label><input type="checkbox" data-fe value="${e.id}" ${linkedEv.has(e.id) ? 'checked' : ''}> ${U.esc(evLab(e))}</label>`).join('')}</div>${evs.length > 300 ? '<p class="sub">First 300 events shown.</p>' : ''}` : '<p class="muted">No coded events for these matches.</p>'}
        ${f.chart ? `<h3 style="margin-top:12px">Chart (redrawn from current data)</h3><div class="mini-chart">${chartFor(Object.assign({}, f, { hideChart: false })) || '<p class="muted">The data behind this chart is no longer available.</p>'}</div>` : ''}
        <div class="ctl" style="margin-top:12px"><button class="btn g" id="fSaveF">Save</button><button class="btn danger sm" id="fDelF">Delete finding</button></div></div>`, d => {
      U.$('#fSaveF', d).onclick = () => {
        const p = {};
        U.$$('[data-ff]', d).forEach(i => { const k = i.dataset.ff; p[k] = i.type === 'checkbox' ? i.checked : k === 'n' ? (i.value.trim() === '' || isNaN(parseInt(i.value, 10)) ? null : parseInt(i.value, 10)) : i.value; });
        p.clipIds = U.$$('[data-fc]', d).filter(c => c.checked).map(c => c.value);
        const shown = new Set(evRows.map(e => e.id));
        p.eventIds = (f.eventIds || []).filter(x => !shown.has(x)).concat(U.$$('[data-fe]', d).filter(c => c.checked).map(c => c.value));
        M.updateFinding(id, p); Lab.closeDrawer(); U.toast('Saved');
      };
      U.$('#fDelF', d).onclick = () => { if (confirm('Delete this finding?')) { M.removeFinding(id); Lab.closeDrawer(); } };
    });
  };


  /* ---------- opponent findings (Opponent Lab's fields) and the opponent report ---------- */
  function oppFinding(f) {
    const ws = M.findWs(f.workspaceId) || M.ws(), id = f.id;
    const ids = new Set(M.wsMatches(ws).concat(M.ourMatches(ws)).map(m => m.id));
    const clips = M.state.clips.filter(c => ids.has(c.matchId));
    const evClips = new Set(M.state.clips.filter(c => (f.eventIds || []).includes(c.eventId)).map(c => c.id));
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Opponent finding · ${U.esc(ws.opponent || '')}</span><h2 id="drawerTitle">${U.esc(f.title || 'Untitled')}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b"><div class="form">
        <label class="full">Title<input data-ff="title" value="${U.esc(f.title)}"></label>
        <label class="full"><span class="lbl-obs">Observation · what the data shows</span><textarea data-ff="observation" placeholder="One plain sentence a coach can read in five seconds, e.g. Kick-ins go short to the left pocket most of the time.">${U.esc(f.observation)}</textarea></label>
        <label class="full"><span class="lbl-obs">Statistic / count</span><textarea data-ff="stat">${U.esc(f.stat)}</textarea></label>
        <label>Sample (n)<input data-ff="n" value="${f.n == null ? '' : f.n}" inputmode="numeric"></label>
        <label>Status<select data-ff="status">${M.OSTATUS.map(x => `<option ${x === f.status ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="full">Source and matches<input data-ff="source" value="${U.esc(f.source)}"></label>
        <label class="full"><span class="lbl-int">Analyst interpretation · opinion</span><textarea data-ff="interpretation" placeholder="What you think it means, after watching the vision.">${U.esc(f.interpretation)}</textarea></label>
        <label class="full"><span class="lbl-act">Coaching question / preparation point</span><textarea data-ff="coaching" placeholder="What coaches could review or prepare.">${U.esc(f.coaching || '')}</textarea></label>
        <label>Confidence<select data-ff="confidence">${M.CONF.map(x => `<option value="${x}" ${x === (f.confidence || '') ? 'selected' : ''}>${x || 'Not set'}</option>`).join('')}</select></label>
        <label class="cb" style="align-self:end"><input type="checkbox" data-ff="inReport" ${f.inReport ? 'checked' : ''}> Include in the report</label>
        <label class="full">Limitations<textarea data-ff="limitations">${U.esc(f.limitations)}</textarea></label>
        ${f.chart ? `<label class="cb full"><input type="checkbox" data-ff="hideChart" ${f.hideChart ? 'checked' : ''}> Leave the chart out of the report</label>` : ''}
      </div>
      <p class="sub">Matches: ${(f.matchIds || []).map(mid => U.esc(M.matchLabel(M.match(mid), ws.focus))).join(', ') || 'none recorded'} · Linked events: ${(f.eventIds || []).length}</p>
      <h3 style="margin-top:12px">Clips</h3>${clips.length ? `<div class="chk-grid">${clips.map(c => `<label><input type="checkbox" data-fc value="${c.id}" ${(f.clipIds || []).includes(c.id) ? 'checked' : ''}> ${U.esc(c.title)}${evClips.has(c.id) ? ' <span class="badge2 clip">linked event</span>' : ''}</label>`).join('')}</div>` : '<p class="muted">No clips yet for these matches.</p>'}
      ${f.chart ? `<h3 style="margin-top:12px">Chart (redrawn from current data)</h3><div class="mini-chart">${chartFor(Object.assign({}, f, { hideChart: false })) || '<p class="muted">The data behind this chart is no longer available.</p>'}</div>` : ''}
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="fSaveF">Save</button><button class="btn danger sm" id="fDelF">Delete finding</button></div></div>`, d => {
      U.$('#fSaveF', d).onclick = () => {
        const p = {};
        U.$$('[data-ff]', d).forEach(i => { const k = i.dataset.ff; p[k] = i.type === 'checkbox' ? i.checked : k === 'n' ? (i.value.trim() === '' || isNaN(parseInt(i.value, 10)) ? null : parseInt(i.value, 10)) : i.value; });
        p.clipIds = U.$$('[data-fc]', d).filter(c => c.checked).map(c => c.value);
        M.updateFinding(id, p); Lab.closeDrawer(); U.toast('Saved');
      };
      U.$('#fDelF', d).onclick = () => { if (confirm('Delete this finding?')) { M.removeFinding(id); Lab.closeDrawer(); } };
    });
  }
  function oppCoverage(ws) {
    const ms = M.wsMatches(ws), opp = ws.focus;
    return `<table class="compact"><thead><tr><th class="l">Match</th><th class="l">Result</th><th>Coded events</th><th>Clips</th></tr></thead><tbody>
      ${ms.map(m => { const u = M.matchUsage(m.id), r = M.result(m, opp); return `<tr><td class="l">${U.esc(M.matchLabel(m, opp))}</td><td class="l">${r ? `${r.res} ${U.signed(r.margin)}` : '<span class="muted">–</span>'}</td><td>${u.events || '–'}</td><td>${u.clips || '–'}</td></tr>`; }).join('') || '<tr><td class="l muted" colspan="4">No matches reviewed</td></tr>'}</tbody></table>`;
  }
  const OCAVEAT = 'Statistics come from the season data and from events coded by club staff. Averages and rates describe past games with their sample sizes; they are not predictions. "Analyst read" and "For coaches" are opinion.';
  const oppTitle = ws => (ws.report || {}).title || `${ws.ourTeam || 'Us'} v ${ws.opponent}: opposition report`;
  const oppMeta = ws => [ws.competition, ws.season, ws.round, ws.date, ws.venue].filter(Boolean).join(' · ');
  function oppItemHTML(f, i) {
    const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean), ch = chartFor(f);
    return `<div class="item">
        <h3>${i + 1}. ${U.esc(f.title || 'Untitled')}${f.confidence ? ` <span class="conf conf-${f.confidence}">${f.confidence} confidence</span>` : ''}</h3>
        ${f.observation ? `<p class="obs">${U.esc(f.observation)}</p>` : ''}
        ${f.stat ? `<p><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` <span class="muted">(n=${f.n}${f.n < U.SMALL_N ? ', small' : ''})</span>` : ''}</p>` : ''}
        ${ch ? `<div class="rep-chart">${ch}</div>` : ''}
        ${f.interpretation ? `<p><span class="lbl-int">Analyst read</span> ${U.esc(f.interpretation)}</p>` : ''}
        ${f.coaching ? `<p><span class="lbl-act">For coaches</span> ${U.esc(f.coaching)}</p>` : ''}
        ${clips.length ? `<p class="small"><b>Clips:</b> ${clips.map(c => U.esc(clipLine(c))).join('; ')}</p>` : ''}${evHTML(f)}
        <p class="small muted">${f.source ? U.esc(f.source) + '. ' : ''}${f.limitations ? 'Limitations: ' + U.esc(f.limitations) : ''}${f.status && f.status !== 'Final' ? ` · Status: ${U.esc(f.status)}` : ''}</p></div>`;
  }
  function oppItemsMD(items, L) {
    items.forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.title}${f.confidence ? ` (${f.confidence} confidence)` : ''}`);
      if (f.observation) L.push(f.observation);
      if (f.stat) L.push(`**Evidence:** ${f.stat}${f.n != null ? ` (n=${f.n})` : ''}`);
      if (f.interpretation) L.push(`**Analyst read:** ${f.interpretation}`);
      if (f.coaching) L.push(`**For coaches:** ${f.coaching}`);
      const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean);
      if (clips.length) L.push(`Clips: ${clips.map(clipLine).join('; ')}`);
      evMD(f, L);
      if (f.limitations) L.push(`_Limitations: ${f.limitations}_`);
      L.push('');
    });
  }
  const oppSlides = (o, items) => items.map((f, i) => `<div class="slide"><span class="k">${U.esc(o.opponent)} · finding ${i + 1} of ${items.length}</span><h2>${U.esc(f.title)}</h2>${f.observation ? `<p class="lead">${U.esc(f.observation)}</p>` : ''}<div class="slide-grid"><div>${chartFor(f) || ''}</div><div>${f.stat ? `<p><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}</p>` : ''}${f.interpretation ? `<p><span class="lbl-int">Analyst read</span> ${U.esc(f.interpretation)}</p>` : ''}${f.coaching ? `<p><span class="lbl-act">For coaches</span> ${U.esc(f.coaching)}</p>` : ''}</div></div></div>`);
  /* An opponent section inside a weekly or season report. */
  function oppSection(o) {
    const items = M.findingsOf(o).filter(f => f.inReport);
    return `<h2>Opponent: ${U.esc(o.opponent)}</h2>${M.wsMatches(o).length ? `<p class="small muted">Their games analysed</p>${oppCoverage(o)}` : ''}
      ${items.length ? items.map(oppItemHTML).join('') : '<p class="muted">No opponent findings selected yet.</p>'}`;
  }
  function oppBrief(ws) {
    const items = M.findingsOf(ws).filter(f => f.inReport), r = ws.report || {};
    return `<article class="brief" id="briefDoc">
      <h1>${U.esc(oppTitle(ws))}</h1>
      <div class="bmeta">Opposition report · prepared ${U.esc(U.today())}${oppMeta(ws) ? ' · ' + U.esc(oppMeta(ws)) : ''}</div>
      ${r.intro ? `<p class="lead">${U.esc(r.intro)}</p>` : ''}
      ${M.wsMatches(ws).length ? `<h2>Matches analysed</h2>${oppCoverage(ws)}` : ''}
      <h2>Findings</h2>
      ${items.length ? items.map(oppItemHTML).join('') : '<p class="muted">No findings selected yet.</p>'}
      ${M.playlists(ws.id).filter(p => p.clipIds.length).map(p => `<h2>Video: ${U.esc(p.name)}</h2><ol class="small">${p.clipIds.map(id => M.state.clips.find(c => c.id === id)).filter(Boolean).map(c => `<li>${U.esc(clipLine(c))}</li>`).join('')}</ol>`).join('')}
      <p class="caveat">${OCAVEAT}</p></article>`;
  }
  function oppMarkdown(ws) {
    const items = M.findingsOf(ws).filter(f => f.inReport), r = ws.report || {};
    const L = [`# ${oppTitle(ws)}`, `Opposition report, ${U.today()}. ${oppMeta(ws)}`, ''];
    if (r.intro) L.push(r.intro, '');
    if (M.wsMatches(ws).length) L.push('## Matches analysed', ...M.wsMatches(ws).map(m => { const u = M.matchUsage(m.id), res = M.result(m, ws.focus); return `- ${M.matchLabel(m, ws.focus)}: ${res ? res.res + ' ' + U.signed(res.margin) + '; ' : ''}${u.events} coded events, ${u.clips} clips`; }), '');
    L.push('## Findings');
    oppItemsMD(items, L);
    L.push('_' + OCAVEAT + '_');
    return L.join('\n');
  }
  function oppPresent(ws) {
    const items = M.findingsOf(ws).filter(f => f.inReport), r = ws.report || {};
    const slides = [`<div class="slide title"><span class="dam-pin">Opposition report</span><h1>${U.esc(ws.ourTeam || 'Us')} v <em>${U.esc(ws.opponent)}</em></h1><p>${U.esc(oppMeta(ws))}</p>${r.intro ? `<p class="lead">${U.esc(r.intro)}</p>` : ''}</div>`]
      .concat(M.wsMatches(ws).length ? [`<div class="slide"><h2>Matches analysed</h2>${oppCoverage(ws)}</div>`] : [])
      .concat(oppSlides(ws, items));
    showSlides(slides);
  }
  function showSlides(slides) {
    let i = 0;
    const ov = document.createElement('div'); ov.className = 'present'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Presentation');
    const draw = () => { ov.innerHTML = `${slides[i]}<div class="present-bar"><span>${i + 1} / ${slides.length}</span><span>← → to move · Esc to exit</span><button class="btn sm" data-x>Exit</button></div>`; ov.querySelector('[data-x]').onclick = close; ov.querySelector('[data-x]').focus(); };
    const key = e => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); i = Math.min(slides.length - 1, i + 1); draw(); } else if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); draw(); } else if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', key); ov.remove(); }
    document.addEventListener('keydown', key); document.body.appendChild(ov); draw();
  }
  /* Finding cards, shared by Match review and Findings. */
  Lab.findingCards = function (list) {
    return `<div class="fgrid">${list.map((f, i) => `<div class="fcard ${f.inReport ? '' : 'out'}">
      <div class="fcard-h"><span class="k">${i + 1} · ${U.esc(f.status)}</span><div class="ctl"><button class="btn sm" data-up="${f.id}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="btn sm" data-dn="${f.id}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></div></div>
      <h3>${U.esc(f.title || 'Untitled')} ${evBadge(f.evidenceStatus)}</h3>
      ${f.observation ? `<p><span class="lbl-obs">Observation</span> ${U.esc(f.observation)}</p>` : '<p class="uncoded">No observation written yet</p>'}
      ${f.stat ? `<p class="small"><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` (n=${f.n})` : ''}</p>` : ''}
      ${f.question ? `<p class="small"><span class="lbl-q">Review question</span> ${U.esc(f.question)}</p>` : ''}${f.coaching ? `<p class="small"><span class="lbl-act">For coaches</span> ${U.esc(f.coaching)}</p>` : ''}${f.confidence ? `<p class="small muted">${U.esc(f.confidence)} confidence</p>` : ''}
      ${f.followUp ? `<p class="small"><span class="lbl-act">Follow-up</span> ${U.esc(f.followUp)} <span class="muted">(${U.esc(f.followStatus)})</span></p>` : ''}
      <p class="small muted">${f.interpretation ? 'Interpretation written' : 'No interpretation'} · ${(f.clipIds || []).length} clips · ${(f.eventIds || []).length} events${f.chart ? ' · chart' : ''}</p>
      <div class="ctl"><label class="cb"><input type="checkbox" data-inrep="${f.id}" ${f.inReport ? 'checked' : ''}> ${'In report'}</label><button class="btn sm g" data-fedit="${f.id}">Open</button></div></div>`).join('')}</div>`;
  };
  Lab.wireFindingCards = function (el) {
    U.$$('[data-fedit]', el).forEach(b => b.onclick = () => Lab.openFinding(b.dataset.fedit));
    U.$$('[data-up]', el).forEach(b => b.onclick = () => M.moveFinding(b.dataset.up, -1));
    U.$$('[data-dn]', el).forEach(b => b.onclick = () => M.moveFinding(b.dataset.dn, 1));
    U.$$('[data-inrep]', el).forEach(c => c.onchange = () => M.updateFinding(c.dataset.inrep, { inReport: c.checked }));
    U.$$('[data-fst]', el).forEach(s => s.onchange = () => M.updateFinding(s.dataset.fst, { followStatus: s.value }));
  };
  Lab.followTable = function (list, showMatch) {
    const ws = M.ws();
    const rows = list.filter(f => f.followUp);
    return `<div class="tw"><table class="compact"><thead><tr><th class="l">Finding</th>${showMatch ? '<th class="l">Match</th>' : ''}<th class="l">Follow-up focus</th><th class="l">Who</th><th class="l">When</th><th class="l">Status</th></tr></thead><tbody>
      ${rows.map(f => { const wid = M.weekOf(f), m = wid && M.match(wid); return `<tr><td class="l wrap"><button class="link" data-fedit="${f.id}">${U.esc(f.title)}</button></td>${showMatch ? `<td class="l">${m ? U.esc(M.matchLabel(m, ws.focus)) : '<span class="muted">Season</span>'}</td>` : ''}<td class="l wrap">${U.esc(f.followUp)}</td><td class="l">${U.esc(f.followOwner || '–')}</td><td class="l">${U.esc(f.followWhen || '–')}</td>
        <td class="l"><select class="mini" data-fst="${f.id}" aria-label="Follow-up status">${M.FOLLOW.map(s => `<option ${s === f.followStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`; }).join('') || `<tr><td class="l muted" colspan="${showMatch ? 6 : 5}">No follow-ups recorded.</td></tr>`}
    </tbody></table></div>`;
  };

  /* ---------- Findings tab: every finding for the team season ---------- */
  /* Our team season and the opponents linked to it (same club, competition and season).
     Findings and Report show all of them together, whichever mode you're in. */
  function ctx() {
    const w = M.ws(), T = M.teamFor(w), O = T ? M.oppsFor(T) : [];
    if (w && w.kind === 'opp' && !O.includes(w)) O.push(w);
    return { w, T, O };
  }
  Lab.findingsCtx = ctx;
  const toTeam = T => { if (M.ws() !== T) M.selectWorkspace(T.id); };
  Lab.Views.findings = {
    render(el) {
      const { w, T, O } = ctx();
      const st = vs.fdStatus || '', fq = (vs.fdQ || '').toLowerCase();
      const keep = f => (!st || (st === 'open' ? f.followUp && f.followStatus !== 'Done' : st === 'Ready for report' ? ['Ready for report', 'Final'].includes(f.status) : f.status === st)) && (!fq || [f.title, f.observation, f.stat, f.interpretation, f.question, f.followUp, f.coaching].join(' ').toLowerCase().includes(fq));
      const all = T ? M.wsFindings(undefined, T) : [], weekly = all.filter(f => M.weekOf(f)), season = T ? M.wsFindings('', T) : [];
      const oppN = O.reduce((n, o) => n + M.findingsOf(o).length, 0);
      const HZ = [['all', `All (${all.length + oppN})`]].concat(T ? [['week', `Weekly (${weekly.length})`], ['season', `Season (${season.length})`]] : [], [['opp', `Opponents (${oppN})`]]);
      const hz = HZ.some(x => x[0] === vs.fdHz) ? vs.fdHz : 'all';
      const seg = `<span class="seg" role="group" aria-label="Findings to show">${HZ.map(([k, l]) => `<button class="${hz === k ? 'on' : ''}" data-fdhz="${k}">${l}</button>`).join('')}</span>`;
      const ms = T ? M.wsMatches(T) : [], weeks = ms.filter(m => M.reviewFor(m.id, T) || M.weekFindings(m.id, T).length).reverse();
      const pickWeek = ms.some(m => m.id === vs.fdWeek) ? vs.fdWeek : (weeks[0] || ms[ms.length - 1] || {}).id || '';
      const wkRes = m => { const r = Lab.MD.result(m, T.focus, M.reviewFor(m.id, T)); return r ? `${r.res} ${U.signed(r.margin)}, ${r.us}-${r.them}` : 'No score entered'; };
      const weekHTML = !T ? '' : weeks.length ? weeks.map(m => { const rv = M.reviewFor(m.id, T), n = M.weekFindings(m.id, T).length, list = M.weekFindings(m.id, T).filter(keep);
          return `<section class="sec card"><div class="card-h"><div><span class="k">Our team · weekly</span><h2>Week: ${U.esc(M.matchLabel(m, T.focus))}</h2><p>${U.esc(wkRes(m))} · ${n} finding${n === 1 ? '' : 's'}${rv ? ', including the match review' : ''}</p></div>
            <div class="ctl"><button class="btn sm g" data-wkadd="${m.id}">+ Add to this week</button>${rv ? `<button class="btn sm" data-openrv="${m.id}">Open review</button>` : ''}<button class="btn sm" data-wkrep="${m.id}">Weekly report →</button></div></div>
            ${list.length ? Lab.findingCards(list) : '<p class="muted">None match the filter.</p>'}</section>`; }).join('')
        : `<section class="sec card"><div class="empty"><h3>No weekly findings yet</h3><p>${ms.length ? `Start a match review for a ${U.esc(T.focus)} game, or add a weekly finding.` : `Add ${U.esc(T.focus)} games in Matches first. Each game is a week.`}</p></div></section>`;
      const seasonHTML = !T ? '' : `<section class="sec card"><div class="card-h"><div><span class="k">Our team · season</span><h2>Season findings</h2><p>Longer-term findings for ${U.esc(T.focus)}: season stats and patterns across games.</p></div><div class="ctl"><button class="btn sm g" data-szadd>+ Season finding</button><button class="btn sm" data-sznrep>Season report →</button></div></div>
        ${season.filter(keep).length ? Lab.findingCards(season.filter(keep)) : '<p class="muted">None yet. Add season stats from the Team and Players tabs, findings from Explore, or write one.</p>'}</section>`;
      const oppHTML = O.length ? O.map(o => { const fl = M.findingsOf(o), list = fl.filter(keep);
          return `<section class="sec card"><div class="card-h"><div><span class="k">Opponent</span><h2>${U.esc(o.opponent)}</h2><p>${fl.length} finding${fl.length === 1 ? '' : 's'} from scouting ${U.esc(o.opponent)}: their stats, analysed games and coding.</p></div>
            <div class="ctl"><button class="btn sm g" data-oadd="${o.id}">+ Opponent finding</button><button class="btn sm" data-orep="${o.id}">Opponent report →</button></div></div>
            ${list.length ? Lab.findingCards(list) : `<p class="muted">${fl.length ? 'None match the filter.' : `None yet. Switch to Opponent mode for ${U.esc(o.opponent)} and use + on their stats, games and coding.`}</p>`}</section>`; }).join('')
        : `<section class="sec card"><div class="empty"><h3>No opponents yet</h3><p>Switch to Opponent mode and add the club you're playing${T ? ` (with ${U.esc(T.team)} as our club)` : ''}. Their findings show here too.</p></div></section>`;
      const unlinked = !T && w && w.kind === 'opp' ? `<p class="warnline">This opponent isn't linked to one of your team seasons, so only its findings show. Edit the opponent and set Our club, competition and season to match a team season.</p>` : '';
      el.innerHTML = `
      <section class="card"><div class="card-h"><div><h2>Findings</h2><p>Everything you find, in one place: ${T ? `${U.esc(T.focus)}'s weekly and season findings` : 'your team findings'} and ${O.length ? O.map(o => U.esc(o.opponent)).join(', ') : 'any opponent you scout'}. All of them can go in the report.</p></div>
        <div class="ctl">${hz === 'week' && ms.length ? `<select id="fdWeek" aria-label="Week">${ms.slice().reverse().map(m => `<option value="${m.id}" ${m.id === pickWeek ? 'selected' : ''}>${U.esc(M.matchLabel(m, T.focus))}</option>`).join('')}</select><button class="btn g" id="fdNew">+ Weekly finding</button>` : hz === 'season' ? '<button class="btn g" data-szadd>+ Season finding</button>' : ''}</div></div>
        ${unlinked}
        <div class="f-row"><div class="f"><label>Show</label>${seg}</div><div class="f"><label>Status</label><span class="seg">${[['', 'All'], ['Draft', 'Draft'], ['Ready for report', 'Ready'], ['open', 'Open follow-ups']].map(([k, l]) => `<button class="${st === k ? 'on' : ''}" data-fdst="${k}">${l}</button>`).join('')}</span></div>
          <div class="f"><label for="fdQ">Search</label><input type="search" id="fdQ" value="${U.esc(vs.fdQ || '')}"></div></div>
        <ul class="defs" style="margin-top:10px"><li><span class="lbl-obs">Observation</span> what the data or coded events show.</li><li><span class="lbl-obs">Evidence</span> the statistic, count, sample and match behind it.</li><li><span class="lbl-int">Interpretation</span> what the analyst thinks it may mean.</li><li><span class="lbl-q">Review question</span> what to check in footage or discuss.</li><li><span class="lbl-act">Follow-up</span> what staff may revisit in training or a later match.</li></ul>
      </section>
      ${hz === 'all' ? weekHTML + seasonHTML + oppHTML : hz === 'week' ? weekHTML : hz === 'season' ? seasonHTML : oppHTML}
      ${T && hz !== 'opp' ? `<section class="sec card"><div class="card-h"><div><h2>Follow-up tracker</h2><p>Follow-ups from ${hz === 'season' ? 'season' : hz === 'week' ? 'weekly' : 'our team'} findings.</p></div></div>${Lab.followTable(hz === 'season' ? season : hz === 'week' ? weekly : all, hz !== 'season')}</section>` : ''}`;
      const addWeek = id => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: T.id, matchIds: [id], week: id });
      const addSeason = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: T.id, reviewId: '', week: '' });
      const nb = U.$('#fdNew', el); if (nb) nb.onclick = () => addWeek(U.$('#fdWeek', el).value);
      U.$$('[data-szadd]', el).forEach(b => b.onclick = addSeason);
      const wsel = U.$('#fdWeek', el); if (wsel) wsel.onchange = () => { vs.fdWeek = wsel.value; };
      U.$$('[data-fdhz]', el).forEach(b => b.onclick = () => { vs.fdHz = b.dataset.fdhz; Lab.render(); });
      U.$$('[data-wkadd]', el).forEach(b => b.onclick = () => addWeek(b.dataset.wkadd));
      U.$$('[data-oadd]', el).forEach(b => b.onclick = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: b.dataset.oadd }));
      U.$$('[data-wkrep]', el).forEach(b => b.onclick = () => { vs.repHz = 'week'; vs.repWeek = b.dataset.wkrep; vs.reportPreview = false; Lab.go('report'); });
      U.$$('[data-sznrep]', el).forEach(b => b.onclick = () => { vs.repHz = 'season'; vs.reportPreview = false; Lab.go('report'); });
      U.$$('[data-orep]', el).forEach(b => b.onclick = () => { vs.repHz = 'opp'; vs.repOpp = b.dataset.orep; vs.reportPreview = false; Lab.go('report'); });
      U.$$('[data-fdst]', el).forEach(b => b.onclick = () => { vs.fdStatus = b.dataset.fdst; Lab.render(); });
      let t; const q = U.$('#fdQ', el); q.oninput = () => { clearTimeout(t); t = setTimeout(() => { vs.fdQ = q.value; Lab.render(); const n = U.$('#fdQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
      U.$$('[data-openrv]', el).forEach(b => b.onclick = () => { toTeam(T); Lab.openReview(b.dataset.openrv, 'findings'); });
      Lab.wireFindingCards(el);
    }
  };

  /* ---------- report ---------- */
  function clipLine(c) { return `${c.title} [${M.matchLabel(M.match(c.matchId))} ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}]`; }
  /* What the report covers: one match week (its review findings plus weekly notes) or the season. */
  function scopeOf(ws) {
    const ms = M.wsMatches(ws);
    if (vs.repScope) { const r0 = M.review(vs.repScope); if (r0 && r0.workspaceId === ws.id) { vs.repHz = 'week'; vs.repWeek = r0.matchId; } vs.repScope = ''; }
    const weeksWith = ms.filter(m => M.weekFindings(m.id, ws).length);
    if (!vs.repHz || vs.repHz === 'opp') vs.repHz = weeksWith.length || !M.wsFindings('', ws).length ? 'week' : 'season';
    const weekly = vs.repHz !== 'season' && ms.length;
    if (!weekly) {
      const meta = (ws.report = ws.report || { title: '', intro: '' });
      return { weekly: false, id: '', m: null, rv: null, meta, opp: '', ms, defTitle: `${ws.focus} ${ws.season}: season report`, items: M.wsFindings('', ws), save: patch => M.updateWorkspace(ws.id, { report: Object.assign({}, meta, patch) }) };
    }
    const m = ms.find(x => x.id === vs.repWeek) || weeksWith[weeksWith.length - 1] || ms[ms.length - 1];
    const rv = M.reviewFor(m.id, ws), opp = M.opponentIn(m, ws.focus);
    const all = ws.weekReports || {}, meta = Object.assign({ title: '', intro: '' }, rv && rv.report, all[m.id]);
    return { weekly: true, id: m.id, m, rv, meta, opp, ms, defTitle: `${ws.focus} v ${opp}, ${m.round} ${m.season}: weekly report`, items: M.weekFindings(m.id, ws),
      save: patch => M.updateWorkspace(ws.id, { weekReports: Object.assign({}, ws.weekReports || {}, { [m.id]: Object.assign({}, meta, patch) }) }) };
  }
  const opt = (meta, k) => !meta.hide || !meta.hide[k];
  function findingHTML(f, i) {
    const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean), ch = chartFor(f);
    return `<div class="item">
      <h3>${i + 1}. ${U.esc(f.title || 'Untitled')} ${evBadge(f.evidenceStatus)}${f.status !== 'Ready for report' ? ' <span class="st st-progress">Draft</span>' : ''}</h3>
      ${f.observation ? `<p class="obs"><span class="lbl-obs">Observation</span> ${U.esc(f.observation)}</p>` : ''}
      ${f.stat ? `<p><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` <span class="muted">(n=${f.n}${f.n < U.SMALL_N && f.n > 1 ? ', small sample' : ''})</span>` : ''}${f.source ? ` <span class="muted">Source: ${U.esc(f.source)}.</span>` : ''}</p>` : ''}
      ${ch ? `<div class="rep-chart">${ch}</div>` : ''}
      ${f.interpretation ? `<p><span class="lbl-int">Analyst interpretation</span> ${U.esc(f.interpretation)}</p>` : ''}
      ${f.question ? `<p><span class="lbl-q">Review question</span> ${U.esc(f.question)}</p>` : ''}
      ${f.followUp ? `<p><span class="lbl-act">Follow-up focus</span> ${U.esc(f.followUp)}${f.followOwner || f.followWhen ? ` <span class="muted">(${U.esc([f.followOwner, f.followWhen].filter(Boolean).join(', '))})</span>` : ''}</p>` : ''}
      ${clips.length ? `<p class="small"><b>Clips:</b> ${clips.map(c => U.esc(clipLine(c))).join('; ')}</p>` : ''}${evHTML(f)}
      ${f.limitations ? `<p class="small muted">Limitations: ${U.esc(f.limitations)}</p>` : ''}</div>`;
  }
  function resultBlock(ws, S) {
    const r = Lab.MD.result(S.m, ws.focus, S.rv); if (!r) return '<p class="muted">No result entered.</p>';
    return `<p class="lead"><b>${U.esc(ws.focus)} ${r.us}</b> ${r.res === 'Win' ? 'defeated' : r.res === 'Loss' ? 'lost to' : 'drew with'} <b>${U.esc(S.opp)} ${r.them}</b> (${r.res} ${U.signed(r.margin)}).</p>
      ${r.quarters ? `<table class="compact"><thead><tr><th class="l">Team</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Final</th></tr></thead><tbody><tr><td class="l">${U.esc(ws.focus)}</td>${r.cumUs.map(c => `<td>${Lab.MD.fmtGB(c)}</td>`).join('')}</tr><tr><td class="l">${U.esc(S.opp)}</td>${r.cumThem.map(c => `<td>${Lab.MD.fmtGB(c)}</td>`).join('')}</tr></tbody></table>` : ''}<p class="small muted">Source: ${U.esc(r.src)}.</p>`;
  }
  function coverageBlock(ws, S) {
    const items = Lab.MD.coverage(S.m, ws.focus, S.rv);
    return `<table class="compact"><thead><tr><th class="l">Data</th><th class="l">Status</th><th class="l">Detail</th></tr></thead><tbody>${items.map(c => `<tr><td class="l">${U.esc(c.label)}</td><td class="l">${Lab.MD.STATE_LABEL[c.state]}</td><td class="l wrap">${U.esc(c.text)}${c.src ? ` <span class="muted">(${U.esc(c.src)})</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  function seasonBlock(ws) {
    const revs = M.reviews(ws);
    return `<table class="compact"><thead><tr><th class="l">Match</th><th class="l">Result</th><th>Findings</th></tr></thead><tbody>${revs.map(r => { const m = M.match(r.matchId), rr = Lab.MD.result(m, ws.focus, r); return `<tr><td class="l">${U.esc(M.matchLabel(m, ws.focus))}</td><td class="l">${rr ? `${rr.res} ${U.signed(rr.margin)} (${rr.us}-${rr.them})` : '–'}</td><td>${M.wsFindings(r.id).length}</td></tr>`; }).join('') || '<tr><td class="l muted" colspan="3">No match reviews yet.</td></tr>'}</tbody></table>`;
  }
  function followRows(items) { const rows = items.filter(f => f.followUp); return rows.length ? `<table class="compact"><thead><tr><th class="l">Follow-up focus</th><th class="l">From finding</th><th class="l">Who</th><th class="l">When</th><th class="l">Status</th></tr></thead><tbody>${rows.map(f => `<tr><td class="l wrap">${U.esc(f.followUp)}</td><td class="l wrap">${U.esc(f.title)}</td><td class="l">${U.esc(f.followOwner || '–')}</td><td class="l">${U.esc(f.followWhen || '–')}</td><td class="l">${U.esc(f.followStatus)}</td></tr>`).join('')}</tbody></table>` : ''; }
  const CAVEAT = 'Prepared from built-in season data, imported stats and events coded by club staff. Numbers describe what was recorded, with their sample and source; they do not explain why it happened. Analyst interpretation, review questions and follow-up focus are staff opinion and discussion points, not conclusions or instructions.';

  function reportHTML(ws, S, oo) {
    const items = S.items.filter(f => f.inReport), meta = S.meta;
    const m = S.m;
    const allClips = [...new Set(items.flatMap(f => f.clipIds || []))].map(id => M.state.clips.find(c => c.id === id)).filter(Boolean);
    return `<article class="brief" id="briefDoc">
      <h1>${U.esc(meta.title || S.defTitle)}</h1>
      <div class="bmeta">${S.weekly ? 'Internal weekly report' : 'Internal season report'} · prepared ${U.esc(U.today())} · ${U.esc([ws.competition, m ? m.round : ws.season, m ? m.date : '', m ? m.venue : ''].filter(Boolean).join(' · '))}</div>
      ${meta.intro ? `<p class="lead">${U.esc(meta.intro)}</p>` : ''}
      ${S.weekly && opt(meta, 'result') ? `<h2>Result</h2>${resultBlock(ws, S)}` : ''}
      ${S.weekly && opt(meta, 'coverage') ? `<h2>Data used</h2>${coverageBlock(ws, S)}` : ''}
      ${!S.weekly ? `<h2>Matches reviewed</h2>${seasonBlock(ws)}` : ''}
      <h2>Findings</h2>${items.length ? items.map(findingHTML).join('') : '<p class="muted">No findings selected for the report yet.</p>'}
      ${oo ? oppSection(oo) : ''}
      ${opt(meta, 'followups') && followRows(items) ? `<h2>Follow-up list</h2>${followRows(items)}` : ''}
      ${opt(meta, 'clips') && allClips.length ? `<h2>Clips referenced</h2><ol class="small">${allClips.map(c => `<li>${U.esc(clipLine(c))}</li>`).join('')}</ol><p class="small muted">Clips are in and out points on the club's own match video. Club Lab doesn't host or edit video.</p>` : ''}
      <p class="caveat">${CAVEAT}</p></article>`;
  }
  function markdown(ws, S, oo) {
    const items = S.items.filter(f => f.inReport), meta = S.meta, L = [`# ${meta.title || S.defTitle}`, `${S.weekly ? 'Internal weekly report' : 'Internal season report'}, prepared ${U.today()}. ${[ws.competition, S.m ? S.m.round : ws.season, S.m ? S.m.date : '', S.m ? S.m.venue : ''].filter(Boolean).join(' · ')}`, ''];
    if (meta.intro) L.push(meta.intro, '');
    if (S.weekly && opt(meta, 'result')) { const r = Lab.MD.result(S.m, ws.focus, S.rv); if (r) L.push('## Result', `${ws.focus} ${r.us}, ${S.opp} ${r.them} (${r.res} ${U.signed(r.margin)}).${r.quarters ? ' By quarter: ' + [0, 1, 2, 3].map(i => `Q${i + 1} ${r.qUs[i]}-${r.qThem[i]}`).join(', ') + '.' : ''} Source: ${r.src}.`, ''); }
    if (S.weekly && opt(meta, 'coverage')) L.push('## Data used', ...Lab.MD.coverage(S.m, ws.focus, S.rv).map(c => `- ${c.label}: ${Lab.MD.STATE_LABEL[c.state]}. ${c.text}`), '');
    L.push('## Findings');
    items.forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.title}${f.evidenceStatus ? ` (${EVL(f.evidenceStatus)[1]})` : ''}${f.status !== 'Ready for report' ? ' [draft]' : ''}`);
      if (f.observation) L.push(`**Observation:** ${f.observation}`);
      if (f.stat) L.push(`**Evidence:** ${f.stat}${f.n != null ? ` (n=${f.n})` : ''}${f.source ? ` Source: ${f.source}.` : ''}`);
      if (f.interpretation) L.push(`**Analyst interpretation:** ${f.interpretation}`);
      if (f.question) L.push(`**Review question:** ${f.question}`);
      if (f.followUp) L.push(`**Follow-up focus:** ${f.followUp}${f.followOwner || f.followWhen ? ` (${[f.followOwner, f.followWhen].filter(Boolean).join(', ')})` : ''}`);
      const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean);
      if (clips.length) L.push(`Clips: ${clips.map(clipLine).join('; ')}`);
      evMD(f, L);
      if (f.limitations) L.push(`_Limitations: ${f.limitations}_`);
      L.push('');
    });
    if (oo) { const oi = M.findingsOf(oo).filter(f => f.inReport); L.push(`## Opponent: ${oo.opponent}`); oppItemsMD(oi, L); }
    const fu = items.filter(f => f.followUp);
    if (opt(meta, 'followups') && fu.length) L.push('## Follow-up list', ...fu.map(f => `- ${f.followUp} (from "${f.title}"; ${[f.followOwner, f.followWhen, f.followStatus].filter(Boolean).join(', ')})`), '');
    L.push(`_${CAVEAT}_`);
    return L.join('\n');
  }
  function present(ws, S, oo) {
    const items = S.items.filter(f => f.inReport), meta = S.meta;
    const r = S.weekly ? Lab.MD.result(S.m, ws.focus, S.rv) : null;
    const slides = [`<div class="slide title"><span class="dam-pin">${S.weekly ? 'Weekly report' : 'Season report'}</span><h1>${S.weekly ? `${U.esc(ws.focus)} v <em>${U.esc(S.opp)}</em>` : `${U.esc(ws.focus)} <em>${U.esc(ws.season)}</em>`}</h1><p>${U.esc([ws.competition, S.m ? S.m.round : ws.season, S.m ? S.m.date : '', S.m ? S.m.venue : ''].filter(Boolean).join(' · '))}${r ? ` · ${r.res} ${U.signed(r.margin)}, ${r.us}-${r.them}` : ''}</p>${meta.intro ? `<p class="lead">${U.esc(meta.intro)}</p>` : ''}</div>`]
      .concat(S.weekly && opt(meta, 'result') && r && r.quarters ? [`<div class="slide"><h2>By quarter</h2>${Lab.MD.chart({ kind: 'mQuarters', matchId: S.m.id })}</div>`] : [])
      .concat(items.map((f, i) => `<div class="slide"><span class="k">Finding ${i + 1} of ${items.length}</span><h2>${U.esc(f.title)}</h2>${f.observation ? `<p class="lead">${U.esc(f.observation)}</p>` : ''}<div class="slide-grid"><div>${chartFor(f) || ''}</div><div>${f.stat ? `<p><span class="lbl-obs">Evidence</span><br>${U.esc(f.stat)}</p>` : ''}${f.interpretation ? `<p><span class="lbl-int">Analyst interpretation</span><br>${U.esc(f.interpretation)}</p>` : ''}${f.question ? `<p><span class="lbl-q">Review question</span><br>${U.esc(f.question)}</p>` : ''}${f.followUp ? `<p><span class="lbl-act">Follow-up focus</span><br>${U.esc(f.followUp)}</p>` : ''}${(f.clipIds || []).length ? `<p class="small">Clips: ${(f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean).map(c => U.esc(c.title)).join('; ')}</p>` : ''}</div></div></div>`))
      .concat(oo ? [`<div class="slide title"><span class="dam-pin">Opponent</span><h1><em>${U.esc(oo.opponent)}</em></h1></div>`].concat(oppSlides(oo, M.findingsOf(oo).filter(f => f.inReport))) : []);
    let i = 0;
    const ov = document.createElement('div'); ov.className = 'present'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Presentation');
    const draw = () => { ov.innerHTML = `${slides[i]}<div class="present-bar"><span>${i + 1} / ${slides.length}</span><span>← → to move · Esc to exit</span><button class="btn sm" data-x>Exit</button></div>`; ov.querySelector('[data-x]').onclick = close; ov.querySelector('[data-x]').focus(); };
    const key = e => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); i = Math.min(slides.length - 1, i + 1); draw(); } else if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); draw(); } else if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', key); ov.remove(); }
    document.addEventListener('keydown', key); document.body.appendChild(ov); draw();
  }

  /* Quick picker: any of our season stats straight into a season finding. */
  function addPanel(ws) {
    const X = Lab.Pack; if (!X || !X.ok) return '';
    const team = X.resolve(ws.focus); if (!team) return '';
    const S = Lab.Season, groups = [...new Set(S.COLUMNS.map(c => c.group))];
    const ros = X.roster(team).filter(p => p.games);
    return `<section class="sec card"><div class="card-h"><div><h2>Add a season stat</h2><p>${U.esc(X.raw.competition + ' ' + X.raw.season)} season data for ${U.esc(team)}. Each one becomes ${ws.kind === 'opp' ? `a ${U.esc(ws.opponent)} finding` : 'a season finding'} you can edit.</p></div></div>
      <div class="grid g2">
        <div><h3>Team</h3><div class="form">
          <label>For or against<select id="aSide"><option value="for">${Lab.isOpp() ? 'Their own' : 'Ours'}</option><option value="against">Conceded</option></select></label>
          <label class="full">Stat<select id="aStat">${groups.map(g => `<optgroup label="${U.esc(g)}">${S.COLUMNS.filter(c => c.group === g).map(c => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        </div><div class="ctl" style="margin-top:8px"><button class="btn g sm" id="aTGo">+ Add team stat</button></div></div>
        <div><h3>Player</h3><div class="form">
          <label class="full">Player<select id="aP">${ros.map(p => `<option value="${U.esc(p.key)}">${U.esc((p.number ? '#' + p.number + ' ' : '') + p.name)}</option>`).join('')}</select></label>
          <label class="full">Stat<select id="aPS">${X.PSTATS.filter(x => x[0] !== 'Matches').map(x => `<option value="${x[0]}">${U.esc(x[1])}</option>`).join('')}</select></label>
        </div><div class="ctl" style="margin-top:8px"><button class="btn g sm" id="aPGo">+ Add player stat</button></div></div>
      </div></section>`;
  }
  function wireAdd(el, ws) {
    const t = U.$('#aTGo', el); if (!t) return;
    const team = Lab.Pack.resolve(ws.focus);
    t.onclick = () => { const id = U.$('#aStat', el).value, side = U.$('#aSide', el).value; const c = Lab.Season.byId.get(id); if (side === 'against' && c.forOnly && !c.againstCol) { U.toast('That stat has no conceded figure', 'warn'); return; } if (Lab.Season.value(Lab.currentSeason(), team, side, id) == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportSeasonStat(team, id, side); };
    const p = U.$('#aPGo', el); if (p) p.onclick = () => { const k = U.$('#aP', el).value, st = U.$('#aPS', el).value, pl = Lab.Pack.player(k); if (!pl.s || pl.s[st] == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportPlayerStat(k, st); };
  }

  Lab.Views.report = {
    render(el) {
      const { w, T, O } = ctx();
      const types = (T ? [['week', 'Weekly'], ['season', 'Season']] : []).concat(O.length ? [['opp', 'Opponent']] : []);
      if (!types.length) { el.innerHTML = `<div class="empty"><h3>Nothing to report yet</h3><p>Choose a team season or an opponent first.</p></div>`; return; }
      if (!vs.repHz && w && w.kind === 'opp' && O.length) vs.repHz = 'opp';
      const isOppRep = vs.repHz === 'opp' ? !!O.length : !T;
      const o = O.find(x => x.id === vs.repOpp) || (w && w.kind === 'opp' ? w : O[0]);
      const S = !isOppRep ? scopeOf(T) : null;
      const withOpp = !isOppRep ? (vs.repWithOpp === undefined ? (w && w.kind === 'opp' ? w : null) : O.find(x => x.id === vs.repWithOpp) || null) : null;
      const hz = isOppRep ? 'opp' : S.weekly ? 'week' : 'season';
      const nSeason = T ? M.wsFindings('', T).length : 0, nWeekly = T ? M.wsFindings(undefined, T).length - nSeason : 0, nOpp = O.reduce((n, x) => n + M.findingsOf(x).length, 0);
      const counts = { week: nWeekly, season: nSeason, opp: nOpp };
      const seg = `<div class="f"><label>Report type</label><span class="seg" role="group" aria-label="Report type">${types.map(([k, l]) => `<button class="${k === hz ? 'on' : ''}" data-rhz="${k}">${l} (${counts[k]})</button>`).join('')}</span></div>`;
      const weekSel = !isOppRep && S.weekly ? `<div class="f"><label for="rScope">Week</label><select id="rScope" style="min-width:240px">${S.ms.slice().reverse().map(m => `<option value="${m.id}" ${m.id === S.id ? 'selected' : ''}>${U.esc(M.matchLabel(m, T.focus))} (${M.weekFindings(m.id, T).length})</option>`).join('')}</select></div>` : '';
      const oppSel = isOppRep ? `<div class="f"><label for="rOppSel">Opponent</label><select id="rOppSel">${O.map(x => `<option value="${x.id}" ${x === o ? 'selected' : ''}>${U.esc(x.opponent)} (${M.findingsOf(x).length})</option>`).join('')}</select></div>`
        : O.length ? `<div class="f"><label for="rWith">Opponent section</label><select id="rWith"><option value="">None</option>${O.map(x => `<option value="${x.id}" ${x === withOpp ? 'selected' : ''}>${U.esc(x.opponent)} (${M.findingsOf(x).length})</option>`).join('')}</select></div>` : '';
      const teamItems = isOppRep ? [] : S.items, oppItems = isOppRep ? M.findingsOf(o) : withOpp ? M.findingsOf(withOpp) : [];
      const meta = isOppRep ? (o.report = o.report || { title: '', intro: '' }) : S.meta;
      const save = isOppRep ? patch => M.updateWorkspace(o.id, { report: Object.assign({}, o.report, patch) }) : S.save;
      const defTitle = isOppRep ? oppTitle(o) : S.defTitle + (withOpp ? ` and ${withOpp.opponent} preview` : '');
      const html = () => isOppRep ? oppBrief(o) : reportHTML(T, S, withOpp);
      const md = () => isOppRep ? oppMarkdown(o) : markdown(T, S, withOpp);
      const pres = () => isOppRep ? oppPresent(o) : present(T, S, withOpp);
      const fname = isOppRep ? `opponent-report-${U.norm(o.opponent)}` : S.weekly ? `weekly-report-${U.norm(S.m.round)}-${U.norm(S.opp)}` : `season-report-${U.norm(T.focus)}`;
      if (vs.reportPreview) {
        el.innerHTML = `<div class="ctl no-print" style="margin-bottom:10px"><button class="btn" id="rBack">← Back to edit</button><button class="btn p" id="rPrint">Print or save as PDF</button><button class="btn" id="rMd">Download Markdown</button><button class="btn g" id="rPres">Present</button></div>${html()}`;
        U.$('#rBack', el).onclick = () => { vs.reportPreview = false; Lab.render(); };
        U.$('#rPrint', el).onclick = () => { el.classList.add('printing'); window.print(); el.classList.remove('printing'); };
        U.$('#rMd', el).onclick = () => U.download(`${fname}-${U.today()}.md`, md(), 'text/markdown;charset=utf-8');
        U.$('#rPres', el).onclick = pres;
        return;
      }
      const inRep = teamItems.concat(oppItems).filter(f => f.inReport), drafts = teamItems.filter(f => f.inReport && f.status !== 'Ready for report').length;
      const hide = meta.hide || {};
      const teamSec = isOppRep ? '' : `<section class="sec card"><div class="card-h"><div><span class="k">Our team · ${S.weekly ? 'weekly' : 'season'}</span><h2>${S.weekly ? `Findings this week (${teamItems.length})` : `Season findings (${teamItems.length})`}</h2><p>${S.weekly ? (S.rv ? 'From the match review and notes for this week.' : 'Notes for this week. Start a match review to add findings straight from the stats.') : 'Add from the Team and Players tabs with +, from Explore with + Finding, or below.'}</p></div><div class="ctl">${S.weekly ? `<button class="btn" id="rToRv">${S.rv ? 'Open match review' : 'Start match review'}</button>` : ''}<button class="btn" id="fBlank">+ ${S.weekly ? 'Weekly' : 'Season'} finding</button></div></div>
        ${teamItems.length ? Lab.findingCards(teamItems) : `<div class="empty"><h3>No findings here yet</h3><p>${S.weekly ? 'Use + next to stats in the match review, or write one from scratch.' : 'Add season stats from the Team and Players tabs, or findings from Explore.'}</p></div>`}</section>`;
      const ob = isOppRep ? o : withOpp;
      const oppSec = !ob ? '' : `<section class="sec card"><div class="card-h"><div><span class="k">Opponent</span><h2>${U.esc(ob.opponent)} (${oppItems.length})</h2><p>Findings from scouting ${U.esc(ob.opponent)}: their stats, analysed games and coding.</p></div><div class="ctl"><button class="btn" id="oBlank">+ Opponent finding</button></div></div>
        ${oppItems.length ? Lab.findingCards(oppItems) : `<div class="empty"><h3>No opponent findings yet</h3><p>In Opponent mode for ${U.esc(ob.opponent)}, use + on their stats, analysed games and coding.</p></div>`}</section>`;
      const panelWs = isOppRep ? (w === o ? o : null) : (!S.weekly && w === T ? T : null);
      el.innerHTML = `
      <section class="card"><div class="card-h"><div><h2>Report</h2><p>One report for coaches from everything you've found. <b>Weekly</b>: one match week of ${T ? U.esc(T.focus) : 'our team'}, the review plus notes. <b>Season</b>: the longer-term picture. <b>Opponent</b>: what you found scouting them. Add an opponent section to a weekly or season report for a review-and-preview in one.</p></div>
        <div class="ctl"><button class="btn g" id="rOpen" ${inRep.length ? '' : 'disabled'}>Preview report</button><button class="btn" id="rPres2" ${inRep.length ? '' : 'disabled'}>Present</button></div></div>
        <div class="f-row" style="margin-bottom:10px">${seg}${weekSel}${oppSel}</div>
        <div class="form"><label>Report title<input id="rTitle" value="${U.esc(meta.title || '')}" placeholder="${U.esc(defTitle)}"></label><label>Summary for coaches (2–3 lines)<input id="rIntro" value="${U.esc(meta.intro || '')}" placeholder="What matters most"></label></div>
        ${isOppRep ? '' : `<div class="ctl" style="margin-top:10px">${(S.weekly ? [['result', 'Result and quarters'], ['coverage', 'Data used']] : []).concat([['followups', 'Follow-up list'], ['clips', 'Clips referenced']]).map(([k, l]) => `<label class="cb"><input type="checkbox" data-show="${k}" ${hide[k] ? '' : 'checked'}> ${l}</label>`).join('')}</div>`}
        ${drafts ? `<p class="warnline">${drafts} finding${drafts === 1 ? ' is' : 's are'} still marked Draft and will show as Draft in the report.</p>` : ''}
      </section>
      ${teamSec}${oppSec}
      ${panelWs ? addPanel(panelWs) : ''}`;
      if (panelWs) wireAdd(el, panelWs);
      U.$$('[data-rhz]', el).forEach(b => b.onclick = () => { vs.repHz = b.dataset.rhz; Lab.render(); });
      const rs = U.$('#rScope', el); if (rs) rs.onchange = e => { vs.repWeek = e.target.value; Lab.render(); };
      const ros = U.$('#rOppSel', el); if (ros) ros.onchange = e => { vs.repOpp = e.target.value; Lab.render(); };
      const rw = U.$('#rWith', el); if (rw) rw.onchange = e => { vs.repWithOpp = e.target.value; Lab.render(); };
      U.$('#rTitle', el).onchange = e => save({ title: e.target.value });
      U.$('#rIntro', el).onchange = e => save({ intro: e.target.value });
      U.$$('[data-show]', el).forEach(c => c.onchange = () => save({ hide: Object.assign({}, hide, { [c.dataset.show]: !c.checked }) }));
      U.$('#rOpen', el).onclick = () => { vs.reportPreview = true; Lab.render(); };
      U.$('#rPres2', el).onclick = pres;
      const tr = U.$('#rToRv', el); if (tr) tr.onclick = () => { toTeam(T); Lab.openReview(S.m.id, S.rv ? 'findings' : undefined); };
      const fb = U.$('#fBlank', el); if (fb) fb.onclick = () => S.weekly ? Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: T.id, matchIds: [S.m.id], week: S.m.id }) : Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: T.id, reviewId: '', week: '' });
      const obb = U.$('#oBlank', el); if (obb) obb.onclick = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', workspaceId: ob.id });
      Lab.wireFindingCards(el);
    }
  };
})(window.Lab);
