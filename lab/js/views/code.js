/* Code: keyboard-first event coding with any template, plus the template editor.
   Number keys pick the highlighted field's option and move on; Enter saves; Esc clears;
   T switches the team being coded; M marks the moment; Space starts/stops the clock. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, Z = Lab.Library;
  const vs = Lab.vs;
  const KEYS = '1234567890qwertyuiop'.split('');
  let ticker = null;

  function st() {
    vs.code = vs.code || {};
    const c = vs.code;
    if (!c.templateId || !M.template(c.templateId)) c.templateId = (M.state.templates[0] || {}).id;
    if (!c.period) c.period = 1;
    if (c.clockSec == null) c.clockSec = M.state.settings.clockMode === 'elapsed' ? 0 : qsecs();
    c.draft = c.draft || {}; c.sticky = c.sticky || {}; c.recent = c.recent || [];
    if (c.active == null) c.active = 0;
    return c;
  }
  const tpl = () => M.template(st().templateId);
  const match = () => M.match(st().matchId);
  const qsecs = () => M.quarterSecs(vs.code && M.match(vs.code.matchId));
  const seq = () => tpl().fields.filter(f => !f.sticky);
  const sticky = () => tpl().fields.filter(f => f.sticky);
  const opts = f => f.type === 'zone' ? Z.ZONES : (f.options || []);

  /* clock */
  function now() { const c = st(); if (!c.runningSince) return c.clockSec; const d = (Date.now() - c.runningSince) / 1000; return M.state.settings.clockMode === 'elapsed' ? c.clockSec + d : Math.max(0, c.clockSec - d); }
  function toggleClock() { const c = st(); if (c.runningSince) { c.clockSec = now(); c.runningSince = null; } else c.runningSince = Date.now(); paint(); }
  function paint() {
    const el = document.getElementById('clockIn'); if (!el) return;
    if (document.activeElement !== el) el.value = U.fmtClock(now());
    el.classList.toggle('run', !!st().runningSince);
    const b = document.getElementById('clockBtn'); if (b) b.textContent = st().runningSince ? 'Stop clock' : 'Start clock';
    const v = document.getElementById('codeVid'), t = document.getElementById('vidNow'); if (v && t) t.textContent = U.fmtVideoTime(v.currentTime);
  }

  /* draft */
  function set(key, val) { const c = st(); const f = tpl().fields.find(x => x.key === key); if (f && f.sticky) c.sticky[key] = val; else c.draft[key] = val; }
  function get(key) { const c = st(); return c.draft[key] != null ? c.draft[key] : c.sticky[key]; }
  function advance() { const fs = seq(), c = st(); for (let i = c.active + 1; i < fs.length; i++) { const v = get(fs[i].key); if (v == null || v === '') { c.active = i; return; } } c.active = Math.min(c.active + 1, fs.length - 1); }
  function clear() { const c = st(); c.draft = {}; c.mark = null; c.active = 0; }
  function teamFor(f) { const m = match(), c = st(); if (!m) return ''; const t = c.team || m.home; return f.side === 'against' ? M.opponentIn(m, t) : f.side === 'any' ? '' : t; }

  function save() {
    const c = st(), t = tpl(), m = match();
    if (!m) { U.toast('Choose or add a match first', 'warn'); return; }
    document.querySelectorAll('[data-fk]').forEach(inp => set(inp.dataset.fk, inp.value));
    const miss = t.fields.filter(f => f.required && (get(f.key) == null || get(f.key) === ''));
    if (miss.length) { U.toast(miss[0].label + ' is required', 'warn'); return; }
    const team = c.team || m.home, v = {}; let added = 0;
    t.fields.forEach(f => {
      let x = get(f.key);
      if (x == null || x === '') return;
      if (f.type === 'player') {
        const tm = f.side === 'against' ? M.opponentIn(m, team) : f.side === 'any' ? '' : team;
        let id = M.player(x) ? x : M.findPlayer(tm, x);
        if (!id && tm) { id = M.addPlayer({ team: tm, name: String(x).replace(/^#?\d+\s+/, '') || String(x), number: (String(x).match(/^#?(\d+)/) || [])[1] || '' }, true).id; added++; }
        x = id || x;
      }
      if (['number', 'margin', 'chain'].includes(f.type)) x = isNaN(parseFloat(x)) ? x : parseFloat(x);
      v[f.key] = x;
    });
    const vid = document.getElementById('codeVid');
    const vt = c.mark && c.mark.video != null ? c.mark.video : (vid && vid.readyState > 0 ? vid.currentTime : null);
    const e = M.addEvent({ matchId: m.id, templateId: t.id, team, period: c.period, clock: (c.mark && c.mark.clock) || U.fmtClock(now()), v, notes: v.notes || '', video: vt != null ? { time: vt, status: 'confirmed' } : null }, true);
    delete e.v.notes;
    c.recent.unshift(e.id);
    clear();
    M.emit('events');
    U.toast(`Saved Q${e.period} ${e.clock}${added ? ` · ${added} new name${added > 1 ? 's' : ''} added to the player lists` : ''}`);
  }
  function undo() { const c = st(); const id = c.recent[0]; const e = id && M.event(id); if (!e) return; if (confirm(`Remove the last event (Q${e.period} ${e.clock})?`)) { c.recent.shift(); M.removeEvent(id); } }
  function mark() { const c = st(), v = document.getElementById('codeVid'); c.mark = { clock: U.fmtClock(now()), video: v && v.readyState > 0 ? v.currentTime : null }; U.toast(`Marked Q${c.period} ${c.mark.clock}`); Lab.render(); }
  function switchTeam() { const m = match(); if (!m) return; const c = st(); c.team = (c.team || m.home) === m.home ? m.away : m.home; Lab.render(); }

  document.addEventListener('keydown', ev => {
    if (Lab.tab() !== 'code' || Lab.drawerOpen() || !tpl()) return;
    const t = ev.target, inText = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName), c = st();
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); save(); return; }
    if (inText) {
      if (ev.key === 'Enter' && t.tagName === 'INPUT' && t.dataset.fk) { ev.preventDefault(); set(t.dataset.fk, t.value); const i = seq().findIndex(f => f.key === t.dataset.fk); if (i >= 0) { c.active = i; advance(); } t.blur(); Lab.render(); }
      else if (ev.key === 'Escape') t.blur();
      return;
    }
    if (ev.altKey || ev.ctrlKey || ev.metaKey) { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); } return; }
    const fs = seq(), f = fs[c.active];
    const k = ev.key.toLowerCase();
    if (ev.key === 'Enter') { ev.preventDefault(); save(); return; }
    if (ev.key === 'Escape') { clear(); Lab.render(); return; }
    if (ev.key === ' ') { ev.preventDefault(); toggleClock(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); c.active = Math.min(fs.length - 1, c.active + 1); Lab.render(); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); c.active = Math.max(0, c.active - 1); Lab.render(); return; }
    if (ev.key === 'Backspace' && f) { ev.preventDefault(); delete c.draft[f.key]; Lab.render(); return; }
    const choiceLike = f && (f.type === 'choice' || f.type === 'zone');
    const usesLetters = choiceLike && opts(f).length > 10;
    if (k === 't' && !usesLetters) { switchTeam(); return; }
    if (k === 'm' && !usesLetters) { mark(); return; }
    if (choiceLike) { const i = KEYS.indexOf(k); if (i >= 0 && i < opts(f).length) { ev.preventDefault(); set(f.key, opts(f)[i]); advance(); Lab.render(); return; } }
    if (f && !choiceLike && /^[\w\-.#]$/.test(ev.key)) { const inp = document.querySelector(`[data-fk="${f.key}"]`); if (inp) inp.focus(); }
  });

  function newMatch() { const w = M.ws(); Lab.openMatchForm(null, w ? { home: w.focus, competition: w.competition, season: w.season } : {}); }

  function row(f, i, isSeq) {
    const c = st(), v = get(f.key), active = isSeq && i === c.active, filled = v != null && v !== '';
    let ctl;
    if (f.type === 'choice' || f.type === 'zone') {
      const m = match(), team = c.team || (m && m.home);
      const lab = o => o === 'Team' ? team || o : o === 'Opposition' && m ? M.opponentIn(m, team) || o : o;
      ctl = f.type === 'zone'
        ? `<div class="zgrid">${Z.ZONES.map((o, j) => `<button type="button" class="opt z${v === o ? ' on' : ''}" data-set="${U.esc(f.key)}" data-val="${U.esc(o)}" title="${U.esc(o)}">${active ? `<kbd>${KEYS[j]}</kbd>` : ''}${U.esc(o.replace(' · ', ' '))}</button>`).join('')}</div>`
        : `<div class="opts">${opts(f).map((o, j) => `<button type="button" class="opt${v === o ? ' on' : ''}" data-set="${U.esc(f.key)}" data-val="${U.esc(o)}">${active && KEYS[j] ? `<kbd>${KEYS[j]}</kbd>` : ''}${U.esc(lab(o))}</button>`).join('')}</div>`;
    } else if (f.long) {
      ctl = `<textarea data-fk="${f.key}" rows="2">${U.esc(v || '')}</textarea>`;
    } else if (f.type === 'player') {
      const tm = teamFor(f), ros = tm ? M.roster(tm) : M.state.players;
      const shown = v && M.player(v) ? (M.player(v).number ? M.player(v).number + ' ' : '') + M.player(v).name : (v || '');
      ctl = `<input data-fk="${f.key}" list="pl_${f.key}" value="${U.esc(shown)}" placeholder="${U.esc(tm ? tm + ': number or name' : 'number or name')}"><datalist id="pl_${f.key}">${ros.map(p => `<option value="${U.esc((p.number ? p.number + ' ' : '') + p.name)}">`).join('')}</datalist>`;
    } else {
      ctl = `<input data-fk="${f.key}" value="${U.esc(v == null ? '' : v)}" ${['number', 'margin', 'chain'].includes(f.type) ? 'inputmode="numeric"' : ''} placeholder="${f.type === 'margin' ? 'e.g. -12' : f.type === 'chain' ? 'chain no.' : ''}">`;
    }
    return `<div class="cf${active ? ' active' : ''}${filled ? ' filled' : ''}" data-row="${isSeq ? i : ''}"><span class="cf-l">${U.esc(f.label)}${f.required ? ' *' : ''}${f.type === 'player' && f.side ? `<em>${f.side === 'against' ? 'opposition' : f.side === 'any' ? 'either team' : 'coded team'}</em>` : ''}</span>${ctl}</div>`;
  }

  /* ---------- template editor ---------- */
  const TYPES = [['choice', 'Choice (buttons)'], ['player', 'Player'], ['zone', 'Ground zone'], ['number', 'Number'], ['margin', 'Margin (score state)'], ['chain', 'Chain number (for sequences)'], ['text', 'Text']];
  function editTemplate(t) {
    const draft = JSON.parse(JSON.stringify(t));
    const draw = d => {
      U.$('#tfRows', d).innerHTML = draft.fields.map((f, i) => `<div class="tf"><div class="form">
          <label>Field<input data-fi="${i}" data-p="label" value="${U.esc(f.label)}"></label>
          <label>Type<select data-fi="${i}" data-p="type">${TYPES.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          ${f.type === 'choice' ? `<label class="full">Options, comma separated (keys 1–9, 0, then q–p)<input data-fi="${i}" data-p="options" value="${U.esc((f.options || []).join(', '))}"></label>` : ''}
          ${f.type === 'player' ? `<label>Which team<select data-fi="${i}" data-p="side">${[['for', 'Team being coded'], ['against', 'Their opposition'], ['any', 'Either']].map(([v, l]) => `<option value="${v}" ${(f.side || 'for') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
        </div><div class="ctl" style="margin-top:6px"><label class="cb"><input type="checkbox" data-fi="${i}" data-p="sticky" ${f.sticky ? 'checked' : ''}> Carries over</label><label class="cb"><input type="checkbox" data-fi="${i}" data-p="required" ${f.required ? 'checked' : ''}> Required</label>${f.type === 'text' ? `<label class="cb"><input type="checkbox" data-fi="${i}" data-p="long" ${f.long ? 'checked' : ''}> Long text</label>` : ''}
          <span style="margin-left:auto"></span><button class="btn sm" data-mv="${i}:-1" ${i ? '' : 'disabled'}>↑</button><button class="btn sm" data-mv="${i}:1" ${i < draft.fields.length - 1 ? '' : 'disabled'}>↓</button><button class="btn sm danger" data-rm="${i}">Remove</button></div></div>`).join('');
      U.$$('[data-fi]', d).forEach(inp => inp.onchange = () => {
        const f = draft.fields[+inp.dataset.fi], p = inp.dataset.p;
        if (inp.type === 'checkbox') f[p] = inp.checked;
        else if (p === 'options') f.options = inp.value.split(',').map(x => x.trim()).filter(Boolean);
        else { f[p] = inp.value; if (p === 'type') { if (inp.value === 'choice' && !f.options) f.options = ['Yes', 'No']; if (inp.value === 'player' && !f.side) f.side = 'for'; draw(d); } }
      });
      U.$$('[data-mv]', d).forEach(b => b.onclick = () => { const [i, dir] = b.dataset.mv.split(':').map(Number); [draft.fields[i], draft.fields[i + dir]] = [draft.fields[i + dir], draft.fields[i]]; draw(d); });
      U.$$('[data-rm]', d).forEach(b => b.onclick = () => { draft.fields.splice(+b.dataset.rm, 1); draw(d); });
    };
    const used = M.state.events.filter(e => e.templateId === draft.id).length;
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Coding template</span><h2 id="drawerTitle">${U.esc(draft.name)}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><div class="form"><label>Name<input id="tName" value="${U.esc(draft.name)}"></label><label>Phase of play<input id="tPhase" value="${U.esc(draft.phase || '')}" placeholder="e.g. Stoppages"></label>
        <label>One event is a…<input id="tUnit" value="${U.esc(draft.unit || 'event')}"></label><label class="full">Definitions for coders<textarea id="tDesc">${U.esc(draft.description || '')}</textarea></label></div>
        <p class="sub" style="margin:10px 0">Every event also records match, team, quarter, clock, tags, notes and video time.</p>
        <div id="tfRows"></div>
        <div class="ctl" style="margin-top:8px"><button class="btn" id="tfAdd">+ Add field</button><span style="margin-left:auto"></span><button class="btn g" id="tSave">Save template</button></div>
        ${used ? `<p class="warnline">${used} events use this template. Renaming an option does not change values already coded.</p>` : ''}</div>`, d => {
      draw(d);
      U.$('#tfAdd', d).onclick = () => { draft.fields.push({ key: '', label: 'New field', type: 'choice', options: ['Yes', 'No'] }); draw(d); };
      U.$('#tSave', d).onclick = () => {
        draft.name = U.$('#tName', d).value.trim() || 'Untitled template'; draft.phase = U.$('#tPhase', d).value.trim(); draft.unit = U.$('#tUnit', d).value.trim() || 'event'; draft.description = U.$('#tDesc', d).value.trim();
        const keys = new Set();
        draft.fields.forEach(f => { if (!f.key) { let k = U.norm(f.label) || 'field'; if (/^\d/.test(k)) k = 'f' + k; while (keys.has(k) || draft.fields.some(o => o !== f && o.key === k)) k += 'x'; f.key = k; } keys.add(f.key); });
        M.saveTemplate(draft); Lab.closeDrawer(); U.toast('Template saved');
      };
    });
  }
  Lab.editTemplate = editTemplate;

  Lab.Views.code = {
    render(el) {
      const c = st(), t = tpl(), w = M.ws();
      const all = M.sortMatches(M.state.matches);
      const pref = w ? M.wsMatches(w) : [];
      if (!c.matchId || !M.match(c.matchId)) c.matchId = (pref[pref.length - 1] || all[all.length - 1] || {}).id || '';
      const m = match();
      if (m && c.team !== m.home && c.team !== m.away) c.team = w && M.involves(m, w.focus) ? w.focus : m.home;
      if (!t) { el.innerHTML = `<div class="empty"><h3>No coding templates</h3><p>Restore the starter templates or create your own.</p><button class="btn g" id="restore">Restore starter templates</button></div>`; U.$('#restore', el).onclick = () => M.restoreStarters(); return; }
      const fs = seq(); if (c.active >= fs.length) c.active = 0;
      const coded = m ? M.state.events.filter(e => e.matchId === m.id && e.templateId === t.id).sort((a, b) => b.period - a.period || (Lab.Analysis.derive(b).el ?? 0) - (Lab.Analysis.derive(a).el ?? 0)) : [];
      const local = m && Lab.localVideos[m.id], vurl = m && (M.state.videos[m.id] || {}).url, direct = vurl && /\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(vurl);
      const phases = U.groupBy(M.state.templates, x => x.phase || 'Custom');
      el.innerHTML = `
      <div class="code-grid">
        <section class="card">
          <div class="card-h"><div><h2>Code ${U.esc(t.unit || 'event')}s</h2><p>${U.esc(t.description || '')}</p></div>
            <div class="ctl"><select id="cTpl" aria-label="Template">${[...phases.entries()].map(([p, list]) => `<optgroup label="${U.esc(p)}">${list.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn sm" id="cEditT">Edit template</button></div></div>
          <div class="cbar">
            <div class="f"><label class="k" for="cMatch">Match</label><div class="ctl"><select id="cMatch">${all.length ? '' : '<option value="">No matches yet</option>'}${(() => { const o = x => `<option value="${x.id}" ${x.id === c.matchId ? 'selected' : ''}>${U.esc(M.matchLabel(x))}</option>`, ids = new Set(pref.map(x => x.id)), rest = all.filter(x => !ids.has(x.id)); return pref.length && rest.length ? `<optgroup label="${U.esc(w.focus)}">${pref.map(o).join('')}</optgroup><optgroup label="Other matches">${rest.map(o).join('')}</optgroup>` : all.map(o).join(''); })()}</select><button class="btn sm" id="cNewM">+ Match</button></div></div>
            ${m ? `<div class="f"><label class="k">Coding for <kbd>T</kbd></label><div class="qbtns team">${[m.home, m.away].map(x => `<button type="button" data-team="${U.esc(x)}" class="${c.team === x ? 'on' : ''}">${U.esc(x)}</button>`).join('')}</div></div>` : ''}
            <div class="f"><label class="k">Quarter</label><div class="qbtns">${[1, 2, 3, 4, 5].map(q => `<button type="button" data-q="${q}" class="${c.period === q ? 'on' : ''}" ${q === 5 ? 'title="Extra time"' : ''}>${q === 5 ? 'ET' : 'Q' + q}</button>`).join('')}</div></div>
            <div class="f"><label class="k" for="clockIn">Clock (${M.state.settings.clockMode === 'elapsed' ? 'elapsed' : 'time left'})</label><div class="ctl"><input id="clockIn" class="clock" value="${U.fmtClock(now())}"><button class="btn sm" id="clockBtn">${c.runningSince ? 'Stop clock' : 'Start clock'}</button></div></div>
          </div>
          ${c.mark ? `<p class="warnline okline">Marked Q${c.period} ${U.esc(c.mark.clock)}${c.mark.video != null ? ' · video ' + U.fmtVideoTime(c.mark.video) : ''}. <button class="link" id="unmark">Clear</button></p>` : ''}
          ${!m ? `<div class="empty" style="margin-top:12px"><h3>Add the match you're coding</h3><p>Add matches on the Matches tab, or one here.</p><div class="ctl" style="justify-content:center"><button class="btn g" onclick="Lab.go('matches')">Go to Matches</button><button class="btn" id="cNewM2">+ Add match</button></div></div>` : `
            <div style="margin-top:12px">${fs.map((f, i) => row(f, i, true)).join('')}</div>
            ${sticky().length ? `<details class="sticky-grp" ${(vs.stickyOpen != null ? vs.stickyOpen : sticky().some(f => !get(f.key))) ? 'open' : ''} id="stickyD"><summary>Carries over between events (${sticky().filter(f => get(f.key)).length}/${sticky().length} set)${sticky().some(f => get(f.key)) ? ': ' + U.esc(sticky().map(f => get(f.key)).filter(Boolean).map(x => M.playerName(x)).join(', ')) : ''}</summary>${sticky().map(f => row(f, -1, false)).join('')}</details>` : ''}
            <div class="ctl" style="margin-top:12px"><button class="btn g" id="cSave">Save event <kbd class="inv">Enter</kbd></button><button class="btn" id="cClear">Clear <kbd>Esc</kbd></button><button class="btn" id="cMark">Mark <kbd>M</kbd></button><button class="btn" id="cUndo" ${c.recent.length ? '' : 'disabled'}>Undo last</button></div>
            <details class="keys-d"><summary>Keyboard shortcuts</summary><div class="keys"><span><kbd>1</kbd>–<kbd>9</kbd> pick and move on</span><span><kbd>↑</kbd><kbd>↓</kbd> fields</span><span><kbd>Backspace</kbd> clear field</span><span><kbd>T</kbd> switch team</span><span><kbd>Space</kbd> clock</span><span><kbd>M</kbd> mark moment</span><span><kbd>Enter</kbd> save</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> save from a text box</span></div></details>`}
        </section>
        <div class="grid">
          ${m ? `<section class="card"><div class="card-h"><div><h3>Video</h3><p>Saved events take the current video time.</p></div></div>
            ${local || direct ? `<div class="vid-wrap" style="padding:0"><video id="codeVid" src="${local ? local.url : U.esc(vurl)}" controls preload="metadata"></video></div><div class="pl-now">Video <span id="vidNow">0:00</span> · ${U.esc(local ? local.name + ' (local, this session)' : vurl)}</div>`
            : `<div class="vid-wrap" style="aspect-ratio:auto;min-height:80px">No playable video for this match.</div>`}
            <div class="ctl" style="margin-top:8px"><label class="btn sm" for="cFile" style="cursor:pointer">Play a local file…</label><input type="file" id="cFile" accept="video/*" class="hidden"></div></section>` : ''}
          <section class="card"><div class="card-h"><div><h3>Coded in this match (${coded.length})</h3><p>${U.esc(t.name)}, newest first.</p></div></div>
            ${coded.length ? `<div class="tw" style="max-height:440px;overflow:auto"><table class="compact"><thead><tr><th>Q</th><th>Clock</th><th class="l">Team</th><th class="l">Summary</th></tr></thead><tbody>
              ${coded.map(e => `<tr class="click" data-open="${e.id}"><td>${e.period}</td><td>${U.esc(e.clock)}</td><td class="l">${U.esc(e.team)}</td><td class="l" style="white-space:normal;font-size:12.5px">${U.esc(t.fields.filter(f => f.type !== 'text' && e.v[f.key] != null && e.v[f.key] !== '').slice(0, 4).map(f => f.type === 'player' ? M.playerName(e.v[f.key]) : e.v[f.key]).join(' · '))}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="muted">Nothing coded yet.</p>'}</section>
        </div>
      </div>
      <details class="sec card"><summary><b>Manage templates</b> <span class="muted">(${M.state.templates.length})</span></summary><div class="card-h" style="margin-top:10px"><div><p>One template per thing you code. Edit, duplicate or build your own.</p></div><div class="ctl"><button class="btn" id="tNew">+ New template</button><button class="btn sm" id="tRestore">Restore starters</button></div></div>
        <div class="tw"><table class="compact"><thead><tr><th class="l">Phase</th><th class="l">Template</th><th class="l">Fields</th><th>Events</th><th></th></tr></thead><tbody>
        ${M.state.templates.map(x => `<tr><td class="l">${U.esc(x.phase || 'Custom')}</td><td class="l"><b>${U.esc(x.name)}</b></td><td class="l wrap" style="font-size:12px;max-width:520px">${x.fields.map(f => U.esc(f.label)).join(' · ')}</td><td>${M.state.events.filter(e => e.templateId === x.id).length}</td>
          <td class="l"><button class="btn sm" data-tuse="${x.id}">Code</button> <button class="btn sm" data-tedit="${x.id}">Edit</button> <button class="btn sm" data-tdup="${x.id}">Duplicate</button> <button class="btn sm danger" data-tdel="${x.id}">Delete</button></td></tr>`).join('')}
        </tbody></table></div></details>`;

      U.$('#cTpl', el).onchange = e => { c.templateId = e.target.value; c.draft = {}; c.sticky = {}; c.active = 0; Lab.render(); };
      U.$('#cEditT', el).onclick = () => editTemplate(t);
      const cm = U.$('#cMatch', el); if (cm) cm.onchange = e => { c.matchId = e.target.value; c.team = ''; c.recent = []; Lab.render(); };
      U.$('#cNewM', el).onclick = newMatch; const n2 = U.$('#cNewM2', el); if (n2) n2.onclick = newMatch;
      U.$$('[data-team]', el).forEach(b => b.onclick = () => { c.team = b.dataset.team; Lab.render(); });
      U.$$('[data-q]', el).forEach(b => b.onclick = () => { c.period = +b.dataset.q; c.clockSec = M.state.settings.clockMode === 'elapsed' ? 0 : qsecs(); c.runningSince = null; c.mark = null; Lab.render(); });
      const ci = U.$('#clockIn', el);
      ci.onchange = () => { const s = U.parseClock(ci.value); if (s == null) { U.toast('Clock must be mm:ss', 'warn'); paint(); return; } c.clockSec = s; if (c.runningSince) c.runningSince = Date.now(); };
      ci.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ci.blur(); } };
      U.$('#clockBtn', el).onclick = toggleClock;
      const um = U.$('#unmark', el); if (um) um.onclick = () => { c.mark = null; Lab.render(); };
      if (m) {
        U.$$('[data-set]', el).forEach(b => b.onclick = () => { const k = b.dataset.set, v = b.dataset.val; set(k, get(k) === v ? '' : v); const i = fs.findIndex(f => f.key === k); if (i >= 0) { c.active = i; if (get(k)) advance(); } Lab.render(); });
        U.$$('[data-fk]', el).forEach(inp => { inp.onchange = () => set(inp.dataset.fk, inp.value); inp.onfocus = () => { const i = fs.findIndex(f => f.key === inp.dataset.fk); if (i >= 0) c.active = i; }; });
        U.$('#cSave', el).onclick = save; U.$('#cClear', el).onclick = () => { clear(); Lab.render(); };
        U.$('#cMark', el).onclick = mark; U.$('#cUndo', el).onclick = undo;
        const sd = U.$('#stickyD', el); if (sd) sd.ontoggle = () => { vs.stickyOpen = sd.open; };
        const cf = U.$('#cFile', el); if (cf) cf.onchange = e => { const f = e.target.files[0]; if (!f) return; if (Lab.localVideos[m.id]) URL.revokeObjectURL(Lab.localVideos[m.id].url); Lab.localVideos[m.id] = { url: URL.createObjectURL(f), name: f.name }; M.setVideo(m.id, { fileName: f.name }); };
        const vid = U.$('#codeVid', el);
        if (vid && Lab._codeVid && Lab._codeVid.id === m.id) { const t0 = Lab._codeVid.t; vid.addEventListener('loadedmetadata', () => { vid.currentTime = t0; }, { once: true }); }
        if (vid) vid.addEventListener('timeupdate', () => { Lab._codeVid = { id: m.id, t: vid.currentTime }; });
      }
      U.$$('[data-open]', el).forEach(r => r.onclick = () => Lab.openEvent(r.dataset.open));
      U.$('#tNew', el).onclick = () => editTemplate({ id: U.uid('tpl'), name: 'New template', phase: 'Custom', unit: 'event', fields: [{ key: 'outcome', label: 'Outcome', type: 'choice', options: ['Won', 'Lost'] }, { key: 'notes', label: 'Notes', type: 'text', long: true }] });
      U.$('#tRestore', el).onclick = () => { M.restoreStarters(); U.toast('Starter templates restored'); };
      U.$$('[data-tuse]', el).forEach(b => b.onclick = () => { c.templateId = b.dataset.tuse; c.draft = {}; c.sticky = {}; c.active = 0; Lab.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      U.$$('[data-tedit]', el).forEach(b => b.onclick = () => editTemplate(M.template(b.dataset.tedit)));
      U.$$('[data-tdup]', el).forEach(b => b.onclick = () => { const x = JSON.parse(JSON.stringify(M.template(b.dataset.tdup))); x.id = U.uid('tpl'); x.name += ' (copy)'; editTemplate(x); });
      U.$$('[data-tdel]', el).forEach(b => b.onclick = () => { if (!confirm('Delete this template?')) return; if (!M.removeTemplate(b.dataset.tdel)) U.toast('It has coded events. Remove those first (Explore → events).', 'warn'); });
      if (!ticker) ticker = setInterval(paint, 250);
    }
  };
})(window.Lab);
