/* Team Lab: shell, workspace header, section status, routing, drawer and tooltip. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;
  Lab.Views = Lab.Views || {};
  Lab.vs = Lab.vs || {};          // view state (not persisted)
  Lab.localVideos = {};           // matchId -> {url, name}; this session only

  const TABS = [
    { id: 'home', label: 'Seasons' },
    { grp: 'Our team' }, { id: 'team', label: 'Team' }, { id: 'players', label: 'Players' },
    { grp: 'Matches' }, { id: 'matches', label: 'Matches', sec: 'matches' }, { id: 'review', label: 'Match review', sec: 'reviews' }, { id: 'code', label: 'Code', sec: 'coding' }, { id: 'video', label: 'Video', sec: 'video' }, { id: 'explore', label: 'Explore', sec: 'coding' },
    { grp: '' }, { id: 'findings', label: 'Findings', sec: 'findings' }, { id: 'report', label: 'Report', sec: 'report' },
    { id: 'data', label: 'Data', right: true }
  ];
  const NEEDS_WS = ['team', 'players', 'matches', 'review', 'code', 'explore', 'video', 'findings', 'report'];
  let current = (location.hash || '').slice(1);

  /* ---------- section status: empty / in progress / complete ---------- */
  const SECTIONS = [
    { id: 'matches', label: 'Matches', tab: 'matches' },
    { id: 'reviews', label: 'Match reviews', tab: 'review' },
    { id: 'coding', label: 'Coded events', tab: 'code', optional: true },
    { id: 'video', label: 'Video & clips', tab: 'video', optional: true },
    { id: 'findings', label: 'Findings', tab: 'findings' },
    { id: 'report', label: 'Report', tab: 'report' }
  ];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(ch|sh)$/.test(w) ? 'es' : 's'}`;
  function sectionStatus(w) {
    w = w || M.ws();
    if (!w) return {};
    const ms = M.wsMatches(w), ids = new Set(ms.map(m => m.id));
    const tl = M.tl;
    const facts = {
      matches: { n: ms.length, text: ms.length ? plural(ms.length, 'match') : 'No matches added' },
      reviews: (() => { const r = tl.reviews.filter(x => x.workspaceId === w.id); return { n: r.length, text: r.length ? `${plural(r.length, 'match review')}` : 'No match reviews yet' }; })(),
      coding: (() => { const ev = M.state.events.filter(e => ids.has(e.matchId)); const t = new Set(ev.map(e => e.templateId)).size; return { n: ev.length, text: ev.length ? `${ev.length} events, ${plural(t, 'template')}` : 'Nothing coded (optional)' }; })(),
      video: (() => { const v = ms.filter(m => (M.state.videos[m.id] || {}).url || (M.state.videos[m.id] || {}).fileName).length; const c = M.state.clips.filter(x => ids.has(x.matchId)).length; return { n: v + c, text: v || c ? `${plural(v, 'match video')}, ${plural(c, 'clip')}` : 'No video linked (optional)' }; })(),
      findings: (() => { const f = tl.findings.filter(x => x.workspaceId === w.id); return { n: f.length, text: f.length ? `${plural(f.length, 'finding')}, ${f.filter(x => x.followUp && x.followStatus !== 'Done').length} open follow-ups` : 'No findings yet' }; })(),
      report: (() => { const n = tl.findings.filter(x => x.workspaceId === w.id && x.inReport && x.status === 'Ready for report').length; return { n, text: n ? `${plural(n, 'finding')} ready for a report` : 'Nothing marked ready yet' }; })()
    };
    const out = {};
    SECTIONS.forEach(s => { const f = facts[s.id]; out[s.id] = Object.assign({}, s, f, { state: (w.done || {})[s.id] ? 'complete' : f.n ? 'progress' : 'empty' }); });
    return out;
  }
  Lab.sectionStatus = sectionStatus;
  Lab.SECTIONS = SECTIONS;
  Lab.statusPill = st => `<span class="st st-${st.state}">${st.state === 'complete' ? 'Complete' : st.state === 'progress' ? 'In progress' : st.optional ? 'Optional' : 'Empty'}</span>`;
  Lab.markDone = (secId, val) => { const w = M.ws(); if (!w) return; const d = Object.assign({}, w.done || {}); d[secId] = val; M.updateWorkspace(w.id, { done: d }); };
  Lab.doneToggle = secId => { const w = M.ws(); if (!w) return ''; const on = (w.done || {})[secId]; return `<label class="done-t"><input type="checkbox" data-done="${secId}" ${on ? 'checked' : ''}> Mark ${U.esc((SECTIONS.find(s => s.id === secId) || {}).label || '').toLowerCase()} complete</label>`; };

  /* ---------- workspace header ---------- */
  Lab.wsLabel = w => `${w.team || 'Our team'}, ${[w.competition, w.season].filter(Boolean).join(' ')}`;
  function renderHead() {
    const w = M.ws(), el = U.$('#ws');
    const ws = M.tl.workspaces;
    const pick = `<div class="ws-pick"><label for="wsSel">Team season</label><select id="wsSel"><option value="">${ws.length ? 'Choose a team season…' : 'No team seasons yet'}</option>${ws.map(x => `<option value="${x.id}" ${w && x.id === w.id ? 'selected' : ''}>${U.esc(Lab.wsLabel(x))}</option>`).join('')}</select><button class="btn sm on-dark" id="wsNew">+ New team season</button></div>`;
    if (!w) {
      el.innerHTML = `<div><span class="dam-pin">Team Lab · Beta</span><h1>Team <em>Lab</em></h1><div class="ws-meta">Review and code your own team</div>
        <div class="ws-cov">Choose your club and season to see your own team and player numbers, review completed matches, code your own vision and build match reviews for coaches.</div></div>${pick}`;
    } else {
      const st = sectionStatus(w);
      const meta = [w.competition, w.season, w.note].filter(Boolean).map(U.esc).join(' · ');
      el.innerHTML = `<div><span class="dam-pin">Team Lab · Beta · Our team</span><h1>${U.esc(w.team || 'Our team')} <em>${U.esc(w.season || '')}</em></h1><div class="ws-meta">${meta || 'Season details not entered'}</div>
        <div class="ws-strip"><button class="wss wss-go" data-go="team">Team data</button><button class="wss wss-go" data-go="players">Player data</button>${SECTIONS.map(s => `<button class="wss wss-${st[s.id].state}" data-go="${s.tab}" data-tip="${U.esc(`<b>${s.label}</b><br>${st[s.id].text}`)}"><i></i>${s.label}</button>`).join('')}</div></div>${pick}`;
    }
    U.$('#wsSel').onchange = e => { M.selectWorkspace(e.target.value); go(e.target.value ? (current === 'home' ? 'team' : current) : 'home'); };
    U.$('#wsNew').onclick = () => Lab.openFixtureForm();
    U.$$('#ws [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  Lab.fixtureLabel = Lab.wsLabel;

  function renderTabs() {
    const hasWs = !!M.ws();
    U.$('#tabs').innerHTML = TABS.map(t => t.grp != null ? `<span class="sep" aria-hidden="true"></span>${t.grp ? `<span class="tgrp">${t.grp}</span>` : ''}` :
      `<button role="tab" aria-selected="${t.id === current}" data-tab="${t.id}" class="${t.right ? 'tright' : ''}" ${NEEDS_WS.includes(t.id) && !hasWs ? 'disabled data-tip="Choose a team season first"' : ''}>${t.label}</button>`).join('');
    U.$$('#tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
  }

  /* ---------- tooltip ---------- */
  const tip = U.$('#tip');
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tip.classList.remove('on'); return; } tip.innerHTML = t.getAttribute('data-tip'); tip.classList.add('on'); });
  document.addEventListener('mousemove', e => {
    if (!tip.classList.contains('on')) return;
    const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  /* ---------- drawer ---------- */
  let lastFocus = null;
  Lab.openDrawer = function (html, onMount) {
    const d = U.$('#drawer');
    if (!Lab.drawerOpen()) lastFocus = document.activeElement;
    d.innerHTML = html; d.classList.add('on'); d.setAttribute('aria-hidden', 'false'); U.$('#scrim').classList.add('on');
    const c = d.querySelector('[data-close]'); if (c) c.onclick = Lab.closeDrawer;
    if (onMount) onMount(d);
    const f = d.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea,button:not([data-close])'); if (f) f.focus();
  };
  Lab.closeDrawer = function () { const d = U.$('#drawer'); d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); U.$('#scrim').classList.remove('on'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); };
  Lab.drawerOpen = () => U.$('#drawer').classList.contains('on');
  U.$('#scrim').onclick = () => Lab.closeDrawer();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Lab.drawerOpen()) Lab.closeDrawer(); });

  /* ---------- team season form ---------- */
  Lab.openFixtureForm = function (id) {
    const w = id ? M.tl.workspaces.find(x => x.id === id) : null;
    const teamsFor = comp => [...new Set(Object.values(Lab.Packs || {}).filter(p => p.raw.competition === comp).flatMap(p => p.teams))].sort();
    const comp0 = w ? w.competition : 'VFL';
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${w ? 'Edit team season' : 'New team season'}</span><h2 id="drawerTitle">${w ? U.esc(Lab.wsLabel(w)) : 'Your club'}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><div class="form">
        <label>Competition<select id="fComp">${Lab.Library.COMPETITIONS.map(c => `<option ${c === comp0 ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Season<input id="fSeason" value="${U.esc(w ? w.season : String(new Date().getFullYear()))}" inputmode="numeric"></label>
        <label class="full">Our club *<input id="fTeam" list="fTeams" value="${U.esc(w ? w.team : '')}" placeholder="The club you work for"></label>
        <datalist id="fTeams"></datalist>
        <label class="full">Note for staff<input id="fNote" value="${U.esc(w ? w.note : '')}" placeholder="optional"></label>
      </div>
      <p class="sub" id="fHint" style="margin-top:8px"></p>
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="fSave">${w ? 'Save' : 'Create team season'}</button></div><div id="fErr" class="warnline hidden"></div></div>`, d => {
      const hint = () => {
        const comp = U.$('#fComp', d).value, season = U.$('#fSeason', d).value.trim();
        U.$('#fTeams', d).innerHTML = teamsFor(comp).map(t => `<option value="${U.esc(t)}">`).join('');
        const X = Lab.packFor({ competition: comp, season });
        U.$('#fHint', d).textContent = X && X.raw.season === season
          ? `${comp} ${season} season data is built in: pick the club from the list so its results, team stats and players load.`
          : `No built-in ${comp} ${season} season data. You can still add matches, import stats and code.`;
      };
      U.$('#fComp', d).onchange = hint; U.$('#fSeason', d).oninput = hint; hint();
      U.$('#fSave', d).onclick = () => {
        const v = { team: U.$('#fTeam', d).value.trim(), competition: U.$('#fComp', d).value, season: U.$('#fSeason', d).value.trim(), note: U.$('#fNote', d).value.trim() };
        const X = Lab.packFor(v);
        if (X && X.raw.season === v.season && X.resolve(v.team)) v.team = X.resolve(v.team);
        if (!v.team) { const e = U.$('#fErr', d); e.textContent = 'Choose your club.'; e.classList.remove('hidden'); return; }
        if (w) { M.updateWorkspace(w.id, v); synced.clear(); } else { M.addWorkspace(v); go('team'); }
        Lab.closeDrawer();
      };
    });
  };

  /* ---------- routing and render ---------- */
  function go(id) { current = id; history.replaceState(null, '', '#' + id); render(); window.scrollTo({ top: 0 }); }
  Lab.go = go;
  Lab.tab = () => current;
  let rendering = false, again = false;
  /* Our club's playing list, and each opponent's, come into the coding rosters. Adds missing names only. */
  const synced = new Set();
  Lab.syncTeams = function (teams) {
    if (!Lab.Pack || !Lab.Pack.ok) return 0;
    let n = 0;
    teams.filter(Boolean).forEach(t => { const k = Lab.Pack.season.key + '|' + t; if (synced.has(k)) return; synced.add(k); n += Lab.Pack.syncRoster(t); });
    return n;
  };
  function syncRosters() {
    const w = M.ws(); if (!w) return;
    const opps = M.wsMatches(w).map(m => M.opponentIn(m, w.team));
    if (Lab.syncTeams([w.team].concat(opps))) M.save();
  }
  function render() {
    if (rendering) { again = true; return; }
    rendering = true;
    try {
      const main = U.$('#main');
      if (main.contains(document.activeElement) && document.activeElement !== main) document.activeElement.blur();
      if (!TABS.some(t => t.id === current)) current = 'home';
      const w = M.ws();
      const P = w && Lab.packFor && Lab.packFor(w);
      Lab.Pack = P && P.raw.season === String(w.season) ? P : { ok: false };
      syncRosters();
      if (NEEDS_WS.includes(current) && !w) current = 'home';
      renderHead(); renderTabs();
      const pv = document.getElementById('vid');
      Lab._vidResume = pv && Lab.vs.videoMatch ? { id: Lab.vs.videoMatch, t: pv.currentTime } : null;
      main.innerHTML = `<div class="view" id="view-${current}"></div>`;
      const el = U.$('#view-' + current);
      Lab.Views[current].render(el, { ws: w });
      U.$$('[data-done]', el).forEach(cb => cb.onchange = () => Lab.markDone(cb.dataset.done, cb.checked));
    } catch (err) { console.error(err); U.$('#main').innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${U.esc(err.message)}</p></div>`; }
    finally { rendering = false; if (again) { again = false; render(); } }
  }
  Lab.render = render;
  M.on(() => { render(); if (!M.persistOk) U.toast('This browser blocked local storage: changes will be lost on reload. Download a backup.', 'warn'); });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id !== current && TABS.some(t => t.id === id)) { current = id; render(); } });
  /* Opponent Lab (or Team Lab in another tab) changed the shared library: reload so this tab doesn't save over it. */
  window.addEventListener('storage', e => { if (e.key === M.KEY || e.key === M.TKEY) { M.load(); render(); U.toast('Updated with changes made in another tab'); } });

  M.load();
  render();
})(window.Lab);
