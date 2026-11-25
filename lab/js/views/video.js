/* Video (Team Lab): per-match video sources, event timestamps, clips and playlists.
   Works: play a local file (from disk, never uploaded), a direct video URL or a YouTube link;
   jump to timestamps; clips as in/out references; sequential playlist playback.
   Not implemented: hosting, uploading, cutting, rendering or exporting video. */
(function (Lab) {
  'use strict';
  const U = Lab.U, M = Lab.Model, A = Lab.Analysis, C = Lab.Charts;
  const vs = Lab.vs;
  const LEAD = 4;
  const ytId = u => { const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/); return m ? m[1] : null; };
  const direct = u => /\.(mp4|m4v|webm|mov|ogg)(\?|#|$)/i.test(u || '');
  function source(id) {
    const v = M.state.videos[id] || {}, l = Lab.localVideos[id];
    if (l) return { kind: 'file', src: l.url, label: l.name + ' (local file, this session only)' };
    if (direct(v.url)) return { kind: 'file', src: v.url, label: v.url };
    if (ytId(v.url)) return { kind: 'yt', id: ytId(v.url), label: 'YouTube link' };
    if (v.url) return { kind: 'link', src: v.url, label: v.url };
    return null;
  }
  Lab.videoSource = source;
  function target(e) {
    if (e.video && e.video.time != null) return { t: e.video.time, kind: 'confirmed' };
    const v = M.state.videos[e.matchId], off = v && v.offsets ? v.offsets[e.period] : null, el = A.derive(e).el;
    return off == null || el == null ? null : { t: off + el, kind: 'estimated' };
  }
  Lab.eventTarget = target;

  function seek(t, end) {
    const vid = document.getElementById('vid'), src = source(vs.videoMatch);
    if (vid) { vid.currentTime = Math.max(0, t); vs.stopAt = end || null; vid.play().catch(() => {}); return true; }
    if (src && src.kind === 'yt') { document.getElementById('yt').src = `https://www.youtube-nocookie.com/embed/${src.id}?rel=0&autoplay=1&start=${Math.floor(Math.max(0, t))}${end ? '&end=' + Math.ceil(end) : ''}`; return true; }
    if (src && src.kind === 'link') { window.open(src.src, '_blank', 'noopener'); U.toast('Opened the link. Go to ' + U.fmtVideoTime(t) + ' there.'); return true; }
    U.toast('No playable video for this match', 'warn'); return false;
  }
  function playClip(c) { if (c.matchId !== vs.videoMatch) { vs.videoMatch = c.matchId; vs.pendingSeek = { t: c.start, end: c.end }; Lab.render(); return; } seek(c.start, c.end); }
  function step(dir) {
    const p = vs.playing && M.playlist(vs.playing.id); if (!p) return;
    let i = vs.playing.i + dir;
    while (i >= 0 && i < p.clipIds.length) { const c = M.state.clips.find(x => x.id === p.clipIds[i]); if (c && source(c.matchId)) { vs.playing.i = i; playClip(c); paintNow(); return; } i += dir; }
    vs.playing = null; paintNow(); U.toast('End of playlist');
  }
  function paintNow() {
    const el = document.getElementById('plNow'); if (!el) return;
    const p = vs.playing && M.playlist(vs.playing.id), c = p && M.state.clips.find(x => x.id === p.clipIds[vs.playing.i]);
    el.innerHTML = c ? `Playing “${U.esc(p.name)}” · ${vs.playing.i + 1} of ${p.clipIds.length}: <b>${U.esc(c.title)}</b> <button class="btn sm" id="plPrev">Prev</button><button class="btn sm" id="plNext">Next</button><button class="btn sm" id="plStop">Stop</button>${source(c.matchId).kind === 'yt' ? ' <span class="muted">YouTube stops at the out point; press Next.</span>' : ''}` : '';
    const a = document.getElementById('plPrev'), b = document.getElementById('plNext'), s = document.getElementById('plStop');
    if (a) a.onclick = () => step(-1); if (b) b.onclick = () => step(1);
    if (s) s.onclick = () => { vs.playing = null; vs.stopAt = null; const v = document.getElementById('vid'); if (v) v.pause(); paintNow(); };
  }

  Lab.openClip = function (clip) {
    const isNew = !clip.id, m = M.match(clip.matchId);
    const ros = m ? M.roster(m.home).concat(M.roster(m.away)) : [];
    const tags = [...new Set(M.state.clips.flatMap(c => c.tags || []).concat(M.state.events.flatMap(e => e.tags || [])))].sort();
    const evs = M.state.events.filter(e => e.matchId === clip.matchId).sort((a, b) => a.period - b.period || (A.derive(a).el ?? 0) - (A.derive(b).el ?? 0));
    Lab.openDrawer(`<div class="drawer-h"><div><span class="k">${U.esc(M.matchLabel(m))}</span><h2 id="drawerTitle">${isNew ? 'New clip' : 'Edit clip'}</h2></div><button class="btn sm" data-close>Cancel</button></div>
      <div class="drawer-b"><div class="form">
        <label class="full">Title<input id="kT" value="${U.esc(clip.title || '')}" placeholder="e.g. Spear runs through off a targeted tap"></label>
        <label>In (h:mm:ss)<input id="kIn" value="${U.fmtVideoTime(clip.start)}"></label><label>Out (h:mm:ss)<input id="kOut" value="${U.fmtVideoTime(clip.end)}"></label>
        <label class="full">Tags: phase, theme, situation, outcome, anything (comma separated)<input id="kTags" list="kTL" value="${U.esc((clip.tags || []).join(', '))}" placeholder="e.g. centre bounce, after goal, clearance won, press"></label><datalist id="kTL">${tags.map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
        <label class="full">Linked coded event<select id="kEv"><option value="">None</option>${evs.map(e => `<option value="${e.id}" ${e.id === clip.eventId ? 'selected' : ''}>Q${e.period} ${U.esc(e.clock)} · ${U.esc((M.template(e.templateId) || {}).name || '')} · ${U.esc(e.team)}</option>`).join('')}</select></label>
        <label class="full">Note<textarea id="kNote">${U.esc(clip.note || '')}</textarea></label>
      </div>
      <h3 style="margin-top:10px">Players in the clip</h3>${ros.length ? `<div class="chk-grid">${ros.map(p => `<label><input type="checkbox" data-kp value="${p.id}" ${(clip.playerIds || []).includes(p.id) ? 'checked' : ''}> ${U.esc(p.name)} <span class="muted">${U.esc(p.team)}</span></label>`).join('')}</div>` : '<p class="muted">No players listed for these teams.</p>'}
      <p class="sub">A clip is a reference (in and out points) to the match video. No new video file is made.</p>
      <div class="ctl" style="margin-top:10px"><button class="btn g" id="kSave">Save clip</button>${isNew ? '' : '<button class="btn danger sm" id="kDel">Delete clip</button>'}</div><div id="kErr" class="warnline hidden"></div></div>`, d => {
      U.$('#kSave', d).onclick = () => {
        const s = U.parseVideoTime(U.$('#kIn', d).value), e = U.parseVideoTime(U.$('#kOut', d).value), err = U.$('#kErr', d);
        if (s == null || e == null || e <= s) { err.textContent = 'In and out must be h:mm:ss with out after in.'; err.classList.remove('hidden'); return; }
        const p = { title: U.$('#kT', d).value.trim() || 'Untitled clip', start: s, end: e, tags: U.$('#kTags', d).value.split(',').map(x => x.trim()).filter(Boolean), eventId: U.$('#kEv', d).value, note: U.$('#kNote', d).value.trim(), playerIds: U.$$('[data-kp]', d).filter(c => c.checked).map(c => c.value) };
        if (isNew) M.addClip(Object.assign({ matchId: clip.matchId }, p)); else M.updateClip(clip.id, p);
        Lab.closeDrawer(); U.toast('Clip saved');
      };
      const del = U.$('#kDel', d); if (del) del.onclick = () => { if (confirm('Delete this clip?')) { M.removeClip(clip.id); Lab.closeDrawer(); } };
    });
  };

  Lab.Views.video = {
    render(el, { ws }) {
      const ms = M.wsMatches(ws);
      if (!ms.length) { el.innerHTML = C.empty('No matches yet', 'Add matches first. Each match can have its own video link or local file.', 'at least one match'); return; }
      if (!vs.videoMatch || !ms.some(m => m.id === vs.videoMatch)) vs.videoMatch = ms[0].id;
      const id = vs.videoMatch, m = M.match(id), v = M.state.videos[id] || { url: '', offsets: {} }, src = source(id);
      const evs = M.state.events.filter(e => e.matchId === id).sort((a, b) => a.period - b.period || (A.derive(a).el ?? 0) - (A.derive(b).el ?? 0));
      const ids = new Set(ms.map(x => x.id));
      const mo = new Map(ms.map((x, i) => [x.id, i]));
      const q = (vs.clipQ || '').toLowerCase();
      const clips = M.state.clips.filter(c => ids.has(c.matchId))
        .filter(c => !vs.clipMatch || c.matchId === vs.clipMatch)
        .filter(c => !vs.clipTag || (c.tags || []).includes(vs.clipTag))
        .filter(c => !vs.clipPlayer || (c.playerIds || []).includes(vs.clipPlayer))
        .filter(c => !q || [c.title, c.note, (c.tags || []).join(' '), (c.playerIds || []).map(M.playerName).join(' ')].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (mo.get(a.matchId) - mo.get(b.matchId)) || a.start - b.start);
      const allClips = M.state.clips.filter(c => ids.has(c.matchId));
      const tagsAll = [...new Set(allClips.flatMap(c => c.tags || []))].sort();
      const playersAll = [...new Set(allClips.flatMap(c => c.playerIds || []))];
      const pls = M.playlists(ws.id);
      const resume = Lab._vidResume;
      let player = `<div class="vid-wrap"><div><b style="color:#fff">No video attached to this match</b><br>Play a file from this computer or save a link below. Footage is never uploaded.</div></div>`;
      if (src && src.kind === 'file') player = `<div class="vid-wrap" style="padding:0"><video id="vid" src="${U.esc(src.src)}" controls preload="metadata"></video></div>`;
      else if (src && src.kind === 'yt') player = `<div class="vid-wrap" style="padding:0"><iframe id="yt" src="https://www.youtube-nocookie.com/embed/${src.id}?rel=0" title="Match video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      else if (src) player = `<div class="vid-wrap"><div>Linked: <a style="color:#fff" href="${U.esc(src.src)}" target="_blank" rel="noopener">${U.esc(src.src)}</a><br>This link can't be embedded; jumps open it in a new tab.</div></div>`;
      el.innerHTML = `
      <section class="grid g2">
        <div class="card"><div class="card-h"><div><h2>Match video</h2><p>${src ? U.esc(src.label) : 'Nothing attached'}</p></div><div class="ctl"><select id="vMatch">${ms.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${U.esc(M.matchLabel(x))}${(M.state.videos[x.id] || {}).url || Lab.localVideos[x.id] ? ' ▶' : ''}</option>`).join('')}</select></div></div>
          ${player}<div class="pl-now" id="plNow"></div>
          <div class="ctl" style="margin-top:8px"><label class="btn sm" for="vFile" style="cursor:pointer">Play a local file…</label><input type="file" id="vFile" accept="video/*" class="hidden">
            ${src && src.kind === 'file' ? `<button class="btn sm" id="kIn">Set in</button><button class="btn sm" id="kOut">Set out &amp; make clip</button><span class="muted" id="kPend">${vs.clipIn != null ? 'In ' + U.fmtVideoTime(vs.clipIn) : ''}</span>` : ''}
            ${v.fileName && !Lab.localVideos[id] ? `<span class="muted">Last file: ${U.esc(v.fileName)} (pick it again to play)</span>` : ''}</div>
          <details style="margin-top:8px" ${v.url || Object.keys(v.offsets || {}).length ? '' : 'open'}><summary>Link and quarter start times</summary>
            <div class="form"><label class="full">Video link (YouTube, direct .mp4/.webm, or where the file is kept)<input id="vUrl" value="${U.esc(v.url || '')}"></label></div><div class="ctl" style="margin-top:6px"><button class="btn sm" id="vSave">Save link</button></div>
            <p class="sub" style="margin-top:8px">Video time of each quarter's first bounce. Events without a confirmed time get an estimate (first bounce + clock time elapsed). The clock stops for time-on, so estimates run early: confirm the real moment.</p>
            <div class="offs">${[1, 2, 3, 4].map(qq => `<label>Q${qq}<input data-q="${qq}" value="${v.offsets && v.offsets[qq] != null ? U.fmtVideoTime(v.offsets[qq]) : ''}" placeholder="h:mm:ss">${src && src.kind === 'file' ? `<button class="btn sm" data-now="${qq}">Use current</button>` : ''}</label>`).join('')}</div>
            <div class="ctl" style="margin-top:8px"><button class="btn sm" id="offSave">Save quarter times</button></div></details>
        </div>
        <div class="card"><div class="card-h"><div><h2>Events in this match</h2><p>${evs.length} coded · ${evs.filter(e => e.video && e.video.time != null).length} with a confirmed time</p></div></div>
          ${evs.length ? `<div class="tw" style="max-height:560px;overflow:auto"><table class="compact"><thead><tr><th>Q</th><th>Clock</th><th class="l">Event</th><th>Video</th><th class="l"></th></tr></thead><tbody>
          ${evs.map(e => { const t = target(e); return `<tr class="${vs.videoEvent === e.id ? 'sel' : ''}"><td>${e.period}</td><td>${U.esc(e.clock)}</td><td class="l" style="white-space:normal"><button class="link" data-open="${e.id}">${U.esc((M.template(e.templateId) || {}).name || 'Event')}</button> · ${U.esc(e.team)}</td><td>${t ? `${U.fmtVideoTime(t.t)} <span class="badge2 ${t.kind === 'confirmed' ? 'clip' : ''}">${t.kind}</span>` : '<span class="muted">–</span>'}</td>
            <td class="l"><button class="btn sm" data-jump="${e.id}" ${t && src ? '' : 'disabled'}>Jump</button> <button class="btn sm" data-conf="${e.id}" ${src && src.kind === 'file' ? '' : 'disabled title="Needs a playable file"'}>Confirm</button> <button class="btn sm" data-mk="${e.id}" ${t ? '' : 'disabled'}>Clip</button> <button class="btn sm" data-efd="${e.id}" title="Add this event to a finding">+ Finding</button></td></tr>`; }).join('')}
          </tbody></table></div>` : C.empty('No coded events in this match', 'Code events on the Code tab; they appear here to jump to and clip.')}
        </div>
      </section>
      <section class="sec card"><div class="card-h"><div><h2>Clip library</h2><p>${allClips.length} clips from our matches.</p></div><div class="ctl"><button class="btn sm" id="kExp" ${clips.length ? '' : 'disabled'}>Export clip list (CSV)</button></div></div>
        <div class="f-row" style="margin-bottom:8px">
          <div class="f"><label>Match</label><select data-cf="clipMatch"><option value="">All</option>${ms.map(x => `<option value="${x.id}" ${vs.clipMatch === x.id ? 'selected' : ''}>${U.esc(M.matchLabel(x))}</option>`).join('')}</select></div>
          <div class="f"><label>Tag</label><select data-cf="clipTag"><option value="">All</option>${tagsAll.map(t => `<option ${vs.clipTag === t ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}</select></div>
          <div class="f"><label>Player</label><select data-cf="clipPlayer"><option value="">All</option>${playersAll.map(p => `<option value="${p}" ${vs.clipPlayer === p ? 'selected' : ''}>${U.esc(M.playerName(p))}</option>`).join('')}</select></div>
          <div class="f"><label>Search</label><input type="search" id="kQ" value="${U.esc(vs.clipQ || '')}"></div></div>
        ${clips.length ? `<div class="tw"><table class="compact"><thead><tr><th class="l">Clip</th><th class="l">Match</th><th>In–out</th><th class="l">Tags &amp; players</th><th class="l">Event</th><th class="l"></th></tr></thead><tbody>
          ${clips.map(c => { const e = c.eventId && M.event(c.eventId); return `<tr><td class="l" style="white-space:normal"><b>${U.esc(c.title)}</b>${c.note ? `<br><span class="sub">${U.esc(c.note)}</span>` : ''}</td><td class="l">${U.esc(M.matchLabel(M.match(c.matchId)))}</td><td>${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}</td>
            <td class="l" style="white-space:normal">${(c.tags || []).map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}${(c.playerIds || []).map(p => `<span class="tag ptag">${U.esc(M.playerName(p))}</span>`).join('')}</td><td class="l">${e ? `<button class="link" data-open="${e.id}">Q${e.period} ${U.esc(e.clock)}</button>` : '<span class="muted">–</span>'}</td>
            <td class="l"><button class="btn sm" data-play="${c.id}" ${source(c.matchId) ? '' : 'disabled title="No video for this match"'}>Play</button> <button class="btn sm" data-kedit="${c.id}">Edit</button> <button class="btn sm" data-kfd="${c.id}" title="Add this clip to a finding">+ Finding</button> <select data-addpl="${c.id}" class="mini"><option value="">+ Playlist</option>${pls.map(p => `<option value="${p.id}">${U.esc(p.name)}</option>`).join('')}<option value="__new">New playlist…</option></select></td></tr>`; }).join('')}
        </tbody></table></div>` : C.empty(allClips.length ? 'No clips match' : 'No clips yet', allClips.length ? 'Loosen the filters.' : 'Give an event a video time (Confirm, or type it in the event), then press Clip. With a local file you can also Set in / Set out.')}
      </section>
      <section class="sec card"><div class="card-h"><div><h2>Playlists</h2><p>Clips in order for a review session.</p></div><div class="ctl"><button class="btn" id="plNew">+ New playlist</button></div></div>
        ${pls.length ? pls.map(p => `<div class="pl"><div class="card-h"><div><h3>${U.esc(p.name)}</h3><p>${p.clipIds.length} clips</p></div><div class="ctl"><button class="btn sm g" data-plplay="${p.id}" ${p.clipIds.length ? '' : 'disabled'}>Play all</button><button class="btn sm" data-plren="${p.id}">Rename</button><button class="btn sm" data-plfd="${p.id}">+ Finding</button><button class="btn sm danger" data-pldel="${p.id}">Delete</button></div></div>
          ${p.clipIds.length ? `<ol class="plist">${p.clipIds.map((cid, i) => { const c = M.state.clips.find(x => x.id === cid); return c ? `<li>${U.esc(c.title)} <span class="muted mono">${U.esc(M.matchLabel(M.match(c.matchId)))} ${U.fmtVideoTime(c.start)}–${U.fmtVideoTime(c.end)}${source(c.matchId) ? '' : ' · no video'}</span> <button class="btn sm" data-plmv="${p.id}:${i}:-1" ${i ? '' : 'disabled'}>↑</button><button class="btn sm" data-plmv="${p.id}:${i}:1" ${i < p.clipIds.length - 1 ? '' : 'disabled'}>↓</button><button class="btn sm" data-plrm="${p.id}:${i}">Remove</button></li>` : ''; }).join('')}</ol>` : '<p class="muted">Add clips from the library.</p>'}</div>`).join('') : '<p class="muted">No playlists yet.</p>'}
      </section>`;

      U.$('#vMatch', el).onchange = e => { vs.videoMatch = e.target.value; vs.clipIn = null; Lab.render(); };
      U.$('#vFile', el).onchange = e => { const f = e.target.files[0]; if (!f) return; if (Lab.localVideos[id]) URL.revokeObjectURL(Lab.localVideos[id].url); Lab.localVideos[id] = { url: URL.createObjectURL(f), name: f.name }; M.setVideo(id, { fileName: f.name }); };
      const vid = U.$('#vid', el);
      if (vid) {
        const ps = vs.pendingSeek; vs.pendingSeek = null;
        vid.addEventListener('loadedmetadata', () => { if (ps) { vid.currentTime = ps.t; vs.stopAt = ps.end; vid.play().catch(() => {}); } else if (resume && resume.id === id && resume.t) vid.currentTime = resume.t; }, { once: true });
        vid.addEventListener('timeupdate', () => { if (vs.stopAt != null && vid.currentTime >= vs.stopAt) { vs.stopAt = null; if (vs.playing) step(1); else vid.pause(); } });
      } else if (vs.pendingSeek && src && src.kind === 'yt') { const ps = vs.pendingSeek; vs.pendingSeek = null; seek(ps.t, ps.end); }
      paintNow();
      U.$('#vSave', el).onclick = () => { M.setVideo(id, { url: U.$('#vUrl', el).value.trim() }); U.toast('Link saved'); };
      U.$$('[data-now]', el).forEach(b => b.onclick = () => { if (vid) U.$(`[data-q="${b.dataset.now}"]`, el).value = U.fmtVideoTime(vid.currentTime); });
      U.$('#offSave', el).onclick = () => { const o = {}; let bad = false; U.$$('[data-q]', el).forEach(i => { const t = U.parseVideoTime(i.value); if (i.value.trim() && t == null) bad = true; if (t != null) o[i.dataset.q] = t; }); if (bad) { U.toast('Use h:mm:ss', 'warn'); return; } M.setVideo(id, { offsets: o }); U.toast('Quarter times saved'); };
      const ki = U.$('#kIn', el), ko = U.$('#kOut', el);
      if (ki) ki.onclick = () => { vs.clipIn = vid.currentTime; U.$('#kPend', el).textContent = 'In ' + U.fmtVideoTime(vs.clipIn); };
      if (ko) ko.onclick = () => { const e = vid.currentTime, s = vs.clipIn != null ? vs.clipIn : Math.max(0, e - 10); if (e <= s) { U.toast('Out must be after in', 'warn'); return; } vs.clipIn = null; const near = evs.filter(x => target(x)).sort((a, b) => Math.abs(target(a).t - s) - Math.abs(target(b).t - s))[0]; Lab.openClip({ matchId: id, start: s, end: e, eventId: near && Math.abs(target(near).t - s) < 30 ? near.id : '' }); };
      U.$$('[data-open]', el).forEach(a => a.onclick = () => Lab.openEvent(a.dataset.open));
      U.$$('[data-jump]', el).forEach(b => b.onclick = () => { const e = M.event(b.dataset.jump), t = target(e); vs.videoEvent = e.id; vs.playing = null; seek(t.t - LEAD); });
      U.$$('[data-conf]', el).forEach(b => b.onclick = () => { if (!vid) return; vs.videoEvent = b.dataset.conf; M.updateEvent(b.dataset.conf, { video: { time: vid.currentTime, status: 'confirmed' } }); U.toast('Time confirmed: ' + U.fmtVideoTime(vid.currentTime)); });
      U.$$('[data-mk]', el).forEach(b => b.onclick = () => { const e = M.event(b.dataset.mk), t = target(e), tp = M.template(e.templateId); Lab.openClip({ matchId: e.matchId, start: Math.max(0, t.t - LEAD), end: t.t + 12, eventId: e.id, tags: (e.tags || []).concat(tp ? [tp.name] : []), playerIds: tp ? tp.fields.filter(f => f.type === 'player' && M.player(e.v[f.key])).map(f => e.v[f.key]) : [], title: `${m.round} Q${e.period} ${e.clock} · ${tp ? tp.name : ''}` }); });
      U.$$('[data-cf]', el).forEach(s => s.onchange = () => { vs[s.dataset.cf] = s.value; Lab.render(); });
      let qt; const kq = U.$('#kQ', el); kq.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { vs.clipQ = kq.value; Lab.render(); const n = U.$('#kQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
      U.$('#kExp', el).onclick = () => U.download(`clips-${U.today()}.csv`, U.toCSV(['Match', 'Clip', 'In', 'Out', 'Tags', 'Players', 'Coded event', 'Video source', 'Note'], clips.map(c => { const e = c.eventId && M.event(c.eventId); return [M.matchLabel(M.match(c.matchId)), c.title, U.fmtVideoTime(c.start), U.fmtVideoTime(c.end), (c.tags || []).join('; '), (c.playerIds || []).map(M.playerName).join('; '), e ? `Q${e.period} ${e.clock}` : '', (M.state.videos[c.matchId] || {}).url || (M.state.videos[c.matchId] || {}).fileName || '', c.note]; })), 'text/csv;charset=utf-8');
      U.$$('[data-play]', el).forEach(b => b.onclick = () => { vs.playing = null; playClip(M.state.clips.find(c => c.id === b.dataset.play)); });
      U.$$('[data-efd]', el).forEach(b => b.onclick = () => Lab.eventToFinding(b.dataset.efd));
      U.$$('[data-kfd]', el).forEach(b => b.onclick = () => Lab.clipToFinding(b.dataset.kfd));
      U.$$('[data-kedit]', el).forEach(b => b.onclick = () => Lab.openClip(M.state.clips.find(c => c.id === b.dataset.kedit)));
      U.$$('[data-addpl]', el).forEach(s => s.onchange = () => { let p = pls.find(x => x.id === s.value); if (s.value === '__new') { const n = prompt('Playlist name', 'Team review'); if (!n) { s.value = ''; return; } p = M.addPlaylist({ name: n }); } if (p && !p.clipIds.includes(s.dataset.addpl)) M.updatePlaylist(p.id, { clipIds: p.clipIds.concat([s.dataset.addpl]) }); U.toast('Added to ' + p.name); });
      U.$('#plNew', el).onclick = () => { const n = prompt('Playlist name', 'Team review'); if (n) M.addPlaylist({ name: n }); };
      U.$$('[data-plplay]', el).forEach(b => b.onclick = () => { vs.playing = { id: b.dataset.plplay, i: -1 }; step(1); });
      U.$$('[data-plren]', el).forEach(b => b.onclick = () => { const p = M.playlist(b.dataset.plren), n = prompt('Playlist name', p.name); if (n) M.updatePlaylist(p.id, { name: n }); });
      U.$$('[data-pldel]', el).forEach(b => b.onclick = () => { if (confirm('Delete this playlist? Clips are kept.')) M.removePlaylist(b.dataset.pldel); });
      U.$$('[data-plmv]', el).forEach(b => b.onclick = () => { const [pid, i, d] = b.dataset.plmv.split(':'), p = M.playlist(pid), a = p.clipIds.slice(), j = +i + +d; [a[+i], a[j]] = [a[j], a[+i]]; M.updatePlaylist(pid, { clipIds: a }); });
      U.$$('[data-plrm]', el).forEach(b => b.onclick = () => { const [pid, i] = b.dataset.plrm.split(':'), p = M.playlist(pid); M.updatePlaylist(pid, { clipIds: p.clipIds.filter((_, j) => j !== +i) }); });
      U.$$('[data-plfd]', el).forEach(b => b.onclick = () => { const p = M.playlist(b.dataset.plfd); const cs = p.clipIds.map(x => M.state.clips.find(c => c.id === x)).filter(Boolean); Lab.newFinding({ title: 'Video: ' + p.name, stat: `Playlist of ${cs.length} clips from ${new Set(cs.map(c => c.matchId)).size} match(es).`, n: cs.length, matchIds: [...new Set(cs.map(c => c.matchId))], clipIds: p.clipIds.slice(), eventIds: cs.map(c => c.eventId).filter(Boolean), source: 'Clips in the Lab' }); });
    }
  };
})(window.Lab);
