/* Fixtures: choose the next game, then work through scouting, coding and the report. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  function stepCard(n, title, text, buttons, extra) {
    return `<div class="stepc"><span class="stepn">${n}</span><div><h3>${title}</h3><p>${text}</p>${extra || ''}<div class="ctl">${buttons.map(([id, l, g]) => `<button class="btn sm${g ? ' g' : ''}" data-go="${id}">${l}</button>`).join('')}</div></div></div>`;
  }

  Lab.Views.home = {
    render(el) {
      const list = M.state.workspaces, w = M.ws();
      const st = w ? Lab.sectionStatus(w) : null;
      const X = Lab.Pack, inData = w && X && X.ok && X.resolve(w.opponent);
      const prog = st ? `<div class="sec-grid">${Lab.SECTIONS.map(s => { const x = st[s.id]; return `<div class="secbox sec-${x.state}"><div class="secbox-h"><b>${s.label}</b>${Lab.statusPill(x)}</div><p>${U.esc(x.text)}</p><div class="ctl">${Lab.doneToggle(s.id)}</div></div>`; }).join('')}</div>` : '';
      el.innerHTML = `
      ${w ? `<section class="card">
        <div class="card-h"><div><h2>${U.esc(w.ourTeam || 'Our team')} v ${U.esc(w.opponent)}</h2><p>${[w.competition, w.season, w.round, w.date, w.venue].filter(Boolean).map(U.esc).join(' · ') || 'Fixture details not entered'}${w.note ? ' · ' + U.esc(w.note) : ''}</p></div>
          <div class="ctl"><button class="btn" id="editWs">Edit fixture</button></div></div>
        <div class="steps3">
          ${stepCard(1, 'Scout the opponent', inData ? `Results, form, team stats, ratings and every player's numbers for ${U.esc(w.opponent)}.` : `${U.esc(w.opponent)} isn't in the season data. Edit the fixture and pick the club from the list.`, [['team', 'Team', true], ['players', 'Players']])}
          ${stepCard(2, 'Code their games', 'Add the matches to review, code what you see, link vision and explore the patterns.', [['matches', 'Matches', true], ['code', 'Code'], ['video', 'Video'], ['explore', 'Explore']])}
          ${stepCard(3, 'Brief the coaches', 'Add stats and findings, then preview, print or present.', [['report', 'Report', true]])}
        </div>
        <h3 style="margin-top:16px">Progress</h3>${prog}
      </section>` : ''}

      <section class="sec">
        <div class="card-h"><div><h2 class="sec-t">Fixtures</h2><p class="sub">One per upcoming game. Coded matches, events and clips carry over to every fixture against the same opponent.</p></div>
          <div class="ctl"><button class="btn g" id="newFx">+ New fixture</button></div></div>
        ${list.length ? `<div class="fx-grid">${list.map(x => {
          const s = Lab.sectionStatus(x);
          return `<div class="fx${w && w.id === x.id ? ' on' : ''}" data-open="${x.id}" tabindex="0" role="button">
            <div class="fx-m">${[x.competition, x.season, x.round, x.date, x.venue].filter(Boolean).map(U.esc).join(' · ') || 'Details not entered'}</div>
            <div class="fx-t">${U.esc(x.ourTeam || 'Our team')} v <em>${U.esc(x.opponent)}</em></div>
            <div class="mini-status">${Lab.SECTIONS.map(sec => `<i class="ms ms-${s[sec.id].state}" data-tip="${U.esc(`<b>${sec.label}</b><br>${s[sec.id].text}`)}"></i>`).join('')}</div>
            <div class="fx-d">${U.esc(s.matches.text)} · ${U.esc(s.coding.text)} · ${U.esc(s.report.text)}</div>
            <div class="ctl" style="margin-top:auto"><button class="btn sm g" data-open="${x.id}">Open</button><button class="btn sm" data-edit="${x.id}">Edit</button><button class="btn sm danger" data-del="${x.id}">Delete</button></div></div>`;
        }).join('')}</div>` : `<div class="empty"><h3>No fixtures yet</h3><p>Create your next game to get started.</p><button class="btn g" id="newFx2">+ New fixture</button></div>`}
      </section>

      <details class="sec card"><summary><b>Match clock settings</b></summary>
        <div class="form" style="max-width:640px;margin-top:10px">
          <label>Clock you type when coding<select id="clkMode"><option value="countdown" ${M.state.settings.clockMode !== 'elapsed' ? 'selected' : ''}>Time remaining (counts down)</option><option value="elapsed" ${M.state.settings.clockMode === 'elapsed' ? 'selected' : ''}>Time elapsed (counts up)</option></select></label>
          <label>Quarter length (minutes)<input id="qMins" type="number" min="5" max="30" value="${U.esc(M.state.settings.quarterMins)}"></label>
        </div><p class="sub">A single match can have its own quarter length in its match details.</p>
      </details>`;
      const nf = () => Lab.openFixtureForm();
      U.$('#newFx', el).onclick = nf; const n2 = U.$('#newFx2', el); if (n2) n2.onclick = nf;
      const ew = U.$('#editWs', el); if (ew) ew.onclick = () => Lab.openFixtureForm(w.id);
      U.$$('[data-go]', el).forEach(b => b.onclick = () => Lab.go(b.dataset.go));
      U.$$('[data-open]', el).forEach(b => { const f = ev => { ev.stopPropagation(); M.selectWorkspace(b.dataset.open); Lab.go('team'); }; b.onclick = f; b.onkeydown = ev => { if (ev.key === 'Enter') f(ev); }; });
      U.$$('[data-edit]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); Lab.openFixtureForm(b.dataset.edit); });
      U.$$('[data-del]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (confirm('Delete this fixture and its report? Coded matches, events and clips are kept.')) M.removeWorkspace(b.dataset.del); });
      U.$('#clkMode', el).onchange = e => { M.state.settings.clockMode = e.target.value; M.emit('settings'); };
      U.$('#qMins', el).onchange = e => { const v = parseInt(e.target.value, 10); if (v >= 5 && v <= 30) { M.state.settings.quarterMins = v; M.emit('settings'); } };
    }
  };
})(window.Lab);
