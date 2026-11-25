/* Our team > Players: our playing list with season averages, grouped by what the stats
   measure, each shown against the league. Click a player for his profile and, where the competition
   has per-game data, his game log. Every stat can go into the report. */
(function (Lab) {
  'use strict';
  const U = Lab.U, C = Lab.Charts;
  let X = Lab.Pack;
  const f = (k, v) => X.fmtP(k, v);
  const plus = (attr, label) => `<button class="btn sm ico" ${attr} data-tip="Add to report" aria-label="Add ${U.esc(label)} to report">+</button>`;
  const band = (pc, k) => !pc ? '' : !X.PSTAT[k] || !X.PSTAT[k].better ? 'n' : pc.pct >= 80 ? 'hi' : pc.pct <= 20 ? 'lo' : 'mid';
  const pctText = (pc, k) => !pc ? '' : !X.PSTAT[k].better ? `${Lab.ord(pc.rank)} highest` : pc.pct >= 50 ? `Top ${Math.max(1, 100 - pc.pct)}%` : `Bottom ${Math.max(1, pc.pct)}%`;
  const poolTip = () => `${X.raw.competition} players with ${X.MIN_GAMES}+ games`;

  const LOG = [['TimeOnGround', 'TOG%'], ['CentreBounceAttendancePercentage', 'CBA%'], ['Disposals', 'Disp'], ['Kicks', 'K'], ['Handballs', 'HB'], ['ContestedPossessions', 'CP'], ['TotalClearances', 'Clr'], ['Inside50s', 'I50'], ['MetresGained', 'MG'], ['Marks', 'Mk'], ['ContestedMarks', 'CM'], ['Intercepts', 'Int'], ['Tackles', 'Tk'], ['PressureActs', 'PA'], ['Turnovers', 'TO'], ['Goals', 'G'], ['Behinds', 'B'], ['ScoreInvolvements', 'SI'], ['Hitouts', 'HO'], ['RatingPoints', 'Rtg'], ['DreamTeamPoints', 'AF']];
  /* Only the per-game stats the built-in data has (the VFL files have fewer than the AFL). */
  const logCols = () => LOG.filter(([k]) => (X.gameCols || []).includes(k));
  const GNAME = { DreamTeamPoints: 'Fantasy points', TimeOnGround: 'Time on ground %', CentreBounceAttendancePercentage: 'Centre bounce attendance %', ContestedPossessions: 'Contested possessions', TotalClearances: 'Clearances', Inside50s: 'Inside 50s', MetresGained: 'Metres gained', ContestedMarks: 'Contested marks', Intercepts: 'Intercept possessions', PressureActs: 'Pressure acts', ScoreInvolvements: 'Score involvements', RatingPoints: 'Rating points' };
  Lab.gameStatName = k => GNAME[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ ([A-Z])/g, (m, c) => ' ' + c.toLowerCase());

  /* ---------- player profile ---------- */
  function drawer(key) {
    const p = X.player(key), b = p.bio || {}, s = p.s || {};
    const G = X.games(p);
    const gk = vsGet('plGStat', 'Disposals');
    const war = X.PSTAT.WAR && s.WAR != null ? X.playerRank(key, 'WAR') : null;
    const facts = [['Games', p.games || 0], ['Age', b.age == null ? '–' : b.age], ['Height', b.height == null ? '–' : b.height + ' cm'], p.afl ? ['AFL list', U.esc(p.afl)] : b.careerGames != null ? ['Career games', b.careerGames] : ['Position', U.esc(p.position || '–')]];
    const seen = new Set();
    const sections = X.PSETS.map(([set, keys]) => {
      const ks = keys.filter(k => !seen.has(k) && k !== 'WAR'); ks.forEach(k => seen.add(k));
      if (!ks.length || !p.s) return '';
      return `<section class="pf-sec"><h3>${U.esc(set)}</h3>${ks.map(k => {
        const pc = X.playerPct(key, k), bd = band(pc, k);
        return `<div class="pf-row"><span class="pf-n">${U.esc(X.PSTAT[k].name)}</span><b class="pf-v">${f(k, s[k])}</b>
          <span class="pf-bar" ${pc ? `data-tip="${U.esc(`${Lab.ord(pc.rank)} of ${pc.of} ${poolTip()}`)}"` : ''}>${pc ? `<i class="b-${bd}" style="width:${Math.max(2, pc.pct)}%"></i>` : ''}</span>
          <span class="pf-p">${pc ? pctText(pc, k) : (s[k] == null ? '' : `<span class="muted">under ${X.MIN_GAMES} games</span>`)}</span>
          ${s[k] != null ? plus(`data-ps="${k}"`, X.PSTAT[k].name) : '<span></span>'}</div>`;
      }).join('')}</section>`;
    }).join('');
    const vals = G.map(g => g.v[gk]);
    const avgKey = gk === 'Goals' ? 'Goals_Avg' : gk === 'RatingPoints' ? 'RatingPoints_Avg' : gk;
    const chart = G.length ? C.line(G.map(g => g.tg.rd), [{ name: p.name, color: C.COL.opp, values: vals, tips: G.map((g, i) => `${vals[i] == null ? '–' : U.round(vals[i], 1)} · ${g.tg.home ? 'v' : '@'} ${g.tg.opp} (${g.tg.res})`) }], { aria: `${p.name} ${gk} by game` }) : '';
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(p.team)}${p.number ? ' · #' + U.esc(p.number) : ''}${p.position ? ' · ' + U.esc(p.position) : ''}</span><h2 id="drawerTitle">${U.esc(p.name)}</h2></div><button class="btn sm" data-close>Close</button></div>
      <div class="drawer-b">
      <div class="pf-top">
        ${X.PSTAT.WAR ? `<div class="pf-war"><span class="k">Footy Lab WAR</span><b>${s.WAR == null ? '–' : f('WAR', s.WAR)}</b><small>${war ? `${Lab.ord(war.rank)} of ${war.of} in the ${U.esc(X.raw.competition)}` : s.WAR == null ? 'Not rated' : ''}${s.WAR != null && s.WAR_Games != null && X.raw.competition === 'AFL' ? ` · ${s.WAR_Games} home-and-away games` : ''}</small>${s.WAR != null ? plus('data-ps="WAR"', 'WAR') : ''}</div>` : ''}
        <div class="pf-facts">${facts.map(([k, v]) => `<div><span class="k">${k}</span><b>${v}</b></div>`).join('')}</div>
      </div>
      ${p.multi ? `<p class="sub warn">Played for ${U.esc(p.multi)} this season. These are his combined season numbers; they can't be split by club.</p>` : ''}
      ${p.s ? `<p class="sub">Per game, ${U.esc(X.raw.season)}. Bars show where he sits among ${poolTip()}.</p>${sections}` : `<p class="muted">No ${U.esc(X.raw.season)} games.</p>`}
      ${G.length ? `<section class="pf-sec"><h3>By game</h3><div class="ctl" style="margin-bottom:4px"><select id="pdG" aria-label="Stat to chart">${logCols().map(([k]) => `<option value="${k}" ${k === gk ? 'selected' : ''}>${U.esc(Lab.gameStatName(k))}</option>`).join('')}</select><span class="muted" style="font-size:12.5px">Season average ${s[avgKey] == null ? '–' : f(avgKey, s[avgKey])}</span><button class="btn sm" id="pdGAdd" style="margin-left:auto">+ Add chart to report</button></div>${chart}</section>
      <section class="pf-sec"><h3>Game log</h3><div class="tw" style="max-height:420px;overflow:auto"><table class="compact glog"><thead><tr><th class="l">Rd</th><th class="l">Opponent</th><th class="l">Result</th>${logCols().map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${G.slice().reverse().map(g => `<tr><td class="l">${U.esc(g.tg.rd)}</td><td class="l">${g.tg.home ? 'v ' : '@ '}${U.esc(g.tg.opp)}</td><td class="l">${g.tg.res} ${g.tg.us}-${g.tg.them}</td>${logCols().map(c => `<td>${g.v[c[0]] == null ? '–' : U.round(g.v[c[0]], 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>` : ''}
      </div>`, d => {
      U.$$('[data-ps]', d).forEach(x => x.onclick = () => Lab.reportPlayerStat(key, x.dataset.ps));
      const sel = U.$('#pdG', d); if (sel) sel.onchange = () => { Lab.vs.plGStat = sel.value; drawer(key); };
      const ga = U.$('#pdGAdd', d); if (ga) ga.onclick = () => Lab.reportPlayerGames(key, gk);
    });
  }
  function vsGet(k, d) { return Lab.vs[k] || d; }
  Lab.openPackPlayer = drawer;

  /* ---------- list ---------- */
  Lab.Views.players = {
    render(el, { ws }) {
      X = Lab.Pack;
      const vs = Lab.vs;
      const team = X && X.ok ? X.resolve(ws.focus) : '';
      if (!team) { el.innerHTML = `<section class="card"><div class="empty"><h3>No built-in player data for ${U.esc(ws.focus)}</h3><p>${X && X.ok ? `Edit the ${ws.kind === 'opp' ? 'fixture' : 'team season'} and pick the club from the list.` : `There's no built-in ${U.esc(ws.competition + ' ' + ws.season)} season data.`} Match-level player stats can still be imported on the Data tab and reviewed in Match review (our-team mode).</p><div class="ctl"><button class="btn g" id="edFx">Edit ${ws.kind === 'opp' ? 'fixture' : 'team season'}</button><button class="btn" onclick="Lab.go('data')">Import stats</button></div></div></section>`; U.$('#edFx', el).onclick = () => Lab.openFixtureForm(ws.id); return; }
      const setName = vs.plSet && X.PSETS.some(x => x[0] === vs.plSet) ? vs.plSet : X.PSETS[0][0];
      const cols = X.PSETS.find(x => x[0] === setName)[1];
      const sortK = vs.plSort && (vs.plSort === 'name' || vs.plSort === 'number' || X.PSTAT[vs.plSort]) ? vs.plSort : (cols[0] || 'Matches'), q = (vs.plQ || '').toLowerCase();
      const ros = X.roster(team).filter(p => !q || p.name.toLowerCase().includes(q) || String(p.number) === q || (p.position || '').toLowerCase().includes(q));
      const val = (p, k) => k === 'name' ? p.name : k === 'number' ? +p.number || 999 : p.s ? p.s[k] : null;
      const low = k => k === 'name' || k === 'number' || (X.PSTAT[k] || {}).better === 'low';
      const sorted = ros.slice().sort((a, b) => {
        const x = val(a, sortK), y = val(b, sortK);
        if (sortK === 'name') return x.localeCompare(y);
        if (x == null && y == null) return a.name.localeCompare(b.name); if (x == null) return 1; if (y == null) return -1;
        return low(sortK) ? x - y : y - x;
      });
      const played = sorted.filter(p => p.games), none = sorted.filter(p => !p.games);
      const th = (k, l, tip, cls) => `<th class="${cls || ''}"><button class="link sortb${sortK === k ? ' on' : ''}" data-sort="${k}"${tip ? ` data-tip="${U.esc(tip)}"` : ''}>${l}${sortK === k ? ' ↓' : ''}</button></th>`;
      const cell = (p, k) => {
        const v = p.s ? p.s[k] : null; if (v == null) return '<td class="sc"><span class="muted">–</span></td>';
        const pc = X.playerPct(p.key, k), bd = band(pc, k);
        return `<td class="sc"${pc ? ` data-tip="${U.esc(`<b>${X.PSTAT[k].name}</b> ${f(k, v)}<br>${pctText(pc, k)} · ${Lab.ord(pc.rank)} of ${pc.of}`)}"` : ''}><span class="sv">${f(k, v)}</span>${pc ? `<span class="sb"><i class="b-${bd}" style="width:${Math.max(3, pc.pct)}%"></i></span>` : ''}</td>`;
      };
      const meta = p => [p.position, p.bio.height ? p.bio.height + ' cm' : '', p.bio.age != null ? p.bio.age + ' yrs' : ''].filter(Boolean).map(U.esc).join(' · ');
      el.innerHTML = `
      <section class="card">
        <div class="card-h"><div><h2>${U.esc(ws.focus)} players</h2><p>${U.esc(X.raw.season)} averages per game · ${played.length} played, ${ros.length} listed. Bars compare each player with ${poolTip()}.</p></div>
          <div class="ctl"><input type="search" id="plQ" placeholder="Name, number or position" value="${U.esc(vs.plQ || '')}" aria-label="Search players"><button class="btn sm" id="plCsv">Export CSV</button></div></div>
        <div class="ctl" style="margin-bottom:10px;justify-content:space-between"><span class="seg">${X.PSETS.map(([n]) => `<button class="${n === setName ? 'on' : ''}" data-set="${U.esc(n)}">${U.esc(n)}</button>`).join('')}</span>
          <span class="leg2"><i class="b-hi"></i>Top 20% <i class="b-mid"></i>Middle <i class="b-lo"></i>Bottom 20%</span></div>
        <div class="tw" style="max-height:700px;overflow:auto"><table class="compact ptab2"><thead><tr>${th('number', '#')}${th('name', 'Player', '', 'l')}${th('Matches', 'Games')}${cols.map(k => th(k, X.PSTAT[k].head, X.PSTAT[k].name)).join('')}</tr></thead><tbody>
          ${played.map(p => `<tr class="click" data-pk="${U.esc(p.key)}"><td class="mono">${U.esc(p.number)}${p.afl && p.number ? `<sup class="aflno" data-tip="AFL list number (${U.esc(p.afl)})">A</sup>` : ''}</td>
            <td class="l pn"><button class="link">${U.esc(p.name)}</button>${p.multi ? ` <span class="multi" data-tip="Played for ${U.esc(p.multi)}. Season stats are combined across both clubs.">2 clubs</span>` : ''}<span class="pm">${meta(p)}</span></td>
            <td>${p.games}</td>${cols.map(k => cell(p, k)).join('')}</tr>`).join('')}
          ${none.length ? `<tr><td colspan="${3 + cols.length}" class="l muted" style="padding-top:12px">No ${U.esc(X.raw.season)} games: ${none.map(p => U.esc(p.name)).join(', ')}</td></tr>` : ''}
        </tbody></table></div>
        ${X.PSTAT.WAR ? `<p class="sub">WAR is Footy Lab WAR${X.raw.competition === 'AFL' ? ', home-and-away games only' : ''}.</p>` : ''}
        <p class="sub">Season averages describe the whole season. For what each player did in one game, open the game in <button class="link" onclick="Lab.go('review')">Match review</button>${X.hasGames ? '' : ` (the ${U.esc(X.raw.competition + ' ' + X.raw.season)} built-in data has no per-game player stats, so they need importing)`}.</p>
      </section>`;
      U.$$('[data-set]', el).forEach(b => b.onclick = () => { vs.plSet = b.dataset.set; vs.plSort = ''; Lab.render(); });
      U.$$('[data-sort]', el).forEach(b => b.onclick = e => { e.stopPropagation(); vs.plSort = b.dataset.sort; Lab.render(); });
      U.$$('tr[data-pk]', el).forEach(r => r.onclick = () => drawer(r.dataset.pk));
      let qt; const qi = U.$('#plQ', el); qi.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { vs.plQ = qi.value; Lab.render(); const n = U.$('#plQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); };
      U.$('#plCsv', el).onclick = () => {
        const keys = X.PSTATS.map(x => x[0]);
        U.download(`${U.norm(ws.focus)}-players-${X.raw.season}.csv`, U.toCSV(['Number', 'Player', 'Position', 'Height', 'Age'].concat(keys.map(k => X.PSTAT[k].name)), X.roster(team).map(p => [p.number, p.name, p.position, p.bio.height, p.bio.age].concat(keys.map(k => p.s ? p.s[k] : '')))), 'text/csv;charset=utf-8');
      };
    }
  };
})(window.Lab);
