/* Opponent Lab: shell, workspace header, section status, routing, drawer and tooltip. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;
  Lab.Views = Lab.Views || {};
  Lab.vs = Lab.vs || {};          // view state (not persisted)
  Lab.localVideos = {};           // matchId -> {url, name}; this session only

  const TABS = [
    { id: 'home', label: 'Fixtures' },
    { grp: 'Opponent' }, { id: 'team', label: 'Team' }, { id: 'players', label: 'Players' },
    { grp: 'Coding' }, { id: 'matches', label: 'Matches', sec: 'matches' }, { id: 'code', label: 'Code', sec: 'coding' }, { id: 'video', label: 'Video', sec: 'video' }, { id: 'explore', label: 'Explore', sec: 'coding' },
    { grp: '' }, { id: 'report', label: 'Report', sec: 'report' },
    { id: 'data', label: 'Data', right: true }
  ];
  const NEEDS_WS = ['team', 'players', 'matches', 'code', 'explore', 'video', 'report'];
  let current = (location.hash || '').slice(1);

  /* ---------- section status: empty / in progress / complete ---------- */
  const SECTIONS = [
    { id: 'matches', label: 'Matches', tab: 'matches' },
    { id: 'coding', label: 'Coded events', tab: 'code' },
    { id: 'video', label: 'Video & clips', tab: 'video' },
    { id: 'report', label: 'Report', tab: 'report' }
  ];
  function sectionStatus(w) {
    w = w || M.ws();
    if (!w) return {};
    const ms = M.wsMatches(w), ids = new Set(ms.map(m => m.id));
    const opp = w.opponent;
    const facts = {
      matches: { n: ms.length, text: ms.length ? `${ms.length} match${ms.length === 1 ? '' : 'es'}` : 'No matches added' },
      coding: (() => { const ev = M.state.events.filter(e => ids.has(e.matchId)); const t = new Set(ev.map(e => e.templateId)).size; return { n: ev.length, text: ev.length ? `${ev.length} events, ${t} template${t === 1 ? '' : 's'}` : 'Nothing coded' }; })(),
      video: (() => { const v = ms.filter(m => (M.state.videos[m.id] || {}).url || (M.state.videos[m.id] || {}).fileName).length; const c = M.state.clips.filter(x => ids.has(x.matchId)).length; return { n: v + c, text: v || c ? `${v} match video${v === 1 ? '' : 's'}, ${c} clip${c === 1 ? '' : 's'}` : 'No video linked' }; })(),
      report: (() => { const n = M.state.findings.filter(x => x.workspaceId === w.id && x.inReport).length; return { n, text: n ? `${n} item${n === 1 ? '' : 's'} in the report` : 'Nothing in the report yet' }; })()
    };
    const out = {};
    SECTIONS.forEach(s => { const f = facts[s.id]; out[s.id] = Object.assign({}, s, f, { state: (w.done || {})[s.id] ? 'complete' : f.n ? 'progress' : 'empty' }); });
    return out;
  }
  Lab.sectionStatus = sectionStatus;
  Lab.SECTIONS = SECTIONS;
  Lab.statusPill = st => `<span class="st st-${st.state}">${st.state === 'complete' ? 'Complete' : st.state === 'progress' ? 'In progress' : 'Empty'}</span>`;
  Lab.markDone = (secId, val) => { const w = M.ws(); if (!w) return; const d = Object.assign({}, w.done || {}); d[secId] = val; M.updateWorkspace(w.id, { done: d }); };
  Lab.doneToggle = secId => { const w = M.ws(); if (!w) return ''; const on = (w.done || {})[secId]; return `<label class="done-t"><input type="checkbox" data-done="${secId}" ${on ? 'checked' : ''}> Mark ${U.esc((SECTIONS.find(s => s.id === secId) || {}).label || '').toLowerCase()} complete</label>`; };

  /* ---------- workspace header ---------- */
  function renderHead() {
    const w = M.ws(), el = U.$('#ws');
    const ws = M.state.workspaces;
    const pick = `<div class="ws-pick"><label for="wsSel">Fixture</label><select id="wsSel"><option value="">${ws.length ? 'Choose a fixture…' : 'No fixtures yet'}</option>${ws.map(x => `<option value="${x.id}" ${w && x.id === w.id ? 'selected' : ''}>${U.esc(Lab.fixtureLabel(x))}</option>`).join('')}</select><button class="btn sm on-dark" id="wsNew">+ New fixture</button></div>`;
    if (!w) {
      el.innerHTML = `<div><span class="dam-pin">Opponent Lab</span><h1>Opponent <em>Lab</em></h1><div class="ws-meta">Opposition analysis for your next game</div>
        <div class="ws-cov">Choose your next fixture to see the opponent's team and player data, then code their matches, cut vision and build the brief for coaches.</div></div>${pick}`;
    } else {
      const st = sectionStatus(w);
      const meta = [w.competition, w.season, w.round ? 'Round ' + String(w.round).replace(/^r(ound)?\s*/i, '') : '', w.date, w.venue].filter(Boolean).map(U.esc).join(' · ') || 'Fixture details not entered';
      el.innerHTML = `<div><span class="dam-pin">Opponent Lab · Next fixture</span><h1>${U.esc(w.ourTeam || 'Our team')} v <em>${U.esc(w.opponent)}</em></h1><div class="ws-meta">${meta}</div>
        <div class="ws-strip"><button class="wss wss-go" data-go="team">Team data</button><button class="wss wss-go" data-go="players">Player data</button>${SECTIONS.map(s => `<button class="wss wss-${st[s.id].state}" data-go="${s.tab}" data-tip="${U.esc(`<b>${s.label}</b><br>${st[s.id].text}`)}"><i></i>${s.label}</button>`).join('')}</div></div>${pick}`;
    }
    U.$('#wsSel').onchange = e => { M.selectWorkspace(e.target.value); go(e.target.value ? (current === 'home' ? 'team' : current) : 'home'); };
    U.$('#wsNew').onclick = () => Lab.openFixtureForm();
    U.$$('#ws [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  Lab.fixtureLabel = w => `${w.ourTeam || 'Our team'} v ${w.opponent}${w.round ? ', ' + w.round : ''}${w.season ? ' ' + w.season : ''}`;

  function renderTabs() {
    const st = sectionStatus();
    const hasWs = !!M.ws();
    U.$('#tabs').innerHTML = TABS.map(t => t.grp != null ? `<span class="sep" aria-hidden="true"></span>${t.grp ? `<span class="tgrp">${t.grp}</span>` : ''}` :
      `<button role="tab" aria-selected="${t.id === current}" data-tab="${t.id}" class="${t.right ? 'tright' : ''}" ${NEEDS_WS.includes(t.id) && !hasWs ? 'disabled data-tip="Choose a fixture first"' : ''}>${t.label}</button>`).join('');
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
  Lab.openDrawer = function (html, onMount) {
    const d = U.$('#drawer'); d.innerHTML = html; d.classList.add('on'); d.setAttribute('aria-hidden', 'false'); U.$('#scrim').classList.add('on');
    const c = d.querySelector('[data-close]'); if (c) c.onclick = Lab.closeDrawer;
    if (onMount) onMount(d);
    const f = d.querySelector('input:not([type=checkbox]),select,textarea'); if (f) f.focus();
  };
  Lab.closeDrawer = function () { const d = U.$('#drawer'); d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); U.$('#scrim').classList.remove('on'); };
  Lab.drawerOpen = () => U.$('#drawer').classList.contains('on');
  U.$('#scrim').onclick = () => Lab.closeDrawer();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Lab.drawerOpen()) Lab.closeDrawer(); });

  /* ---------- fixture form ---------- */
  Lab.openFixtureForm = function (id) {
    const w = id ? M.state.workspaces.find(x => x.id === id) : null;
    const teams = [...new Set(Object.values(Lab.Packs || {}).flatMap(x => x.teams).concat(M.teams()))].sort();
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${w ? 'Edit fixture' : 'New fixture'}</span><h2 id="drawerTitle">${w ? U.esc(Lab.fixtureLabel(w)) : 'Upcoming game'}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><div class="form">
        <label>Our club<input id="fOur" list="fTeams" value="${U.esc(w ? w.ourTeam : '')}" placeholder="Your club"></label>
        <label>Opponent *<input id="fOpp" list="fTeams" value="${U.esc(w ? w.opponent : '')}" placeholder="Club you are preparing for"></label>
        <datalist id="fTeams">${teams.map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
        <label>Competition<select id="fComp">${Lab.Library.COMPETITIONS.map(c => `<option ${c === (w ? w.competition : 'AFL') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Season<input id="fSeason" value="${U.esc(w ? w.season : String(new Date().getFullYear()))}"></label>
        <label>Round<input id="fRound" value="${U.esc(w ? w.round : '')}" placeholder="e.g. R1, QF"></label>
        <label>Match date<input id="fDate" type="date" value="${U.esc(w ? w.date : '')}"></label>
        <label class="full">Venue<input id="fVenue" value="${U.esc(w ? w.venue : '')}"></label>
        <label class="full">Note for staff<input id="fNote" value="${U.esc(w ? w.note : '')}" placeholder="optional"></label>
      </div>
      <div class="ctl" style="margin-top:12px"><button class="btn g" id="fSave">${w ? 'Save fixture' : 'Create fixture'}</button></div><div id="fErr" class="warnline hidden"></div></div>`, d => {
      U.$('#fSave', d).onclick = () => {
        const v = { ourTeam: U.$('#fOur', d).value.trim(), opponent: U.$('#fOpp', d).value.trim(), competition: U.$('#fComp', d).value, season: U.$('#fSeason', d).value.trim(), round: U.$('#fRound', d).value.trim(), date: U.$('#fDate', d).value, venue: U.$('#fVenue', d).value.trim(), note: U.$('#fNote', d).value.trim() };
        if (!v.opponent) { const e = U.$('#fErr', d); e.textContent = 'Opponent is required.'; e.classList.remove('hidden'); return; }
        if (w) { M.updateWorkspace(w.id, v); synced.delete(w.id); } else { M.addWorkspace(v); go('team'); }
        Lab.closeDrawer();
      };
    });
  };

  /* ---------- routing and render ---------- */
  function go(id) { current = id; history.replaceState(null, '', '#' + id); render(); window.scrollTo({ top: 0 }); }
  Lab.go = go;
  Lab.tab = () => current;
  let rendering = false, again = false;
  /* The fixture's clubs come with their playing lists, so players can be coded straight away. */
  const synced = new Set();
  function syncRosters() {
    const w = M.ws(); if (!w || !Lab.Pack || !Lab.Pack.ok || synced.has(w.id)) return;
    synced.add(w.id);
    const n = [w.opponent, w.ourTeam].filter(Boolean).reduce((a, t) => a + Lab.Pack.syncRoster(t), 0);
    if (n) M.emit('players');
  }
  function render() {
    if (rendering) { again = true; return; }
    rendering = true;
    try {
      const main = U.$('#main');
      if (main.contains(document.activeElement) && document.activeElement !== main) document.activeElement.blur();
      if (!TABS.some(t => t.id === current)) current = 'home';
      Lab.Pack = (Lab.packFor && Lab.packFor(M.ws())) || { ok: false };
      syncRosters();
      if (NEEDS_WS.includes(current) && !M.ws()) current = 'home';
      renderHead(); renderTabs();
      const pv = document.getElementById('vid');
      Lab._vidResume = pv && Lab.vs.videoMatch ? { id: Lab.vs.videoMatch, t: pv.currentTime } : null;
      main.innerHTML = `<div class="view" id="view-${current}"></div>`;
      const el = U.$('#view-' + current);
      Lab.Views[current].render(el, { ws: M.ws() });
      U.$$('[data-done]', el).forEach(cb => cb.onchange = () => Lab.markDone(cb.dataset.done, cb.checked));
    } catch (err) { console.error(err); U.$('#main').innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${U.esc(err.message)}</p></div>`; }
    finally { rendering = false; if (again) { again = false; render(); } }
  }
  Lab.render = render;
  M.on(() => { render(); if (!M.persistOk) U.toast('This browser blocked local storage: changes will be lost on reload. Export a backup.', 'warn'); });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id !== current && TABS.some(t => t.id === id)) { current = id; render(); } });

  M.load();
  render();
})(window.Lab);
