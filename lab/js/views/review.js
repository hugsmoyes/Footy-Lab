/* Match review: one completed match, from our point of view.
   Order: what data the match has (coverage) -> result and context -> team match stats -> player match stats
   -> optional coded events and video -> findings. Nothing here diagnoses the game: it shows what was recorded,
   says where it came from, and lets the analyst write findings that keep evidence and opinion apart. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;
  const MD = () => Lab.MD;
  const SECS = [['coverage', 'Data coverage'], ['overview', 'Overview'], ['team', 'Team stats'], ['players', 'Player stats'], ['events', 'Events & video'], ['findings', 'Findings']];
  const plus = (attr, label) => `<button class="btn sm ico" ${attr} data-tip="Add to a finding" aria-label="Add ${U.esc(label)} to a finding">+</button>`;
  const sg = (v, unit) => v == null || isNaN(v) ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + (unit === 'm' ? Math.round(Math.abs(v)).toLocaleString('en-AU') : MD().fmt('count', Math.abs(v)).replace(/\.0$/, ''));

  Lab.openReview = function (matchId, sec) {
    vs.rvMatch = matchId;
    vs.rvSec = sec || (M.reviewFor(matchId) ? 'overview' : 'coverage');
    Lab.go('review');
  };
  function ensureReview(m) { return M.reviewFor(m.id) || M.addReview({ matchId: m.id }); }

  /* ---------- actions from coverage rows and empty states ---------- */
  Lab.reviewAct = function (act, m) {
    const w = M.ws(), team = w.focus;
    if (act === 'editMatch') return Lab.openMatchForm(m.id);
    if (act === 'quarters') return quartersForm(m);
    if (act === 'manual') return manualStats(m);
    if (act === 'lineups') { Lab.syncTeams([m.home, m.away]); return Lab.openLineup(m.id); }
    if (act.startsWith('import:')) { vs.iKind = act.slice(7); vs.iMatch = m.id; Lab.go('data'); setTimeout(() => { const d = document.getElementById('importCard'); if (d) d.scrollIntoView({ behavior: 'smooth' }); }, 40); return; }
    if (act === 'tpl:team' || act === 'tpl:player') { Lab.syncTeams([m.home, m.away]); const k = act.slice(4); U.download(`${k}-stats-${U.norm(m.round)}-${U.norm(m.home)}-${U.norm(m.away)}.csv`, MD().templateCSV(m, team, k), 'text/csv;charset=utf-8'); U.toast('Template downloaded. Fill it in, then import it on the Data tab.'); return; }
    if (act === 'code') { vs.code = vs.code || {}; vs.code.matchId = m.id; vs.code.team = team; vs.code.recent = []; Lab.go('code'); return; }
    if (act === 'video') { vs.videoMatch = m.id; Lab.go('video'); return; }
  };

  function quartersForm(m) {
    const rv = ensureReview(m), q = rv.quarters || { home: ['', '', '', ''], away: ['', '', '', ''] };
    const row = side => `<tr><td class="l"><b>${U.esc(m[side])}</b></td>${[0, 1, 2, 3].map(i => `<td><input class="num" data-q="${side}:${i}" value="${U.esc(q[side][i] || '')}" placeholder="g.b" aria-label="${U.esc(m[side])} at end of Q${i + 1}"></td>`).join('')}</tr>`;
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(M.matchLabel(m))}</span><h2 id="drawerTitle">Quarter scores</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><p class="sub" style="margin-top:0">Running score at the end of each quarter, as goals.behinds (e.g. 3.2, 6.5, 9.7, 12.10).</p>
      <div class="tw"><table class="compact entry"><thead><tr><th class="l">Team</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Final</th></tr></thead><tbody>${row('home')}${row('away')}</tbody></table></div>
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="qSave">Save quarter scores</button></div><div id="qErr" class="warnline hidden"></div></div>`, d => {
      U.$('#qSave', d).onclick = () => {
        const out = { home: [], away: [] }; let bad = false;
        U.$$('[data-q]', d).forEach(i => { const [s, k] = i.dataset.q.split(':'), v = i.value.trim(); if (v && !/^\d+\.\d+$/.test(v)) bad = true; out[s][+k] = v; });
        const err = U.$('#qErr', d);
        if (bad) { err.textContent = 'Use goals.behinds, e.g. 6.5'; err.classList.remove('hidden'); return; }
        const fin = side => M.parseScore(side === 'home' ? m.homeScore : m.awayScore), q4 = side => { const v = out[side][3]; if (!v) return null; const [g, b] = v.split('.').map(Number); return 6 * g + b; };
        const clash = ['home', 'away'].filter(s => fin(s) && q4(s) != null && fin(s).pts !== q4(s));
        M.updateReview(rv.id, { quarters: out });
        if (clash.length) U.toast(`Final quarter doesn't match the match score for ${clash.map(s => m[s]).join(' and ')}. Check both.`, 'warn'); else U.toast('Quarter scores saved');
        Lab.closeDrawer();
      };
    });
  }

  function manualStats(m) {
    const w = M.ws(), team = w.focus, opp = M.opponentIn(m, team);
    const mets = MD().entryMetrics('team');
    const groups = [...new Set(mets.map(x => x.group || 'Other'))];
    const cell = (t, mt) => { const v = M.state.teamStats[M.tsKey(m.id, t, 'Full', mt.id)]; return `<td><input class="num" data-ms="${U.esc(t)}|${mt.id}" value="${v == null ? '' : v}" inputmode="decimal" aria-label="${U.esc(t)} ${U.esc(mt.name)}"></td>`; };
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(M.matchLabel(m, team))}</span><h2 id="drawerTitle">Enter team stats</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><p class="sub" style="margin-top:0">Full-game numbers from your stat sheet. Leave a box blank if you don't have it: blank stays missing, it is never read as zero. Use the importer for quarter splits.</p>
      <div class="tw" style="max-height:60vh;overflow:auto"><table class="compact entry"><thead><tr><th class="l">Stat</th><th>${U.esc(team)}</th><th>${U.esc(opp)}</th></tr></thead><tbody>
      ${groups.map(g => `<tr class="grp-row"><td class="l" colspan="3">${U.esc(g)}</td></tr>` + mets.filter(x => (x.group || 'Other') === g).map(mt => `<tr><td class="l">${U.esc(mt.name)}${mt.unit === '%' ? ' %' : ''}</td>${cell(team, mt)}${cell(opp, mt)}</tr>`).join('')).join('')}
      </tbody></table></div><div class="ctl" style="margin-top:12px"><button class="btn g" id="msSave">Save stats</button></div></div>`, d => {
      U.$('#msSave', d).onclick = () => {
        let n = 0, bad = 0;
        U.$$('[data-ms]', d).forEach(i => { const [t, id] = i.dataset.ms.split('|'), raw = i.value.trim().replace('%', ''); if (raw !== '' && isNaN(parseFloat(raw))) { bad++; return; } M.setTeamStat(m.id, t, 'Full', id, raw === '' ? '' : parseFloat(raw), true); if (raw !== '') n++; });
        M.emit('stats'); Lab.closeDrawer(); U.toast(`${n} values saved${bad ? `; ${bad} not numbers, skipped` : ''}`, bad ? 'warn' : '');
      };
    });
  }

  /* ---------- findings from review data ---------- */
  function lim(parts) { return parts.filter(Boolean).join(' '); }
  function fdQuarters(m, team, r) {
    const opp = M.opponentIn(m, team);
    Lab.newFinding({ title: `${m.round} v ${opp}: scoring by quarter`, stat: `${team} v ${opp}, ${m.round} ${m.season}. Points by quarter: ${[0, 1, 2, 3].map(i => `Q${i + 1} ${r.qUs[i]}-${r.qThem[i]}`).join(', ')}. Final ${r.us}-${r.them} (${r.res} ${U.signed(r.margin)}).`, n: 1, matchIds: [m.id], source: r.src, chart: { kind: 'mQuarters', matchId: m.id }, limitations: 'One match. Quarter scores show when points came, not why.' });
  }
  function fdTeam(m, team, row, period) {
    const opp = M.opponentIn(m, team), f = v => MD().fmt(row.unit, v);
    Lab.newFinding({ title: `${row.label}${period && period !== 'Full' ? ' (' + period + ')' : ''}: ${team} ${f(row.us)}, ${opp} ${f(row.them)}`,
      stat: `${team} ${f(row.us)}, ${opp} ${f(row.them)}${row.us != null && row.them != null ? ` (difference ${sg(row.us - row.them)})` : ''}, ${m.round} ${m.season}${period && period !== 'Full' ? ', ' + period : ''}.${row.base ? ` ${row.base.label.replace(/^./, c => c.toUpperCase())}: ${f(row.base.f)} for, ${f(row.base.a)} against.` : ''}`,
      n: 1, matchIds: [m.id], source: row.srcLabel, chart: { kind: 'mTeamStat', matchId: m.id, id: row.id, period: period || 'Full' },
      limitations: lim(['One match. A team total shows how much, not why: check the footage before reading a cause into it.', row.src === 'pack' ? 'Team totals are summed from player stat lines.' : '', row.base ? row.base.note : 'No baseline available for this stat.']) });
  }
  function fdPlayer(m, team, pl, row, k) {
    const c = pl.cols[k], f = v => MD().fmt(c.unit, v), opp = M.opponentIn(m, team);
    const sk = c.seasonKey, sv = sk && row.s ? row.s[sk] : null;
    Lab.newFinding({ title: `${row.name}: ${c.label.toLowerCase()} v ${opp}`, stat: `${row.name} (${team}) ${f(row.v[k])} ${c.label.toLowerCase()} v ${opp}, ${m.round} ${m.season}.${sv != null ? ` Season average ${Lab.Pack.fmtP(sk, sv)} across ${row.games} games (context, not this match).` : ''}`,
      n: 1, matchIds: [m.id], source: pl.srcLabel, chart: { kind: 'mPlayers', matchId: m.id, team, col: k }, limitations: 'One match, one player. Role, time on ground and match-ups shape single-game numbers.' });
  }

  /* ---------- sections ---------- */
  const sec = {};
  sec.coverage = (m, team, rv) => {
    const P = Lab.Pack, items = MD().coverage(m, team, rv);
    const note = P && P.ok ? (P.hasGames ? `Built-in ${P.raw.competition} ${P.raw.season} data covers results with quarter scores and per-game player stats (team totals are summed from those). It has no quarter splits for stats.` : `Built-in ${P.raw.competition} ${P.raw.season} data covers results with quarter scores, team season stats, player season averages and club lists. It has no per-game team or player stats, so match-level stats need an import.`) : `There's no built-in ${M.ws().competition} ${m.season} data: everything for this match comes from what you enter or import.`;
    return `<section class="card"><div class="card-h"><div><h2>What this match has</h2><p>${U.esc(note)} Missing means not recorded, not zero.</p></div><div class="ctl">${rv ? `<label class="done-t"><input type="checkbox" data-rvdone="coverage" ${(rv.done || {}).coverage ? 'checked' : ''}> Coverage checked</label>` : ''}</div></div>
      ${MD().coverageTable(items)}
      ${rv ? `<div class="ctl" style="margin-top:12px;justify-content:flex-end"><button class="btn g" data-sec="overview">Next: overview →</button></div>` : ''}</section>`;
  };

  function quarterTable(m, team, r) {
    const opp = M.opponentIn(m, team);
    return `<div class="tw"><table class="compact"><thead><tr><th class="l">Team</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Final</th></tr></thead><tbody>
      <tr><td class="l"><b>${U.esc(team)}</b></td>${r.cumUs.map(c => `<td class="mono">${MD().fmtGB(c)}</td>`).join('')}</tr>
      <tr><td class="l">${U.esc(opp)}</td>${r.cumThem.map(c => `<td class="mono">${MD().fmtGB(c)}</td>`).join('')}</tr>
      <tr><td class="l muted">Quarter margin</td>${[0, 1, 2, 3].map(i => { const d = r.qUs[i] - r.qThem[i]; return `<td class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${r.qUs[i] == null ? '–' : U.signed(d)}</td>`; }).join('')}</tr>
    </tbody></table></div>`;
  }
  function keyIds(rv) { const w = M.ws(); return rv.keyStats || w.keyStats || MD().DEFAULT_KEYS; }
  function statTable(m, team, rows, period, chartSel) {
    const opp = M.opponentIn(m, team);
    if (!rows.length) return '';
    const anyBase = rows.some(r => r.base);
    return `<div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>${U.esc(team)}</th><th>${U.esc(opp)}</th><th>Diff</th>${anyBase ? '<th data-tip="Our average for comparison. Hover a value for what it covers.">Our usual</th><th data-tip="This match minus our usual">v usual</th>' : ''}<th class="l">Source</th><th></th></tr></thead><tbody>
      ${rows.map(r => { const f = v => MD().fmt(r.unit, v); const d = r.us != null && r.them != null ? r.us - r.them : null, dv = r.base && r.us != null && r.base.f != null ? r.us - r.base.f : null;
        return `<tr class="${chartSel === r.id ? 'hl' : ''}"><td class="l">${chartSel !== undefined ? `<button class="link" data-chart="${U.esc(r.id)}">${U.esc(r.label)}</button>` : U.esc(r.label)}</td><td><b>${f(r.us)}</b></td><td>${f(r.them)}</td><td>${r.unit === 'ratio' ? (d == null ? '–' : U.signed(U.round(d * 100, 1)) + ' pts') : sg(d, r.unit)}</td>
          ${anyBase ? `<td class="muted" ${r.base ? `data-tip="${U.esc(`<b>${r.base.label}</b><br>${r.base.note}`)}"` : ''}>${r.base ? f(r.base.f) + (r.base.season ? '<sup class="flag">season</sup>' : '') : '–'}</td><td>${r.unit === 'ratio' ? (dv == null ? '–' : U.signed(U.round(dv * 100, 1)) + ' pts') : sg(dv, r.unit)}</td>` : ''}
          <td class="l small muted">${r.src === 'pack' ? 'Built in' : 'Imported'}</td><td>${plus(`data-fdt="${U.esc(r.id)}"`, r.label)}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  sec.overview = (m, team, rv) => {
    const r = MD().result(m, team, rv), opp = M.opponentIn(m, team), b = MD().before(m, team);
    const all = MD().teamRows(m, team, 'Full'), ids = keyIds(rv), key = ids.map(id => all.find(x => x.id === id)).filter(Boolean);
    const fds = M.wsFindings(rv.id);
    const next = !all.length && !MD().players(m, team) ? ['Import match stats', 'This match has no team or player match stats yet. Import them, enter key stats by hand, or go straight to findings from what you saw.', 'coverage']
      : !fds.length ? ['Write your first finding', 'Use + next to any stat, or start a blank finding.', 'findings'] : [`${fds.length} finding${fds.length === 1 ? '' : 's'} so far`, 'Check the evidence, then mark findings ready for the report.', 'findings'];
    return `<section class="grid g2">
      <div class="card"><div class="card-h"><div><h2>Result</h2><p>${r ? U.esc(r.src) : 'No score entered'}</p></div>${r && r.quarters ? `<div class="ctl">${plus('data-fdq', 'quarter scoring')}</div>` : ''}</div>
        ${r ? `<div class="scoreline"><span class="sl-t">${U.esc(team)}</span><b>${r.us}</b><span class="sl-v">${r.res === 'Win' ? 'd' : r.res === 'Loss' ? 'lost to' : 'drew with'}</span><b>${r.them}</b><span class="sl-t">${U.esc(opp)}</span><span class="res res-${r.res}">${r.res} ${U.signed(r.margin)}</span></div>
          ${r.quarters ? quarterTable(m, team, r) + `<div class="mini-chart">${MD().chart({ kind: 'mQuarters', matchId: m.id })}</div>` : `<p class="warnline">No quarter scores. <button class="link" data-act="quarters">Add them</button> to see the game by quarter.</p>`}`
          : C.empty('No result for this match', 'Enter the final score, and quarter scores if you have them.', 'a score')}
        <p class="sub">${U.esc([m.date, m.venue].filter(Boolean).join(' · '))}</p>
      </div>
      <div class="grid">
        ${b ? `<div class="card"><div class="card-h"><div><h3>Going into the match</h3><p>Context from the built-in season results. Not part of this match's output.</p></div></div>
          <div class="tw"><table class="compact"><thead><tr><th class="l">Team</th><th>Record</th><th>Avg margin</th><th class="l">Last 5</th></tr></thead><tbody>
            <tr><td class="l"><b>${U.esc(team)}</b></td><td>${b.us.wld}</td><td>${sg(b.us.margin)}</td><td class="l mono">${U.esc(b.us.last5 || '–')}</td></tr>
            <tr><td class="l">${U.esc(opp)}</td><td>${b.them.wld}</td><td>${sg(b.them.margin)}</td><td class="l mono">${U.esc(b.them.last5 || '–')}</td></tr></tbody></table></div><p class="sub">${b.us.n} and ${b.them.n} earlier games.</p></div>` : ''}
        <div class="card"><div class="card-h"><div><h3>Review focus</h3><p>What staff wanted to look at in this game.</p></div><div class="ctl"><button class="btn sm" id="rvFocus">Edit</button></div></div>
          ${(rv.focus || []).length ? `<div>${rv.focus.map(x => `<span class="tag">${U.esc(x)}</span>`).join('')}</div>` : '<p class="muted">No focus areas set. Optional.</p>'}</div>
        <div class="next"><span class="k">Next</span><b>${U.esc(next[0])}</b><span>${U.esc(next[1])}</span><button class="btn sm g" data-sec="${next[2]}">Go</button></div>
      </div>
    </section>
    <section class="sec card"><div class="card-h"><div><h2>Key team stats</h2><p>${key.length ? `${key.length} of ${all.length} stats this match has. "Our usual" is our average in other games, so this game can be compared with our own baseline.` : all.length ? 'None of your key stats are recorded for this match.' : 'No team match stats for this match.'}</p></div>
      <div class="ctl">${all.length ? '<button class="btn sm" id="rvKeys">Choose key stats</button><button class="btn sm" data-sec="team">All team stats</button>' : ''}</div></div>
      ${key.length ? statTable(m, team, key, 'Full') : all.length ? '<p class="muted">Choose key stats to show here.</p>' : `<div class="empty"><h3>No team match stats yet</h3><p>${U.esc(MD().coverage(m, team, rv).find(c => c.id === 'teamstats').text)}</p><div class="ctl"><button class="btn g" data-act="import:teamstats">Import team stats</button><button class="btn" data-act="tpl:team">Pre-filled template</button><button class="btn" data-act="manual">Enter stats by hand</button></div></div>`}
    </section>`;
  };
  sec.team = (m, team, rv) => {
    const pers = ['Full'].concat(MD().importPeriods(m, team).filter(p => p !== 'Full'));
    const period = pers.includes(vs.rvPeriod) ? vs.rvPeriod : 'Full';
    const rowsAll = MD().teamRows(m, team, period), groups = [...new Set(rowsAll.map(r => r.group))];
    const grp = groups.includes(vs.rvGroup) ? vs.rvGroup : '';
    const rows = rowsAll.filter(r => !grp || r.group === grp);
    const sel = rows.some(r => r.id === vs.rvStat) ? vs.rvStat : (rows[0] || {}).id;
    const r = MD().result(m, team, rv);
    return `<section class="card"><div class="card-h"><div><h2>Team match stats</h2><p>${U.esc(team)} and ${U.esc(M.opponentIn(m, team))} in this match, with our usual numbers for comparison. Click a stat to chart it.</p></div></div>
      ${rowsAll.length || period !== 'Full' ? `<div class="f-row" style="margin-bottom:10px">
        <div class="f"><label>Quarter</label><span class="seg">${['Full', 'Q1', 'Q2', 'Q3', 'Q4'].map(p => `<button class="${p === period ? 'on' : ''}" data-per="${p}" ${pers.includes(p) ? '' : 'disabled data-tip="No imported stats for this quarter"'}>${p === 'Full' ? 'Full game' : p}</button>`).join('')}</span></div>
        <div class="f"><label for="rvG">Stat group</label><select id="rvG"><option value="">All (${rowsAll.length})</option>${groups.map(g => `<option ${g === grp ? 'selected' : ''}>${U.esc(g)}</option>`).join('')}</select></div></div>
        ${period !== 'Full' ? '<p class="sub">Quarter splits come from imported stats only. Built-in totals are full game.</p>' : ''}` : ''}
      ${rows.length ? `<div class="grid g-side"><div>${statTable(m, team, rows, period, sel)}</div><div class="card" style="box-shadow:none"><h3>${U.esc((rows.find(x => x.id === sel) || {}).label || '')}</h3>${MD().chart({ kind: 'mTeamStat', matchId: m.id, id: sel, period })}<div class="ctl"><button class="btn sm" data-fdt="${U.esc(sel)}">+ Add to a finding</button></div></div></div>`
        : `<div class="empty"><h3>No team match stats${period !== 'Full' ? ' for ' + period : ''}</h3><p>${U.esc(MD().coverage(m, team, rv).find(c => c.id === 'teamstats').text)}</p><div class="ctl"><button class="btn g" data-act="import:teamstats">Import team stats</button><button class="btn" data-act="tpl:team">Pre-filled template</button><button class="btn" data-act="manual">Enter stats by hand</button></div></div>`}
      <p class="sub">These are totals for the game. They show how much happened, not why: they don't tell you a tactical cause. Turn what stands out into a review question and check it on footage.</p>
    </section>
    ${r && r.quarters ? `<section class="sec card"><div class="card-h"><div><h2>Scoring by quarter</h2><p>${U.esc(r.src)}</p></div><div class="ctl">${plus('data-fdq', 'quarter scoring')}</div></div>${quarterTable(m, team, r)}</section>` : ''}`;
  };
  sec.players = (m, team, rv) => {
    const opp = M.opponentIn(m, team), side = vs.rvSide === 'them' ? opp : team;
    const pl = MD().players(m, side), P = Lab.Pack;
    const sideSeg = `<span class="seg">${[['us', team], ['them', opp]].map(([k, l]) => `<button class="${(vs.rvSide === 'them' ? 'them' : 'us') === k ? 'on' : ''}" data-side="${k}">${U.esc(l)}</button>`).join('')}</span>`;
    if (!pl) {
      const pt = P && P.ok ? P.resolve(side) : '', ros = pt ? P.roster(pt).filter(p => p.games) : [];
      const ctxCols = P && P.ok ? (P.PSETS[0] || ['', []])[1].filter(k => k !== 'Matches').slice(0, 9) : [];
      return `<section class="card"><div class="card-h"><div><h2>Player match stats</h2><p>${U.esc(side)} in this match.</p></div><div class="ctl">${sideSeg}</div></div>
        <div class="empty"><h3>No player stats for this match</h3><p>${U.esc(MD().coverage(m, team, rv).find(c => c.id === 'playerstats').text)} Import a file with one row per player for this match (Season, Round, Team, Opponent, Player, then any stats).</p>
          <div class="ctl"><button class="btn g" data-act="import:playerstats">Import player stats</button><button class="btn" data-act="tpl:player">Pre-filled template</button></div></div></section>
        ${ros.length ? `<details class="sec card"><summary><b>Season context: ${U.esc(side)} season averages</b> <span class="muted">(not this match)</span></summary>
          <p class="sub">${U.esc(P.raw.competition + ' ' + P.raw.season)} averages per game, for context only. They are not what anyone did in ${U.esc(m.round)}.</p>
          <div class="tw" style="max-height:480px;overflow:auto"><table class="compact"><thead><tr><th class="l">Player</th><th>Games</th>${ctxCols.map(k => `<th data-tip="${U.esc(P.PSTAT[k].name)}">${U.esc(P.PSTAT[k].head)}</th>`).join('')}</tr></thead><tbody>
          ${ros.map(p => `<tr><td class="l">${U.esc(p.name)}</td><td>${p.games}</td>${ctxCols.map(k => `<td>${p.s && p.s[k] != null ? P.fmtP(k, p.s[k]) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : ''}`;
    }
    const setName = pl.sets.some(s => s[0] === vs.rvPSet) ? vs.rvPSet : pl.sets[0][0], cols = (pl.sets.find(s => s[0] === setName) || pl.sets[0])[1].filter(k => pl.cols[k]);
    const sortK = cols.includes(vs.rvPSort) || vs.rvPSort === 'name' ? vs.rvPSort : (cols.find(k => !/TimeOnGround|Percentage/.test(k)) || cols[0]), q = (vs.rvPQ || '').toLowerCase();
    const rows = pl.rows.filter(r => !q || r.name.toLowerCase().includes(q) || String(r.number) === q).sort((a, b) => sortK === 'name' ? a.name.localeCompare(b.name) : (b.v[sortK] == null ? -1e9 : b.v[sortK]) - (a.v[sortK] == null ? -1e9 : a.v[sortK]));
    const th = (k, l, tip) => `<th class="${k === 'name' ? 'l' : ''}"><button class="link sortb${sortK === k ? ' on' : ''}" data-psort="${U.esc(k)}" ${tip ? `data-tip="${U.esc(tip)}"` : ''}>${U.esc(l)}${sortK === k ? ' ↓' : ''}</button></th>`;
    return `<section class="card"><div class="card-h"><div><h2>Player match stats</h2><p>${U.esc(side)} in ${U.esc(m.round)} v ${U.esc(M.opponentIn(m, side))} · ${rows.length} players · ${U.esc(pl.srcLabel)}. Click a player for his line and, where available, his season average as context.</p></div>
        <div class="ctl">${sideSeg}<input type="search" id="rvPQ" placeholder="Name or number" value="${U.esc(vs.rvPQ || '')}" aria-label="Search players"></div></div>
      ${pl.sets.length > 1 ? `<div class="ctl" style="margin-bottom:10px"><span class="seg">${pl.sets.map(([n]) => `<button class="${n === setName ? 'on' : ''}" data-pset="${U.esc(n)}">${U.esc(n)}</button>`).join('')}</span></div>` : ''}
      <div class="grid g-side"><div class="tw" style="max-height:640px;overflow:auto"><table class="compact"><thead><tr><th>#</th>${th('name', 'Player')}${cols.map(k => th(k, pl.cols[k].head, pl.cols[k].label)).join('')}</tr></thead><tbody>
        ${rows.map(r => `<tr class="click" data-prow="${U.esc(r.id)}" tabindex="0"><td class="mono">${U.esc(r.number || '')}</td><td class="l"><button class="link">${U.esc(r.name)}</button></td>${cols.map(k => `<td>${MD().fmt(pl.cols[k].unit, r.v[k])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="card" style="box-shadow:none">${sortK !== 'name' ? `<h3>${U.esc(pl.cols[sortK].label)}: leaders</h3>${MD().chart({ kind: 'mPlayers', matchId: m.id, team: side, col: sortK })}<div class="ctl"><button class="btn sm" id="rvPLead">+ Add to a finding</button></div>` : '<p class="muted">Sort by a stat to chart it.</p>'}</div></div>
    </section>`;
  };
  function playerDrawer(m, side, pl, row) {
    const keys = Object.keys(pl.cols).filter(k => row.v[k] != null), P = Lab.Pack;
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(side)}${row.number ? ' · #' + U.esc(row.number) : ''} · ${U.esc(M.matchLabel(m, side))}</span><h2 id="drawerTitle">${U.esc(row.name)}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b"><p class="sub" style="margin-top:0">This match: ${U.esc(pl.srcLabel)}.${row.s ? ` Season average is ${U.esc(P.raw.season)} context across ${row.games} games, not part of this match.` : ''}</p>
      <div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>This match</th>${row.s ? '<th>Season avg (context)</th>' : ''}<th></th></tr></thead><tbody>
      ${keys.map(k => { const c = pl.cols[k], sv = row.s && c.seasonKey ? row.s[c.seasonKey] : null; return `<tr><td class="l">${U.esc(c.label)}</td><td><b>${MD().fmt(c.unit, row.v[k])}</b></td>${row.s ? `<td class="muted">${sv == null ? '–' : P.fmtP(c.seasonKey, sv)}</td>` : ''}<td>${plus(`data-pfd="${U.esc(k)}"`, c.label)}</td></tr>`; }).join('')}
      </tbody></table></div></div>`, d => {
      U.$$('[data-pfd]', d).forEach(b => b.onclick = () => fdPlayer(m, side, pl, row, b.dataset.pfd));
    });
  }
  sec.events = (m, team, rv) => {
    const opp = M.opponentIn(m, team), evs = M.state.events.filter(e => e.matchId === m.id);
    const v = MD().videoStatus(m), clips = M.state.clips.filter(c => c.matchId === m.id).sort((a, b) => a.start - b.start);
    const byT = U.groupBy(evs, e => e.templateId), tids = [...byT.keys()];
    const tplId = tids.includes(vs.rvTpl) ? vs.rvTpl : tids[0], tpl = tplId && M.template(tplId);
    let breakdown = '';
    if (tpl) {
      const dims = A.dims(tpl, M.ws()).filter(x => x.field && ['choice', 'zone', 'player'].includes(x.field.type));
      const by = dims.some(x => x.key === vs.rvBy) ? vs.rvBy : (dims[0] || {}).key;
      const sideK = vs.rvEvSide || 'us', list = byT.get(tplId).filter(e => sideK === 'both' || (sideK === 'us' ? e.team === team : e.team !== team));
      const ct = by ? A.counts(list, by, M.ws(), (dims.find(x => x.key === by) || {}).order) : null;
      breakdown = `<section class="sec card"><div class="card-h"><div><h3>What was coded: ${U.esc(tpl.name)}</h3><p>${list.length} ${U.esc(tpl.unit || 'event')}s · counts of what the coder recorded, not a rating.</p></div>
        <div class="ctl"><select id="rvTpl" aria-label="Template">${tids.map(id => `<option value="${id}" ${id === tplId ? 'selected' : ''}>${U.esc((M.template(id) || {}).name || id)} (${byT.get(id).length})</option>`).join('')}</select>
        <span class="seg">${[['us', team], ['them', opp], ['both', 'Both']].map(([k, l]) => `<button class="${sideK === k ? 'on' : ''}" data-evside="${k}">${U.esc(l)}</button>`).join('')}</span>
        ${dims.length ? `<select id="rvBy" aria-label="Field">${dims.map(x => `<option value="${x.key}" ${x.key === by ? 'selected' : ''}>${U.esc(x.label)}</option>`).join('')}</select>` : ''}<button class="btn sm" id="rvEvFd" ${ct && ct.rows.length ? '' : 'disabled'}>+ Add to a finding</button></div></div>
        ${ct ? C.bars(ct.rows.map(r => ({ label: r.label, r: r.r })), { emptyTitle: 'Nothing coded for this field', need: 'that field coded' }) + `<p class="sub">Share of ${ct.coded} events with this field coded${ct.uncoded ? `; ${ct.uncoded} left blank are not counted` : ''}.</p>` : C.empty('No fields to break down')}</section>`;
    }
    const col = e => e.team === team ? C.COL.opp : C.COL.their;
    const tip = e => { const t = M.template(e.templateId); return `<b>Q${e.period} ${U.esc(e.clock)} · ${U.esc(e.team)}</b><br>${U.esc(t ? t.name : '')}` + (t ? '<br>' + t.fields.filter(f => f.type !== 'text' && e.v[f.key] != null && e.v[f.key] !== '').slice(0, 4).map(f => `${U.esc(f.label)}: ${U.esc(f.type === 'player' ? M.playerName(e.v[f.key]) : e.v[f.key])}`).join('<br>') : ''); };
    return `<section class="grid g2">
      <div class="card"><div class="card-h"><div><h2>Coded events</h2><p>Optional. ${evs.length ? `${evs.length} events in this match (${evs.filter(e => e.team === team).length} for ${U.esc(team)}).` : 'Nothing coded for this match yet.'}</p></div>
        <div class="ctl"><button class="btn sm g" data-act="code">Code this match</button><button class="btn sm" data-act="import:events">Import events</button>${evs.length ? '<button class="btn sm" id="rvExplore">Explore</button>' : ''}</div></div>
        ${evs.length ? `<div class="tl-match">${C.timeline(evs, M.quarterSecs(m), col, tip, e => (e.video && e.video.time != null) || M.state.clips.some(c => c.eventId === e.id) ? '▶' : '', vs.selEvent)}</div><div class="legend"><span><i style="background:${C.COL.opp}"></i>${U.esc(team)}</span><span><i style="background:${C.COL.their}"></i>${U.esc(opp)}</span><span>▶ has a video time or clip</span></div><p class="sub">Click a dot to open the event. Events and clips can be linked to findings.</p>` : '<p class="muted">You can review this match from stats alone. Code with the starter templates (centre bounces, stoppages, kick-ins, entries, turnovers and more) or your own.</p>'}
      </div>
      <div class="card"><div class="card-h"><div><h2>Video</h2><p>${U.esc(v.text)}</p></div><div class="ctl"><button class="btn sm g" data-act="video">${v.any ? 'Open video' : 'Add video'}</button></div></div>
        ${clips.length ? `<div class="tw" style="max-height:320px;overflow:auto"><table class="compact"><thead><tr><th class="l">Clip</th><th>In–out</th><th class="l"></th></tr></thead><tbody>${clips.map(c => `<tr><td class="l wrap">${U.esc(c.title)}</td><td class="mono">${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}</td><td class="l"><button class="btn sm" data-cfd="${c.id}">+ Finding</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No clips for this match. Clips are in and out points on the match video; make them on the Video tab.</p>'}
      </div>
    </section>${breakdown}`;
  };
  sec.findings = (m, team, rv) => {
    const list = M.wsFindings(rv.id);
    return `<section class="card"><div class="card-h"><div><h2>Findings for this match</h2><p>Keep what the data shows apart from what you think it means and what to do next. Order here is the report order.</p></div>
      <div class="ctl"><button class="btn g" id="rvNewF">+ New finding</button><button class="btn" id="rvRep" ${list.length ? '' : 'disabled'}>Build match report →</button></div></div>
      ${list.length ? Lab.findingCards(list) : `<div class="empty"><h3>No findings yet</h3><p>Use <b>+</b> next to a stat, a coded-events chart or a clip, or write one from scratch.</p><div class="ctl"><button class="btn" data-sec="team">Team stats</button><button class="btn" data-sec="players">Player stats</button><button class="btn" data-sec="events">Events & video</button></div></div>`}
    </section>
    ${list.some(f => f.followUp) ? `<section class="sec card"><div class="card-h"><div><h2>Follow-ups from this match</h2></div></div>${Lab.followTable(list)}</section>` : ''}`;
  };

  function secState(id, m, team, rv) {
    if (!rv) return 'empty';
    if ((rv.done || {})[id]) return 'complete';
    if (id === 'coverage') return 'progress';
    if (id === 'overview') return MD().result(m, team, rv) ? 'progress' : 'empty';
    if (id === 'team') return MD().teamRows(m, team, 'Full').length ? 'progress' : 'empty';
    if (id === 'players') return MD().players(m, team) ? 'progress' : 'empty';
    if (id === 'events') return M.state.events.some(e => e.matchId === m.id) || MD().videoStatus(m).any ? 'progress' : 'empty';
    if (id === 'findings') return M.wsFindings(rv.id).length ? 'progress' : 'empty';
    return 'empty';
  }

  Lab.Views.review = {
    render(el, { ws }) {
      const team = ws.focus, ms = M.sortMatches(M.state.matches.filter(m => M.involves(m, team)));
      if (!ms.length) { el.innerHTML = `<div class="empty"><h3>No matches to review yet</h3><p>Add a completed ${U.esc(team)} game first. Match review is for games that have been played; to prepare for an upcoming opponent, use Opponent Lab.</p><div class="ctl"><button class="btn g" id="rvAdd">+ Add a match</button></div></div>`; U.$('#rvAdd', el).onclick = () => Lab.openPackPicker(); return; }
      const played = ms.filter(m => MD().result(m, team, M.reviewFor(m.id)));
      if (!vs.rvMatch || !ms.some(m => m.id === vs.rvMatch)) { const withRv = ms.filter(m => M.reviewFor(m.id)); vs.rvMatch = (withRv[withRv.length - 1] || played[played.length - 1] || ms[ms.length - 1]).id; }
      const m = M.match(vs.rvMatch), rv = M.reviewFor(m.id), opp = M.opponentIn(m, team), r = MD().result(m, team, rv);
      const future = !r && m.date && m.date > U.today();
      Lab.syncTeams([m.home, m.away]);
      const cur = rv ? (SECS.some(s => s[0] === vs.rvSec) ? vs.rvSec : 'overview') : 'coverage';
      const picker = `<div class="f"><label for="rvM">Match</label><select id="rvM">${ms.slice().reverse().map(x => { const rr = MD().result(x, team, M.reviewFor(x.id)); return `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${U.esc(M.matchLabel(x, team))}${rr ? ` · ${rr.res[0]} ${U.signed(rr.margin)}` : ''}${M.reviewFor(x.id) ? ' · reviewed' : ''}</option>`; }).join('')}</select></div>`;
      const headline = `${U.esc(team)} ${r ? `${r.us} ${r.res === 'Win' ? 'd' : r.res === 'Loss' ? 'lost to' : 'drew with'} ${U.esc(opp)} ${r.them}` : `v ${U.esc(opp)}`}`;
      let body;
      if (!rv) {
        body = `<section class="card"><div class="card-h"><div><span class="k">Post-match review · completed match</span><h2>${headline}</h2><p>${U.esc([m.round, m.season, m.date, m.venue].filter(Boolean).join(' · '))}</p></div></div>
          ${future ? `<p class="warnline">This match is dated ${U.esc(m.date)} and has no score, so it looks like it hasn't been played. Match review is for completed games. To prepare for an upcoming opponent, use Opponent Lab.</p>` : ''}
          <div class="form" style="max-width:720px;margin-top:8px"><label class="full">Review focus (optional, comma separated)<input id="rvF0" placeholder="e.g. Stoppages, Forward entries, Defensive transition"></label></div>
          <div class="ctl" style="margin-top:10px"><button class="btn g" id="rvStart" ${future ? 'disabled' : ''}>Start review</button>${!r ? '<button class="btn" data-act="editMatch">Enter the score</button>' : ''}</div></section>
          <div class="sec">${sec.coverage(m, team, null)}</div>`;
      } else {
        body = `<div class="rv-nav" role="tablist" aria-label="Review sections">${SECS.map(([id, l]) => `<button role="tab" aria-selected="${id === cur}" data-sec="${id}" class="${id === cur ? 'on' : ''}"><i class="dot dot-${secState(id, m, team, rv)}"></i>${l}</button>`).join('')}<button class="rv-rep" id="rvRep2">Report →</button></div>
          <div class="sec">${sec[cur](m, team, rv)}</div>`;
      }
      el.innerHTML = `<section class="card rv-head"><div class="card-h" style="margin:0"><div><span class="k">Match review</span><h2>${headline}</h2><p>${U.esc([m.round, m.season, m.date, m.venue].filter(Boolean).join(' · '))}${rv ? ` · review started ${U.esc(rv.createdAt.slice(0, 10))}` : ''}</p></div>
        <div class="ctl">${picker}${rv ? `<button class="btn sm danger" id="rvDel">Delete review</button>` : ''}</div></div></section>
        <div class="sec">${body}</div>`;

      // wiring
      U.$('#rvM', el).onchange = e => { vs.rvMatch = e.target.value; vs.rvSec = M.reviewFor(e.target.value) ? 'overview' : 'coverage'; Lab.render(); };
      U.$$('[data-sec]', el).forEach(b => b.onclick = () => { vs.rvSec = b.dataset.sec; Lab.render(); window.scrollTo({ top: 0 }); });
      U.$$('[data-act]', el).forEach(b => b.onclick = () => Lab.reviewAct(b.dataset.act, m));
      const st = U.$('#rvStart', el); if (st) st.onclick = () => { const focus = U.$('#rvF0', el).value.split(',').map(x => x.trim()).filter(Boolean); M.addReview({ matchId: m.id, focus }); vs.rvSec = 'coverage'; U.toast('Review started'); };
      const del = U.$('#rvDel', el); if (del) del.onclick = () => { const n = M.wsFindings(rv.id).length; if (confirm(`Delete this match review${n ? ` and its ${n} finding${n === 1 ? '' : 's'}` : ''}? The match, its stats, coded events and clips stay in the shared library.`)) M.removeReview(rv.id); };
      U.$$('[data-rvdone]', el).forEach(c => c.onchange = () => M.updateReview(rv.id, { done: Object.assign({}, rv.done, { [c.dataset.rvdone]: c.checked }) }));
      const toRep = () => { vs.repScope = rv.id; vs.reportPreview = false; Lab.go('report'); };
      ['#rvRep', '#rvRep2'].forEach(id => { const b = U.$(id, el); if (b) b.onclick = toRep; });
      if (!rv) return;
      U.$$('[data-fdq]', el).forEach(b => b.onclick = () => fdQuarters(m, team, MD().result(m, team, rv)));
      U.$$('[data-fdt]', el).forEach(b => b.onclick = () => { const p = cur === 'team' ? (vs.rvPeriod || 'Full') : 'Full'; const row = MD().teamRow(m, team, b.dataset.fdt, p) || MD().teamRow(m, team, b.dataset.fdt, 'Full'); if (row) fdTeam(m, team, row, p); });
      U.$$('[data-chart]', el).forEach(b => b.onclick = () => { vs.rvStat = b.dataset.chart; Lab.render(); });
      U.$$('[data-per]', el).forEach(b => b.onclick = () => { vs.rvPeriod = b.dataset.per; Lab.render(); });
      const g = U.$('#rvG', el); if (g) g.onchange = () => { vs.rvGroup = g.value; Lab.render(); };
      const fo = U.$('#rvFocus', el); if (fo) fo.onclick = () => { const v = prompt('Review focus areas, comma separated', (rv.focus || []).join(', ')); if (v != null) M.updateReview(rv.id, { focus: v.split(',').map(x => x.trim()).filter(Boolean) }); };
      const ks = U.$('#rvKeys', el); if (ks) ks.onclick = () => keyPicker(m, team, rv);
      U.$$('[data-side]', el).forEach(b => b.onclick = () => { vs.rvSide = b.dataset.side; Lab.render(); });
      U.$$('[data-pset]', el).forEach(b => b.onclick = () => { vs.rvPSet = b.dataset.pset; vs.rvPSort = ''; Lab.render(); });
      U.$$('[data-psort]', el).forEach(b => b.onclick = e => { e.stopPropagation(); vs.rvPSort = b.dataset.psort; Lab.render(); });
      const side = vs.rvSide === 'them' ? opp : team, pl = cur === 'players' ? MD().players(m, side) : null;
      U.$$('[data-prow]', el).forEach(tr => { const open = () => playerDrawer(m, side, pl, pl.rows.find(x => x.id === tr.dataset.prow)); tr.onclick = open; tr.onkeydown = e => { if (e.key === 'Enter') open(); }; });
      const pq = U.$('#rvPQ', el); if (pq) { let t; pq.oninput = () => { clearTimeout(t); t = setTimeout(() => { vs.rvPQ = pq.value; Lab.render(); const n = U.$('#rvPQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); }; }
      const pld = U.$('#rvPLead', el); if (pld && pl) pld.onclick = () => { const set0 = (pl.sets.find(s => s[0] === (vs.rvPSet || pl.sets[0][0])) || pl.sets[0])[1], k = vs.rvPSort && pl.cols[vs.rvPSort] ? vs.rvPSort : (set0.find(x => !/TimeOnGround|Percentage/.test(x)) || set0[0]), c = pl.cols[k], top = pl.rows.filter(r => r.v[k] != null).sort((a, b) => b.v[k] - a.v[k]).slice(0, 5); Lab.newFinding({ title: `${c.label}: ${side} leaders v ${M.opponentIn(m, side)}`, stat: `${c.label}, ${side}, ${m.round} ${m.season}: ${top.map(r => `${r.name} ${MD().fmt(c.unit, r.v[k])}`).join(', ')}.`, n: pl.rows.length, matchIds: [m.id], source: pl.srcLabel, chart: { kind: 'mPlayers', matchId: m.id, team: side, col: k }, limitations: 'One match. Totals depend on role and time on ground.' }); };
      const tp = U.$('#rvTpl', el); if (tp) tp.onchange = () => { vs.rvTpl = tp.value; vs.rvBy = ''; Lab.render(); };
      const by = U.$('#rvBy', el); if (by) by.onchange = () => { vs.rvBy = by.value; Lab.render(); };
      U.$$('[data-evside]', el).forEach(b => b.onclick = () => { vs.rvEvSide = b.dataset.evside; Lab.render(); });
      const ex = U.$('#rvExplore', el); if (ex) ex.onclick = () => { vs.exFlt = { side: 'both', f: {}, matchId: m.id }; Lab.go('explore'); };
      const ef = U.$('#rvEvFd', el); if (ef) ef.onclick = () => {
        const evs = M.state.events.filter(e => e.matchId === m.id), tplId = vs.rvTpl && evs.some(e => e.templateId === vs.rvTpl) ? vs.rvTpl : evs[0].templateId, tpl = M.template(tplId);
        const dims = A.dims(tpl, ws).filter(x => x.field && ['choice', 'zone', 'player'].includes(x.field.type)), byK = dims.some(x => x.key === vs.rvBy) ? vs.rvBy : dims[0].key;
        const sideK = vs.rvEvSide || 'us', list = evs.filter(e => e.templateId === tplId && (sideK === 'both' || (sideK === 'us' ? e.team === team : e.team !== team)));
        const ct = A.counts(list, byK, ws, (dims.find(x => x.key === byK) || {}).order), lab = (dims.find(x => x.key === byK) || {}).label;
        Lab.newFinding({ title: `${tpl.name}: ${String(lab).toLowerCase()}`, stat: `${tpl.name}, ${sideK === 'both' ? 'both teams' : sideK === 'us' ? team : opp}, ${m.round} ${m.season}. ${lab}: ${ct.rows.map(x => `${x.label} ${x.n}/${ct.coded}`).join(', ')}${ct.uncoded ? ` (${ct.uncoded} not coded)` : ''}.`, n: list.length, matchIds: [m.id], source: `Coded events (${tpl.name})`, eventIds: list.slice(0, 80).map(e => e.id), limitations: lim(['Hand-coded events from one match.', list.length < U.SMALL_N ? `Small sample (n=${list.length}).` : '', 'Shows what the coder recorded; check whether the whole match was coded.']) });
      };
      U.$$('[data-cfd]', el).forEach(b => b.onclick = () => { const c = M.state.clips.find(x => x.id === b.dataset.cfd); Lab.newFinding({ title: c.title, stat: `Clip ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}, ${M.matchLabel(m, team)}.`, n: 1, matchIds: [m.id], clipIds: [c.id], eventIds: c.eventId ? [c.eventId] : [], source: 'Video clip', limitations: 'One passage of play.' }); });
      U.$$('.tl-match [data-open]', el).forEach(n => n.onclick = () => Lab.openEvent(n.dataset.open));
      const nf = U.$('#rvNewF', el); if (nf) nf.onclick = () => Lab.newFinding({ title: 'New finding', matchIds: [m.id], source: 'Analyst observation' });
      Lab.wireFindingCards(el);
    }
  };

  function keyPicker(m, team, rv) {
    const all = MD().teamRows(m, team, 'Full'), cur = new Set(keyIds(rv)), groups = [...new Set(all.map(r => r.group))];
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Key team stats</span><h2 id="drawerTitle">Choose what to show first</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><p class="sub" style="margin-top:0">Only stats this match has are listed.</p>${groups.map(g => `<h3 style="margin-top:10px">${U.esc(g)}</h3><div class="chk-grid">${all.filter(r => r.group === g).map(r => `<label><input type="checkbox" data-k value="${U.esc(r.id)}" ${cur.has(r.id) ? 'checked' : ''}> ${U.esc(r.label)} <span class="muted small">${r.src === 'pack' ? 'built in' : 'imported'}</span></label>`).join('')}</div>`).join('')}
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="kSave">Use for this review</button><button class="btn" id="kDef">Use for every review this season</button></div></div>`, d => {
      const pick = () => { const on = new Set(U.$$('[data-k]', d).filter(c => c.checked).map(c => c.value)); return all.map(r => r.id).filter(id => on.has(id)).concat([...cur].filter(id => !all.some(r => r.id === id))); };
      U.$('#kSave', d).onclick = () => { M.updateReview(rv.id, { keyStats: pick() }); Lab.closeDrawer(); };
      U.$('#kDef', d).onclick = () => { const k = pick(); M.updateReview(rv.id, { keyStats: null }); M.updateWorkspace(M.ws().id, { keyStats: k }); Lab.closeDrawer(); U.toast('Saved as the default for this team season'); };
    });
  }
})(window.Lab);
