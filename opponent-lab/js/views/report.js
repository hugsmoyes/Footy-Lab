/* Findings & report: evidence-backed findings, then a coach brief (print/PDF, Markdown, presentation). */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;
  const STATUS = ['Draft', 'Reviewed on video', 'Final'];
  const CONF = ['', 'Low', 'Medium', 'High'];

  /* Charts for stat and player findings */
  Lab.statChart = function (ws, spec) {
    const x = M.metric(spec.metricId); if (!x) return '';
    const ser = A.teamSeries(x.id, ws.opponent, M.wsMatches(ws), spec.period || 'Full');
    return C.line(ser.map(s => s.m.round), [
      { name: ws.opponent, color: C.COL.opp, values: ser.map(s => A.asNumber(s.for)), tips: ser.map(s => A.fmt(x, s.for)) },
      { name: 'Their opposition', color: C.COL.their, values: ser.map(s => A.asNumber(s.against)), tips: ser.map(s => A.fmt(x, s.against)) }],
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
    return Lab.renderSpec(f.chart);
  }

  function autoLimits(f) {
    const ws = M.ws(), out = [];
    const total = M.wsMatches(ws).length;
    if (f.n != null && f.n < U.SMALL_N) out.push(`Small sample (n=${f.n}).`);
    if (f.matchIds && f.matchIds.length && total && f.matchIds.length < total) out.push(`Covers ${f.matchIds.length} of ${total} included matches.`);
    if (f.chart && f.chart.kind && !['stat', 'player', 'packTeam', 'packPlayer'].includes(f.chart.kind)) out.push('Hand-coded events; definitions on the Code tab.');
    return out.join(' ');
  }

  /* ---------- season data into the report ---------- */
  const seasonSrc = () => { const X = Lab.Pack; return `${X.raw.competition} ${X.raw.season} season data`; };
  function addStat(partial) { Lab.newFinding(Object.assign({ inReport: true, status: 'Final' }, partial)); }
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

  /* Create (or edit) a finding. partial: {title, stat, n, matchIds, source, chart, eventIds, clipIds} */
  Lab.newFinding = function (partial) {
    const f = M.addFinding(Object.assign({ observation: '', limitations: '' }, partial));
    if (!f.limitations) M.updateFinding(f.id, { limitations: autoLimits(f) });
    Lab.openFinding(f.id);
    U.toast(f.inReport ? 'Added to the report' : 'Finding saved as a draft');
  };
  Lab.openFinding = function (id) {
    const f = M.state.findings.find(x => x.id === id); if (!f) return;
    const ws = M.ws();
    const ids = new Set(M.wsMatches(ws).concat(M.ourMatches(ws)).map(m => m.id));
    const clips = M.state.clips.filter(c => ids.has(c.matchId));
    const evClips = new Set(M.state.clips.filter(c => (f.eventIds || []).includes(c.eventId)).map(c => c.id));
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Finding</span><h2 id="drawerTitle">${U.esc(f.title || 'Untitled')}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b"><div class="form">
        <label class="full">Title<input data-ff="title" value="${U.esc(f.title)}"></label>
        <label class="full"><span class="lbl-obs">Observation · what the data shows</span><textarea data-ff="observation" placeholder="One plain sentence a coach can read in five seconds, e.g. Kick-ins go short to the left pocket most of the time.">${U.esc(f.observation)}</textarea></label>
        <label class="full"><span class="lbl-obs">Statistic / count</span><textarea data-ff="stat">${U.esc(f.stat)}</textarea></label>
        <label>Sample (n)<input data-ff="n" value="${f.n == null ? '' : f.n}" inputmode="numeric"></label>
        <label>Status<select data-ff="status">${STATUS.map(s => `<option ${s === f.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="full">Source and matches<input data-ff="source" value="${U.esc(f.source)}"></label>
        <label class="full"><span class="lbl-int">Analyst interpretation · opinion</span><textarea data-ff="interpretation" placeholder="What you think it means, after watching the vision.">${U.esc(f.interpretation)}</textarea></label>
        <label class="full"><span class="lbl-act">Coaching question / preparation point</span><textarea data-ff="coaching" placeholder="What coaches could review or prepare.">${U.esc(f.coaching)}</textarea></label>
        <label>Confidence<select data-ff="confidence">${CONF.map(s => `<option value="${s}" ${s === f.confidence ? 'selected' : ''}>${s || 'Not set'}</option>`).join('')}</select></label>
        <label class="cb" style="align-self:end"><input type="checkbox" data-ff="inReport" ${f.inReport ? 'checked' : ''}> Include in report</label>
        <label class="full">Limitations<textarea data-ff="limitations">${U.esc(f.limitations)}</textarea></label>
        ${f.chart ? `<label class="cb full"><input type="checkbox" data-ff="hideChart" ${f.hideChart ? 'checked' : ''}> Leave the chart out of the report</label>` : ''}
      </div>
      <p class="sub">Matches: ${(f.matchIds || []).map(mid => U.esc(M.matchLabel(M.match(mid), ws.opponent))).join(', ') || 'none recorded'} · Linked events: ${(f.eventIds || []).length}</p>
      <h3 style="margin-top:12px">Clips</h3>${clips.length ? `<div class="chk-grid">${clips.map(c => `<label><input type="checkbox" data-fc value="${c.id}" ${(f.clipIds || []).includes(c.id) ? 'checked' : ''}> ${U.esc(c.title)}${evClips.has(c.id) ? ' <span class="badge2 clip">linked event</span>' : ''}</label>`).join('')}</div>` : '<p class="muted">No clips yet for these matches.</p>'}
      ${f.chart ? `<h3 style="margin-top:12px">Chart (redrawn from current data)</h3><div class="mini-chart">${chartFor(Object.assign({}, f, { hideChart: false }))}</div>` : ''}
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="fSaveF">Save</button><button class="btn danger sm" id="fDelF">Delete finding</button></div></div>`, d => {
      U.$('#fSaveF', d).onclick = () => {
        const p = {};
        U.$$('[data-ff]', d).forEach(i => { const k = i.dataset.ff; p[k] = i.type === 'checkbox' ? i.checked : k === 'n' ? (i.value.trim() === '' ? null : parseInt(i.value, 10)) : i.value; });
        p.clipIds = U.$$('[data-fc]', d).filter(c => c.checked).map(c => c.value);
        M.updateFinding(id, p); Lab.closeDrawer(); U.toast('Saved');
      };
      U.$('#fDelF', d).onclick = () => { if (confirm('Delete this finding?')) { M.removeFinding(id); Lab.closeDrawer(); } };
    });
  };

  function clipLine(c) { return `${c.title} [${M.matchLabel(M.match(c.matchId))} ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}]`; }
  function coverageTable(ws) {
    const ms = M.wsMatches(ws), opp = ws.opponent;
    return `<table class="compact"><thead><tr><th class="l">Match</th><th class="l">Result</th><th>Coded events</th><th>Clips</th></tr></thead><tbody>
      ${ms.map(m => { const u = M.matchUsage(m.id), r = M.result(m, opp); return `<tr><td class="l">${U.esc(M.matchLabel(m, opp))}</td><td class="l">${r ? `${r.res} ${U.signed(r.margin)}` : '<span class="muted">–</span>'}</td><td>${u.events || '–'}</td><td>${u.clips || '–'}</td></tr>`; }).join('') || '<tr><td class="l muted" colspan="4">No matches reviewed</td></tr>'}</tbody></table>`;
  }

  function reportHTML(ws) {
    const items = M.wsFindings().filter(f => f.inReport);
    const r = ws.report || {};
    return `<article class="brief" id="briefDoc">
      <h1>${U.esc(r.title || `${ws.ourTeam || 'Us'} v ${ws.opponent}: opposition brief`)}</h1>
      <div class="bmeta">Opposition brief · prepared ${U.esc(U.today())}${[ws.competition, ws.season, ws.round, ws.date, ws.venue].filter(Boolean).length ? ' · ' + [ws.competition, ws.season, ws.round, ws.date, ws.venue].filter(Boolean).map(U.esc).join(' · ') : ''}</div>
      ${r.intro ? `<p class="lead">${U.esc(r.intro)}</p>` : ''}
      ${M.wsMatches(ws).length ? `<h2>Matches reviewed</h2>${coverageTable(ws)}` : ''}
      <h2>Findings</h2>
      ${items.length ? items.map((f, i) => { const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean); return `<div class="item">
        <h3>${i + 1}. ${U.esc(f.title || 'Untitled')}${f.confidence ? ` <span class="conf conf-${f.confidence}">${f.confidence} confidence</span>` : ''}</h3>
        ${f.observation ? `<p class="obs">${U.esc(f.observation)}</p>` : ''}
        ${f.stat ? `<p><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` <span class="muted">(n=${f.n}${f.n < U.SMALL_N ? ', small' : ''})</span>` : ''}</p>` : ''}
        ${chartFor(f) ? `<div class="rep-chart">${chartFor(f)}</div>` : ''}
        ${f.interpretation ? `<p><span class="lbl-int">Analyst read</span> ${U.esc(f.interpretation)}</p>` : ''}
        ${f.coaching ? `<p><span class="lbl-act">For coaches</span> ${U.esc(f.coaching)}</p>` : ''}
        ${clips.length ? `<p class="small"><b>Clips:</b> ${clips.map(c => U.esc(clipLine(c))).join('; ')}</p>` : ''}
        <p class="small muted">${f.source ? U.esc(f.source) + '. ' : ''}${f.limitations ? 'Limitations: ' + U.esc(f.limitations) : ''}${f.status !== 'Final' ? ` · Status: ${U.esc(f.status)}` : ''}</p></div>`; }).join('') : '<p class="muted">No findings selected for the report yet.</p>'}
      ${M.state.playlists.filter(p => p.workspaceId === ws.id && p.clipIds.length).map(p => `<h2>Video: ${U.esc(p.name)}</h2><ol class="small">${p.clipIds.map(id => M.state.clips.find(c => c.id === id)).filter(Boolean).map(c => `<li>${U.esc(clipLine(c))}</li>`).join('')}</ol>`).join('')}
      <p class="caveat">Statistics come from the season data and from events coded by club staff. Averages and rates describe past games with their sample sizes; they are not predictions. "Analyst read" and "For coaches" are opinion.</p></article>`;
  }

  function markdown(ws) {
    const items = M.wsFindings().filter(f => f.inReport), r = ws.report || {};
    const L = [`# ${r.title || `${ws.ourTeam || 'Us'} v ${ws.opponent}: opposition brief`}`, `Opposition brief, ${U.today()}. ${[ws.competition, ws.season, ws.round, ws.date, ws.venue].filter(Boolean).join(' · ')}`, ''];
    if (r.intro) L.push(r.intro, '');
    if (M.wsMatches(ws).length) L.push('## Matches reviewed', ...M.wsMatches(ws).map(m => { const u = M.matchUsage(m.id), res = M.result(m, ws.opponent); return `- ${M.matchLabel(m, ws.opponent)}: ${res ? res.res + ' ' + U.signed(res.margin) + '; ' : ''}${u.events} coded events; ${u.clips} clips`; }), '');
    L.push('## Findings');
    items.forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.title}${f.confidence ? ` (${f.confidence} confidence)` : ''}`);
      if (f.observation) L.push(f.observation);
      if (f.stat) L.push(`**Evidence:** ${f.stat}${f.n != null ? ` (n=${f.n})` : ''}`);
      if (f.interpretation) L.push(`**Analyst read:** ${f.interpretation}`);
      if (f.coaching) L.push(`**For coaches:** ${f.coaching}`);
      const clips = (f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean);
      if (clips.length) L.push(`Clips: ${clips.map(clipLine).join('; ')}`);
      if (f.limitations) L.push(`_Limitations: ${f.limitations}_`);
      L.push('');
    });
    L.push('_Season data and staff-coded events. Descriptive, not predictions. Analyst read and coaching points are opinion._');
    return L.join('\n');
  }

  function present(ws) {
    const items = M.wsFindings().filter(f => f.inReport);
    const r = ws.report || {};
    const slides = [`<div class="slide title"><span class="dam-pin">Opposition brief</span><h1>${U.esc(ws.ourTeam || 'Us')} v <em>${U.esc(ws.opponent)}</em></h1><p>${[ws.competition, ws.season, ws.round, ws.date, ws.venue].filter(Boolean).map(U.esc).join(' · ')}</p>${r.intro ? `<p class="lead">${U.esc(r.intro)}</p>` : ''}</div>`,
      `<div class="slide">${M.wsMatches(ws).length ? `<h2>Matches reviewed</h2>${coverageTable(ws)}` : ''}</div>`]
      .concat(items.map((f, i) => `<div class="slide"><span class="k">Finding ${i + 1} of ${items.length}</span><h2>${U.esc(f.title)}</h2>${f.observation ? `<p class="lead">${U.esc(f.observation)}</p>` : ''}<div class="slide-grid"><div>${chartFor(f) || ''}</div><div>${f.stat ? `<p><span class="lbl-obs">Evidence</span><br>${U.esc(f.stat)}</p>` : ''}${f.coaching ? `<p><span class="lbl-act">For coaches</span><br>${U.esc(f.coaching)}</p>` : ''}${f.interpretation ? `<p><span class="lbl-int">Analyst read</span><br>${U.esc(f.interpretation)}</p>` : ''}${(f.clipIds || []).length ? `<p class="small">Clips: ${(f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean).map(c => U.esc(c.title)).join('; ')}</p>` : ''}</div></div></div>`));
    let i = 0;
    const ov = document.createElement('div'); ov.className = 'present'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Presentation');
    const draw = () => { ov.innerHTML = `${slides[i]}<div class="present-bar"><span>${i + 1} / ${slides.length}</span><span>← → to move · Esc to exit</span><button class="btn sm" data-x>Exit</button></div>`; ov.querySelector('[data-x]').onclick = close; };
    const key = e => { if (e.key === 'ArrowRight' || e.key === ' ') { i = Math.min(slides.length - 1, i + 1); draw(); } else if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); draw(); } else if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', key); ov.remove(); }
    document.addEventListener('keydown', key); document.body.appendChild(ov); draw();
  }

  /* Quick picker: any team or player stat straight into the report. */
  function addPanel(ws) {
    const X = Lab.Pack; if (!X || !X.ok) return '';
    const opp = X.resolve(ws.opponent), us = X.resolve(ws.ourTeam); if (!opp) return '';
    const S = Lab.Season, groups = [...new Set(S.COLUMNS.map(c => c.group))];
    const teams = [opp].concat(us && us !== opp ? [us] : []);
    const ros = X.roster(opp).filter(p => p.games);
    return `<section class="sec card"><div class="card-h"><div><h2>Add a stat</h2><p>${U.esc(X.raw.season)} season data. Each one is added as a report item you can edit.</p></div></div>
      <div class="grid g2">
        <div><h3>Team</h3><div class="form">
          <label>Club<select id="aT">${teams.map(t => `<option>${U.esc(t)}</option>`).join('')}</select></label>
          <label>For or against<select id="aSide"><option value="for">Their own</option><option value="against">Conceded</option></select></label>
          <label class="full">Stat<select id="aStat">${groups.map(g => `<optgroup label="${U.esc(g)}">${S.COLUMNS.filter(c => c.group === g).map(c => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        </div><div class="ctl" style="margin-top:8px"><button class="btn g sm" id="aTGo">+ Add team stat</button></div></div>
        <div><h3>Player</h3><div class="form">
          <label class="full">Player<select id="aP">${ros.map(p => `<option value="${U.esc(p.key)}">${U.esc((p.number ? '#' + p.number + ' ' : '') + p.name)}</option>`).join('')}</select></label>
          <label class="full">Stat<select id="aPS">${X.PSTATS.filter(x => x[0] !== 'Matches').map(x => `<option value="${x[0]}">${U.esc(x[1])}</option>`).join('')}</select></label>
        </div><div class="ctl" style="margin-top:8px"><button class="btn g sm" id="aPGo">+ Add player stat</button></div></div>
      </div></section>`;
  }
  function wireAdd(el) {
    const t = U.$('#aTGo', el); if (!t) return;
    t.onclick = () => { const team = U.$('#aT', el).value, id = U.$('#aStat', el).value, side = U.$('#aSide', el).value; const c = Lab.Season.byId.get(id); if (side === 'against' && c.forOnly && !c.againstCol) { U.toast('That stat has no conceded figure', 'warn'); return; } if (Lab.Season.value(Lab.currentSeason(), team, side, id) == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportSeasonStat(team, id, side); };
    const p = U.$('#aPGo', el); if (p) p.onclick = () => { const k = U.$('#aP', el).value, st = U.$('#aPS', el).value, pl = Lab.Pack.player(k); if (!pl.s || pl.s[st] == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportPlayerStat(k, st); };
  }

  Lab.Views.report = {
    render(el, { ws }) {
      const list = M.wsFindings();
      ws.report = ws.report || { title: '', intro: '' };
      if (vs.reportPreview) {
        el.innerHTML = `<div class="ctl no-print" style="margin-bottom:10px"><button class="btn" id="rBack">← Back</button><button class="btn p" id="rPrint">Print or save as PDF</button><button class="btn" id="rMd">Download Markdown</button><button class="btn g" id="rPres">Present</button></div>${reportHTML(ws)}`;
        U.$('#rBack', el).onclick = () => { vs.reportPreview = false; Lab.render(); };
        U.$('#rPrint', el).onclick = () => { el.classList.add('printing'); window.print(); el.classList.remove('printing'); };
        U.$('#rMd', el).onclick = () => U.download(`brief-${U.norm(ws.opponent)}-${U.today()}.md`, markdown(ws), 'text/markdown;charset=utf-8');
        U.$('#rPres', el).onclick = () => present(ws);
        return;
      }
      el.innerHTML = `
      <section class="card"><div class="card-h"><div><h2>Report</h2><p>Choose what goes to the coaches, put it in order, then preview, print, export or present.</p></div>
        <div class="ctl"><button class="btn g" id="rOpen" ${list.some(f => f.inReport) ? '' : 'disabled'}>Preview report</button><button class="btn" id="rPres2" ${list.some(f => f.inReport) ? '' : 'disabled'}>Present</button></div></div>
        <div class="form"><label>Report title<input id="rTitle" value="${U.esc(ws.report.title || '')}" placeholder="${U.esc((ws.ourTeam || 'Us') + ' v ' + ws.opponent + ': opposition brief')}"></label><label>Summary for coaches (2–3 lines)<input id="rIntro" value="${U.esc(ws.report.intro || '')}" placeholder="The three things that matter most this week"></label></div></section>
      <section class="sec card"><div class="card-h"><div><h2>Report items (${list.length})</h2><p>Add from the Team and Players tabs with <b>+</b>, from Explore with <b>+ Finding</b>, or below.</p></div><div class="ctl"><button class="btn" id="fBlank">+ Blank item</button></div></div>
        ${list.length ? `<div class="fgrid">${list.map((f, i) => `<div class="fcard ${f.inReport ? '' : 'out'}">
          <div class="fcard-h"><span class="k">${i + 1} · ${U.esc(f.status)}${f.confidence ? ' · ' + f.confidence + ' confidence' : ''}</span><div class="ctl"><button class="btn sm" data-up="${f.id}" ${i ? '' : 'disabled'}>↑</button><button class="btn sm" data-dn="${f.id}" ${i < list.length - 1 ? '' : 'disabled'}>↓</button></div></div>
          <h3>${U.esc(f.title || 'Untitled')}</h3>
          ${f.observation ? `<p>${U.esc(f.observation)}</p>` : f.stat ? '' : '<p class="uncoded">No observation written yet</p>'}
          ${f.stat ? `<p class="small"><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` (n=${f.n})` : ''}</p>` : ''}
          <p class="small">${f.interpretation ? '<span class="lbl-int">Read</span> ✓ ' : '<span class="muted">No interpretation</span> · '}${f.coaching ? '<span class="lbl-act">Coaching</span> ✓ ' : '<span class="muted">No coaching point</span> · '}${(f.clipIds || []).length} clips${f.chart ? ' · chart' : ''}</p>
          <div class="ctl"><label class="cb"><input type="checkbox" data-inrep="${f.id}" ${f.inReport ? 'checked' : ''}> In report</label><button class="btn sm g" data-fedit="${f.id}">Open</button></div></div>`).join('')}</div>`
          : `<div class="empty"><h3>Nothing in the report yet</h3><p>Add team and player stats from the Opponent tabs or the panel below, and findings from your coding in Explore.</p><div class="ctl"><button class="btn g" onclick="Lab.go('team')">Team</button><button class="btn" onclick="Lab.go('players')">Players</button><button class="btn" onclick="Lab.go('explore')">Explore</button></div></div>`}
      </section>
      ${addPanel(ws)}`;
      wireAdd(el, ws);
      const saveMeta = () => M.updateWorkspace(ws.id, { report: Object.assign({}, ws.report, { title: U.$('#rTitle', el).value, intro: U.$('#rIntro', el).value }) });
      U.$('#rTitle', el).onchange = saveMeta; U.$('#rIntro', el).onchange = saveMeta;
      const ro = U.$('#rOpen', el); ro.onclick = () => { vs.reportPreview = true; Lab.render(); };
      U.$('#rPres2', el).onclick = () => present(ws);
      U.$('#fBlank', el).onclick = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation' });
      U.$$('[data-fedit]', el).forEach(b => b.onclick = () => Lab.openFinding(b.dataset.fedit));
      U.$$('[data-up]', el).forEach(b => b.onclick = () => M.moveFinding(b.dataset.up, -1));
      U.$$('[data-dn]', el).forEach(b => b.onclick = () => M.moveFinding(b.dataset.dn, 1));
      U.$$('[data-inrep]', el).forEach(c => c.onchange = () => M.updateFinding(c.dataset.inrep, { inReport: c.checked }));
    }
  };
})(window.Lab);
