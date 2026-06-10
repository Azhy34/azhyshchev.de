/* Shared navigation JS — hamburger menu + mobile bottom nav active state */

/* Language switcher */
var langMap = {
  '/': '/de/',
  '/experience/': '/de/erfahrung/',
  '/projects/': '/de/projekte/',
  '/skills/': '/de/fahigkeiten/',
  '/contact/': '/de/kontakt/',
  '/de/': '/',
  '/de/erfahrung/': '/experience/',
  '/de/projekte/': '/projects/',
  '/de/fahigkeiten/': '/skills/',
  '/de/kontakt/': '/contact/',
  '/articles/b2b-lead-pipeline-germany/': '/de/artikel/b2b-lead-pipeline-deutschland/',
  '/de/artikel/b2b-lead-pipeline-deutschland/': '/articles/b2b-lead-pipeline-germany/',
  '/articles/invoice-automation-pipeline/': '/de/artikel/rechnungsautomatisierung-pipeline/',
  '/de/artikel/rechnungsautomatisierung-pipeline/': '/articles/invoice-automation-pipeline/',
  '/articles/wallpaper-ai-automation/': '/de/artikel/tapeten-ki-automatisierung/',
  '/de/artikel/tapeten-ki-automatisierung/': '/articles/wallpaper-ai-automation/',
  '/articles/rag-sales-agent/': '/de/artikel/hybrid-rag-verkaufsassistent/',
  '/de/artikel/hybrid-rag-verkaufsassistent/': '/articles/rag-sales-agent/',
  '/articles/rag-sales-agent-ecommerce/': '/de/artikel/rag-kundenservice-ecommerce/',
  '/de/artikel/rag-kundenservice-ecommerce/': '/articles/rag-sales-agent-ecommerce/',
  '/articles/ai-image-composer/': '/de/artikel/ki-bildkomposition/',
  '/de/artikel/ki-bildkomposition/': '/articles/ai-image-composer/',
  '/articles/ai-visibility/': '/de/artikel/ki-sichtbarkeit-website/',
  '/de/artikel/ki-sichtbarkeit-website/': '/articles/ai-visibility/',
  '/articles/ai-music-saas/': '/de/artikel/ki-musik-saas/',
  '/de/artikel/ki-musik-saas/': '/articles/ai-music-saas/',
  '/articles/': '/de/artikel/',
  '/de/artikel/': '/articles/',
  '/projects/b2b-lead-generation-germany/': '/de/projekte/b2b-lead-generierung-deutschland/',
  '/de/projekte/b2b-lead-generierung-deutschland/': '/projects/b2b-lead-generation-germany/',
  '/projects/invoice-automation-germany/': '/de/projekte/rechnungsautomatisierung-deutschland/',
  '/de/projekte/rechnungsautomatisierung-deutschland/': '/projects/invoice-automation-germany/',
  '/ai-checker/': '/de/ki-checker/',
  '/de/ki-checker/': '/ai-checker/'
};

function normalizePath(p) {
  return p === '/' ? p : (p.endsWith('/') ? p : p + '/');
}

function switchLang() {
  var alt = langMap[normalizePath(window.location.pathname)];
  if (alt) {
    try { localStorage.setItem('lang', alt.startsWith('/de/') ? 'de' : 'en'); } catch(e) {}
    var toLang = alt.startsWith('/de/') ? 'de' : 'en';
    if (typeof gtag === 'function') {
      gtag('event', 'lang_switch', { to: toLang, from: toLang === 'de' ? 'en' : 'de' });
    }
    window.location.href = alt;
  }
}

