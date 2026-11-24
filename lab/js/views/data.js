/* Data (Club Lab): season files, CSV/TSV import of matches, team and player match stats and coded events,
   export, backups and the storage statement. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, I = Lab.Importer;
  const vs = Lab.vs;
  let pend = null; // {text, name, kind, templateId, res, skipFirst, mapping}
  let spend = null; // season files waiting: [{name, kind, res}]
  const SK = { teamseason: 'Team season stats', playerlist: 'Player lists', ratings: 'Team ratings' };
  const ORDER = { teamseason: 0, playerlist: 1, ratings: 2 };

  function seasonCard() {
    const S = Lab.Season, have = S.seasons();
    return `<section class="card" style="margin-bottom:12px"><div class="card-h"><div><h2>Season data</h2><p>Built in: ${U.esc(Object.keys(Lab.Packs || {}).map(k => k.replace('|', ' ')).join(' and '))}. Load a newer season file here to replace it. Files are read in this browser only and checked before anything is saved.</p></div></div>
      <div class="form" style="margin-bottom:10px">
        <label>Competition<select id="sComp">${Lab.Library.COMPETITIONS.map(c => `<option ${c === (vs.sComp || 'AFL') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Season<input id="sSeason" value="${U.esc(vs.sSeason || String(new Date().getFullYear()))}" inputmode="numeric"></label>
        <label class="full">Source (shown with every number)<input id="sSource" value="${U.esc(vs.sSource || '')}" placeholder="Provider and the date you pulled it, e.g. Site name, pulled 24 Nov 2026"></label>
      </div>
      <div class="ctl"><label class="btn p" for="sFiles" style="cursor:pointer">Choose files…</label><input type="file" id="sFiles" accept=".csv,.tsv,.txt,text/csv" multiple class="hidden"><span class="sub">Team season stats, player lists and/or ratings. The type is worked out from the headers.</span></div>
      ${spend ? `<div style="margin-top:12px">${spend.map((f, i) => `<div class="card" style="margin-top:8px;box-shadow:none"><div class="card-h"><div><h3>${U.esc(f.name)}</h3><p>${f.kind ? U.esc(SK[f.kind]) : '<b>Not recognised.</b> Headers didn\'t match a team season file, player list or ratings file.'}</p></div></div>${f.res ? `<ul class="notes-list">${f.res.checks.map(c => `<li class="${c.pass ? '' : 'warn'}"><b>${c.pass ? 'Pass' : 'Check'}</b>${U.esc(c.label)}${c.detail ? `<br><span class="muted">${U.esc(c.detail)}</span>` : ''}</li>`).join('')}</ul>` : ''}</div>`).join('')}
        <div class="ctl" style="margin-top:10px"><button class="btn" id="sCancel">Cancel</button><button class="btn g" id="sGo" ${spend.some(f => f.res) ? '' : 'disabled'}>Save ${spend.filter(f => f.res).length} file${spend.filter(f => f.res).length === 1 ? '' : 's'} as ${U.esc((vs.sComp || 'AFL') + ' ' + (vs.sSeason || ''))}</button></div></div>` : ''}
      ${have.length ? `<p class="sub" style="margin-top:10px">Loaded: ${have.map(x => `${U.esc(x.competition)} ${U.esc(x.season)} (${[x.teams && Object.keys(x.teams).length + ' teams', x.ratings && 'ratings', x.checks.players && 'player lists'].filter(Boolean).join(', ')})`).join('; ')}. Loading the same competition and season again replaces that part.</p>` : ''}
    </section>`;
  }
  function readSeasonFiles(files) {
    const S = Lab.Season;
    const opts = () => ({ competition: vs.sComp || 'AFL', season: vs.sSeason || String(new Date().getFullYear()), source: vs.sSource || '' });
    Promise.all([...files].map(f => new Promise(res => { const r = new FileReader(); r.onload = () => res({ name: f.name, text: String(r.result) }); r.readAsText(f); }))).then(list => {
      spend = list.map(f => {
        const kind = S.detect(f.text), o = Object.assign(opts(), { file: f.name });
        const res = kind === 'teamseason' ? S.readTeamSeason(f.text, o) : kind === 'playerlist' ? S.readPlayerList(f.text, o) : kind === 'ratings' ? S.readRatings(f.text, o) : null;
        return { name: f.name, kind, res };
      }).sort((a, b) => (ORDER[a.kind] == null ? 9 : ORDER[a.kind]) - (ORDER[b.kind] == null ? 9 : ORDER[b.kind]));
      Lab.render();
    });
  }

  function run() { pend.res = I.analyse(pend.text, pend.kind, { templateId: pend.templateId, skipFirst: pend.skipFirst, mapping: pend.mapping }); if (!pend.mapping) pend.mapping = pend.res.mapping; }

  function preview() {
    const r = pend.res;
    if (r.error) return `<section class="sec card" id="prev"><h2>Import preview</h2><p class="warnline">${U.esc(r.error)}</p><button class="btn" id="pCancel">Cancel</button></section>`;
    const opts = sel => `<option value="">(ignore)</option>${r.fields.map(f => `<option value="${U.esc(f.key)}" ${f.key === sel ? 'selected' : ''}>${U.esc(f.label)}${f.required ? ' *' : ''}</option>`).join('')}`;
    return `<section class="sec card" id="prev"><div class="card-h"><div><h2>Import preview: ${U.esc(pend.name)}</h2><p>${r.data.length} rows · ${U.esc(I.KINDS[pend.kind].label)}${r.tpl ? ' · template ' + U.esc(r.tpl.name) : ''} · ${r.delimiter === '\t' ? 'tab' : r.delimiter === ',' ? 'comma' : 'semicolon'} separated</p></div>
      <div class="ctl"><button class="btn" id="pCancel">Cancel</button><button class="btn g" id="pGo" ${r.ok ? '' : 'disabled'}>Import ${r.data.length} rows</button></div></div>
      <ul class="notes-list">${r.notes.map(n => `<li class="${n.level}"><b>${n.level === 'warn' ? 'Check' : 'Note'}</b>${U.esc(n.msg)}</li>`).join('')}</ul>
      ${r.firstRow ? `<label class="cb"><input type="checkbox" id="pSkip" ${pend.skipFirst ? 'checked' : ''}> Skip the first row under the header (for spreadsheets that keep an example row there). It reads: <code>${U.esc(r.firstRow.slice(0, 8).join(' | '))}</code></label>` : ''}
      ${I.KINDS[pend.kind].metrics ? `<label class="cb"><input type="checkbox" id="pNew" ${pend.createMetrics ? 'checked' : ''}> Create stat definitions for unmapped numeric columns</label>` : ''}
      <div class="tw" style="margin-top:8px;max-height:420px;overflow:auto"><table class="compact"><thead><tr><th class="l">Column in file</th><th class="l">Read as</th><th class="l">First values</th></tr></thead><tbody>
        ${r.header.map((h, i) => `<tr><td class="l">${U.esc(h || '(blank)')}</td><td class="l"><select data-map="${i}">${opts(pend.mapping[i])}</select></td><td class="l muted" style="font-size:12px">${U.esc(r.data.slice(0, 3).map(x => x[i]).join(' · '))}</td></tr>`).join('')}
      </tbody></table></div><p class="sub">Matches are found by season, round and the two teams; any that don't exist are created. Unknown players are added to the right club's list. Blank cells are left blank.</p></section>`;
  }

  Lab.Views.data = {
    render(el) {
      const ws = M.ws();
      const kinds = ['teamstats', 'playerstats', 'events', 'matches', 'players'];
      if (!kinds.includes(vs.iKind)) vs.iKind = 'teamstats';
      const im = vs.iMatch && M.match(vs.iMatch), imTeam = ws && ws.focus;
      el.innerHTML = `${seasonCard()}
      <section class="grid g2">
        <div class="card" id="importCard"><div class="card-h"><div><h2>Import CSV or TSV</h2><p>Bring in match-level team stats, player stats, coded events or matches from your own spreadsheets or stats provider. Files are read in this browser and never uploaded. Every column can be re-mapped before importing.</p></div></div>
          ${im && (vs.iKind === 'teamstats' || vs.iKind === 'playerstats' || vs.iKind === 'events') ? `<div class="next"><span class="k">For this match</span><span>Rows join <b>${U.esc(M.matchLabel(im, imTeam))}</b> when they read Season <b>${U.esc(im.season)}</b>, Round <b>${U.esc(im.round)}</b>, and Team / Opponent <b>${U.esc(im.home)}</b> and <b>${U.esc(im.away)}</b>, spelt exactly like that.</span>${vs.iKind !== 'events' ? `<button class="btn sm" id="iPre">Download a pre-filled template</button>` : ''}<button class="btn sm" id="iBack">Back to the review</button></div>` : ''}
          <div class="form" style="margin-bottom:10px">
            <label>What's in the file<select id="iKind">${kinds.map(k => `<option value="${k}" ${k === (vs.iKind || 'matches') ? 'selected' : ''}>${U.esc(I.KINDS[k].label)}</option>`).join('')}</select></label>
            <label>Template (for coded events)<select id="iTpl" ${(vs.iKind || 'matches') === 'events' ? '' : 'disabled'}>${M.state.templates.map(t => `<option value="${t.id}" ${t.id === vs.iTpl ? 'selected' : ''}>${U.esc(t.name)}</option>`).join('')}</select></label>
            <label>Competition for new matches<select id="iComp">${Lab.Library.COMPETITIONS.map(c => `<option ${c === (vs.iComp || (ws && ws.competition) || 'AFL') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <div class="drop" id="drop"><b>Drop a .csv or .tsv file here</b><p>or</p><label class="btn p" for="iFile" style="cursor:pointer">Choose file</label><input type="file" id="iFile" accept=".csv,.tsv,.txt,text/csv" class="hidden"></div>
          <details style="margin-top:10px"><summary>Or paste rows copied from a spreadsheet</summary><textarea class="paste" id="iPaste" placeholder="Header row first, then data rows"></textarea><button class="btn" id="iPasteGo" style="margin-top:6px">Read pasted rows</button></details>
          <p class="sub" style="margin-top:10px"><button class="link" id="iTplCsv">Download blank headers</button> for the selected type. Expected columns: ${U.esc(I.KINDS[vs.iKind || 'matches'].fields.map(f => f.label + (f.required ? '*' : '')).join(', '))}${I.KINDS[vs.iKind || 'matches'].metrics ? ', then one column per stat (named as on the Team stats tab)' : (vs.iKind === 'events' ? ', then one column per template field' : '')}.</p>
        </div>
        <div class="card"><div class="card-h"><div><h2>Export</h2><p>CSV files that re-import cleanly.</p></div></div>
          <div class="ctl" style="flex-wrap:wrap;gap:6px">
            <button class="btn sm" data-exp="players">Players</button><button class="btn sm" data-exp="matches">Matches</button><button class="btn sm" data-exp="teamstats">Team stats</button><button class="btn sm" data-exp="playerstats">Player stats</button>
            <select id="eTpl" class="mini">${M.state.templates.map(t => `<option value="${t.id}">${U.esc(t.name)}</option>`).join('')}</select><button class="btn sm" data-exp="events">Coded events</button>
            <label class="cb"><input type="checkbox" id="eAll"> All matches in the library, not just this team season</label></div>
          <h3 style="margin-top:16px">Backup</h3><p class="sub">One file with everything in both modes: team seasons, match reviews, fixtures, findings, briefs, playlists and the shared match library. Old Opponent Lab backups can be restored here too.</p>
          <div class="ctl" style="margin-top:6px"><button class="btn" id="bExp">Download backup (.json)</button><label class="btn" for="bIn" style="cursor:pointer">Restore backup…</label><input type="file" id="bIn" accept=".json" class="hidden"><button class="btn sm danger" id="bReset">Clear our-team records</button></div>
        </div>
      </section>
      ${pend ? preview() : ''}
      <section class="sec card"><h2>Where your data lives</h2>
        <div class="grid g2" style="margin-top:8px">
          <ul class="notes-list">
            <li><b>Our team</b>Team seasons, match reviews, findings, follow-ups, report settings and playlists: this browser's local storage on this device, key <code>${U.esc(M.TKEY)}</code> (${Math.round(M.bytes('tl') / 1024)} KB). The same key the old Team Lab used.</li>
            <li><b>Opponent and the match library</b>Fixtures, briefs and their findings, plus matches, players, stat definitions, imported team and player stats, coding templates, coded events, video links, timestamps and clips: key <code>${U.esc(M.KEY)}</code> (${Math.round(M.bytes() / 1024)} KB), the same key Opponent Lab used. ${(() => { const L = M.libraryInfo(); return `It holds ${L.fixtures} fixture${L.fixtures === 1 ? '' : 's'}, ${L.matches} matches, ${L.events} coded events and ${L.clips} clips.`; })()}</li>
            <li><b>Built-in season data</b>Read from the data files in this folder. Never written to storage.</li>
          </ul>
          <ul class="notes-list">
            <li><b>Not stored</b>Video files. A local file plays from your disk for this session only; only its name is kept. Links stay links.</li>
            <li><b>Leaves the device</b>Nothing, unless you play a YouTube link (YouTube's player loads, as with any embed) or download a file yourself. No server, account or sync.</li>
            <li class="warn"><b>Keep in mind</b>Clearing this browser's site data deletes everything, so download backups. Work done in the old Team Lab and Opponent Lab pages on this site shows up here automatically. Avoid editing in two tabs at the same moment.</li>
          </ul>
        </div>
      </section>`;

      ['sComp', 'sSeason', 'sSource'].forEach(k => { U.$('#' + k, el).onchange = e => { vs[k] = e.target.value.trim(); }; });
      U.$('#sFiles', el).onchange = e => { ['sComp', 'sSeason', 'sSource'].forEach(k => { vs[k] = U.$('#' + k, el).value.trim(); }); if (e.target.files.length) readSeasonFiles(e.target.files); };
      if (spend) {
        U.$('#sCancel', el).onclick = () => { spend = null; Lab.render(); };
        const sg = U.$('#sGo', el); if (sg) sg.onclick = () => {
          const opts = { competition: vs.sComp || 'AFL', season: vs.sSeason || String(new Date().getFullYear()), source: vs.sSource || '' };
          const done = spend.filter(f => f.res).map(f => { const r = Lab.Season.commit(f.res, Object.assign({}, opts, { file: f.name })); return f.kind === 'teamseason' ? `${r.teams} teams (${r.metrics} new stat definitions)` : f.kind === 'playerlist' ? `${r.added} players added, ${r.updated} updated` : `ratings for ${r.teams} teams`; });
          spend = null; U.toast('Saved: ' + done.join('; ')); Lab.go('team');
        };
      }
      const kSel = U.$('#iKind', el);
      kSel.onchange = () => { vs.iKind = kSel.value; Lab.render(); };
      U.$('#iTpl', el).onchange = e => { vs.iTpl = e.target.value; };
      U.$('#iComp', el).onchange = e => { vs.iComp = e.target.value; };
      const start = (text, name) => { pend = { text, name, kind: vs.iKind || 'matches', templateId: vs.iKind === 'events' ? (vs.iTpl || M.state.templates[0].id) : '', skipFirst: false, mapping: null, createMetrics: true }; run(); Lab.render(); setTimeout(() => { const p = document.getElementById('prev'); if (p) p.scrollIntoView({ behavior: 'smooth' }); }, 30); };
      const read = f => { const r = new FileReader(); r.onload = () => start(String(r.result), f.name); r.readAsText(f); };
      const drop = U.$('#drop', el);
      ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) read(f); });
      U.$('#iFile', el).onchange = e => { const f = e.target.files[0]; if (f) read(f); };
      U.$('#iPasteGo', el).onclick = () => { const t = U.$('#iPaste', el).value; if (t.trim()) start(t, 'Pasted rows'); };
      U.$('#iTplCsv', el).onclick = () => U.download(`${vs.iKind || 'matches'}-headers.csv`, I.templateHeaders(vs.iKind || 'matches', vs.iKind === 'events' ? (vs.iTpl || M.state.templates[0].id) : ''), 'text/csv;charset=utf-8');
      U.$$('[data-exp]', el).forEach(b => b.onclick = () => { const k = b.dataset.exp; const csv = I.exportKind(k, { templateId: U.$('#eTpl', el).value, allMatches: U.$('#eAll', el).checked }); U.download(`${k}${k === 'events' ? '-' + U.norm(M.template(U.$('#eTpl', el).value).name) : ''}-${U.today()}.csv`, csv, 'text/csv;charset=utf-8'); });
      U.$('#bExp', el).onclick = () => U.download(`club-lab-backup-${U.today()}.json`, M.exportAll(true), 'application/json');
      U.$('#bIn', el).onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const o = M.readBackup(String(r.result)); if (o.oppOnly) { if (!confirm('This is an Opponent Lab backup. Replace the fixtures, briefs and match library in this browser with it? Our-team records stay.')) return; M.restore(o, true); U.toast('Opponent Lab backup restored'); return; } if (!confirm('Replace the our-team records (team seasons, reviews, findings) in this browser with the backup?')) return; const lib = !!o.library && confirm('The backup also has the fixtures, briefs and match library. Replace those too? Cancel keeps what is here now.'); M.restore(o, lib); U.toast('Backup restored' + (lib ? ' with the match library' : '')); } catch (err) { U.toast(err.message, 'warn'); } }; r.readAsText(f); };
      U.$('#bReset', el).onclick = () => { if (confirm('Delete the our-team records (team seasons, match reviews, findings and playlists) in this browser? Fixtures, briefs and the match library (matches, stats, coded events, clips) are kept. Download a backup first if you need it.')) { pend = null; M.reset(); Lab.go('home'); } };
      const ipre = U.$('#iPre', el); if (ipre) ipre.onclick = () => Lab.reviewAct(vs.iKind === 'teamstats' ? 'tpl:team' : 'tpl:player', im);
      const ibk = U.$('#iBack', el); if (ibk) ibk.onclick = () => Lab.openReview(im.id);
      if (pend) {
        U.$('#pCancel', el).onclick = () => { pend = null; Lab.render(); };
        const go = U.$('#pGo', el);
        if (go) go.onclick = () => {
          const before = new Set(M.state.matches.map(m => m.id));
          const s = I.commit(pend.res, { competition: vs.iComp || (ws && ws.competition) || '', createMetrics: pend.createMetrics });
          const made = M.state.matches.filter(m => !before.has(m.id));
          if (made.length && ['teamstats', 'playerstats', 'events'].includes(pend.kind)) s.warnings.unshift(`${made.length} row group${made.length === 1 ? '' : 's'} didn't match an existing match, so new match${made.length === 1 ? ' was' : 'es were'} created: ${made.map(m => M.matchLabel(m)).join('; ')}. If these were meant for a match you already have, check the season, round and team names, then delete the extra match on the Matches tab.`);
          pend = null;
          const parts = [s.matches && `${s.matches} match${s.matches > 1 ? 'es' : ''} created`, s.players && `${s.players} player${s.players > 1 ? 's' : ''} added`, s.stats && `${s.stats} stat values`, s.events && `${s.events} events`, s.metrics && `${s.metrics} new stat definitions`].filter(Boolean);
          U.toast('Imported: ' + (parts.join(', ') || 'nothing new'));
          if (s.warnings.length) Lab.openDrawer(`<div class="drawer-h"><div><span class="k">Import finished</span><h2 id="drawerTitle">${s.rows} rows read</h2></div><button class="btn sm" data-close>Close</button></div><div class="drawer-b"><p>${U.esc(parts.join(', ') || 'Nothing new was added.')}</p><h3>Check these</h3><ul class="notes-list">${s.warnings.map(w => `<li class="warn">${U.esc(w)}</li>`).join('')}</ul></div>`);
        };
        const sk = U.$('#pSkip', el); if (sk) sk.onchange = () => { pend.skipFirst = sk.checked; run(); Lab.render(); };
        const nw = U.$('#pNew', el); if (nw) nw.onchange = () => { pend.createMetrics = nw.checked; };
        U.$$('[data-map]', el).forEach(s => s.onchange = () => { const i = +s.dataset.map; if (s.value) pend.mapping = pend.mapping.map((m, j) => m === s.value && j !== i ? '' : m); pend.mapping[i] = s.value; run(); Lab.render(); });
      }
    }
  };
})(window.Lab);
