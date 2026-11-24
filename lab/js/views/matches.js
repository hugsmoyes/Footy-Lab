/* Matches: our team's games in scope, with details, lineups, results and what data each one has. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, C = Lab.Charts;

  Lab.openMatchForm = function (id, preset) {
    const m = id ? M.match(id) : Object.assign({ season: '', round: '', competition: '', date: '', venue: '', home: '', away: '', homeScore: '', awayScore: '', quarterMins: '', note: '' }, preset || {});
    const teams = M.teams();
    const w = M.ws();
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${id ? 'Edit match' : 'Add match'}</span><h2 id="drawerTitle">${id ? U.esc(M.matchLabel(m)) : 'Match details'}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><div class="form">
        <label>Home team *<input id="mHome" list="mTeams" value="${U.esc(m.home)}"></label>
        <label>Away team *<input id="mAway" list="mTeams" value="${U.esc(m.away)}"></label>
        <datalist id="mTeams">${teams.map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
        <label>Season<input id="mSeason" value="${U.esc(m.season || (w && w.season) || '')}"></label>
        <label>Round *<input id="mRound" value="${U.esc(m.round)}" placeholder="e.g. R7, EF"></label>
        <label>Competition<select id="mComp"><option value=""></option>${Lab.Library.COMPETITIONS.map(c => `<option ${c === (m.competition || (!id && w ? w.competition : '')) ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Date<input id="mDate" type="date" value="${U.esc(m.date)}"></label>
        <label class="full">Venue<input id="mVenue" value="${U.esc(m.venue)}"></label>
        <label>Home score<input id="mHS" value="${U.esc(m.homeScore)}" placeholder="e.g. 12.10 (82)"></label>
        <label>Away score<input id="mAS" value="${U.esc(m.awayScore)}" placeholder="e.g. 9.8 (62)"></label>
        <label>Quarter length (mins)<input id="mQ" type="number" value="${U.esc(m.quarterMins)}" placeholder="${U.esc(M.state.settings.quarterMins)} (default)"></label>
        <label class="full">Note<input id="mNote" value="${U.esc(m.note)}" placeholder="e.g. wet, key outs, travel"></label>
      </div><p class="sub">Scores as 12.10, 12.10 (82) or 82. Leave blank if unknown.</p>
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="mSave">${id ? 'Save match' : 'Add match'}</button></div><div id="mErr" class="warnline hidden"></div></div>`, d => {
      U.$('#mSave', d).onclick = () => {
        const v = { home: U.$('#mHome', d).value.trim(), away: U.$('#mAway', d).value.trim(), season: U.$('#mSeason', d).value.trim(), round: U.$('#mRound', d).value.trim(), competition: U.$('#mComp', d).value, date: U.$('#mDate', d).value, venue: U.$('#mVenue', d).value.trim(), homeScore: U.$('#mHS', d).value.trim(), awayScore: U.$('#mAS', d).value.trim(), quarterMins: U.$('#mQ', d).value.trim(), note: U.$('#mNote', d).value.trim() };
        const err = U.$('#mErr', d);
        if (!v.home || !v.away || !v.round) { err.textContent = 'Home team, away team and round are required.'; err.classList.remove('hidden'); return; }
        if (v.home === v.away) { err.textContent = 'Home and away must be different teams.'; err.classList.remove('hidden'); return; }
        if ((v.homeScore && !M.parseScore(v.homeScore)) || (v.awayScore && !M.parseScore(v.awayScore))) { err.textContent = 'Scores must look like 12.10, 12.10 (82) or 82.'; err.classList.remove('hidden'); return; }
        if (id) M.updateMatch(id, v); else M.addMatch(v);
        Lab.closeDrawer(); U.toast(id ? 'Match saved' : 'Match added');
      };
    });
  };

  Lab.openLineup = function (id) {
    const m = M.match(id);
    const side = t => {
      const ros = M.roster(t), sel = new Set((m.lineups || {})[t] || []);
      return `<div><h3>${U.esc(t)} <span class="muted">(${sel.size} selected)</span></h3>${ros.length ? `<div class="chk-grid">${ros.map(p => `<label><input type="checkbox" data-lu="${U.esc(t)}" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}> ${p.number ? `<b class="mono">${U.esc(p.number)}</b> ` : ''}${U.esc(p.name)}</label>`).join('')}</div>` : `<p class="muted">No players listed for ${U.esc(t)}.</p>`}</div>`;
    };
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Lineups</span><h2 id="drawerTitle">${U.esc(M.matchLabel(m))}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><p class="sub">Who played in this match.</p>${side(m.home)}<div style="height:14px"></div>${side(m.away)}
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="luSave">Save lineups</button></div></div>`, d => {
      U.$('#luSave', d).onclick = () => {
        const lu = {}; [m.home, m.away].forEach(t => { lu[t] = U.$$(`[data-lu="${CSS.escape(t)}"]`, d).filter(c => c.checked).map(c => c.value); });
        M.updateMatch(id, { lineups: lu }); Lab.closeDrawer(); U.toast('Lineups saved');
      };
    });
  };

  function row(m, w) {
    const u = M.matchUsage(m.id), team = w.focus, opp = M.opponentIn(m, team);
    const r = M.result(m, team);
    const vid = M.state.videos[m.id] || {};
    const rv = M.reviewFor(m.id);
    const cov = Lab.MD ? Lab.MD.badges(m, team) : '';
    const excluded = (w.excluded || []).includes(m.id);
    const future = !r && m.date && m.date > U.today();
    return `<tr class="${excluded ? 'dim' : ''}"><td><input type="checkbox" data-inc="${m.id}" ${excluded ? '' : 'checked'} aria-label="Include ${U.esc(M.matchLabel(m, team))} in analysis"></td>
      <td class="l"><b>${U.esc(m.round)}</b> ${U.esc(m.season)}</td><td class="l">${U.esc(m.date) || '<span class="muted">–</span>'}</td>
      <td class="l">${m.home === team ? 'v' : '@'} ${U.esc(opp)}</td><td class="l">${U.esc(m.venue) || '<span class="muted">–</span>'}</td>
      <td class="l">${m.homeScore || m.awayScore ? U.esc((m.homeScore || '?') + ' – ' + (m.awayScore || '?')) : `<span class="muted">${future ? 'not played yet' : 'not entered'}</span>`}${r ? ` <span class="res res-${r.res}">${r.res[0]} ${U.signed(r.margin)}</span>` : ''}</td>
      <td class="l">${cov}${u.events ? `<span class="cov on" data-tip="${u.events} coded events">${u.events} ev</span>` : ''}${vid.url || vid.fileName ? '<span class="cov on" data-tip="Video linked">Video</span>' : ''}</td>
      ${Lab.isOpp() ? '' : `<td class="l">${rv ? `<span class="st st-progress">Review started</span>` : '<span class="muted">–</span>'}</td>`}
      <td class="l">${Lab.isOpp() ? '' : `<button class="btn sm g" data-rv="${m.id}">${rv ? 'Open review' : 'Review'}</button> `}<button class="btn sm" data-edit="${m.id}">Edit</button> <button class="btn sm" data-lu="${m.id}">Lineups</button> <button class="btn sm danger" data-del="${m.id}">Delete</button></td></tr>`;
  }

  /* Add our games from the season results, scores and all. */
  function openPackPicker(ws, packTeam) {
    const X = Lab.Pack, G = X.teamGames(packTeam).slice().reverse();
    const have = new Set(M.state.matches.map(m => [m.season, String(m.round).toUpperCase(), X.resolve(m.home), X.resolve(m.away)].join('|')));
    const keyOf = g => [X.raw.season, String(g.rd).toUpperCase(), g.m.home, g.m.away].join('|');
    const score = q => { const [gl, b] = q[3].split('.').map(Number); return `${gl}.${b} (${6 * gl + b})`; };
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Add matches</span><h2 id="drawerTitle">${U.esc(ws.focus)} ${U.esc(X.raw.season)}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><p class="sub" style="margin:0 0 8px">Completed games from the built-in ${U.esc(X.raw.competition)} ${U.esc(X.raw.season)} results, with final and quarter scores.</p><div class="ctl" style="margin-bottom:8px"><button class="btn sm" id="pkL5">Last 5</button><button class="btn sm" id="pkAll">All</button><button class="btn sm" id="pkNone">None</button></div>
      <div class="chk-list">${G.map((g, i) => { const on = have.has(keyOf(g)); return `<label class="${on ? 'muted' : ''}"><input type="checkbox" data-pk="${i}" ${on ? 'disabled checked' : ''}> <b>${U.esc(g.rd)}</b> ${g.home ? 'v' : '@'} ${U.esc(g.opp)} · ${g.res} ${g.us}-${g.them} <span class="muted">${U.esc(g.date)} · ${U.esc(g.venue)}${on ? ' · already added' : ''}</span></label>`; }).join('')}</div>
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="pkGo">Add selected</button></div></div>`, d => {
      const boxes = U.$$('[data-pk]:not([disabled])', d);
      U.$('#pkL5', d).onclick = () => boxes.forEach(b => { b.checked = +b.dataset.pk < 5; });
      U.$('#pkAll', d).onclick = () => boxes.forEach(b => { b.checked = true; });
      U.$('#pkNone', d).onclick = () => boxes.forEach(b => { b.checked = false; });
      U.$('#pkGo', d).onclick = () => {
        const sel = boxes.filter(b => b.checked).map(b => G[+b.dataset.pk]);
        sel.forEach(g => M.addMatch({ season: X.raw.season, round: g.rd, competition: X.raw.competition, date: g.date, venue: g.venue, home: g.m.home, away: g.m.away, homeScore: score(g.m.hq), awayScore: score(g.m.aq), packId: g.m.id }, true));
        if (sel.length) M.emit('matches');
        Lab.closeDrawer(); U.toast(sel.length ? `${sel.length} match${sel.length > 1 ? 'es' : ''} added` : 'Nothing selected');
      };
    });
  }
  Lab.openPackPicker = () => { const ws = M.ws(), X = Lab.Pack; if (ws && X && X.ok && X.resolve(ws.focus)) openPackPicker(ws, X.resolve(ws.focus)); else Lab.openMatchForm(null, { home: ws.focus, competition: ws.competition, season: ws.season }); };

  Lab.Views.matches = {
    render(el, { ws }) {
      const all = M.sortMatches(M.state.matches.filter(m => M.involves(m, ws.focus)));
      const head = `<thead><tr><th>Use</th><th class="l">Round</th><th class="l">Date</th><th class="l">Opponent</th><th class="l">Venue</th><th class="l">Score</th><th class="l">Data</th>${Lab.isOpp() ? '' : '<th class="l">Review</th>'}<th></th></tr></thead>`;
      const X = Lab.Pack, packTeam = X && X.ok ? X.resolve(ws.focus) : '';
      el.innerHTML = `
      <section class="card">
        <div class="card-h"><div><h2>${Lab.isOpp() ? 'Matches to review' : 'Our matches'}</h2><p>${Lab.isOpp() ? `${U.esc(ws.focus)} games you're coding. Untick a game to leave it out without deleting it.` : `${U.esc(ws.focus)} games you're reviewing or coding. Untick a game to leave it out of season charts without deleting it. <b>Review</b> opens the post-match review for that game.`}</p></div>
          <div class="ctl">${packTeam ? '<button class="btn g" id="addPack">+ Add from season results</button>' : ''}<button class="btn" id="addOpp">+ Add match manually</button></div></div>
        ${all.length ? `<div class="tw"><table class="compact">${head}<tbody>${all.map(m => row(m, ws)).join('')}</tbody></table></div>
          <p class="sub">Data: <span class="cov on">Stats</span> team match stats · <span class="cov on">Players</span> player match stats · <span class="cov">grey</span> = not available for that match.</p>`
          : `<div class="empty"><h3>No matches yet</h3><p>Add the completed ${U.esc(ws.focus)} games you want to review.${packTeam ? '' : ' There are no built-in results for this season, so add them manually or import a matches file on the Data tab.'}</p><div class="ctl" style="justify-content:center">${packTeam ? '<button class="btn g" id="addPack2">+ Add from season results</button>' : ''}<button class="btn" id="addOpp2">+ Add match manually</button></div></div>`}
      </section>`;
      const pick = () => openPackPicker(ws, packTeam);
      const ap = U.$('#addPack', el); if (ap) ap.onclick = pick; const ap2 = U.$('#addPack2', el); if (ap2) ap2.onclick = pick;
      const addOpp = () => Lab.openMatchForm(null, { home: ws.focus, competition: ws.competition, season: ws.season });
      U.$('#addOpp', el).onclick = addOpp; const a2 = U.$('#addOpp2', el); if (a2) a2.onclick = addOpp;
      U.$$('[data-rv]', el).forEach(b => b.onclick = () => Lab.openReview(b.dataset.rv));
      U.$$('[data-edit]', el).forEach(b => b.onclick = () => Lab.openMatchForm(b.dataset.edit));
      U.$$('[data-lu]', el).forEach(b => b.onclick = () => Lab.openLineup(b.dataset.lu));
      U.$$('[data-del]', el).forEach(b => b.onclick = () => {
        const u = M.matchUsage(b.dataset.del), rv = M.reviewFor(b.dataset.del);
        if (confirm(`Delete this match from the shared library${u.events + u.teamStats + u.playerStats + u.clips ? ` with its data (${u.events} events, ${u.teamStats} team stat values, ${u.playerStats} player stat values, ${u.clips} clips)` : ''}? It's removed from both modes.${rv ? ' Its match review is removed; its findings stay as season findings.' : ''}`)) M.removeMatch(b.dataset.del);
      });
      U.$$('[data-inc]', el).forEach(c => c.onchange = () => { const ex = new Set(ws.excluded || []); if (c.checked) ex.delete(c.dataset.inc); else ex.add(c.dataset.inc); M.updateWorkspace(ws.id, { excluded: [...ex] }); });
    }
  };
})(window.Lab);
