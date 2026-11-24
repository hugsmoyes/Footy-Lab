/* Opponent Lab: chart kit (plain SVG/HTML). Every chart takes real values only; when there is
   nothing to draw it shows an empty state that says what data is needed. */
(function (Lab) {
  'use strict';
  const U = Lab.U, Z = () => Lab.Library;
  const C = Lab.Charts = {};
  Lab.Views = Lab.Views || {};
  Lab.vs = Lab.vs || {};
  const esc = U.esc;
  C.COL = { opp: '#137a40', their: '#6c8cf5', ours: '#2f2f2c', grid: '#e3e1db', muted: '#6f6e69' };

  C.empty = function (title, msg, need) {
    return `<div class="chart-empty"><svg viewBox="0 0 300 90" aria-hidden="true"><line x1="20" y1="75" x2="290" y2="75" stroke="#d2cfc6"/><line x1="20" y1="10" x2="20" y2="75" stroke="#d2cfc6"/>
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${36 + i * 50}" y="${75 - (18 + (i % 3) * 14)}" width="26" height="${18 + (i % 3) * 14}" rx="4" fill="none" stroke="#d2cfc6" stroke-dasharray="3 3"/>`).join('')}</svg>
      <div><b>${esc(title || 'No data yet')}</b><p>${esc(msg || '')}</p>${need ? `<p class="need">Needs: ${esc(need)}</p>` : ''}</div></div>`;
  };

  /* Horizontal bars. rows: {label, n, r (rate obj) | value, tip, attrs} */
  C.bars = function (rows, opts) {
    opts = opts || {};
    if (!rows.length) return C.empty(opts.emptyTitle, opts.emptyMsg, opts.need);
    const vals = rows.map(r => r.r ? r.r.p : r.value).filter(v => v != null);
    const max = opts.max || Math.max(1e-9, ...vals);
    return `<div class="hbars">${rows.map(r => {
      const v = r.r ? r.r.p : r.value;
      const w = v == null ? 0 : Math.max(0, v / max * 100);
      const ci = r.r && r.r.den ? `<i class="ci" style="left:${r.r.lo / max * 100}%;width:${(r.r.hi - r.r.lo) / max * 100}%"></i>` : '';
      const lab = r.r ? `${r.r.num}/${r.r.den} · ${U.pct(r.r.p)}` : (opts.fmt ? opts.fmt(r.value) : r.value);
      const small = (r.r ? r.r.den : r.n) < U.SMALL_N;
      return `<div class="hb${opts.click ? ' click' : ''}" ${r.attrs || ''} data-tip="${esc(r.tip || `<b>${esc(r.label)}</b><br>${lab}${r.r ? `<br>95% interval ${U.pct(r.r.lo)}–${U.pct(r.r.hi)}` : ''}`)}">
        <span class="hb-l">${esc(r.label)}</span><span class="hb-t"><i style="width:${w.toFixed(1)}%;background:${r.color || opts.color || C.COL.opp}"></i>${opts.ci ? ci : ''}</span><span class="hb-v">${lab}${small ? ' <em class="smallflag">small</em>' : ''}</span></div>`;
    }).join('')}</div>`;
  };

  /* Line chart across categories. series: [{name, color, values:[number|null], tips:[]}] */
  C.line = function (cats, series, opts) {
    opts = opts || {};
    const all = series.flatMap(s => s.values).filter(v => v != null);
    if (all.length < 1) return C.empty(opts.emptyTitle || 'Nothing to plot yet', opts.emptyMsg, opts.need);
    const W = 640, H = 220, L = 44, R = 90, T = 14, B = 46;
    let lo = opts.min != null ? opts.min : Math.min(0, ...all), hi = opts.max != null ? opts.max : Math.max(...all);
    if (hi === lo) hi = lo + 1;
    if (opts.max == null) { const pad = (hi - lo) * 0.08; hi += pad; if (lo !== 0 && opts.min == null) lo -= pad; }
    const x = i => L + (cats.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (cats.length - 1));
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => lo + t * (hi - lo));
    const f = opts.fmt || (v => U.round(v, 1));
    let out = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.aria || 'Line chart')}">`;
    out += ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${C.COL.grid}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(f(t))}</text>`).join('');
    out += cats.map((c, i) => `<text x="${x(i)}" y="${H - B + 16}" text-anchor="${cats.length > 6 ? 'end' : 'middle'}" class="ax" ${cats.length > 6 ? `transform="rotate(-30 ${x(i)} ${H - B + 16})"` : ''}>${esc(c)}</text>`).join('');
    series.forEach(s => {
      let d = '', pen = false;
      s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
      out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
      out += s.values.map((v, i) => v == null ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2" data-tip="${esc(`<b>${esc(s.name)}</b> · ${esc(cats[i])}<br>${esc(s.tips && s.tips[i] ? s.tips[i] : f(v))}`)}"/>`).join('');
      const li = s.values.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
      if (li != null && li >= 0) out += `<text x="${x(li) + 9}" y="${y(s.values[li]) + 4}" class="dl" fill="${s.color}">${esc(s.name)}</text>`;
    });
    out += '</svg>';
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return legend + out;
  };

  /* Grouped vertical bars. cats: labels; series: [{name,color,values}] */
  C.grouped = function (cats, series, opts) {
    opts = opts || {};
    const all = series.flatMap(s => s.values).filter(v => v != null);
    if (!all.length) return C.empty(opts.emptyTitle || 'Nothing to compare yet', opts.emptyMsg, opts.need);
    const W = 640, H = 210, L = 40, R = 10, T = 16, B = 36;
    const hi = Math.max(...all, 0) * 1.12 || 1;
    const gw = (W - L - R) / cats.length, bw = Math.min(30, (gw - 12) / series.length);
    const y = v => T + (1 - v / hi) * (H - T - B);
    const f = opts.fmt || (v => U.round(v, 1));
    let out = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.aria || 'Bar chart')}">`;
    [0, 0.5, 1].forEach(t => { out += `<line x1="${L}" x2="${W - R}" y1="${y(hi * t)}" y2="${y(hi * t)}" stroke="${C.COL.grid}"/><text x="${L - 6}" y="${y(hi * t) + 4}" text-anchor="end" class="ax">${esc(f(hi * t))}</text>`; });
    cats.forEach((c, i) => {
      const x0 = L + i * gw + (gw - bw * series.length - 2 * (series.length - 1)) / 2;
      series.forEach((s, j) => {
        const v = s.values[i];
        const x = x0 + j * (bw + 2);
        out += v == null ? `<text x="${x + bw / 2}" y="${H - B - 4}" text-anchor="middle" class="ax">–</text>` : `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - B - y(v))}" rx="4" fill="${s.color}" data-tip="${esc(`<b>${esc(s.name)}</b> · ${esc(c)}<br>${esc(s.tips && s.tips[i] ? s.tips[i] : f(v))}`)}"/>`;
      });
      out += `<text x="${L + i * gw + gw / 2}" y="${H - B + 16}" text-anchor="middle" class="ax">${esc(c)}</text>`;
    });
    out += '</svg>';
    return (series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '') + out;
  };

  /* Flow (sankey-style) between up to 3 coded fields. data from Analysis.flow */
  C.flow = function (data, labels) {
    if (!data.n) return C.empty('No complete sequences yet', 'Each event needs every chosen field coded to appear in the flow.', 'events with ' + labels.join(', ') + ' coded');
    const W = 680, H = Math.max(200, 40 + Math.max(...data.stages.map(s => s.length)) * 34), T = 26, colW = 14;
    const nStages = data.stages.length, gap = 8;
    const sx = i => 20 + i * ((W - 200) / Math.max(1, nStages - 1));
    const scale = (H - T - 10 - gap * 10) / data.n;
    const pos = data.stages.map(stage => { let yy = T; const p = {}; stage.forEach(nd => { p[nd.value] = { y: yy, h: Math.max(3, nd.n * scale), n: nd.n, off: 0, inOff: 0 }; yy += Math.max(3, nd.n * scale) + gap; }); return p; });
    let out = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Flow diagram">`;
    labels.forEach((l, i) => { out += `<text x="${sx(i)}" y="14" class="ax" style="font-weight:600">${esc(l)}</text>`; });
    data.links.sort((a, b) => b.n - a.n).forEach(lk => {
      const a = pos[lk.stage][lk.from], b = pos[lk.stage + 1][lk.to];
      const h = lk.n * scale, x1 = sx(lk.stage) + colW, x2 = sx(lk.stage + 1);
      const y1 = a.y + a.off + h / 2, y2 = b.y + b.inOff + h / 2;
      a.off += h; b.inOff += h;
      out += `<path d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" fill="none" stroke="${C.COL.opp}" stroke-opacity=".28" stroke-width="${Math.max(1.5, h)}" data-tip="${esc(`<b>${esc(lk.from)} → ${esc(lk.to)}</b><br>${lk.n} of ${a.n} (${U.pct(lk.n / a.n)})`)}"/>`;
    });
    data.stages.forEach((stage, i) => stage.forEach(nd => {
      const p = pos[i][nd.value];
      out += `<rect x="${sx(i)}" y="${p.y}" width="${colW}" height="${p.h}" rx="3" fill="${C.COL.opp}" data-tip="${esc(`<b>${esc(nd.value)}</b><br>${nd.n} of ${data.n}`)}"/><text x="${sx(i) + colW + 5}" y="${p.y + Math.min(p.h / 2, 12) + 4}" class="fl">${esc(nd.value)} <tspan class="ax">${nd.n}</tspan></text>`;
    }));
    return out + '</svg>';
  };

  /* Ground zone map: 4 bands × 3 lanes, attacking up the page. counts: {zone: n} */
  function ground(inner) {
    const W = 300, H = 380;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart ground" role="img" aria-label="Ground zones, attacking up the page">`;
    s += `<defs><clipPath id="oval"><ellipse cx="150" cy="190" rx="140" ry="180"/></clipPath></defs>`;
    s += `<ellipse cx="150" cy="190" rx="140" ry="180" fill="#f4f8f3" stroke="#9fc5ad" stroke-width="2"/>`;
    s += inner;
    s += `<g clip-path="url(#oval)" fill="none" stroke="#9fc5ad"><path d="M100 10 A 60 60 0 0 0 200 10"/><path d="M95 10 Q150 110 205 10" opacity=".0"/></g>`;
    s += `<path d="M95 18 Q150 105 205 18" fill="none" stroke="#9fc5ad" stroke-width="1.5"/><path d="M95 362 Q150 275 205 362" fill="none" stroke="#9fc5ad" stroke-width="1.5"/>`;
    s += `<rect x="125" y="165" width="50" height="50" fill="none" stroke="#9fc5ad" stroke-width="1.5"/><circle cx="150" cy="190" r="8" fill="none" stroke="#9fc5ad"/>`;
    s += `<text x="150" y="8" text-anchor="middle" class="ax">attacking ↑</text></svg>`;
    return s;
  }
  const cell = (band, lane) => { const bi = Z().BANDS.indexOf(band), li = Z().LANES.indexOf(lane); return { x: 10 + li * 93.3, y: 10 + bi * 90, w: 93.3, h: 90 }; };
  C.zoneCentre = z => { const [b, l] = String(z).split(' · '); const c = cell(b, l); return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; };
  C.zoneMap = function (counts, total, opts) {
    opts = opts || {};
    if (!total) return C.empty('No zones coded yet', 'Code the zone for each event to see where it happens. No map is drawn from uncoded data.', 'a zone field coded');
    const max = Math.max(1, ...Object.values(counts));
    let inner = '<g clip-path="url(#oval)">';
    Z().BANDS.forEach(b => Z().LANES.forEach(l => {
      const z = b + ' · ' + l, n = counts[z] || 0, c = cell(b, l);
      inner += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="rgba(19,122,64,${(n / max * 0.75).toFixed(3)})" stroke="#fff" stroke-width="2" data-zone="${esc(z)}" data-tip="${esc(`<b>${esc(z)}</b><br>${n} of ${total} coded (${U.pct(n / total)})`)}" style="cursor:pointer"/>`;
      if (n) inner += `<text x="${c.x + c.w / 2}" y="${c.y + c.h / 2 + 5}" text-anchor="middle" class="zl" fill="${n / max > .55 ? '#fff' : '#141414'}">${n}</text>`;
    }));
    inner += '</g>';
    return ground(inner);
  };
  C.sequenceMap = function (steps, zoneKey, label) {
    const pts = steps.filter(e => e.v[zoneKey]).map(e => Object.assign(C.zoneCentre(e.v[zoneKey]), { e }));
    if (!pts.length) return C.empty('No zones in this chain', 'Code a zone on each action to draw the path.', 'zones');
    const jit = pts.map((p, i) => ({ x: p.x + ((i * 37) % 30) - 15, y: p.y + ((i * 23) % 24) - 12, e: p.e }));
    let inner = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#141414"/></marker></defs>';
    for (let i = 1; i < jit.length; i++) inner += `<line x1="${jit[i - 1].x}" y1="${jit[i - 1].y}" x2="${jit[i].x}" y2="${jit[i].y}" stroke="#141414" stroke-width="1.8" marker-end="url(#arr)"/>`;
    inner += jit.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="10" fill="${i === jit.length - 1 ? '#f6c453' : '#137a40'}" stroke="#fff" stroke-width="2" data-open="${p.e.id}" style="cursor:pointer" data-tip="${esc(`<b>${i + 1}. ${esc(label(p.e))}</b><br>${esc(p.e.v[zoneKey])}`)}"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" class="zl" fill="${i === jit.length - 1 ? '#141414' : '#fff'}" style="pointer-events:none;font-size:10px">${i + 1}</text>`).join('');
    return ground(inner);
  };

  /* Event timeline by quarter lane. colour(e) -> css colour; tip(e) -> html; label(e) -> short text */
  C.timeline = function (events, qsecs, colour, tip, label, selId) {
    const W = 1000, left = 34, right = 14, laneH = 28, top = 18;
    const xMax = Math.max(qsecs, ...events.map(e => Lab.Analysis.derive(e).el || 0));
    const x = s => left + (Math.min(s, xMax) / xMax) * (W - left - right);
    const qs = [1, 2, 3, 4].concat([...new Set(events.map(e => e.period))].filter(q => q > 4));
    const H = top + qs.length * laneH + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart tl" role="img" aria-label="Events by quarter and clock">`;
    for (let m = 0; m <= xMax / 60; m += 5) s += `<line x1="${x(m * 60)}" x2="${x(m * 60)}" y1="${top - 4}" y2="${H - 4}" stroke="${C.COL.grid}" stroke-dasharray="2 3"/><text x="${x(m * 60)}" y="${top - 6}" text-anchor="middle" class="ax">${m}′</text>`;
    qs.forEach((q, i) => { const y = top + i * laneH + laneH / 2; s += `<text x="0" y="${y + 4}" class="ql">Q${q}</text><line x1="${left}" x2="${W - right}" y1="${y}" y2="${y}" stroke="${C.COL.grid}"/>`; });
    events.forEach(e => {
      const el = Lab.Analysis.derive(e).el; const qi = qs.indexOf(e.period); if (el == null || qi < 0) return;
      const y = top + qi * laneH + laneH / 2, cx = x(el), lb = label ? label(e) : '';
      s += `<g class="ev${selId === e.id ? ' sel' : ''}" data-open="${e.id}" data-tip="${esc(tip(e))}" style="cursor:pointer"><circle cx="${cx}" cy="${y}" r="12" fill="transparent"/><circle cx="${cx}" cy="${y}" r="6.5" fill="${colour(e)}" stroke="${colour(e) === '#fff' ? '#9c9a94' : '#fff'}" stroke-width="2"/>${lb ? `<text x="${cx}" y="${y - 10}" text-anchor="middle" class="lbl">${esc(lb)}</text>` : ''}</g>`;
    });
    return s + '</svg>';
  };
})(window.Lab);
