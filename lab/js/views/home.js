/* Home: the current workspace's steps and progress, then every team season and fixture in one place. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model;

  function stepCard(n, title, text, buttons) {
    return `<div class="stepc"><span class="stepn">${n}</span><div><h3>${title}</h3><p>${text}</p><div class="ctl">${buttons.map(([id, l, g]) => `<button class="btn sm${g ? ' g' : ''}" data-go="${id}">${l}</button>`).join('')}</div></div></div>`;
  }
  function card(x, cur) {
    const s = Lab.sectionStatus(x), secs = Lab.sectionsFor(x), opp = x.kind === 'opp';
    return `<div class="fx${cur && cur.id === x.id ? ' on' : ''}" data-open="${x.id}" tabindex="0" role="button" aria-label="Open ${U.esc(Lab.wsLabel(x))}">
      <div class="fx-m">${(opp ? [x.competition, x.season, x.round, x.date, x.venue] : [x.competition, x.season, x.note]).filter(Boolean).map(U.esc).join(' · ') || 'Details not entered'}</div>
      <div class="fx-t">${opp ? `${U.esc(x.ourTeam || 'Our team')} v <em>${U.esc(x.opponent)}</em>` : `${U.esc(x.team)} <em>${U.esc(x.season)}</em>`}</div>
      <div class="mini-status">${secs.map(sec => `<i class="ms ms-${s[sec.id].state}" data-tip="${U.esc(`<b>${sec.label}</b><br>${s[sec.id].text}`)}"></i>`).join('')}</div>
      <div class="fx-d">${opp ? `${U.esc(s.matches.text)} · ${U.esc(s.coding.text)} · ${U.esc(s.report.text)}` : `${U.esc(s.matches.text)} · ${U.esc(s.reviews.text)} · ${U.esc(s.findings.text)}`}</div>
      <div class="ctl" style="margin-top:auto"><button class="btn sm g" data-open="${x.id}">Open</button><button class="btn sm" data-edit="${x.id}">Edit</button><button class="btn sm danger" data-del="${x.id}">Delete</button></div></div>`;
  }

  Lab.Views.home = {
    render(el) {
      const w = M.ws(), opp = Lab.isOpp();
      const teams = M.workspaces('team'), fixtures = M.workspaces('opp');
      const st = w ? Lab.sectionStatus(w) : null, secs = w ? Lab.sectionsFor(w) : [];
      const X = Lab.Pack, inData = w && X && X.ok && X.resolve(w.focus);
      const prog = st ? `<div class="sec-grid ${secs.length > 5 ? 'sec-grid6' : 'sec-grid5'}">${secs.map(s => { const x = st[s.id]; return `<div class="secbox sec-${x.state}"><div class="secbox-h"><b>${s.label}</b>${Lab.statusPill(x)}</div><p>${U.esc(x.text)}</p><div class="ctl">${Lab.doneToggle(s.id)}</div></div>`; }).join('')}</div>` : '';
      const steps = !w ? '' : opp
        ? `${stepCard(1, 'Scout the opponent', inData ? `Results, form, team stats, ratings and every player's numbers for ${U.esc(w.opponent)}.` : `${U.esc(w.opponent)} isn't in the season data. Edit the fixture and pick the club from the list.`, [['team', 'Team', true], ['players', 'Players']])}
          ${stepCard(2, 'Code their games', 'Add the matches to review, code what you see, link vision and explore the patterns.', [['matches', 'Matches', true], ['code', 'Code'], ['video', 'Video'], ['explore', 'Explore']])}
          ${stepCard(3, 'Brief the coaches', 'Add stats and findings, then preview, print or present the brief.', [['findings', 'Findings'], ['report', 'Brief', true]])}`
        : `${stepCard(1, 'Our team', inData ? `Results, form, team stats with league ranks and every player's numbers for ${U.esc(w.team)}.` : `${U.esc(w.team)} isn't in built-in season data for ${U.esc(w.competition + ' ' + w.season)}. Import stats on the Data tab, or edit the season and pick the club from the list.`, [['team', 'Team', true], ['players', 'Players']])}
          ${stepCard(2, 'Review a match', 'Pick a completed match, see what data it has, then look at the result, team stats and player stats for that game.', [['matches', 'Matches', true], ['review', 'Match review']])}
          ${stepCard(3, 'Code and clip (optional)', 'Code your own vision with templates, link video and cut clips. Not needed to review imported stats.', [['code', 'Code'], ['video', 'Video'], ['explore', 'Explore']])}
          ${stepCard(4, 'Findings and report', 'Write evidence-backed findings, note what to check and follow up, then build the report for coaches.', [['findings', 'Findings', true], ['report', 'Report']])}`;
      const group = (kind, list, title, sub, btn, empty) => `<section class="sec">
        <div class="card-h"><div><h2 class="sec-t">${title}</h2><p class="sub">${sub}</p></div><div class="ctl"><button class="btn${(kind === 'opp') === opp ? ' g' : ''}" data-new="${kind}">${btn}</button></div></div>
        ${list.length ? `<div class="fx-grid">${list.map(x => card(x, w)).join('')}</div>` : `<div class="empty"><h3>${empty[0]}</h3><p>${empty[1]}</p><button class="btn g" data-new="${kind}">${btn}</button></div>`}</section>`;
      const teamGroup = group('team', teams, 'Our team', 'One per club and season: season numbers, match reviews, findings and follow-ups.', '+ New team season', ['No team seasons yet', 'Start with your club and season to review your own games.']);
      const oppGroup = group('opp', fixtures, 'Opponents', 'One per upcoming game: scout the opponent, code their games and build the brief.', '+ New fixture', ['No fixtures yet', 'Create your next game to scout the opponent.']);
      el.innerHTML = `
      ${w ? `<section class="card">
        <div class="card-h"><div><h2>${opp ? `${U.esc(w.ourTeam || 'Our team')} v ${U.esc(w.opponent)}` : `${U.esc(w.team)} · ${U.esc([w.competition, w.season].filter(Boolean).join(' '))}`}</h2><p>${w.note ? U.esc(w.note) : opp ? 'Preparing for the next game: the opponent\'s numbers, their games coded and the brief.' : 'Your own team: season numbers, completed matches, coding and match reviews.'}</p></div>
          <div class="ctl"><button class="btn" id="editWs">${opp ? 'Edit fixture' : 'Edit team season'}</button></div></div>
        <div class="${opp ? 'steps3' : 'steps4'}">${steps}</div>
        <h3 style="margin-top:16px">Progress</h3>${prog}
      </section>` : `<section class="card"><div class="card-h"><div><h2>Two modes, one workspace</h2><p>Matches, players, coded events and clips are shared, so a game you code once serves your own review and the scouting job when you play that club.</p></div></div>
        <div class="steps3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="stepc"><span class="stepn">1</span><div><h3>Our team</h3><p>Your club across a season: team and player numbers, completed matches reviewed with the evidence, findings and follow-ups.</p><div class="ctl"><button class="btn sm g" data-new="team">+ New team season</button></div></div></div>
        <div class="stepc"><span class="stepn">2</span><div><h3>Opponent</h3><p>The club you play next: form, team and player numbers, their games coded and clipped, and a brief for coaches.</p><div class="ctl"><button class="btn sm g" data-new="opp">+ New fixture</button></div></div></div></div></section>`}
      ${opp ? oppGroup + teamGroup : teamGroup + oppGroup}

      <details class="sec card"><summary><b>Match clock settings</b></summary>
        <div class="form" style="max-width:640px;margin-top:10px">
          <label>Clock you type when coding<select id="clkMode"><option value="countdown" ${M.state.settings.clockMode !== 'elapsed' ? 'selected' : ''}>Time remaining (counts down)</option><option value="elapsed" ${M.state.settings.clockMode === 'elapsed' ? 'selected' : ''}>Time elapsed (counts up)</option></select></label>
          <label>Quarter length (minutes)<input id="qMins" type="number" min="5" max="30" value="${U.esc(M.state.settings.quarterMins)}"></label>
        </div><p class="sub">Used in both modes. A single match can have its own quarter length in its match details.</p>
      </details>`;
      U.$$('[data-new]', el).forEach(b => b.onclick = () => Lab.openFixtureForm(null, b.dataset.new));
      const ew = U.$('#editWs', el); if (ew) ew.onclick = () => Lab.openFixtureForm(w.id);
      U.$$('[data-go]', el).forEach(b => b.onclick = () => Lab.go(b.dataset.go));
      U.$$('[data-open]', el).forEach(b => { const f = ev => { ev.stopPropagation(); M.selectWorkspace(b.dataset.open); Lab.go('team'); }; b.onclick = f; b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(ev); } }; });
      U.$$('[data-edit]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); Lab.openFixtureForm(b.dataset.edit); });
      U.$$('[data-del]', el).forEach(b => b.onclick = ev => { ev.stopPropagation(); const x = M.findWs(b.dataset.del); if (confirm(x && x.kind === 'opp' ? 'Delete this fixture and its brief? Coded matches, events and clips are kept.' : 'Delete this team season with its match reviews, findings and playlists? Matches, coded events and clips are kept.')) M.removeWorkspace(b.dataset.del); });
      U.$('#clkMode', el).onchange = e => { M.state.settings.clockMode = e.target.value; M.emit('settings'); };
      U.$('#qMins', el).onchange = e => { const v = parseInt(e.target.value, 10); if (v >= 5 && v <= 30) { M.state.settings.quarterMins = v; M.emit('settings'); } };
    }
  };
})(window.Lab);
