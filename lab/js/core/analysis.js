/* Opponent Lab: generic analysis over coded events and entered stats.
   Descriptive only. Every rate keeps numerator and denominator; uncoded values are excluded from
   denominators and reported separately. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  const PERIODS = ['Full', 'Q1', 'Q2', 'Q3', 'Q4'];

  /* ---------- event helpers ---------- */
  function derive(e) {
    const m = M.match(e.matchId);
    const qs = M.quarterSecs(m);
    const c = U.parseClock(e.clock);
    const countdown = M.state.settings.clockMode !== 'elapsed';
    const el = c == null ? null : Math.max(0, countdown ? qs - c : c);
    const tpl = M.template(e.templateId);
    const marginField = tpl && tpl.fields.find(f => f.type === 'margin');
    const mg = marginField ? e.v[marginField.key] : null;
    return {
      m, el, qs,
      window: el == null ? '' : el < 300 ? 'First 5 min' : el < 600 ? '5–10 min' : el < 900 ? '10–15 min' : '15+ min',
      half: e.period ? (e.period <= 2 ? '1st half' : '2nd half') : '',
      scoreState: mg == null || mg === '' || isNaN(mg) ? '' : +mg <= -19 ? 'Trailing 19+' : +mg < 0 ? 'Trailing 1–18' : +mg === 0 ? 'Level' : +mg < 19 ? 'Leading 1–18' : 'Leading 19+'
    };
  }

  /* Base dimensions every event has, plus the template's own fields. */
  function dims(tpl, ws) {
    const base = [
      { key: '_match', label: 'Match' }, { key: '_period', label: 'Quarter' }, { key: '_half', label: 'Half' },
      { key: '_window', label: 'Time into quarter', order: ['First 5 min', '5–10 min', '10–15 min', '15+ min'] },
      { key: '_team', label: 'Coded for' }
    ];
    if (tpl && tpl.fields.some(f => f.type === 'margin')) base.push({ key: '_state', label: 'Score state', order: ['Trailing 19+', 'Trailing 1–18', 'Level', 'Leading 1–18', 'Leading 19+'] });
    const own = tpl ? tpl.fields.filter(f => ['choice', 'player', 'zone', 'chain'].includes(f.type)).map(f => ({ key: f.key, label: f.label, order: f.type === 'zone' ? Lab.Library.ZONES : f.options, field: f })) : [];
    return base.concat(own).concat([{ key: '_tag', label: 'Tag', multi: true }]);
  }
  /* Value of a dimension for an event (string, or array for tags). */
  function val(e, key, ws) {
    if (key === '_match') { const m = M.match(e.matchId); return m ? M.matchLabel(m, ws && ws.focus) : ''; }
    if (key === '_period') return e.period ? 'Q' + e.period : '';
    if (key === '_half') return derive(e).half;
    if (key === '_window') return derive(e).window;
    if (key === '_team') return e.team || '';
    if (key === '_state') return derive(e).scoreState;
    if (key === '_tag') return e.tags || [];
    const tpl = M.template(e.templateId);
    const f = tpl && tpl.fields.find(x => x.key === key);
    const v = e.v[key];
    if (v == null || v === '') return '';
    if (f && f.type === 'player') return M.playerName(v);
    return String(v);
  }

  /* Filters: {matchId, period, side ('opp'|'their'|'both'), tag, player, q, f:{key:value}} */
  function scope(ws, tplId) {
    if (!ws) return [];
    const ids = new Set(M.wsMatches(ws).map(m => m.id));
    return M.state.events.filter(e => ids.has(e.matchId) && (!tplId || e.templateId === tplId));
  }
  function apply(events, flt, ws) {
    flt = flt || {};
    const q = (flt.q || '').trim().toLowerCase();
    return events.filter(e => {
      const side = flt.side || 'opp';
      if (side === 'opp' && e.team !== ws.focus) return false;
      if (side === 'their' && e.team === ws.focus) return false;
      if (flt.matchId && e.matchId !== flt.matchId) return false;
      if (flt.period && String(e.period) !== String(flt.period)) return false;
      if (flt.tag && !(e.tags || []).includes(flt.tag)) return false;
      if (flt.player) { const tpl = M.template(e.templateId); if (!tpl || !tpl.fields.some(f => f.type === 'player' && e.v[f.key] === flt.player)) return false; }
      for (const k of Object.keys(flt.f || {})) {
        const want = flt.f[k];
        if (want == null || want === '') continue;
        const v = val(e, k, ws);
        if (Array.isArray(v) ? !v.includes(want) : v !== want) return false;
      }
      if (q) {
        const hay = [e.notes, (e.tags || []).join(' '), ...Object.keys(e.v).map(k => val(e, k, ws))].join(' ').toLowerCase();
        if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
      }
      return true;
    });
  }
  function describe(flt, ws, tpl) {
    const parts = [];
    if (flt.side === 'their') parts.push(`coded for ${ws.focus}'s opponents`);
    if (flt.matchId) parts.push(M.matchLabel(M.match(flt.matchId), ws.focus));
    if (flt.period) parts.push('Q' + flt.period);
    if (flt.player) parts.push('player ' + M.playerName(flt.player));
    if (flt.tag) parts.push('tag ' + flt.tag);
    const d = dims(tpl, ws);
    Object.keys(flt.f || {}).forEach(k => { if (flt.f[k]) parts.push(`${(d.find(x => x.key === k) || { label: k }).label}: ${flt.f[k]}`); });
    if (flt.q) parts.push(`"${flt.q}"`);
    return parts.length ? parts.join(' · ') : 'All coded ' + (tpl ? tpl.name.toLowerCase() : 'events');
  }

  function orderRows(rows, order) {
    if (order) rows.sort((a, b) => { const i = order.indexOf(a.value), j = order.indexOf(b.value); return (i < 0 ? 999 : i) - (j < 0 ? 999 : j); });
    else rows.sort((a, b) => b.n - a.n || String(a.label).localeCompare(String(b.label)));
    return rows;
  }
  function counts(events, key, ws, order) {
    const m = new Map(); let coded = 0;
    events.forEach(e => {
      let v = val(e, key, ws);
      const vs = Array.isArray(v) ? v : (v === '' ? [] : [v]);
      if (vs.length) coded++;
      vs.forEach(x => { if (!m.has(x)) m.set(x, []); m.get(x).push(e); });
    });
    const rows = [...m.entries()].map(([value, evs]) => ({ value, label: value, n: evs.length, events: evs, r: U.rate(evs.length, coded) }));
    if (key === '_match') rows.sort((a, b) => matchOrder(a.events[0]) - matchOrder(b.events[0]));
    else orderRows(rows, order || (key === '_period' ? ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] : null));
    return { rows, coded, uncoded: events.length - coded };
  }
  function matchOrder(e) { const list = M.sortMatches(M.state.matches); return list.findIndex(m => m.id === e.matchId); }

  /* Rate of an outcome (outcomeKey in successValues) split by splitKey. Denominator = events with outcome coded. */
  function rateBy(events, splitKey, outcomeKey, success, ws, order) {
    const withOutcome = events.filter(e => val(e, outcomeKey, ws) !== '');
    const groups = counts(withOutcome, splitKey, ws, order);
    const rows = groups.rows.map(r => ({ value: r.value, label: r.label, events: r.events, r: U.rate(r.events.filter(e => success.includes(val(e, outcomeKey, ws))).length, r.events.length) }));
    const all = U.rate(withOutcome.filter(e => success.includes(val(e, outcomeKey, ws))).length, withOutcome.length);
    return { rows, all, uncodedOutcome: events.length - withOutcome.length, uncodedSplit: groups.uncoded };
  }

  function crosstab(events, rk, ck, ws, ro, co) {
    const rows = counts(events, rk, ws, ro).rows, cols = counts(events, ck, ws, co).rows;
    const cell = (rv, cv) => events.filter(e => { const a = val(e, rk, ws), b = val(e, ck, ws); return (Array.isArray(a) ? a.includes(rv) : a === rv) && (Array.isArray(b) ? b.includes(cv) : b === cv); });
    return { rows, cols, cell };
  }

  /* Flow between up to three choice fields; only events with every stage coded are drawn. */
  function flow(events, keys, ws, tpl) {
    const full = events.filter(e => keys.every(k => val(e, k, ws) !== ''));
    const d = dims(tpl, ws);
    const stages = keys.map(k => counts(full, k, ws, (d.find(x => x.key === k) || {}).order).rows.map(r => ({ value: r.value, n: r.n })));
    const links = [];
    for (let s = 0; s < keys.length - 1; s++) {
      const m = new Map();
      full.forEach(e => { const a = val(e, keys[s], ws), b = val(e, keys[s + 1], ws); const k = a + '\u0000' + b; m.set(k, (m.get(k) || 0) + 1); });
      m.forEach((n, k) => { const [a, b] = k.split('\u0000'); links.push({ stage: s, from: a, to: b, n }); });
    }
    return { stages, links, n: full.length, excluded: events.length - full.length };
  }

  function zoneCounts(events, key) {
    const c = {}; let coded = 0;
    events.forEach(e => { const z = e.v[key]; if (z) { c[z] = (c[z] || 0) + 1; coded++; } });
    return { c, coded, uncoded: events.length - coded };
  }

  /* Sequences: events grouped by match + chain number, in clock order. */
  function sequences(events, chainKey, zoneKey) {
    const g = U.groupBy(events.filter(e => e.v[chainKey] !== '' && e.v[chainKey] != null), e => e.matchId + '|' + e.v[chainKey]);
    return [...g.entries()].map(([k, evs]) => ({
      key: k, matchId: evs[0].matchId, chain: evs[0].v[chainKey],
      steps: evs.slice().sort((a, b) => (a.period - b.period) || ((derive(a).el ?? 0) - (derive(b).el ?? 0)) || String(a.createdAt).localeCompare(String(b.createdAt))),
      zoned: evs.filter(e => e.v[zoneKey]).length
    })).sort((a, b) => b.steps.length - a.steps.length);
  }

  /* Player involvement across all player fields of a template. */
  function involvement(events, tpl) {
    const pf = tpl.fields.filter(f => f.type === 'player');
    const m = new Map();
    events.forEach(e => pf.forEach(f => {
      const id = e.v[f.key]; if (!id) return;
      if (!m.has(id)) m.set(id, { id, name: M.playerName(id), total: 0, byField: {}, events: [] });
      const r = m.get(id); r.total++; r.byField[f.label] = (r.byField[f.label] || 0) + 1; if (!r.events.includes(e)) r.events.push(e);
    }));
    return { fields: pf.map(f => f.label), rows: [...m.values()].sort((a, b) => b.total - a.total) };
  }
  /* Matchups: a "for" player field against an "against" player field in the same event. */
  function matchups(events, tpl, ws) {
    const fFor = tpl.fields.find(f => f.type === 'player' && f.side === 'for');
    const fAg = tpl.fields.find(f => f.type === 'player' && f.side === 'against');
    if (!fFor || !fAg) return null;
    const outcome = tpl.fields.find(f => f.type === 'choice' && /outcome|result|won/i.test(f.key + f.label));
    const m = new Map();
    events.forEach(e => {
      const a = e.v[fFor.key], b = e.v[fAg.key]; if (!a || !b) return;
      const k = a + '|' + b;
      if (!m.has(k)) m.set(k, { a, b, n: 0, outcomes: {}, events: [] });
      const r = m.get(k); r.n++; r.events.push(e);
      if (outcome && e.v[outcome.key]) r.outcomes[e.v[outcome.key]] = (r.outcomes[e.v[outcome.key]] || 0) + 1;
    });
    return { forLabel: fFor.label, againstLabel: fAg.label, outcomeLabel: outcome && outcome.label, rows: [...m.values()].sort((x, y) => y.n - x.n) };
  }

  /* ---------- stats ---------- */
  /* Aggregate a metric over matches. values: array of number | {num,den} | null. */
  function aggregate(mt, values) {
    const present = values.filter(v => v != null);
    const missing = values.length - present.length;
    if (!present.length) return { n: 0, missing, value: null };
    if (mt.kind === 'ratio') {
      const num = present.reduce((a, v) => a + v.num, 0), den = present.reduce((a, v) => a + v.den, 0);
      return { n: present.length, missing, value: den ? num / den : null, num, den, ratio: true };
    }
    const sum = present.reduce((a, v) => a + v, 0);
    return { n: present.length, missing, value: sum / present.length, sum, mean: true };
  }
  function fmt(mt, v, dp) {
    if (v == null) return '–';
    if (typeof v === 'object') return v.den ? U.pct(v.num / v.den) + ` (${U.round(v.num, 1)}/${U.round(v.den, 1)})` : '–';
    if (mt && mt.kind === 'ratio') return U.pct(v);
    const r = U.round(v, dp == null ? 1 : dp);
    return mt && mt.unit === '%' ? r + '%' : mt && mt.unit === 'm' ? r + 'm' : String(r);
  }
  function asNumber(v) { return v == null ? null : typeof v === 'object' ? (v.den ? v.num / v.den : null) : v; }

  /* One team's metric across matches, with the opposition's value in each. */
  function teamSeries(metricId, team, matches, period) {
    return matches.map(m => {
      const opp = M.opponentIn(m, team);
      return { m, label: M.matchLabel(m, team), for: M.teamValue(m.id, team, period, metricId), against: M.teamValue(m.id, opp, period, metricId), res: M.result(m, team) };
    });
  }

  Lab.Analysis = { PERIODS, derive, dims, val, scope, apply, describe, counts, rateBy, crosstab, flow, zoneCounts, sequences, involvement, matchups, aggregate, fmt, asNumber, teamSeries };
})(window.Lab);
