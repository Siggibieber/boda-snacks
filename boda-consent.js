/* BODA Snacks: gemeinsame Einwilligungssteuerung, Version 2026-11-11.
   Ersetzt die bisherigen Inline-Loader. Keine Google-Anfrage ohne Zustimmung.
   Hauptdomain und Kaffee-Subdomain behalten getrennte Entscheidungen. */
(() => {
  'use strict';
  if (window.BodaConsent) return;
  const GA = 'G-6RJ6RX8XWZ';
  const KEY = 'boda-consent-v2';
  const MAX_AGE = 180 * 86400000;
  const preview = location.protocol === 'file:' || document.documentElement.dataset.preview === 'true';
  // Lokale Vorschauen und fremde Staging-Hosts senden keine Analytics-Daten.
  const production = ['boda-snacks.de', 'www.boda-snacks.de', 'kaffee.boda-snacks.de'].includes(location.hostname);
  let state = null, configured = false, scriptLoading = false, expiryTimer = null;
  let panel, settings, accept, decline, close, returnFocus = null;
  window['ga-disable-' + GA] = true;

  function normalize(value) {
    if (!value || typeof value !== 'object') return null;
    const at = Number.isFinite(value.at) ? value.at : value.timestamp;
    let analytics = value.analytics;
    // Zwei bereits vorhandene v2-Datenformate ohne Verlängerung übernehmen.
    if (analytics === 'accepted') analytics = true;
    if (analytics === 'declined') analytics = false;
    const age = Date.now() - at;
    if (typeof analytics !== 'boolean' || !Number.isFinite(at) || at <= 0 || age < 0 || age >= MAX_AGE) return null;
    return { analytics, at, version: 3 };
  }
  function read() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch (_) { return null; }
  }
  function persist(value) {
    try {
      // Undatierte alte Zustimmung wird nicht automatisch als neue Zustimmung gewertet.
      localStorage.removeItem('bodaCookiesAccepted');
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch (_) { /* Bei gesperrtem Speicher gilt die Auswahl nur auf dieser Seite. */ }
  }
  function allowed() { return !preview && production && !!normalize(state)?.analytics; }
  function cleanURL(raw) {
    try { const u = new URL(raw, location.href); return /^https?:$/.test(u.protocol) ? u.origin + u.pathname : ''; }
    catch (_) { return ''; }
  }
  // Bestehende, ausschließlich anonyme Standort-Ereignisse verwenden denselben Guard.
  window.gtag = function () {
    if (allowed() && !window['ga-disable-' + GA]) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(arguments);
    }
  };
  function eraseCookies() {
    const domains = ['', location.hostname, '.' + location.hostname, 'boda-snacks.de', '.boda-snacks.de'];
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (/^(_ga(?:_|$)|_gid$|_gat)/.test(name)) {
        domains.forEach(domain => {
          document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '') + '; SameSite=Lax';
        });
      }
    });
  }
  function off() {
    // Laut Google unterbindet dieses Flag auch Aufrufe des bereits geladenen Tags.
    window['ga-disable-' + GA] = true;
    eraseCookies();
    // Kein Reload: bereits eingegebene Formularangaben bleiben erhalten.
  }
  function on() {
    if (!allowed()) { off(); return; }
    window['ga-disable-' + GA] = false;
    if (!configured) {
      configured = true;
      window.gtag('js', new Date());
      window.gtag('config', GA, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_domain: 'none',
        cookie_flags: 'SameSite=Lax;Secure',
        page_location: cleanURL(location.href),
        page_referrer: cleanURL(document.referrer),
        send_page_view: true
      });
    }
    if (!scriptLoading && !document.getElementById('boda-analytics')) {
      scriptLoading = true;
      const script = document.createElement('script');
      script.id = 'boda-analytics'; script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
      script.onerror = () => { scriptLoading = false; script.remove(); };
      document.head.appendChild(script);
    }
  }
  function show(visible, focus = false) {
    if (!panel) return;
    panel.hidden = !visible;
    panel.style.display = visible ? 'block' : 'none';
    panel.classList.toggle('open', visible);
    if (settings) settings.setAttribute('aria-expanded', String(visible));
    if (close) close.hidden = !state;
    if (visible && focus && decline) decline.focus();
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!state) return;
    expiryTimer = setTimeout(() => {
      if (!normalize(state)) { state = null; persist(null); off(); show(true); }
      else scheduleExpiry();
    }, Math.min(Math.max(1, state.at + MAX_AGE - Date.now()), 2147483647));
  }
  function apply() {
    if (allowed()) on(); else off();
    scheduleExpiry();
    window.dispatchEvent(new CustomEvent('boda:consent', { detail: { analytics: allowed() } }));
  }
  function choose(analytics) {
    state = { analytics, at: Date.now(), version: 3 };
    persist(state); show(false); apply();
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function open(event) {
    if (event) event.preventDefault();
    returnFocus = event?.currentTarget || settings || document.activeElement;
    show(true, true);
  }
  window.BodaConsent = Object.freeze({
    hasAnalyticsConsent: allowed,
    open,
    // Nur vordefinierte Parameter; niemals Formulardaten oder vollständige Kontakt-URLs.
    track(name, params) {
      if (!allowed()) return false;
      const supported = ['form_submit_attempt', 'form_success_redirect'];
      if (!supported.includes(name)) return false;
      window.gtag('event', name, { form_id: params?.form_id === 'hotelshop' ? 'hotelshop' : 'standort' });
      return true;
    }
  });
  function init() {
    panel = document.querySelector('#cookie-panel, #boda-cookie-panel, #cookie-banner, #cookieBanner, #cookie, #consent');
    settings = document.querySelector('#cookie-settings, #boda-cookie-settings, #cookieSettings, #cookieSettingsButton, #privacy-settings');
    accept = document.querySelector('#cookie-accept, #boda-cookie-accept, #cookieAccept, #cookie-yes, #yes-analytics');
    decline = document.querySelector('#cookie-decline, #boda-cookie-decline, #cookieDecline, #cookie-no, #no-analytics');
    close = document.getElementById('cookie-close');
    if (!panel || !accept || !decline) { off(); return; }
    panel.dataset.bodaConsentPanel = '';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Datenschutzeinstellungen');
    panel.setAttribute('aria-modal', 'false');
    if (settings) {
      settings.hidden = false;
      settings.setAttribute('aria-controls', panel.id);
      settings.addEventListener('click', open);
    }
    accept.addEventListener('click', () => choose(true));
    decline.addEventListener('click', () => choose(false));
    if (close) close.addEventListener('click', () => {
      show(false); (returnFocus || settings)?.focus(); returnFocus = null;
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state) {
        show(false); (returnFocus || settings)?.focus(); returnFocus = null;
      }
    });
    let old = null;
    try { old = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    state = normalize(old);
    if (old?.version !== 3) eraseCookies(); // vorhandene Domain-Cookies bei Umstellung auf Host-Cookies entfernen
    persist(state);
    show(!state);
    apply();
    window.addEventListener('storage', event => {
      if (event.key === KEY || event.key === null) {
        state = read(); show(!state); apply();
      }
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) { state = read(); show(!state); apply(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state && !normalize(state)) {
        state = null; persist(null); show(true); apply();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
