/* Opponent Lab: shared helpers. Classic script (no modules) so the page works from file:// */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  const U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  U.norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');

  /* "18:08" -> 1088 seconds. Accepts m:ss, mm:ss, or plain minutes. */
  U.parseClock = function (s) {
    if (s == null) return null;
    const t = String(s).trim();
    if (!t) return null;
    let m = t.match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    m = t.match(/^(\d{1,2})$/);
    if (m) return parseInt(m[1], 10) * 60;
    return null;
  };
  U.fmtClock = function (sec) {
    if (sec == null || isNaN(sec)) return '';
    const s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  /* Video timestamp h:mm:ss or m:ss */
  U.parseVideoTime = function (s) {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s;
    const parts = String(s).trim().split(':').map(p => p.trim());
    if (parts.some(p => !/^\d+(\.\d+)?$/.test(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0);
  };
  U.fmtVideoTime = function (sec) {
    if (sec == null || isNaN(sec)) return '';
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  };

  /* Rate object: always carries numerator, denominator and an interval. */
  U.rate = function (num, den) {
    const r = { num, den, p: den ? num / den : null, lo: null, hi: null };
    if (den) {
      // Wilson score interval, 95%
      const z = 1.96, p = num / den, z2 = z * z;
      const centre = (p + z2 / (2 * den)) / (1 + z2 / den);
      const half = (z * Math.sqrt(p * (1 - p) / den + z2 / (4 * den * den))) / (1 + z2 / den);
      r.lo = Math.max(0, centre - half);
      r.hi = Math.min(1, centre + half);
    }
    return r;
  };
  U.pct = function (p, dp) {
    if (p == null || isNaN(p)) return '–';
    return (p * 100).toFixed(dp == null ? 0 : dp) + '%';
  };
  U.signed = n => (n > 0 ? '+' : '') + n;
  U.round = (n, dp) => (n == null || isNaN(n) ? null : Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp));

  /* Small-sample threshold used across the product. */
  U.SMALL_N = 10;

  /* Rate cell HTML: "52% · 28/54" with tooltip interval. */
  U.rateCell = function (r, opts) {
    opts = opts || {};
    if (!r || !r.den) return '<span class="muted">–</span>';
    const small = r.den < U.SMALL_N;
    const ci = r.lo != null ? `95% interval ${U.pct(r.lo)}–${U.pct(r.hi)}` : '';
    return `<span class="rc${small ? ' small' : ''}" title="${U.esc(r.num + ' of ' + r.den + (ci ? ' · ' + ci : '') + (small ? ' · small sample' : ''))}">` +
      `<b>${U.pct(r.p)}</b><i>${r.num}/${r.den}</i></span>`;
  };

  U.groupBy = function (arr, fn) {
    const m = new Map();
    arr.forEach(x => {
      const k = fn(x);
      const keys = Array.isArray(k) ? k : [k];
      keys.forEach(key => {
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(x);
      });
    });
    return m;
  };

  U.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  U.csvCell = function (v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  U.toCSV = function (header, rows) {
    return [header.map(U.csvCell).join(',')].concat(rows.map(r => r.map(U.csvCell).join(','))).join('\r\n');
  };

  U.toast = function (msg, kind) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  };

  U.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  Lab.U = U;
})(window.Lab);
