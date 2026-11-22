/* Footy Lab — shared interface behaviour: mobile menu and current-page marker. */
(function () {
  var d = document;
  d.documentElement.classList.add('js');
  var btn = d.querySelector('.nav-toggle'), nav = d.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus();
      }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }
  var file = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  var key = /players/.test(file) ? 'players'
    : /^about/.test(file) ? 'about'
    : /^(article-|centre-ball-ups)/.test(file) ? 'deep-dives'
    : /^index|^$/.test(file) ? null : 'models';
  if (key) {
    var a = d.querySelector('.site-nav a[data-nav="' + key + '"]');
    if (a) a.setAttribute('aria-current', 'page');
  }
})();
