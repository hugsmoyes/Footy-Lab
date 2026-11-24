/* Findings and report (Team Lab): evidence-backed findings, then a match review or season review for coaches
   (print/PDF, Markdown, presentation). Season stat helpers add season-level findings. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;

  /* Charts for stat and player findings */
  Lab.statChart = function (ws, spec) {
    const x = M.metric(spec.metricId); if (!x) return '';
    const ser = A.teamSeries(x.id, ws.team, M.wsMatches(ws), spec.period || 'Full');
    return C.line(ser.map(s => s.m.round), [
      { name: ws.team, color: C.COL.opp, values: ser.map(s => A.asNumber(s.for)), tips: ser.map(s => A.fmt(x, s.for)) },
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
    if (/^m[A-Z]/.test(f.chart.kind)) return Lab.MD.chart(f.chart);
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
    if (partial.reviewId == null) {
      const ids = partial.matchIds || [], rv = ids.length === 1 ? M.reviewFor(ids[0]) : null;
      partial.reviewId = rv ? rv.id : '';
    }
    const f = M.addFinding(partial);
    if (!f.limitations) M.updateFinding(f.id, { limitations: autoLimits(f) });
    Lab.openFinding(f.id);
    U.toast(f.reviewId ? 'Finding added to this match review' : 'Season finding added');
  };

  Lab.openFinding = function (id) {
    const f = M.finding(id); if (!f) return;
    const ws = M.ws(), rv = f.reviewId ? M.review(f.reviewId) : null, rm = rv && M.match(rv.matchId);
    const scopeIds = rm ? [rm.id] : (f.matchIds && f.matchIds.length ? f.matchIds : M.wsMatches(ws).map(m => m.id));
    const ids = new Set(scopeIds);
    const clips = M.state.clips.filter(c => ids.has(c.matchId));
    const evs = M.state.events.filter(e => ids.has(e.matchId)).sort((a, b) => a.period - b.period || (A.derive(a).el ?? 0) - (A.derive(b).el ?? 0));
    const linkedEv = new Set(f.eventIds || []);
    const evRows = evs.filter(e => linkedEv.has(e.id)).concat(evs.filter(e => !linkedEv.has(e.id))).slice(0, 300);
    const evLab = e => `Q${e.period} ${e.clock} · ${(M.template(e.templateId) || {}).name || 'Event'} · ${e.team}`;
    const focusOpts = rv ? rv.focus || [] : [];
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${rv ? 'Match review finding · ' + U.esc(M.matchLabel(rm, ws.team)) : 'Season finding'}</span><h2 id="drawerTitle">${U.esc(f.title || 'Untitled')}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b">
        <div class="form"><label class="full">Title<input data-ff="title" value="${U.esc(f.title)}"></label></div>
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

  /* Finding cards, shared by Match review and Findings. */
  Lab.findingCards = function (list) {
    return `<div class="fgrid">${list.map((f, i) => `<div class="fcard ${f.inReport ? '' : 'out'}">
      <div class="fcard-h"><span class="k">${i + 1} · ${U.esc(f.status)}</span><div class="ctl"><button class="btn sm" data-up="${f.id}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="btn sm" data-dn="${f.id}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></div></div>
      <h3>${U.esc(f.title || 'Untitled')} ${evBadge(f.evidenceStatus)}</h3>
      ${f.observation ? `<p><span class="lbl-obs">Observation</span> ${U.esc(f.observation)}</p>` : '<p class="uncoded">No observation written yet</p>'}
      ${f.stat ? `<p class="small"><span class="lbl-obs">Evidence</span> ${U.esc(f.stat)}${f.n != null ? ` (n=${f.n})` : ''}</p>` : ''}
      ${f.question ? `<p class="small"><span class="lbl-q">Review question</span> ${U.esc(f.question)}</p>` : ''}
      ${f.followUp ? `<p class="small"><span class="lbl-act">Follow-up</span> ${U.esc(f.followUp)} <span class="muted">(${U.esc(f.followStatus)})</span></p>` : ''}
      <p class="small muted">${f.interpretation ? 'Interpretation written' : 'No interpretation'} · ${(f.clipIds || []).length} clips · ${(f.eventIds || []).length} events${f.chart ? ' · chart' : ''}</p>
      <div class="ctl"><label class="cb"><input type="checkbox" data-inrep="${f.id}" ${f.inReport ? 'checked' : ''}> In report</label><button class="btn sm g" data-fedit="${f.id}">Open</button></div></div>`).join('')}</div>`;
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
      ${rows.map(f => { const rv = f.reviewId && M.review(f.reviewId), m = rv && M.match(rv.matchId); return `<tr><td class="l wrap"><button class="link" data-fedit="${f.id}">${U.esc(f.title)}</button></td>${showMatch ? `<td class="l">${m ? U.esc(M.matchLabel(m, ws.team)) : '<span class="muted">Season</span>'}</td>` : ''}<td class="l wrap">${U.esc(f.followUp)}</td><td class="l">${U.esc(f.followOwner || '–')}</td><td class="l">${U.esc(f.followWhen || '–')}</td>
        <td class="l"><select class="mini" data-fst="${f.id}" aria-label="Follow-up status">${M.FOLLOW.map(s => `<option ${s === f.followStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`; }).join('') || `<tr><td class="l muted" colspan="${showMatch ? 6 : 5}">No follow-ups recorded.</td></tr>`}
    </tbody></table></div>`;
  };

  /* ---------- Findings tab: every finding for the team season ---------- */
  Lab.Views.findings = {
    render(el, { ws }) {
      const all = M.wsFindings(), revs = M.reviews();
      const st = vs.fdStatus || '', fq = (vs.fdQ || '').toLowerCase();
      const keep = f => (!st || (st === 'open' ? f.followUp && f.followStatus !== 'Done' : f.status === st)) && (!fq || [f.title, f.observation, f.stat, f.interpretation, f.question, f.followUp].join(' ').toLowerCase().includes(fq));
      const groups = [['', 'Season findings', null]].concat(revs.map(r => [r.id, M.matchLabel(M.match(r.matchId), ws.team), r])).map(([id, label, r]) => [id, label, r, M.wsFindings(id).filter(keep)]).filter(g => g[3].length || g[0] === '');
      el.innerHTML = `
      <section class="card"><div class="card-h"><div><h2>Findings</h2><p>${all.length} finding${all.length === 1 ? '' : 's'} across ${revs.length} match review${revs.length === 1 ? '' : 's'} and the season. Each keeps observation and evidence apart from interpretation, review questions and follow-up.</p></div>
        <div class="ctl"><button class="btn g" id="fdNew">+ Season finding</button></div></div>
        <div class="f-row"><div class="f"><label>Show</label><span class="seg">${[['', 'All'], ['Draft', 'Draft'], ['Ready for report', 'Ready'], ['open', 'Open follow-ups']].map(([k, l]) => `<button class="${st === k ? 'on' : ''}" data-fdst="${k}">${l}</button>`).join('')}</span></div>
          <div class="f"><label for="fdQ">Search</label><input type="search" id="fdQ" value="${U.esc(vs.fdQ || '')}"></div></div>
        <ul class="defs" style="margin-top:10px"><li><span class="lbl-obs">Observation</span> what the data or coded events show.</li><li><span class="lbl-obs">Evidence</span> the statistic, count, sample and match behind it.</li><li><span class="lbl-int">Interpretation</span> what the analyst thinks it may mean.</li><li><span class="lbl-q">Review question</span> what to check in footage or discuss.</li><li><span class="lbl-act">Follow-up</span> what staff may revisit in training or a later match.</li></ul>
      </section>
      ${groups.map(([id, label, r, list]) => `<section class="sec card"><div class="card-h"><div><h2>${U.esc(label)}</h2><p>${r ? `${M.wsFindings(id).length} in this review` : 'Not tied to one match: season stats, patterns across games.'}</p></div>${r ? `<div class="ctl"><button class="btn sm" data-openrv="${r.matchId}">Open review</button></div>` : ''}</div>
        ${list.length ? Lab.findingCards(list) : '<p class="muted">None.</p>'}</section>`).join('')}
      <section class="sec card"><div class="card-h"><div><h2>Follow-up tracker</h2><p>Every follow-up focus recorded this season.</p></div></div>${Lab.followTable(all, true)}</section>`;
      U.$('#fdNew', el).onclick = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', reviewId: '' });
      U.$$('[data-fdst]', el).forEach(b => b.onclick = () => { vs.fdStatus = b.dataset.fdst; Lab.render(); });
      let t; const q = U.$('#fdQ', el); q.oninput = () => { clearTimeout(t); t = setTimeout(() => { vs.fdQ = q.value; Lab.render(); const n = U.$('#fdQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
      U.$$('[data-openrv]', el).forEach(b => b.onclick = () => Lab.openReview(b.dataset.openrv, 'findings'));
      Lab.wireFindingCards(el);
    }
  };

  /* ---------- report ---------- */
  function clipLine(c) { return `${c.title} [${M.matchLabel(M.match(c.matchId))} ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}]`; }
  function scopeOf(ws) {
    const id = vs.repScope && M.review(vs.repScope) && M.review(vs.repScope).workspaceId === ws.id ? vs.repScope : '';
    const rv = id ? M.review(id) : null, m = rv ? M.match(rv.matchId) : null;
    const meta = rv ? (rv.report = rv.report || { title: '', intro: '' }) : (ws.report = ws.report || { title: '', intro: '' });
    const opp = m ? M.opponentIn(m, ws.team) : '';
    const defTitle = rv ? `${ws.team} v ${opp}, ${m.round} ${m.season}: match review` : `${ws.team} ${ws.season}: season review`;
    return { id, rv, m, meta, defTitle, opp, items: M.wsFindings(id), save: patch => rv ? M.updateReview(rv.id, { report: Object.assign({}, meta, patch) }) : M.updateWorkspace(ws.id, { report: Object.assign({}, meta, patch) }) };
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
      ${clips.length ? `<p class="small"><b>Clips:</b> ${clips.map(c => U.esc(clipLine(c))).join('; ')}</p>` : ''}${(f.eventIds || []).length ? `<p class="small muted">${f.eventIds.length} linked coded event${f.eventIds.length === 1 ? '' : 's'}.</p>` : ''}
      ${f.limitations ? `<p class="small muted">Limitations: ${U.esc(f.limitations)}</p>` : ''}</div>`;
  }
  function resultBlock(ws, S) {
    const r = Lab.MD.result(S.m, ws.team, S.rv); if (!r) return '<p class="muted">No result entered.</p>';
    return `<p class="lead"><b>${U.esc(ws.team)} ${r.us}</b> ${r.res === 'Win' ? 'defeated' : r.res === 'Loss' ? 'lost to' : 'drew with'} <b>${U.esc(S.opp)} ${r.them}</b> (${r.res} ${U.signed(r.margin)}).</p>
      ${r.quarters ? `<table class="compact"><thead><tr><th class="l">Team</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Final</th></tr></thead><tbody><tr><td class="l">${U.esc(ws.team)}</td>${r.cumUs.map(c => `<td>${Lab.MD.fmtGB(c)}</td>`).join('')}</tr><tr><td class="l">${U.esc(S.opp)}</td>${r.cumThem.map(c => `<td>${Lab.MD.fmtGB(c)}</td>`).join('')}</tr></tbody></table>` : ''}<p class="small muted">Source: ${U.esc(r.src)}.</p>`;
  }
  function coverageBlock(ws, S) {
    const items = Lab.MD.coverage(S.m, ws.team, S.rv);
    return `<table class="compact"><thead><tr><th class="l">Data</th><th class="l">Status</th><th class="l">Detail</th></tr></thead><tbody>${items.map(c => `<tr><td class="l">${U.esc(c.label)}</td><td class="l">${Lab.MD.STATE_LABEL[c.state]}</td><td class="l wrap">${U.esc(c.text)}${c.src ? ` <span class="muted">(${U.esc(c.src)})</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  function seasonBlock(ws) {
    const revs = M.reviews();
    return `<table class="compact"><thead><tr><th class="l">Match</th><th class="l">Result</th><th>Findings</th></tr></thead><tbody>${revs.map(r => { const m = M.match(r.matchId), rr = Lab.MD.result(m, ws.team, r); return `<tr><td class="l">${U.esc(M.matchLabel(m, ws.team))}</td><td class="l">${rr ? `${rr.res} ${U.signed(rr.margin)} (${rr.us}-${rr.them})` : '–'}</td><td>${M.wsFindings(r.id).length}</td></tr>`; }).join('') || '<tr><td class="l muted" colspan="3">No match reviews yet.</td></tr>'}</tbody></table>`;
  }
  function followRows(items) { const rows = items.filter(f => f.followUp); return rows.length ? `<table class="compact"><thead><tr><th class="l">Follow-up focus</th><th class="l">From finding</th><th class="l">Who</th><th class="l">When</th><th class="l">Status</th></tr></thead><tbody>${rows.map(f => `<tr><td class="l wrap">${U.esc(f.followUp)}</td><td class="l wrap">${U.esc(f.title)}</td><td class="l">${U.esc(f.followOwner || '–')}</td><td class="l">${U.esc(f.followWhen || '–')}</td><td class="l">${U.esc(f.followStatus)}</td></tr>`).join('')}</tbody></table>` : ''; }
  const CAVEAT = 'Prepared from built-in season data, imported stats and events coded by club staff. Numbers describe what was recorded, with their sample and source; they do not explain why it happened. Analyst interpretation, review questions and follow-up focus are staff opinion and discussion points, not conclusions or instructions.';

  function reportHTML(ws, S) {
    const items = S.items.filter(f => f.inReport), meta = S.meta;
    const m = S.m;
    const allClips = [...new Set(items.flatMap(f => f.clipIds || []))].map(id => M.state.clips.find(c => c.id === id)).filter(Boolean);
    return `<article class="brief" id="briefDoc">
      <h1>${U.esc(meta.title || S.defTitle)}</h1>
      <div class="bmeta">${S.rv ? 'Internal match review' : 'Internal season review'} · prepared ${U.esc(U.today())} · ${U.esc([ws.competition, m ? m.round : ws.season, m ? m.date : '', m ? m.venue : ''].filter(Boolean).join(' · '))}</div>
      ${meta.intro ? `<p class="lead">${U.esc(meta.intro)}</p>` : ''}
      ${S.rv && opt(meta, 'result') ? `<h2>Result</h2>${resultBlock(ws, S)}` : ''}
      ${S.rv && opt(meta, 'coverage') ? `<h2>Data used</h2>${coverageBlock(ws, S)}` : ''}
      ${!S.rv ? `<h2>Matches reviewed</h2>${seasonBlock(ws)}` : ''}
      <h2>Findings</h2>${items.length ? items.map(findingHTML).join('') : '<p class="muted">No findings selected for the report yet.</p>'}
      ${opt(meta, 'followups') && followRows(items) ? `<h2>Follow-up list</h2>${followRows(items)}` : ''}
      ${opt(meta, 'clips') && allClips.length ? `<h2>Clips referenced</h2><ol class="small">${allClips.map(c => `<li>${U.esc(clipLine(c))}</li>`).join('')}</ol><p class="small muted">Clips are in and out points on the club's own match video. Team Lab doesn't host or edit video.</p>` : ''}
      <p class="caveat">${CAVEAT}</p></article>`;
  }
  function markdown(ws, S) {
    const items = S.items.filter(f => f.inReport), meta = S.meta, L = [`# ${meta.title || S.defTitle}`, `${S.rv ? 'Internal match review' : 'Internal season review'}, prepared ${U.today()}. ${[ws.competition, S.m ? S.m.round : ws.season, S.m ? S.m.date : '', S.m ? S.m.venue : ''].filter(Boolean).join(' · ')}`, ''];
    if (meta.intro) L.push(meta.intro, '');
    if (S.rv && opt(meta, 'result')) { const r = Lab.MD.result(S.m, ws.team, S.rv); if (r) L.push('## Result', `${ws.team} ${r.us}, ${S.opp} ${r.them} (${r.res} ${U.signed(r.margin)}).${r.quarters ? ' By quarter: ' + [0, 1, 2, 3].map(i => `Q${i + 1} ${r.qUs[i]}-${r.qThem[i]}`).join(', ') + '.' : ''} Source: ${r.src}.`, ''); }
    if (S.rv && opt(meta, 'coverage')) L.push('## Data used', ...Lab.MD.coverage(S.m, ws.team, S.rv).map(c => `- ${c.label}: ${Lab.MD.STATE_LABEL[c.state]}. ${c.text}`), '');
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
      if (f.limitations) L.push(`_Limitations: ${f.limitations}_`);
      L.push('');
    });
    const fu = items.filter(f => f.followUp);
    if (opt(meta, 'followups') && fu.length) L.push('## Follow-up list', ...fu.map(f => `- ${f.followUp} (from "${f.title}"; ${[f.followOwner, f.followWhen, f.followStatus].filter(Boolean).join(', ')})`), '');
    L.push(`_${CAVEAT}_`);
    return L.join('\n');
  }
  function present(ws, S) {
    const items = S.items.filter(f => f.inReport), meta = S.meta;
    const r = S.rv ? Lab.MD.result(S.m, ws.team, S.rv) : null;
    const slides = [`<div class="slide title"><span class="dam-pin">${S.rv ? 'Match review' : 'Season review'}</span><h1>${S.rv ? `${U.esc(ws.team)} v <em>${U.esc(S.opp)}</em>` : `${U.esc(ws.team)} <em>${U.esc(ws.season)}</em>`}</h1><p>${U.esc([ws.competition, S.m ? S.m.round : ws.season, S.m ? S.m.date : '', S.m ? S.m.venue : ''].filter(Boolean).join(' · '))}${r ? ` · ${r.res} ${U.signed(r.margin)}, ${r.us}-${r.them}` : ''}</p>${meta.intro ? `<p class="lead">${U.esc(meta.intro)}</p>` : ''}</div>`]
      .concat(S.rv && opt(meta, 'result') && r && r.quarters ? [`<div class="slide"><h2>By quarter</h2>${Lab.MD.chart({ kind: 'mQuarters', matchId: S.m.id })}</div>`] : [])
      .concat(items.map((f, i) => `<div class="slide"><span class="k">Finding ${i + 1} of ${items.length}</span><h2>${U.esc(f.title)}</h2>${f.observation ? `<p class="lead">${U.esc(f.observation)}</p>` : ''}<div class="slide-grid"><div>${chartFor(f) || ''}</div><div>${f.stat ? `<p><span class="lbl-obs">Evidence</span><br>${U.esc(f.stat)}</p>` : ''}${f.interpretation ? `<p><span class="lbl-int">Analyst interpretation</span><br>${U.esc(f.interpretation)}</p>` : ''}${f.question ? `<p><span class="lbl-q">Review question</span><br>${U.esc(f.question)}</p>` : ''}${f.followUp ? `<p><span class="lbl-act">Follow-up focus</span><br>${U.esc(f.followUp)}</p>` : ''}${(f.clipIds || []).length ? `<p class="small">Clips: ${(f.clipIds || []).map(id => M.state.clips.find(c => c.id === id)).filter(Boolean).map(c => U.esc(c.title)).join('; ')}</p>` : ''}</div></div></div>`));
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
    const team = X.resolve(ws.team); if (!team) return '';
    const S = Lab.Season, groups = [...new Set(S.COLUMNS.map(c => c.group))];
    const ros = X.roster(team).filter(p => p.games);
    return `<section class="sec card"><div class="card-h"><div><h2>Add a season stat</h2><p>${U.esc(X.raw.competition + ' ' + X.raw.season)} season data for ${U.esc(team)}. Each one becomes a season finding you can edit.</p></div></div>
      <div class="grid g2">
        <div><h3>Team</h3><div class="form">
          <label>For or against<select id="aSide"><option value="for">Ours</option><option value="against">Conceded</option></select></label>
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
    const team = Lab.Pack.resolve(ws.team);
    t.onclick = () => { const id = U.$('#aStat', el).value, side = U.$('#aSide', el).value; const c = Lab.Season.byId.get(id); if (side === 'against' && c.forOnly && !c.againstCol) { U.toast('That stat has no conceded figure', 'warn'); return; } if (Lab.Season.value(Lab.currentSeason(), team, side, id) == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportSeasonStat(team, id, side); };
    const p = U.$('#aPGo', el); if (p) p.onclick = () => { const k = U.$('#aP', el).value, st = U.$('#aPS', el).value, pl = Lab.Pack.player(k); if (!pl.s || pl.s[st] == null) { U.toast('No value for that stat', 'warn'); return; } Lab.reportPlayerStat(k, st); };
  }

  Lab.Views.report = {
    render(el, { ws }) {
      const S = scopeOf(ws), meta = S.meta, list = S.items, revs = M.reviews();
      const scopeSel = `<div class="f"><label for="rScope">Report</label><select id="rScope"><option value="">Season review (${M.wsFindings('').length} findings)</option>${revs.map(r => `<option value="${r.id}" ${r.id === S.id ? 'selected' : ''}>Match review: ${U.esc(M.matchLabel(M.match(r.matchId), ws.team))} (${M.wsFindings(r.id).length})</option>`).join('')}</select></div>`;
      if (vs.reportPreview) {
        el.innerHTML = `<div class="ctl no-print" style="margin-bottom:10px"><button class="btn" id="rBack">← Back to edit</button><button class="btn p" id="rPrint">Print or save as PDF</button><button class="btn" id="rMd">Download Markdown</button><button class="btn g" id="rPres">Present</button></div>${reportHTML(ws, S)}`;
        U.$('#rBack', el).onclick = () => { vs.reportPreview = false; Lab.render(); };
        U.$('#rPrint', el).onclick = () => { el.classList.add('printing'); window.print(); el.classList.remove('printing'); };
        U.$('#rMd', el).onclick = () => U.download(`${S.rv ? 'match-review-' + U.norm(S.m.round) + '-' + U.norm(S.opp) : 'season-review-' + U.norm(ws.team)}-${U.today()}.md`, markdown(ws, S), 'text/markdown;charset=utf-8');
        U.$('#rPres', el).onclick = () => present(ws, S);
        return;
      }
      const inRep = list.filter(f => f.inReport), drafts = inRep.filter(f => f.status !== 'Ready for report').length;
      const hide = meta.hide || {};
      el.innerHTML = `
      <section class="card"><div class="card-h"><div><h2>Report</h2><p>A concise internal report for coaches: choose the findings, put them in order, then preview, print or save as PDF, download Markdown or present. Match review reports and season reviews are kept apart; neither is an opposition brief.</p></div>
        <div class="ctl"><button class="btn g" id="rOpen" ${inRep.length ? '' : 'disabled'}>Preview report</button><button class="btn" id="rPres2" ${inRep.length ? '' : 'disabled'}>Present</button></div></div>
        <div class="f-row" style="margin-bottom:10px">${scopeSel}</div>
        <div class="form"><label>Report title<input id="rTitle" value="${U.esc(meta.title || '')}" placeholder="${U.esc(S.defTitle)}"></label><label>Summary for coaches (2–3 lines)<input id="rIntro" value="${U.esc(meta.intro || '')}" placeholder="What matters most from this ${S.rv ? 'game' : 'season so far'}"></label></div>
        <div class="ctl" style="margin-top:10px">${(S.rv ? [['result', 'Result and quarters'], ['coverage', 'Data used']] : []).concat([['followups', 'Follow-up list'], ['clips', 'Clips referenced']]).map(([k, l]) => `<label class="cb"><input type="checkbox" data-show="${k}" ${hide[k] ? '' : 'checked'}> ${l}</label>`).join('')}</div>
        ${drafts ? `<p class="warnline">${drafts} finding${drafts === 1 ? ' is' : 's are'} still marked Draft and will show as Draft in the report.</p>` : ''}
      </section>
      <section class="sec card"><div class="card-h"><div><h2>${S.rv ? 'Findings in this match review' : 'Season findings'} (${list.length})</h2><p>${S.rv ? 'Add more from the Match review tab.' : 'Add from the Team and Players tabs with +, from Explore with + Finding, or below.'}</p></div><div class="ctl">${S.rv ? `<button class="btn" id="rToRv">Open match review</button>` : ''}<button class="btn" id="fBlank">+ Blank finding</button></div></div>
        ${list.length ? Lab.findingCards(list) : `<div class="empty"><h3>No findings here yet</h3><p>${S.rv ? 'Use + next to stats in the match review, or write one from scratch.' : 'Add season stats from the Team and Players tabs, or findings from Explore.'}</p></div>`}
      </section>
      ${S.rv ? '' : addPanel(ws)}`;
      wireAdd(el, ws);
      U.$('#rScope', el).onchange = e => { vs.repScope = e.target.value; Lab.render(); };
      U.$('#rTitle', el).onchange = e => S.save({ title: e.target.value });
      U.$('#rIntro', el).onchange = e => S.save({ intro: e.target.value });
      U.$$('[data-show]', el).forEach(c => c.onchange = () => S.save({ hide: Object.assign({}, hide, { [c.dataset.show]: !c.checked }) }));
      U.$('#rOpen', el).onclick = () => { vs.reportPreview = true; Lab.render(); };
      U.$('#rPres2', el).onclick = () => present(ws, S);
      const tr = U.$('#rToRv', el); if (tr) tr.onclick = () => Lab.openReview(S.m.id, 'findings');
      U.$('#fBlank', el).onclick = () => Lab.newFinding({ title: 'New finding', source: 'Analyst observation', reviewId: S.id, matchIds: S.m ? [S.m.id] : [] });
      Lab.wireFindingCards(el);
    }
  };
})(window.Lab);
