/* Team (both modes): the focus club's results, form, trends, season stats with ranks, ratings and head to head,
   from the built-in season data. Every stat can go into the report. */
(function (Lab) {
  'use strict';
  const U = Lab.U, C = Lab.Charts, S = Lab.Season;
  let X = Lab.Pack;
  const vs = Lab.vs;
  const r1 = v => v == null ? '–' : U.round(v, 1).toFixed(1);
  const r0 = v => v == null ? '–' : String(Math.round(v));
  const sg = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(U.round(v, 1)).toFixed(1).replace(/\.0$/, '');
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const avg = a => { const b = a.filter(v => v != null); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };
  Lab.ord = ord;

  const FILTERS = [['all', 'All'], ['l5', 'Last 5'], ['l10', 'Last 10'], ['home', 'Home'], ['away', 'Away'], ['W', 'Wins'], ['L', 'Losses'], ['close', 'Within 12 pts'], ['final', 'Finals']];
  function applyFilter(G, f) {
    if (f === 'l5') return G.slice(-5);
    if (f === 'l10') return G.slice(-10);
    if (f === 'home') return G.filter(g => g.home);
    if (f === 'away') return G.filter(g => !g.home);
    if (f === 'W' || f === 'L') return G.filter(g => g.res === f);
    if (f === 'close') return G.filter(g => Math.abs(g.margin) <= 12);
    if (f === 'final') return G.filter(g => g.final);
    return G;
  }
  Lab.teamFilter = applyFilter; Lab.TEAM_FILTERS = FILTERS;
  const wld = G => { const w = G.filter(g => g.res === 'W').length, l = G.filter(g => g.res === 'L').length, d = G.length - w - l; return w + '-' + l + (d ? '-' + d : ''); };
  Lab.wld = wld;
  const resChip = g => `<span class="wl ${g.res}" data-tip="${U.esc(`${g.rd} ${g.home ? 'v' : '@'} ${g.opp}: ${g.us}-${g.them}`)}">${g.res}</span>`;

  const lgCache = {};
  function leagueAvg(k) {
    const ck = X.season.key + '|' + k;
    if (lgCache[ck] !== undefined) return lgCache[ck];
    const v = [];
    X.teams.forEach(t => X.teamGames(t).forEach(g => v.push(X.gameValue(g, 'for', k))));
    return (lgCache[ck] = avg(v));
  }

  function rankCell(r) {
    if (!r) return '<span class="muted">–</span>';
    if (!r.directional) return `<span class="rk rk-n" data-tip="Ranked highest to lowest">${ord(r.rank)}</span>`;
    const q = r.rank <= Math.ceil(r.of / 4) ? 'top' : r.rank > r.of - Math.ceil(r.of / 4) ? 'bot' : 'mid';
    return `<span class="rk rk-${q}" data-tip="${ord(r.rank)} of ${r.of}">${ord(r.rank)}</span>`;
  }
  const plus = (attr, label) => `<button class="btn sm ico" ${attr} data-tip="Add to report" aria-label="Add ${U.esc(label)} to report">+</button>`;

  /* Pick the season: an imported season for the same year replaces the built-in one. */
  function season() { const all = S.seasons().filter(s => s.teams); return all.find(s => s.key === Lab.Pack.season.key) || null; }
  Lab.currentSeason = season;

  Lab.Views.team = {
    render(el, { ws }) {
      X = Lab.Pack;
      if (!X || !X.ok) { el.innerHTML = `<section class="card"><div class="empty"><h3>No built-in ${U.esc(ws.competition + ' ' + ws.season)} season data</h3><p>Built-in data covers ${U.esc(Object.keys(Lab.Packs || {}).map(k => k.replace('|', ' ')).join(' and '))}. You can still add matches, import your own match stats and review them.</p><div class="ctl"><button class="btn g" onclick="Lab.go('matches')">Matches</button><button class="btn" onclick="Lab.go('data')">Import stats</button></div></div></section>`; return; }
      const sea = season();
      const opp = X.resolve(ws.focus), us = ws.kind === 'opp' ? X.resolve(ws.ourTeam || '') : '';
      if (!opp) {
        el.innerHTML = `<section class="card"><div class="empty"><h3>${U.esc(ws.focus)} isn't in the ${U.esc(X.raw.competition + ' ' + X.raw.season)} data</h3><p>Edit the ${ws.kind === 'opp' ? 'fixture' : 'team season'} and pick the club from the list. Without built-in data you can still add matches, import match stats on the Data tab and use Match review.</p><button class="btn g" id="edFx">Edit ${ws.kind === 'opp' ? 'fixture' : 'team season'}</button></div></section>`;
        U.$('#edFx', el).onclick = () => Lab.openFixtureForm(ws.id); return;
      }
      const team = opp, flt = vs.tmFlt || 'all';
      if (vs.tmCmpSet !== ws.id) { vs.tmCmp = us && us !== team ? us : ''; vs.tmCmpSet = ws.id; }
      const cmp = vs.tmCmp && X.teams.includes(vs.tmCmp) ? vs.tmCmp : '';
      const G = X.teamGames(team), F = applyFilter(G, flt);
      const lad = X.ladder(), me = lad.find(x => x.t === team);
      const rt = sea.ratings && sea.ratings[team];
      const last5 = G.slice(-5);

      /* trend chart */
      const tk = vs.tmStat || 'Points', TR = X.TREND.find(x => x[0] === tk) || X.TREND[0];
      const abbr = t => (sea.teams[t] && sea.teams[t].abbr) || t;
      const cats = F.map(g => g.rd + (g.home ? ' v ' : ' @ ') + abbr(g.opp));
      const fv = F.map(g => X.gameValue(g, 'for', tk)), av = F.map(g => X.gameValue(g, 'against', tk));
      const trendChart = C.line(cats, [
        { name: team, color: C.COL.opp, values: fv, tips: F.map((g, i) => `${r1(fv[i])} · ${g.res} ${g.us}-${g.them}`) },
        { name: 'Opposition', color: C.COL.their, values: av, tips: F.map((g, i) => `${g.opp}: ${r1(av[i])}`) }
      ], { aria: `${TR[1]} per game`, emptyMsg: 'No games in this selection.' });
      const trName = n => n.replace(' (summed from players)', '');
      const trendRows = X.TREND.map(([k, name]) => {
        const fF = avg(F.map(g => X.gameValue(g, 'for', k))), fA = avg(F.map(g => X.gameValue(g, 'against', k)));
        const sF = avg(G.map(g => X.gameValue(g, 'for', k)));
        return `<tr class="${k === tk ? 'hl' : ''}"><td class="l"><button class="link" data-st="${k}">${U.esc(trName(name))}</button></td><td><b>${r1(fF)}</b></td><td>${r1(fA)}</td><td>${sg(fF != null && fA != null ? fF - fA : null)}</td>${flt === 'all' ? '' : `<td class="muted">${r1(sF)}</td>`}<td class="muted">${r1(leagueAvg(k))}</td><td>${plus(`data-tr="${k}"`, trName(name))}</td></tr>`;
      }).join('');

      /* quarters */
      const qF = [0, 1, 2, 3].map(i => avg(F.map(g => g.qf[i]))), qA = [0, 1, 2, 3].map(i => avg(F.map(g => g.qa[i])));
      const qW = [0, 1, 2, 3].map(i => F.filter(g => g.qf[i] > g.qa[i]).length);
      const qChart = C.grouped(['Q1', 'Q2', 'Q3', 'Q4'], [{ name: 'Scored', color: C.COL.opp, values: qF, tips: qF.map((v, i) => `${r1(v)} pts · won the quarter in ${qW[i]} of ${F.length}`) }, { name: 'Conceded', color: C.COL.their, values: qA, tips: qA.map(v => r1(v) + ' pts') }], { aria: 'Average points per quarter', emptyMsg: 'No games in this selection.' });

      /* season stats */
      const fp = S.fingerprint(sea, team);
      const top = (arr, n) => arr.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, n);
      const strong = top(fp.filter(x => x.good === true), 6), weak = top(fp.filter(x => x.good === false), 6), style = top(fp.filter(x => x.good === null && x.side === 'for'), 6);
      const sideLbl = x => x.side === 'for' ? '' : ' <span class="muted">(conceded)</span>';
      const fpRow = x => `<tr><td class="l">${U.esc(x.col.name)}${sideLbl(x)}</td><td>${S.fmt(x.col.id, x.value)}</td><td class="muted">${S.fmt(x.col.id, x.league)}</td><td>${rankCell(x.r)}</td><td>${plus(`data-ss="${x.col.id}|${x.side}"`, x.col.name)}</td></tr>`;
      const fpTable = (title, rows) => `<div><h3>${title}</h3><div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>${U.esc(team)}</th><th>League</th><th>Rank</th><th></th></tr></thead><tbody>${rows.map(fpRow).join('') || '<tr><td class="l muted" colspan="5">None.</td></tr>'}</tbody></table></div></div>`;
      const groups = [...new Set(S.COLUMNS.filter(c => Object.keys(sea.teams).some(t => S.value(sea, t, 'for', c.id) != null)).map(c => c.group))];
      if (!vs.tmOpen) vs.tmOpen = { [groups[0]]: true };
      const statTable = g => {
        const cols = S.COLUMNS.filter(c => c.group === g && Object.keys(sea.teams).some(t => S.value(sea, t, 'for', c.id) != null));
        if (!cols.length) return '';
        return `<details class="grp" data-g="${U.esc(g)}" ${vs.tmOpen[g] ? 'open' : ''}><summary>${U.esc(g)} <span class="muted">(${cols.length})</span></summary>
          <div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>For</th><th>Rank</th><th>Against</th><th>Rank</th><th>League</th>${cmp ? `<th class="cmp">${U.esc(cmp)} for</th><th class="cmp">${U.esc(cmp)} against</th>` : ''}<th></th></tr></thead><tbody>
          ${cols.map(c => { const f = S.value(sea, team, 'for', c.id), a = S.value(sea, team, 'against', c.id); return `<tr><td class="l">${U.esc(c.name)}</td><td><b>${S.fmt(c.id, f)}</b></td><td>${rankCell(S.rank(sea, team, 'for', c.id))}</td><td>${S.fmt(c.id, a)}</td><td>${rankCell(S.rank(sea, team, 'against', c.id))}</td><td class="muted">${S.fmt(c.id, S.leagueValue(sea, 'for', c.id))}</td>${cmp ? `<td class="cmp">${S.fmt(c.id, S.value(sea, cmp, 'for', c.id))}</td><td class="cmp">${S.fmt(c.id, S.value(sea, cmp, 'against', c.id))}</td>` : ''}<td>${f != null ? plus(`data-ss="${c.id}|for"`, c.name) : ''}</td></tr>`; }).join('')}
          </tbody></table></div></details>`;
      };

      const h2hTeam = vs.tmH2h && X.teams.includes(vs.tmH2h) ? vs.tmH2h : us && us !== team ? us : '';
      const H = h2hTeam ? G.filter(g => g.opp === h2hTeam) : [];
      const HK = X.hasGames ? ['Disposals', 'ContestedPossessions', 'TotalClearances', 'Inside50s', 'Tackles', 'Marks'] : X.TREND.map(x => x[0]).filter(k => k !== 'Points');
      const ratingRow = (n, r) => `<tr class="${n === team ? 'hl' : n === cmp ? 'hl2' : ''}"><td class="mono">${r.CurrentRank || ''}</td><td class="l">${U.esc(n)}</td><td>${r.CurrentRating != null ? U.signed(r.CurrentRating.toFixed(1)) : '–'}</td><td>${r.CurrentAttack != null ? U.signed(r.CurrentAttack.toFixed(1)) : '–'} <span class="muted">${r.CurrentAttackRank || ''}</span></td><td>${r.CurrentDefence != null ? U.signed(r.CurrentDefence.toFixed(1)) : '–'} <span class="muted">${r.CurrentDefenceRank || ''}</span></td><td>${r.SeasonRating != null ? U.signed(r.SeasonRating.toFixed(1)) : '–'}</td><td>${r.SeasonRank || ''}</td></tr>`;

      el.innerHTML = `
      <div class="ctl" style="margin-bottom:10px;justify-content:space-between">
        <span class="muted" style="font-size:13px">${U.esc(sea.competition + ' ' + sea.season)} season · ${G.length} games · Opening Round to ${G.some(g => g.rd === 'GF') ? 'Grand Final' : G.length ? G[G.length - 1].rd : '–'}</span>
        <span class="ctl"><label class="k" for="tmC">Compare with</label><select id="tmC"><option value="">No comparison</option>${X.teams.filter(x => x !== team).map(x => `<option ${x === cmp ? 'selected' : ''}>${U.esc(x)}</option>`).join('')}</select></span>
      </div>

      <section class="grid g4">
        <div class="kpi"><span class="k">Record ${U.esc(sea.season)}</span><div class="v">${wld(G)}</div><div class="d">Ladder <b>${me ? ord(me.pos) : '–'}</b>${me && me.official ? ' (official)' : ''} after the home and away season · ${me ? me.pts : '–'} pts · ${me && me.pct != null ? U.round(me.pct, 1).toFixed(1) : '–'}%</div></div>
        <div class="kpi"><span class="k">Points per game</span><div class="v">${r1(avg(G.map(g => g.us)))}</div><div class="d">Conceded <b>${r1(avg(G.map(g => g.them)))}</b> · average margin <b>${sg(avg(G.map(g => g.margin)))}</b></div></div>
        ${rt ? `<div class="kpi"><span class="k">Team rating</span><div class="v">${rt.CurrentRank != null ? ord(rt.CurrentRank) : '–'}</div><div class="d">Attack <b>${rt.CurrentAttackRank != null ? ord(rt.CurrentAttackRank) : '–'}</b> · defence <b>${rt.CurrentDefenceRank != null ? ord(rt.CurrentDefenceRank) : '–'}</b> · season <b>${rt.SeasonRank != null ? ord(rt.SeasonRank) : '–'}</b></div></div>` : (() => { const fin = G.filter(g => g.final), lastF = fin[fin.length - 1], NAMES = { WC: 'wildcard round', EF: 'elimination final', QF: 'qualifying final', SF: 'semi final', PF: 'preliminary final', GF: 'Grand Final' }; const v = !fin.length ? 'No finals' : lastF.rd === 'GF' && lastF.res === 'W' ? 'Premiers' : 'Out in the ' + (NAMES[lastF.rd] || lastF.rd); return `<div class="kpi"><span class="k">Finals</span><div class="v" style="font-size:24px">${U.esc(v)}</div><div class="d">${fin.length ? `${wld(fin)} in finals · ${fin.map(g => g.rd + ' ' + g.res).join(', ')}` : 'Did not play finals.'}</div></div>`; })()}
        <div class="kpi"><span class="k">Last 5</span><div class="v form5">${last5.map(resChip).join('')}</div><div class="d">${wld(last5)} · average margin <b>${sg(avg(last5.map(g => g.margin)))}</b></div></div>
      </section>

      <section class="sec card">
        <div class="card-h"><div><h2>Results and form</h2><p>Choose a set of games. The charts, averages and results below all use it.</p></div></div>
        <div class="ctl"><span class="seg">${FILTERS.map(([k, l]) => { const n = applyFilter(G, k).length; return `<button class="${k === flt ? 'on' : ''}" data-f="${k}" ${n ? '' : 'disabled'}>${l} <i>${n}</i></button>`; }).join('')}</span></div>
        <p class="sub" style="margin-top:8px"><b>${F.length}</b> game${F.length === 1 ? '' : 's'} · ${wld(F)} · scored ${r1(avg(F.map(g => g.us)))} · conceded ${r1(avg(F.map(g => g.them)))} · margin ${sg(avg(F.map(g => g.margin)))}${F.length && F.length < 5 ? ' · <em class="smallflag">small sample</em>' : ''}</p>
        <div class="grid g2" style="margin-top:6px">
          <div><h3>${U.esc(trName(TR[1]))} by game</h3>${trendChart}</div>
          <div><h3>Points by quarter</h3>${qChart}</div>
        </div>
        <details class="grp" ${vs.tmTrOpen !== false ? 'open' : ''} id="tmTr"><summary>Match stats per game</summary>
          <div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>${U.esc(team)}</th><th>Opposition</th><th>Diff</th>${flt === 'all' ? '' : '<th>Season</th>'}<th>League</th><th></th></tr></thead><tbody>${trendRows}</tbody></table></div>
          <p class="sub">Click a stat to chart it.</p>
        </details>
        <details class="grp" open><summary>Results (${F.length})</summary>
          <div class="tw" style="max-height:440px;overflow:auto"><table class="compact"><thead><tr><th class="l">Rd</th><th class="l">Date</th><th class="l">Opponent</th><th class="l">Venue</th><th>Result</th><th>Score</th><th>Margin</th><th data-tip="Quarter margin">Q1</th><th>Q2</th><th>Q3</th><th>Q4</th></tr></thead><tbody>
          ${F.slice().reverse().map(g => `<tr><td class="l">${U.esc(g.rd)}</td><td class="l mono">${U.esc(g.date)}</td><td class="l">${g.home ? 'v' : '@'} ${U.esc(g.opp)}</td><td class="l">${U.esc(g.venue)}</td><td>${resChip(g)}</td><td class="mono">${g.us}-${g.them}</td><td>${sg(g.margin)}</td>${[0, 1, 2, 3].map(i => { const d = g.qf[i] - g.qa[i]; return `<td class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${sg(d)}</td>`; }).join('')}</tr>`).join('') || '<tr><td colspan="11" class="l muted">No games.</td></tr>'}
          </tbody></table></div></details>
      </section>

      <section class="sec card"><div class="card-h"><div><h2>${ws.kind === 'opp' ? 'Where they stand out' : 'Where we stand out'}</h2><p>Season averages furthest from the league average. Ranks run best to worst; for conceded stats, fewer is better.</p></div></div>
        <div class="fp3">${fpTable('Strengths', strong)}${fpTable('Weaknesses', weak)}${fpTable('Style', style)}</div>
      </section>

      <section class="sec card"><div class="card-h"><div><h2>Season stats</h2><p>Per game. For = ${U.esc(team)}; against = ${ws.kind === 'opp' ? 'their opponents' : 'what opponents did against us'}.</p></div>
        <div class="ctl"><button class="btn sm" id="tmAll">Open all</button><button class="btn sm" id="tmNone">Close all</button></div></div>
        ${groups.map(statTable).join('')}
      </section>

      <section class="sec grid g2">
        ${sea.ratings ? `<div class="card"><div class="card-h"><div><h2>Team ratings</h2><p>Rating = attack + defence.</p></div></div>
          <div class="tw" style="max-height:520px;overflow:auto"><table class="compact"><thead><tr><th>#</th><th class="l">Team</th><th>Current</th><th>Attack</th><th>Defence</th><th>Season</th><th>Rank</th></tr></thead><tbody>
          ${Object.entries(sea.ratings).sort((a, b) => (a[1].CurrentRank || 99) - (b[1].CurrentRank || 99)).map(([n, r]) => ratingRow(n, r)).join('')}</tbody></table></div></div>` : ''}
        <div class="card"><div class="card-h"><div><h2>Head to head</h2><p>${U.esc(sea.season)} meetings.</p></div>
          <div class="ctl"><select id="tmH" aria-label="Head to head against"><option value="">Choose a club</option>${X.teams.filter(t => t !== team).map(t => `<option ${t === h2hTeam ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select></div></div>
          ${!h2hTeam ? '<p class="muted">Choose a club.</p>' : !H.length ? `<p class="muted">${U.esc(team)} didn't play ${U.esc(h2hTeam)} in ${U.esc(sea.season)}.</p>` : H.map(g => `<div class="h2h"><div class="h2h-h"><b>${U.esc(g.rd)}</b> · ${U.esc(g.date)} · ${U.esc(g.venue)}<span>${resChip(g)} ${U.esc(team)} ${g.us} – ${g.them} ${U.esc(h2hTeam)}</span></div>
            <div class="tw"><table class="compact"><thead><tr><th class="l">Stat</th><th>${U.esc(abbr(team))}</th><th>${U.esc(abbr(h2hTeam))}</th></tr></thead><tbody>${HK.map(k => `<tr><td class="l">${U.esc(trName((X.TREND.find(x => x[0] === k) || [k, k])[1]))}</td><td>${r0(X.gameValue(g, 'for', k))}</td><td>${r0(X.gameValue(g, 'against', k))}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}
        </div>
      </section>`;

      U.$('#tmC', el).onchange = e => { vs.tmCmp = e.target.value; Lab.render(); };
      U.$$('[data-f]', el).forEach(b => b.onclick = () => { vs.tmFlt = b.dataset.f; Lab.render(); });
      U.$$('[data-st]', el).forEach(b => b.onclick = () => { vs.tmStat = b.dataset.st; Lab.render(); });
      U.$('#tmTr', el).ontoggle = e => { vs.tmTrOpen = e.target.open; };
      U.$('#tmH', el).onchange = e => { vs.tmH2h = e.target.value; Lab.render(); };
      U.$('#tmAll', el).onclick = () => { groups.forEach(g => { vs.tmOpen[g] = true; }); Lab.render(); };
      U.$('#tmNone', el).onclick = () => { vs.tmOpen = {}; Lab.render(); };
      U.$$('details.grp[data-g]', el).forEach(d => d.addEventListener('toggle', () => { vs.tmOpen[d.dataset.g] = d.open; }));
      U.$$('[data-ss]', el).forEach(b => b.onclick = () => { const [id, side] = b.dataset.ss.split('|'); Lab.reportSeasonStat(team, id, side); });
      U.$$('[data-tr]', el).forEach(b => b.onclick = () => Lab.reportMatchStat(team, b.dataset.tr, flt));
    }
  };
})(window.Lab);
