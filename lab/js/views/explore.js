/* Explore: coded events for the workspace, with one set of filters driving every chart and table.
   Each chart can be saved as a finding; the report re-draws it from the same spec. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;
  const SUCCESS_GUESS = ['Goal', 'Won', 'Yes', 'Team', 'Mark', 'Retained', 'Contest won', 'Ground ball won', 'Regained'];

  /* ---------- chart renderers (pure: spec + events -> html) ---------- */
  function outcomeField(tpl) { return tpl.fields.find(f => f.type === 'choice' && /result|outcome/i.test(f.key + ' ' + f.label)) || tpl.fields.find(f => f.type === 'choice'); }
  function defaults(tpl) {
    const d = A.dims(tpl);
    const own = d.filter(x => x.field && x.field.type === 'choice');
    const of = outcomeField(tpl);
    return {
      by: (own[0] || d[0]).key, split: (own.find(x => !of || x.key !== of.key) || d[1]).key,
      outcome: of ? of.key : '', success: of ? (of.options || []).filter(o => SUCCESS_GUESS.includes(o)).slice(0, 2) : [],
      xr: (own[0] || d[1]).key, xc: (own[1] || own[0] || d[0]).key,
      flow: own.slice(0, 3).map(x => x.key)
    };
  }
  function label(d, k) { return (d.find(x => x.key === k) || { label: k }).label; }
  function orderOf(d, k) { return (d.find(x => x.key === k) || {}).order; }

  const R = {};
  R.breakdown = (ws, tpl, evs, p) => {
    const d = A.dims(tpl, ws), c = A.counts(evs, p.by, ws, orderOf(d, p.by));
    return C.bars(c.rows.map(r => ({ label: r.label, r: r.r, attrs: `data-pick="${U.esc(p.by)}" data-val="${U.esc(r.value)}"` })), { click: true, emptyTitle: 'Nothing coded for this field', emptyMsg: 'No filtered event has a value here.', need: label(d, p.by) + ' coded' })
      + `<p class="sub">Share of ${c.coded} events with ${U.esc(label(d, p.by).toLowerCase())} coded${c.uncoded ? `; ${c.uncoded} uncoded left out` : ''}.</p>`;
  };
  R.rate = (ws, tpl, evs, p) => {
    if (!p.outcome || !p.success || !p.success.length) return C.empty('Choose an outcome', 'Pick the field and the value(s) that count as success.');
    const d = A.dims(tpl, ws), r = A.rateBy(evs, p.split, p.outcome, p.success, ws, orderOf(d, p.split));
    if (!r.all.den) return C.empty(`${label(d, p.outcome)} not coded yet`, `None of these ${evs.length} events has ${label(d, p.outcome).toLowerCase()} coded, so no rate can be shown.`, label(d, p.outcome) + ' coded');
    return `<p class="sub" style="margin:0 0 6px">Rate of <b>${U.esc(p.success.join(' or '))}</b> (${U.esc(label(d, p.outcome))}) · overall ${r.all.num}/${r.all.den} = ${U.pct(r.all.p)}</p>`
      + C.bars(r.rows.map(x => ({ label: x.label, r: x.r, attrs: `data-pick="${U.esc(p.split)}" data-val="${U.esc(x.value)}"` })), { ci: true, max: 1, click: true, emptyTitle: 'No events with this outcome coded' })
      + `<p class="sub">Bars show the rate with its 95% interval (thin band). Denominator = events with ${U.esc(label(d, p.outcome).toLowerCase())} coded${r.uncodedOutcome ? `; ${r.uncodedOutcome} without it left out` : ''}${r.uncodedSplit ? `; ${r.uncodedSplit} without ${U.esc(label(d, p.split).toLowerCase())}` : ''}.</p>`;
  };
  R.trend = (ws, tpl, evs, p) => {
    const ms = M.wsMatches(ws);
    const per = ms.map(m => evs.filter(e => e.matchId === m.id));
    const counts = per.map(x => x.length);
    if (!counts.some(Boolean)) return C.empty('No events in these matches', '', 'coded events');
    const series = [{ name: 'Events coded', color: C.COL.their, values: counts.map(n => n || null), tips: counts.map(n => n + ' events') }];
    let rateLine = '';
    if (p.outcome && p.success && p.success.length) {
      const rates = per.map(x => { const den = x.filter(e => A.val(e, p.outcome, ws) !== ''); return U.rate(den.filter(e => p.success.includes(A.val(e, p.outcome, ws))).length, den.length); });
      rateLine = `<h4>Rate of ${U.esc(p.success.join(' or '))} by match</h4>` + C.line(ms.map(m => m.round), [{ name: ws.focus, color: C.COL.opp, values: rates.map(r => r.den ? r.p : null), tips: rates.map(r => r.den ? `${r.num}/${r.den} = ${U.pct(r.p)}` : 'not coded') }], { min: 0, max: 1, fmt: v => U.pct(v), aria: 'Rate by match' });
    }
    return `<h4>Events coded per match</h4>` + C.grouped(ms.map(m => m.round), series, { fmt: v => U.round(v, 0), aria: 'Events per match' }) + `<p class="sub">How much was coded, not how often it happened: a match coded in part shows fewer events.</p>` + rateLine;
  };
  R.quarter = (ws, tpl, evs, p) => {
    const qs = ['Q1', 'Q2', 'Q3', 'Q4'];
    const by = qs.map(q => evs.filter(e => 'Q' + e.period === q));
    if (!evs.length) return C.empty();
    const series = [{ name: 'Events', color: C.COL.their, values: by.map(x => x.length), tips: by.map(x => x.length + ' events') }];
    let out = C.grouped(qs, series, { fmt: v => U.round(v, 0) });
    if (p.outcome && p.success && p.success.length) {
      const rates = by.map(x => { const den = x.filter(e => A.val(e, p.outcome, ws) !== ''); return U.rate(den.filter(e => p.success.includes(A.val(e, p.outcome, ws))).length, den.length); });
      out += `<div class="qrates">${qs.map((q, i) => `<span><b>${q}</b> ${rates[i].den ? `${U.pct(rates[i].p)} <i>${rates[i].num}/${rates[i].den}</i>` : '–'}</span>`).join('')}</div><p class="sub">Rate of ${U.esc(p.success.join(' or '))} in each quarter (all included matches pooled).</p>`;
    }
    return out;
  };
  R.crosstab = (ws, tpl, evs, p) => {
    const d = A.dims(tpl, ws), x = A.crosstab(evs, p.xr, p.xc, ws, orderOf(d, p.xr), orderOf(d, p.xc));
    if (!x.rows.length || !x.cols.length) return C.empty('Nothing to cross-tabulate', 'Both fields need values.');
    const max = Math.max(1, ...x.rows.flatMap(r => x.cols.map(c => x.cell(r.value, c.value).length)));
    return `<div class="tw"><table class="xt"><thead><tr><th class="l">${U.esc(label(d, p.xr))} ↓ · ${U.esc(label(d, p.xc))} →</th>${x.cols.map(c => `<th>${U.esc(c.label)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${x.rows.map(r => `<tr><td class="l"><b>${U.esc(r.label)}</b></td>${x.cols.map(c => { const n = x.cell(r.value, c.value).length; return `<td class="cell" data-xr="${U.esc(r.value)}" data-xc="${U.esc(c.value)}" style="background:rgba(19,122,64,${(n / max * .55).toFixed(3)});${n / max > .6 ? 'color:#fff' : ''}" data-tip="${U.esc(`<b>${U.esc(r.label)} × ${U.esc(c.label)}</b><br>${n} of ${r.n} (${U.pct(r.n ? n / r.n : null)})`)}">${n || '·'}${n ? `<span class="cp">${U.pct(n / r.n)}</span>` : ''}</td>`; }).join('')}<td>${r.n}</td></tr>`).join('')}
    </tbody></table></div><p class="sub">Cell % = share of its row. Events missing either field are left out.</p>`;
  };
  R.flow = (ws, tpl, evs, p) => { const d = A.dims(tpl, ws); const keys = (p.flow || []).filter(Boolean); if (keys.length < 2) return C.empty('Pick at least two fields', 'A flow shows how events move from one coded value to the next.'); const f = A.flow(evs, keys, ws, tpl); return C.flow(f, keys.map(k => label(d, k))) + (f.n ? `<p class="sub">${f.n} events with every stage coded${f.excluded ? `; ${f.excluded} left out` : ''}. Line width = number of events.</p>` : ''); };
  R.zones = (ws, tpl, evs, p) => {
    const zf = tpl.fields.filter(f => f.type === 'zone'); if (!zf.length) return C.empty('No zone field in this template', 'Add a "Ground zone" field to the template to map where events happen.', 'a zone field');
    const key = p.zone || zf[0].key, z = A.zoneCounts(evs, key);
    return `${zf.length > 1 ? '' : ''}<div class="zone-wrap">${C.zoneMap(z.c, z.coded)}</div><p class="sub">${z.coded} events with ${U.esc(zf.find(f => f.key === key).label.toLowerCase())} coded${z.uncoded ? `; ${z.uncoded} uncoded not shown` : ''}. Zones are coded by the analyst, relative to the team in possession attacking up the page. Not tracking data.</p>`;
  };
  R.sequence = (ws, tpl, evs, p) => {
    const cf = tpl.fields.find(f => f.type === 'chain'), zf = tpl.fields.find(f => f.type === 'zone');
    if (!cf || !zf) return C.empty('No sequence fields', 'Sequences need a chain-number field and a zone field (see the "Ball movement" starter template).', 'chain number and zone');
    const seqs = A.sequences(evs, cf.key, zf.key);
    if (!seqs.length) return C.empty('No chains coded yet', 'Code actions with the same chain number to draw the ball\'s path.', 'actions with a chain number');
    const s = seqs.find(x => x.key === p.seq) || seqs[0];
    const af = tpl.fields.find(f => f.type === 'choice');
    const lbl = e => [af && e.v[af.key], tpl.fields.find(f => f.type === 'player') && M.playerName(e.v[tpl.fields.find(f => f.type === 'player').key])].filter(Boolean).join(' · ') || 'Action';
    return `<div class="ctl" style="margin-bottom:6px"><select data-seq aria-label="Chain">${seqs.map(x => `<option value="${U.esc(x.key)}" ${x.key === s.key ? 'selected' : ''}>${U.esc(M.matchLabel(M.match(x.matchId), ws.focus))} · chain ${U.esc(x.chain)} (${x.steps.length} actions)</option>`).join('')}</select></div>
      <div class="zone-wrap">${C.sequenceMap(s.steps, zf.key, lbl)}</div><p class="sub">${s.zoned} of ${s.steps.length} actions have a zone. Order = coded clock order. Positions inside a zone are spread for legibility, not measured.</p>`;
  };
  R.players = (ws, tpl, evs, p) => {
    const inv = A.involvement(evs, tpl);
    if (!inv.fields.length) return C.empty('No player fields in this template');
    if (!inv.rows.length) return C.empty('No players named yet', 'Code player fields to see involvement.', 'player fields coded');
    const mu = A.matchups(evs, tpl, ws);
    return C.bars(inv.rows.slice(0, 15).map(r => ({ label: r.name, value: r.total, n: r.total, tip: `<b>${U.esc(r.name)}</b><br>${Object.entries(r.byField).map(([k, v]) => `${U.esc(k)}: ${v}`).join('<br>')}`, attrs: `data-player="${U.esc(r.id)}"` })), { click: true, fmt: v => v + ' events' })
      + `<p class="sub">Times named in any player field (${U.esc(inv.fields.join(', '))}). A count of involvement in coded events, not a rating.</p>`
      + (mu && mu.rows.length ? `<h4>Matchups: ${U.esc(mu.forLabel)} v ${U.esc(mu.againstLabel)}</h4><div class="tw"><table class="compact"><thead><tr><th class="l">${U.esc(mu.forLabel)}</th><th class="l">${U.esc(mu.againstLabel)}</th><th>Events</th>${mu.outcomeLabel ? `<th class="l">${U.esc(mu.outcomeLabel)}</th>` : ''}</tr></thead><tbody>${mu.rows.slice(0, 12).map(r => `<tr><td class="l">${U.esc(M.playerName(r.a))}</td><td class="l">${U.esc(M.playerName(r.b))}</td><td>${r.n}</td>${mu.outcomeLabel ? `<td class="l">${Object.entries(r.outcomes).map(([k, v]) => `${U.esc(k)} ${v}`).join(', ') || '<span class="muted">not coded</span>'}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '');
  };
  R.timeline = (ws, tpl, evs, p) => {
    if (!evs.length) return C.empty();
    const byM = U.groupBy(evs, e => e.matchId);
    const of = p.outcome, succ = p.success || [];
    const colour = e => { const v = of ? A.val(e, of, ws) : ''; return !v ? '#fff' : succ.includes(v) ? C.COL.opp : C.COL.their; };
    const tip = e => `<b>Q${e.period} ${U.esc(e.clock)} · ${U.esc(e.team)}</b><br>` + tpl.fields.filter(f => f.type !== 'text' && e.v[f.key] != null && e.v[f.key] !== '').slice(0, 6).map(f => `${U.esc(f.label)}: ${U.esc(f.type === 'player' ? M.playerName(e.v[f.key]) : e.v[f.key])}`).join('<br>');
    return M.wsMatches(ws).filter(m => byM.has(m.id)).map(m => `<div class="tl-match"><h4>${U.esc(M.matchLabel(m, ws.focus))} <span class="muted">${byM.get(m.id).length} events</span></h4>${C.timeline(byM.get(m.id), M.quarterSecs(m), colour, tip, e => (e.video && e.video.time != null) || M.state.clips.some(c => c.eventId === e.id) ? '▶' : '', vs.selEvent)}</div>`).join('')
      + `<div class="legend">${of ? `<span><i style="background:${C.COL.opp}"></i>${U.esc(succ.join(' / ') || 'success')}</span><span><i style="background:${C.COL.their}"></i>Other ${U.esc(label(A.dims(tpl, ws), of).toLowerCase())}</span><span><i style="background:#fff;border:1px solid #9c9a94"></i>Not coded</span>` : ''}<span>▶ = has video time or clip</span></div>`;
  };
  Lab.ChartRenderers = R;

  /* Render a saved spec (used by the report). */
  Lab.renderSpec = function (spec) {
    const ws = M.ws();
    if (!spec || !ws) return '';
    if (spec.kind === 'stat') return Lab.statChart ? Lab.statChart(ws, spec) : '';
    if (spec.kind === 'player') return '';
    const tpl = M.template(spec.tplId); if (!tpl || !R[spec.kind]) return '';
    const evs = A.apply(A.scope(ws, tpl.id), spec.flt || {}, ws);
    return R[spec.kind](ws, tpl, evs, spec.params || {});
  };

  /* ---------- event drawer ---------- */
  function openEvent(id) {
    const e = M.event(id); if (!e) return;
    vs.selEvent = id;
    const tpl = M.template(e.templateId), m = M.match(e.matchId), ws = M.ws();
    const clips = M.state.clips.filter(c => c.eventId === id);
    const tags = [...new Set(M.state.events.flatMap(x => x.tags || []).concat(M.state.clips.flatMap(c => c.tags || [])))].sort();
    const inp = f => {
      const v = e.v[f.key];
      if (f.type === 'choice' || f.type === 'zone') { const o = f.type === 'zone' ? Lab.Library.ZONES : f.options || []; const all = v && !o.includes(v) ? o.concat([v]) : o; return `<label>${U.esc(f.label)}<select data-ek="${f.key}"><option value="">(not coded)</option>${all.map(x => `<option ${x === v ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select></label>`; }
      if (f.type === 'player') { const tm = f.side === 'against' ? M.opponentIn(m, e.team) : f.side === 'any' ? '' : e.team; return `<label>${U.esc(f.label)}<select data-ek="${f.key}"><option value="">(not coded)</option>${(tm ? M.roster(tm) : M.state.players).map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${U.esc((p.number ? p.number + ' ' : '') + p.name)}</option>`).join('')}${v && !M.player(v) ? `<option selected value="${U.esc(v)}">${U.esc(v)}</option>` : ''}</select></label>`; }
      if (f.key === 'notes') return '';
      return `<label>${U.esc(f.label)}<input data-ek="${f.key}" value="${U.esc(v == null ? '' : v)}"></label>`;
    };
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(tpl ? tpl.name : '')} · ${U.esc(M.matchLabel(m))}</span><h2 id="drawerTitle">Q${e.period} ${U.esc(e.clock)} · ${U.esc(e.team)}</h2><span class="badge2">${e.source === 'import' ? 'Imported' : 'Coded in Lab'}${e.editedAt ? ' · edited' : ''}</span></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b">
        <div class="form">
          <label>Team<select data-eb="team">${[m.home, m.away].map(t => `<option ${t === e.team ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select></label>
          <label>Quarter<select data-eb="period">${[1, 2, 3, 4, 5].map(q => `<option value="${q}" ${q === e.period ? 'selected' : ''}>${q === 5 ? 'ET' : 'Q' + q}</option>`).join('')}</select></label>
          <label>Clock<input data-eb="clock" value="${U.esc(e.clock)}"></label>
          <label>Video time<input data-eb="video" value="${e.video && e.video.time != null ? U.fmtVideoTime(e.video.time) : ''}" placeholder="h:mm:ss"></label>
          ${tpl ? tpl.fields.map(inp).join('') : ''}
          <label class="full">Tags (comma separated)<input data-eb="tags" list="evTags" value="${U.esc((e.tags || []).join(', '))}"></label><datalist id="evTags">${tags.map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
          <label class="full">Notes (analyst description)<textarea data-eb="notes">${U.esc(e.notes || '')}</textarea></label>
        </div>
        <div class="ctl" style="margin-top:10px"><button class="btn g" id="evSave">Save</button><button class="btn" id="evClip" ${e.video && e.video.time != null ? '' : 'disabled title="Add a video time first"'}>Make clip</button><button class="btn" id="evVid">Open in Video</button><button class="btn" id="evFd">+ Finding</button><button class="btn danger sm" id="evDel">Delete event</button></div>
        ${clips.length ? `<h3 style="margin-top:12px">Clips</h3><ul class="notes-list">${clips.map(c => `<li><b>${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}</b>${U.esc(c.title)}</li>`).join('')}</ul>` : ''}
        <p class="sub" style="margin-top:10px">Blank fields are stored as not coded.</p>
      </div>`, d => {
      const read = () => {
        const v = Object.assign({}, e.v);
        U.$$('[data-ek]', d).forEach(x => { const f = tpl.fields.find(y => y.key === x.dataset.ek); let val = x.value.trim(); if (['number', 'margin', 'chain'].includes(f.type) && val !== '' && !isNaN(parseFloat(val))) val = parseFloat(val); if (val === '') delete v[f.key]; else v[f.key] = val; });
        const vt = U.parseVideoTime(U.$('[data-eb=video]', d).value.trim());
        if (U.$('[data-eb=video]', d).value.trim() && vt == null) { U.toast('Video time must be h:mm:ss', 'warn'); return null; }
        if (U.parseClock(U.$('[data-eb=clock]', d).value) == null) { U.toast('Clock must be mm:ss', 'warn'); return null; }
        return { v, team: U.$('[data-eb=team]', d).value, period: +U.$('[data-eb=period]', d).value, clock: U.$('[data-eb=clock]', d).value.trim(), tags: U.$('[data-eb=tags]', d).value.split(',').map(x => x.trim()).filter(Boolean), notes: U.$('[data-eb=notes]', d).value, video: vt != null ? { time: vt, status: 'confirmed' } : null };
      };
      U.$('#evSave', d).onclick = () => { const p = read(); if (p) { M.updateEvent(id, p); U.toast('Saved'); openEvent(id); } };
      U.$('#evClip', d).onclick = () => { const p = read(); if (!p) return; M.updateEvent(id, p); const x = M.event(id); Lab.openClip({ matchId: x.matchId, start: Math.max(0, x.video.time - 4), end: x.video.time + 12, eventId: id, tags: (x.tags || []).slice(), playerIds: tpl.fields.filter(f => f.type === 'player' && M.player(x.v[f.key])).map(f => x.v[f.key]), title: `${m.round} Q${x.period} ${x.clock} · ${tpl.name}` }); };
      U.$('#evVid', d).onclick = () => { vs.videoMatch = e.matchId; vs.videoEvent = id; Lab.closeDrawer(); Lab.go('video'); };
      U.$('#evFd', d).onclick = () => Lab.newFinding({ title: `${m.round} Q${e.period} ${e.clock}: ${tpl.name}`, stat: `Single coded event (${tpl.name}), ${M.matchLabel(m, ws && ws.focus)} Q${e.period} ${e.clock}.`, n: 1, matchIds: [m.id], eventIds: [id], clipIds: clips.map(c => c.id), source: 'One coded event' });
      U.$('#evDel', d).onclick = () => { if (confirm('Delete this event?')) { M.removeEvent(id); Lab.closeDrawer(); } };
    });
  }
  Lab.openEvent = openEvent;

  /* ---------- view ---------- */
  const CARDS = [
    ['breakdown', 'Breakdown', 'How often each value was coded.'],
    ['rate', 'Outcome rate', 'How often an outcome happened, split by another field.'],
    ['trend', 'By match', 'Events and outcome rate in each match.'],
    ['quarter', 'By quarter', 'When it happens.'],
    ['crosstab', 'Cross-tab', 'Two fields against each other.'],
    ['flow', 'Flow', 'How events move from one coded value to the next.'],
    ['zones', 'Ground zones', 'Where it happens (coded zones only).'],
    ['sequence', 'Ball movement', 'The path of one chain (needs chain numbers and zones).'],
    ['players', 'Players & matchups', 'Who is involved.'],
    ['timeline', 'Timeline', 'Every event on the match clock. Click a dot to open it.']
  ];

  Lab.Views.explore = {
    render(el, { ws }) {
      const inScope = A.scope(ws);
      const used = U.groupBy(inScope, e => e.templateId);
      if (!inScope.length) {
        el.innerHTML = `<div class="empty"><h3>No coded events for ${U.esc(ws.focus)}'s matches yet</h3><p>Charts and tables appear here once you've coded events in our matches. Coding is optional: the Team, Players and Match review tabs work from imported stats alone.</p>
          <div class="ctl"><button class="btn g" onclick="Lab.go('code')">Code a match</button><button class="btn" onclick="Lab.go('data')">Import events</button></div>
          <h3 style="margin-top:18px">What you'll see</h3><div class="preview-grid">${CARDS.map(c => `<div class="pv"><b>${c[1]}</b><span>${c[2]}</span></div>`).join('')}</div></div>`;
        return;
      }
      if (!vs.exTpl || !used.has(vs.exTpl)) vs.exTpl = [...used.keys()][0];
      const tpl = M.template(vs.exTpl);
      const d = A.dims(tpl, ws);
      vs.exFlt = vs.exFlt || { side: 'opp', f: {} }; vs.exFlt.f = vs.exFlt.f || {};
      const P = vs.exP && vs.exP.tpl === tpl.id ? vs.exP : (vs.exP = Object.assign({ tpl: tpl.id }, defaults(tpl)));
      const base = inScope.filter(e => e.templateId === tpl.id);
      const flt = vs.exFlt, evs = A.apply(base, flt, ws);
      const sideCount = s => A.apply(base, Object.assign({}, flt, { side: s }), ws).length;
      const choice = d.filter(x => x.field && ['choice', 'zone'].includes(x.field.type));
      const fsel = (k, lab, optsArr, cur) => `<div class="f"><label>${U.esc(lab)}</label><select data-flt="${U.esc(k)}" class="${cur ? 'on' : ''}"><option value="">All</option>${optsArr.map(o => `<option value="${U.esc(o.v)}" ${String(o.v) === String(cur || '') ? 'selected' : ''}>${U.esc(o.l)}</option>`).join('')}</select></div>`;
      const ms = M.wsMatches(ws);
      const mOrder = new Map(ms.map((m, i) => [m.id, i]));
      const players = [...new Set(base.flatMap(e => tpl.fields.filter(f => f.type === 'player').map(f => e.v[f.key]).filter(Boolean)))];
      const tagsAll = [...new Set(base.flatMap(e => e.tags || []))];
      const matchesIn = [...new Set(evs.map(e => e.matchId))];
      const card = (k, extra) => { const c = CARDS.find(x => x[0] === k); return `<section class="card ex-card" data-card="${k}"><div class="card-h"><div><h3>${c[1]}</h3><p>${c[2]}</p></div><div class="ctl">${extra || ''}<button class="btn sm" data-fd="${k}">+ Finding</button></div></div><div class="ex-body">${R[k](ws, tpl, evs, P)}</div></section>`; };
      const dsel = (attr, cur, list, multi) => `<select data-p="${attr}" aria-label="${attr}">${(list || d).map(x => `<option value="${x.key}" ${x.key === cur ? 'selected' : ''}>${U.esc(x.label)}</option>`).join('')}</select>`;
      const of = tpl.fields.find(f => f.key === P.outcome);
      el.innerHTML = `
      <div class="tplbar">${[...used.entries()].map(([id, list]) => { const t = M.template(id); return t ? `<button class="tplchip${id === tpl.id ? ' on' : ''}" data-tpl="${id}"><span>${U.esc(t.phase || 'Custom')}</span>${U.esc(t.name)} <b>${list.length}</b></button>` : ''; }).join('')}</div>
      <section class="card fbar">
        <div class="f-row">
          <div class="f"><label>Coded for</label><span class="seg">${[['opp', ws.focus], ['their', 'Opponents'], ['both', 'Both']].map(([v, l]) => `<button class="${(flt.side || 'opp') === v ? 'on' : ''}" data-side="${v}">${U.esc(l)} <i>${sideCount(v)}</i></button>`).join('')}</span></div>
          ${fsel('matchId', 'Match', ms.map(m => ({ v: m.id, l: M.matchLabel(m, ws.focus) })), flt.matchId)}
          ${fsel('period', 'Quarter', [1, 2, 3, 4, 5].map(q => ({ v: q, l: q === 5 ? 'ET' : 'Q' + q })), flt.period)}
          ${players.length ? fsel('player', 'Player', players.map(p => ({ v: p, l: M.playerName(p) })).sort((a, b) => a.l.localeCompare(b.l)), flt.player) : ''}
          ${tagsAll.length ? fsel('tag', 'Tag', tagsAll.map(t => ({ v: t, l: t })), flt.tag) : ''}
          ${choice.slice(0, 5).map(x => fsel('f:' + x.key, x.label, (x.order || []).filter(o => base.some(e => e.v[x.key] === o)).map(o => ({ v: o, l: o })), flt.f[x.key])).join('')}
          <div class="f"><label>Search</label><input type="search" id="exQ" value="${U.esc(flt.q || '')}" placeholder="notes, names, tags"></div>
        </div>
        <div class="f-meta"><span class="f-n"><b>${evs.length}</b> of ${base.length} ${U.esc(tpl.unit)}s · ${matchesIn.length} of ${ms.length} matches · ${U.esc(A.describe(flt, ws, tpl))}${evs.length && evs.length < U.SMALL_N ? ' <span class="smallflag">Small sample</span>' : ''}</span>
          <span class="ctl">${Object.keys(flt).some(k => k !== 'side' && k !== 'f' && flt[k]) || Object.values(flt.f).some(Boolean) ? '<button class="link" id="exClear">Clear filters</button>' : ''}<button class="btn sm" id="exCsv">Export these events (CSV)</button></span></div>
      </section>
      ${evs.length ? `<div class="ex-grid">
        ${card('breakdown', dsel('by', P.by, d.filter(x => x.key !== '_tag' || tagsAll.length)))}
        ${card('rate', `<span class="k">Outcome</span>${dsel('outcome', P.outcome, d.filter(x => x.field && x.field.type === 'choice'))}<span class="k">split by</span>${dsel('split', P.split)}`)}
        ${of ? `<div class="succ full">Counts as success: ${(of.options || []).map(o => `<label class="cb"><input type="checkbox" data-succ value="${U.esc(o)}" ${P.success.includes(o) ? 'checked' : ''}> ${U.esc(o)}</label>`).join('')}</div>` : ''}
        ${card('trend')}${card('quarter')}
        ${card('crosstab', dsel('xr', P.xr) + ' × ' + dsel('xc', P.xc))}
        ${card('flow', [0, 1, 2].map(i => `<select data-flow="${i}" aria-label="Flow stage ${i + 1}"><option value="">${i === 2 ? '(optional)' : ''}</option>${choice.map(x => `<option value="${x.key}" ${P.flow[i] === x.key ? 'selected' : ''}>${U.esc(x.label)}</option>`).join('')}</select>`).join('→'))}
        ${tpl.fields.some(f => f.type === 'zone') ? card('zones', tpl.fields.filter(f => f.type === 'zone').length > 1 ? `<select data-p="zone">${tpl.fields.filter(f => f.type === 'zone').map(f => `<option value="${f.key}" ${P.zone === f.key ? 'selected' : ''}>${U.esc(f.label)}</option>`).join('')}</select>` : '') : ''}
        ${tpl.fields.some(f => f.type === 'chain') ? card('sequence') : ''}
        ${card('players')}
        <div class="full">${card('timeline')}</div>
      </div>
      <section class="sec card"><div class="card-h"><h2>Events (${evs.length})</h2></div>
        <div class="tw" style="max-height:520px;overflow:auto"><table class="compact"><thead><tr><th class="l">Match</th><th>Q</th><th>Clock</th><th class="l">Team</th>${tpl.fields.filter(f => f.type !== 'text').slice(0, 7).map(f => `<th class="l">${U.esc(f.label)}</th>`).join('')}<th class="l">Notes</th><th class="l"></th></tr></thead><tbody>
        ${evs.slice().sort((a, b) => (mOrder.get(a.matchId) - mOrder.get(b.matchId)) || a.period - b.period || (A.derive(a).el ?? 0) - (A.derive(b).el ?? 0)).map(e => `<tr class="click${vs.selEvent === e.id ? ' sel' : ''}" data-open="${e.id}"><td class="l">${U.esc(M.match(e.matchId).round)}</td><td>${e.period}</td><td>${U.esc(e.clock)}</td><td class="l">${U.esc(e.team)}</td>${tpl.fields.filter(f => f.type !== 'text').slice(0, 7).map(f => `<td class="l">${e.v[f.key] == null || e.v[f.key] === '' ? '<span class="uncoded">–</span>' : U.esc(f.type === 'player' ? M.playerName(e.v[f.key]) : e.v[f.key])}</td>`).join('')}<td class="l wrap" style="min-width:200px;font-size:12px">${U.esc(e.notes || '')}</td><td class="l">${(e.tags || []).map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}${e.video && e.video.time != null ? '<span class="badge2 clip">▶</span>' : ''}</td></tr>`).join('')}
        </tbody></table></div></section>` : `<div class="empty"><h3>No events match these filters</h3><button class="btn" id="exClear2">Clear filters</button></div>`}`;

      // wiring
      U.$$('[data-tpl]', el).forEach(b => b.onclick = () => { vs.exTpl = b.dataset.tpl; vs.exFlt = { side: flt.side, f: {} }; Lab.render(); });
      U.$$('[data-side]', el).forEach(b => b.onclick = () => { flt.side = b.dataset.side; Lab.render(); });
      U.$$('[data-flt]', el).forEach(s => s.onchange = () => { const k = s.dataset.flt; if (k.startsWith('f:')) flt.f[k.slice(2)] = s.value; else flt[k] = s.value; Lab.render(); });
      let qt; const q = U.$('#exQ', el); q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { flt.q = q.value; Lab.render(); const n = U.$('#exQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
      const clr = () => { vs.exFlt = { side: flt.side, f: {} }; Lab.render(); };
      const c1 = U.$('#exClear', el); if (c1) c1.onclick = clr; const c2 = U.$('#exClear2', el); if (c2) c2.onclick = clr;
      U.$('#exCsv', el).onclick = () => U.download(`events-${U.norm(tpl.name)}-${U.today()}.csv`, Lab.Importer.exportKind('events', { templateId: tpl.id, events: evs }), 'text/csv;charset=utf-8');
      U.$$('[data-p]', el).forEach(s => s.onchange = () => { P[s.dataset.p] = s.value; if (s.dataset.p === 'outcome') { const f = tpl.fields.find(x => x.key === s.value); P.success = f ? (f.options || []).filter(o => SUCCESS_GUESS.includes(o)).slice(0, 2) : []; } Lab.render(); });
      U.$$('[data-succ]', el).forEach(c => c.onchange = () => { P.success = U.$$('[data-succ]', el).filter(x => x.checked).map(x => x.value); Lab.render(); });
      U.$$('[data-flow]', el).forEach(s => s.onchange = () => { P.flow[+s.dataset.flow] = s.value; Lab.render(); });
      const sq = U.$('[data-seq]', el); if (sq) sq.onchange = () => { P.seq = sq.value; Lab.render(); };
      U.$$('[data-pick]', el).forEach(b => b.onclick = () => { const k = b.dataset.pick, v = b.dataset.val; if (k === '_match') { const m = ms.find(x => M.matchLabel(x, ws.focus) === v); if (m) flt.matchId = m.id; } else if (k === '_period') flt.period = v.replace('Q', ''); else if (k === '_tag') flt.tag = v; else if (k === '_team') flt.side = v === ws.focus ? 'opp' : 'their'; else if (!k.startsWith('_')) { const f = tpl.fields.find(x => x.key === k); if (f && f.type === 'player') { const p = base.map(e => e.v[k]).find(id => M.playerName(id) === v); flt.player = p; } else flt.f[k] = v; } Lab.render(); });
      U.$$('[data-player]', el).forEach(b => b.onclick = () => { flt.player = b.dataset.player; Lab.render(); });
      U.$$('[data-xr]', el).forEach(td => td.onclick = () => { [[P.xr, td.dataset.xr], [P.xc, td.dataset.xc]].forEach(([k, v]) => { if (k.startsWith('_') || !tpl.fields.some(f => f.key === k && f.type !== 'player')) return; flt.f[k] = v; }); Lab.render(); });
      U.$$('[data-zone]', el).forEach(z => z.onclick = () => { flt.f[P.zone || tpl.fields.find(f => f.type === 'zone').key] = z.dataset.zone; Lab.render(); });
      U.$$('[data-open]', el).forEach(n => n.onclick = () => openEvent(n.dataset.open));
      U.$$('[data-fd]', el).forEach(b => b.onclick = () => {
        const k = b.dataset.fd, c = CARDS.find(x => x[0] === k);
        let stat = `${A.describe(flt, ws, tpl)}: ${evs.length} ${tpl.unit}s across ${matchesIn.length} match${matchesIn.length === 1 ? '' : 'es'}.`;
        if (k === 'rate' && P.outcome) { const r = A.rateBy(evs, P.split, P.outcome, P.success, ws); stat += r.all.den ? ` ${P.success.join(' or ')} (${label(d, P.outcome)}): ${r.all.num}/${r.all.den} (${U.pct(r.all.p)}).` + (r.rows.length ? ` By ${label(d, P.split).toLowerCase()}: ` + r.rows.map(x => `${x.label} ${x.r.num}/${x.r.den}`).join(', ') + '.' : '') : ` ${label(d, P.outcome)} is not coded in these events.`; }
        if (k === 'breakdown') { const ct = A.counts(evs, P.by, ws, orderOf(d, P.by)); stat += ` ${label(d, P.by)}: ` + ct.rows.map(x => `${x.label} ${x.n}/${ct.coded}`).join(', ') + (ct.uncoded ? ` (${ct.uncoded} uncoded)` : '') + '.'; }
        Lab.newFinding({ title: `${tpl.name}: ${c[1].toLowerCase()}`, stat, n: evs.length, matchIds: matchesIn, source: `Coded events (${tpl.name}), ${matchesIn.length} of ${ms.length} included matches`, eventIds: evs.slice(0, 60).map(e => e.id), chart: { kind: k, tplId: tpl.id, flt: JSON.parse(JSON.stringify(flt)), params: JSON.parse(JSON.stringify(P)) } });
      });
    }
  };
})(window.Lab);