(function () {
  var path = normalizePath(window.location.pathname);
  var isDE = path.startsWith('/de');

  /* Auto-redirect if user chose DE and this page has a DE version */
  var savedLang = null;
  try { savedLang = localStorage.getItem('lang'); } catch(e) {}
  if (savedLang === 'de' && !isDE) {
    var deAlt = langMap[path];
    if (deAlt && deAlt.startsWith('/de')) {
      window.location.replace(deAlt);
      return;
    }
  }

  if (!langMap[path]) return;

  /* Inject button CSS once */
  var style = document.createElement('style');
  style.textContent = '.lang-btn{font-family:"JetBrains Mono",monospace;font-weight:800;font-size:0.75rem;background:var(--cream,#f8f0dc);color:var(--black,#111);border:2px solid var(--black,#111);box-shadow:3px 3px 0 var(--black,#111);padding:6px 12px;cursor:pointer;width:100%;text-align:left;margin-top:4px;}.lang-btn:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--black,#111);}.lang-btn .lang-current{font-weight:900;background:var(--yellow,#f5c84b);padding:1px 5px;border-radius:0;}.lang-btn .lang-alt{font-weight:700;opacity:0.55;}@media(max-width:820px){.lang-btn{display:none;}}';
  document.head.appendChild(style);

  var sidebarBottom = document.querySelector('.sidebar-bottom');
  if (!sidebarBottom) return;

  var btn = document.createElement('button');
  btn.className = 'lang-btn';
  btn.setAttribute('onclick', 'switchLang()');
  btn.setAttribute('aria-label', 'Switch language');
  btn.innerHTML = '<span class="lang-current">' + (isDE ? 'DE' : 'EN') + '</span> / <span class="lang-alt">' + (isDE ? 'EN' : 'DE') + '</span>';
  sidebarBottom.appendChild(btn);
})();

(function () {
  /* Language suggestion banner — shown once to DE-browser users on EN pages */
  var browserLang = (navigator.language || '').toLowerCase();
  if (!browserLang.startsWith('de')) return;

  var path = normalizePath(window.location.pathname);
  if (path.startsWith('/de')) return;

  var deAlt = langMap[path];
  if (!deAlt || !deAlt.startsWith('/de')) return;

  try {
    if (localStorage.getItem('lang') || localStorage.getItem('lang_banner_dismissed')) return;
  } catch(e) {}

  var banner = document.createElement('div');
  banner.id = 'lang-suggest';
  banner.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;z-index:9999;background:#f5c84b;color:#111;font-family:"JetBrains Mono",monospace;font-size:0.78rem;font-weight:700;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:2px solid #111;box-shadow:4px 4px 0 #111;';

  var msg = document.createElement('span');
  msg.textContent = 'Diese Seite ist auch auf Deutsch verfügbar.';
  msg.style.cssText = 'flex:1;line-height:1.4;';

  var switchBtn = document.createElement('button');
  switchBtn.textContent = 'Auf Deutsch →';
  switchBtn.style.cssText = 'background:#111;color:#f5c84b;border:none;font-family:"JetBrains Mono",monospace;font-weight:800;font-size:0.78rem;padding:6px 12px;cursor:pointer;white-space:nowrap;flex-shrink:0;';
  switchBtn.onclick = function() {
    try { localStorage.setItem('lang', 'de'); } catch(e) {}
    if (typeof gtag === 'function') gtag('event', 'lang_switch', { to: 'de', from: 'en', method: 'banner' });
    window.location.href = deAlt;
  };

  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&#10005;';
  closeBtn.setAttribute('aria-label', 'Schlie\xdfen');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.1rem;cursor:pointer;color:#111;font-weight:900;padding:0;line-height:1;flex-shrink:0;';
  closeBtn.onclick = function() {
    try { localStorage.setItem('lang_banner_dismissed', '1'); } catch(e) {}
    banner.remove();
  };

  banner.appendChild(msg);
  banner.appendChild(switchBtn);
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);
})();

(function () {
  /* Hamburger toggle */
  var toggle = document.getElementById('navToggle');
  var nav = document.querySelector('.nav');
  var bottom = document.querySelector('.sidebar-bottom');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      if (bottom) bottom.classList.toggle('open', open);
      toggle.innerHTML = open ? '&#10005;' : '&#9776;';
    });
    document.querySelectorAll('.nav .nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        if (bottom) bottom.classList.remove('open');
        toggle.innerHTML = '&#9776;';
      });
    });
  }

  /* Mobile bottom nav active state */
  var path = window.location.pathname;
  document.querySelectorAll('.mbn-item').forEach(function (el) {
    var href = el.getAttribute('href');
    var isRoot = href === '/' || href === '/de/';
    if (isRoot && (path === href || path === href + 'index.html')) {
      el.classList.add('active');
    } else if (!isRoot && path.startsWith(href)) {
      el.classList.add('active');
    }
  });

  /* Hide reviews on mobile */
  if (window.innerWidth <= 820) {
    var reviews = document.querySelector('.reviews');
    if (reviews) reviews.style.display = 'none';
  }
})();
