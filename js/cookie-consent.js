(function () {
  var GA_ID = 'G-6FQTTX4FW0';
  var STORAGE_KEY = 'cookie_consent';

  function loadGA4() {
    var s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    s.async = true;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function saveConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function getConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function removeBanner() {
    var b = document.getElementById('cc-banner');
    if (b) b.remove();
    var m = document.getElementById('cc-modal');
    if (m) m.remove();
  }

  function accept() {
    saveConsent('accepted');
    loadGA4();
    removeBanner();
  }

  function decline() {
    saveConsent('declined');
    removeBanner();
  }

  function openSettings() {
    var existing = document.getElementById('cc-modal');
    if (existing) { existing.remove(); return; }

    var checked = getConsent() === 'accepted' ? 'checked' : '';
    var modal = document.createElement('div');
    modal.id = 'cc-modal';
    modal.innerHTML = [
      '<div class="cc-modal-box">',
      '  <div class="cc-modal-title">Cookie-Einstellungen</div>',
      '  <div class="cc-modal-row">',
      '    <label class="cc-toggle-wrap">',
      '      <input type="checkbox" id="cc-analytics-chk" ' + checked + '>',
      '      <span class="cc-toggle"></span>',
      '    </label>',
      '    <div class="cc-modal-info">',
      '      <div class="cc-modal-label">Analytics (Google Analytics 4)</div>',
      '      <div class="cc-modal-desc">Hilft uns zu verstehen, wie Besucher die Website nutzen. Keine personenbezogenen Daten.</div>',
      '    </div>',
      '  </div>',
      '  <div class="cc-modal-row cc-modal-always">',
      '    <div class="cc-always-on">IMMER AN</div>',
      '    <div class="cc-modal-info">',
      '      <div class="cc-modal-label">Notwendig</div>',
      '      <div class="cc-modal-desc">Technisch erforderlich für den Betrieb der Website.</div>',
      '    </div>',
      '  </div>',
      '  <div class="cc-modal-actions">',
      '    <button class="cc-btn cc-btn-decline" id="cc-modal-decline">Ablehnen</button>',
      '    <button class="cc-btn cc-btn-accept" id="cc-modal-accept">Speichern</button>',
      '  </div>',
      '</div>',
    ].join('');

    document.body.appendChild(modal);

    document.getElementById('cc-modal-accept').addEventListener('click', function () {
      var chk = document.getElementById('cc-analytics-chk');
      if (chk && chk.checked) { accept(); } else { decline(); }
    });
    document.getElementById('cc-modal-decline').addEventListener('click', decline);
  }

  function injectStyles() {
    var css = [
      '@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap");',
      '#cc-banner{',
      '  position:fixed;bottom:24px;left:24px;right:190px;z-index:99999;',
      '  background:#111111;color:#ffffff;',
      '  font-family:"JetBrains Mono",monospace;',
      '  border:2px solid #f5c84b;box-shadow:4px 4px 0 #f5c84b;',
      '  padding:12px 16px;',
      '  display:flex;align-items:center;gap:12px;flex-wrap:wrap;',
      '}',
      '#cc-banner .cc-text{font-size:0.72rem;font-weight:600;line-height:1.4;flex:1;min-width:180px;}',
      '#cc-banner .cc-text a{color:#f5c84b;text-underline-offset:3px;}',
      '#cc-banner .cc-btns{display:flex;gap:8px;align-items:center;flex-shrink:0;}',
      '.cc-btn{',
      '  font-family:"JetBrains Mono",monospace;font-weight:800;font-size:0.72rem;',
      '  padding:6px 12px;border:2px solid;cursor:pointer;',
      '  transition:transform 0.1s,box-shadow 0.1s;white-space:nowrap;',
      '}',
      '.cc-btn-accept{background:#f5c84b;color:#111111;border-color:#111111;box-shadow:3px 3px 0 #f5c84b;}',
      '.cc-btn-accept:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 #f5c84b;}',
      '.cc-btn-decline{background:#ffffff;color:#111111;border-color:#111111;box-shadow:3px 3px 0 #ffffff;}',
      '.cc-btn-decline:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 #ffffff;}',
      '.cc-btn-settings{background:transparent;color:#ffffff;border-color:#ffffff;box-shadow:3px 3px 0 rgba(255,255,255,0.3);}',
      '.cc-btn-settings:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 rgba(255,255,255,0.3);}',
      /* Modal */
      '#cc-modal{',
      '  position:fixed;inset:0;z-index:100000;',
      '  background:rgba(0,0,0,0.6);',
      '  display:flex;align-items:flex-end;justify-content:center;',
      '  padding-bottom:90px;',
      '}',
      '.cc-modal-box{',
      '  background:#ffffff;color:#111111;',
      '  font-family:"JetBrains Mono",monospace;',
      '  border:3px solid #111111;box-shadow:6px 6px 0 #111111;',
      '  padding:28px;width:100%;max-width:500px;',
      '}',
      '.cc-modal-title{font-size:1.1rem;font-weight:800;margin-bottom:20px;}',
      '.cc-modal-row{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid #111111;}',
      '.cc-modal-row:last-of-type{border-bottom:none;}',
      '.cc-modal-label{font-size:0.85rem;font-weight:800;margin-bottom:4px;}',
      '.cc-modal-desc{font-size:0.75rem;font-weight:500;opacity:0.7;line-height:1.5;}',
      '.cc-modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;}',
      '.cc-always-on{',
      '  background:#111111;color:#f5c84b;',
      '  font-size:0.65rem;font-weight:800;padding:4px 8px;',
      '  white-space:nowrap;flex-shrink:0;',
      '}',
      /* Toggle switch */
      '.cc-toggle-wrap{flex-shrink:0;position:relative;display:inline-block;width:44px;height:24px;margin-top:2px;}',
      '.cc-toggle-wrap input{opacity:0;width:0;height:0;position:absolute;}',
      '.cc-toggle{',
      '  position:absolute;inset:0;',
      '  background:#cccccc;border:2px solid #111111;cursor:pointer;',
      '  transition:background 0.2s;',
      '}',
      '.cc-toggle:before{',
      '  content:"";position:absolute;',
      '  width:16px;height:16px;left:2px;top:2px;',
      '  background:#111111;transition:transform 0.2s;',
      '}',
      '.cc-toggle-wrap input:checked + .cc-toggle{background:#f5c84b;}',
      '.cc-toggle-wrap input:checked + .cc-toggle:before{transform:translateX(20px);}',
      /* Mobile — banner moves to top to avoid bottom nav + chat button */
      '@media(max-width:820px){',
      '  #cc-banner{left:0;right:0;bottom:auto;top:0;border-left:none;border-right:none;border-top:none;box-shadow:0 4px 0 #f5c84b;}',
      '  .cc-btn{text-align:center;}',
      '  #cc-modal{padding-bottom:0;align-items:flex-end;}',
      '  .cc-modal-box{border-left:none;border-right:none;border-bottom:none;box-shadow:none;max-width:100%;}',
      '}',
    ].join('');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();
    var banner = document.createElement('div');
    banner.id = 'cc-banner';
    banner.innerHTML = [
      '<div class="cc-text">',
      '  🍪 Cookies für Analyse. <a href="/datenschutz/">Datenschutz</a>',
      '</div>',
      '<div class="cc-btns">',
      '  <button class="cc-btn cc-btn-settings" id="cc-settings-btn">Einstellungen</button>',
      '  <button class="cc-btn cc-btn-decline" id="cc-decline-btn">Ablehnen</button>',
      '  <button class="cc-btn cc-btn-accept" id="cc-accept-btn">Akzeptieren</button>',
      '</div>',
    ].join('');

    document.body.appendChild(banner);

    document.getElementById('cc-accept-btn').addEventListener('click', accept);
    document.getElementById('cc-decline-btn').addEventListener('click', decline);
    document.getElementById('cc-settings-btn').addEventListener('click', openSettings);
  }

  function init() {
    var consent = getConsent();
    if (consent === 'accepted') { loadGA4(); return; }
    if (consent === 'declined') { return; }
    // No consent yet — show banner
    if (document.body) {
      showBanner();
    } else {
      document.addEventListener('DOMContentLoaded', showBanner);
    }
  }

  init();
})();
