/* Seasons: choose your club and season, then work through team data, match reviews, coding and the report. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  function stepCard(n, title, text, buttons) {
    return `<div class="stepc"><span class="stepn">${n}</span><div><h3>${title}</h3><p>${text}</p><div class="ctl">${buttons.map(([id, l, g]) => `<button class="btn sm${g ? ' g' : ''}" data-go="${id}">${l}</button>`).join('')}</div></div></div>`;
  }

  Lab.Views.home = {
    render(el) {
      const list = M.tl.workspaces, w = M.ws();
      const st = w ? Lab.sectionStatus(w) : null;
      const X = Lab.Pack, inData = w && X && X.ok && X.resolve(w.team);
      const prog = st ? `<div class="sec-grid sec-grid6">${Lab.SECTIONS.map(s => { const x = st[s.id]; return `<div class="secbox sec-${x.state}"><div class="secbox-h"><b>${s.label}</b>${Lab.statusPill(x)}</div><p>${U.esc(x.text)}</p><div class="ctl">${Lab.doneToggle(s.id)}</div></div>`; }).join('')}</div>` : '';
      el.innerHTML = `
      ${w ? `<section class="card">
        <div class="card-h"><div><h2>${U.esc(w.team)} · ${U.esc([w.competition, w.season].filter(Boolean).join(' '))}</h2><p>${w.note ? U.esc(w.note) : 'Your own team: season numbers, completed matches, coding and match reviews.'}</p></div>
          <div class="ctl"><button class="btn" id="editWs">Edit team season</button></div></div>
        <div class="steps4">
          ${stepCard(1, 'Our team', inData ? `Results, form, team stats with league ranks and every player's numbers for ${U.esc(w.team)}.` : `${U.esc(w.team)} isn't in built-in season data for ${U.esc(w.competition + ' ' + w.season)}. Import stats on the Data tab, or edit the season and pick the club from the list.`, [['team', 'Team', true], ['players', 'Players']])}
          ${stepCard(2, 'Review a match', 'Pick a completed match, see what data it has, then look at the result, team stats and player stats for that game.', [['matches', 'Matches', true], ['review', 'Match review']])}
          ${stepCard(3, 'Code and clip (optional)', 'Code your own vision with templates, link video and cut clips. Not needed to review imported stats.', [['code', 'Code'], ['video', 'Video'], ['explore', 'Explore']])}
          ${stepCard(4, 'Findings and report', 'Write evidence-backed findings, note what to check and follow up, then build the report for coaches.', [['findings', 'Findings', true], ['report', 'Report']])}
        </div>
        <h3 style="margin-top:16px">Progress</h3>${prog}
      </section>` : ''}

      <section class="sec">
        <div class="card-h"><div><h2 class="sec-t">Team seasons</h2><p class="sub">One per club and season. Matches, coded events and clips live in the shared match library, so they also appear in Opponent Lab when it runs in this browser.</p></div>
          <div class="ctl"><button class="btn g" id="newFx">+ New team season</button></div></div>
        ${list.length ? `<div class="fx-grid">${list.map(x => {
          const s = Lab.sectionStatus(x);
          return `<div class="fx${w && w.id === x.id ? ' on' : ''}" data-open="${x.id}" tabindex="0" role="button" aria-label="Open ${U.esc(Lab.wsLabel(x))}">
            <div class="fx-m">${[x.competition, x.season, x.note].filter(Boolean).map(U.esc).join(' · ') || 'Details not entered'}</div>
            <div class="fx-t">${U.esc(x.team)} <em>${U.esc(x.season)}</em></div>
            <div class="mini-status">${Lab.SECTIONS.map(sec => `<i class="ms ms-${s[sec.id].state}" data-tip="${U.esc(`<b>${sec.label}</b><br>${s[sec.id].text}`)}"></i>`).join('')}</div>
            <div class="fx-d">${U.esc(s.matches.text)} · ${U.esc(s.reviews.text)} · ${U.esc(s.findings.text)}</div>
            <div class="ctl" style="margin-top:auto"><button class="btn sm g" data-open="${x.id}">Open</button><button class="btn sm" data-edit="${x.id}">Edit</button><button class="btn sm danger" data-del="${x.id}">Delete</button></div></div>`;
        }).join('')}</div>` : `<div class="empty"><h3>No team seasons yet</h3><p>Start with your club and season. Team Lab is for reviewing your own team; to prepare for an upcoming opponent, use Opponent Lab.</p><button class="btn g" id="newFx2">+ New team season</button></div>`}
      </section>

      <details class="sec card"><summary><b>Match clock settings</b></summary>
        <div class="form" style="max-width:640px;margin-top:10px">
          <label>Clock you type when coding<select id="clkMode"><option value="countdown" ${M.state.settings.clockMode !== 'elapsed' ? 'selected' : ''}>Time remaining (counts down)</option><option value="elapsed" ${M.state.settings.clockMode === 'elapsed' ? 'selected' : ''}>Time elapsed (counts up)</option></select></label>
          <label>Quarter length (minutes)<input id="qMins" type="number" min="5" max="30" value="${U.esc(M.state.settings.quarterMins)}"></label>
        </div><p class="sub">Shared with Opponent Lab. A single match can have its own quarter length in its match details.</p>
      </details>`;
      const nf = () => Lab.openFixtureForm();
      U.$('#newFx', el).onclick = nf; const n2 = U.$('#newFx2', el); if (n2) n2.onclick = nf;
      const ew = U.$('#editWs', el); if (ew) ew.onclick = () => Lab.openFixtureForm(w.id);
      U.$$('[data-go]', el).forEach(b => b.onclick = () => Lab.go(b.dataset.go));
      U.$$('[data-open]', el).forEach(b => { const f = ev => { ev.stopPropagation(); M.selectWorkspace(b.dataset.open); Lab.go('team'); }; b.onclick = f; b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(ev); } }; });
      U.$$('[data-edit]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); Lab.openFixtureForm(b.dataset.edit); });
      U.$$('[data-del]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (confirm('Delete this team season with its match reviews, findings and playlists? Matches, coded events and clips stay in the shared library.')) M.removeWorkspace(b.dataset.del); });
      U.$('#clkMode', el).onchange = e => { M.state.settings.clockMode = e.target.value; M.emit('settings'); };
      U.$('#qMins', el).onchange = e => { const v = parseInt(e.target.value, 10); if (v >= 5 && v <= 30) { M.state.settings.quarterMins = v; M.emit('settings'); } };
    }
  };
})(window.Lab);
