/* BODA Hotelanfrage. Native POST/Captcha bleiben beim bestehenden Formulardienst.
   Keine Anfrage wird durch dieses Skript automatisch versendet. */
(() => {
  'use strict';
  const KEY = 'boda-hotel-submit-v1';
  const MAX_AGE = 2 * 60 * 60 * 1000;
  const preview = location.protocol === 'file:' || document.documentElement.dataset.preview === 'true';
  const form = document.getElementById('hotelshop-anfrage');
  const NEXT = form?.elements.namedItem('_next')?.value || 'https://boda-snacks.de/hotelshop-danke.html';
  if (form) {
    const button = form.querySelector('[type="submit"]');
    const status = document.getElementById('hotel-form-status');
    const next = form.elements.namedItem('_next');
    let busy = false, timer;
    const label = button.textContent;
    function reset() {
      clearTimeout(timer); busy = false; button.disabled = false;
      button.textContent = label; form.removeAttribute('aria-busy');
    }
    form.addEventListener('submit', event => {
      if (busy) { event.preventDefault(); return; }
      if (!form.reportValidity()) { event.preventDefault(); return; }
      if (preview) {
        event.preventDefault(); status.hidden = false;
        status.textContent = 'Vorschau: Die Angaben sind vollständig. Es wurde keine Anfrage versendet.';
        return;
      }
      // Nur ein zufälliger Rückkehrnachweis und Zeitpunkt, keine Formulardaten.
      try {
        const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
        const token = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
        next.value = NEXT + '#boda-' + token;
      } catch (_) { next.value = NEXT; }
      window.BodaConsent?.track('form_submit_attempt', { form_id: 'hotelshop' });
      busy = true; button.disabled = true; button.textContent = 'Weiter zur Sicherheitsprüfung …';
      form.setAttribute('aria-busy', 'true');
      status.hidden = false;
      status.textContent = 'Ihre Anfrage wird an den Formulardienst übergeben. Bitte schließen Sie gegebenenfalls dessen Sicherheitsprüfung ab.';
      timer = setTimeout(() => {
        reset();
        status.textContent = 'Falls keine Weiterleitung erfolgt ist, prüfen Sie Ihre Verbindung. Sie können erneut absenden oder uns unter 0177 6901863 erreichen.';
      }, 20000);
      // Kein preventDefault: Der Browser übermittelt an die vorhandene FormSubmit-Adresse.
    });
    window.addEventListener('pageshow', () => { reset(); status.hidden = true; });
  }
  const receipt = document.querySelector('[data-boda-hotel-receipt]');
  if (receipt) {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem(KEY)); } catch (_) {}
    const token = location.hash.match(/^#boda-([a-f0-9]{32})$/)?.[1];
    const age = pending ? Date.now() - pending.at : -1;
    const valid = !!token && token === pending?.token && Number.isFinite(age) && age >= 0 && age < MAX_AGE;
    if (valid) {
      try { sessionStorage.removeItem(KEY); } catch (_) {}
      receipt.querySelector('[data-receipt-heading]').textContent = 'Vielen Dank für Ihre Hotelshop-Anfrage.';
      receipt.querySelector('[data-receipt-message]').textContent = 'Sie sind nach der Übermittlung vom Formulardienst zurückgekehrt. BODA Snacks prüft Ihre Angaben und meldet sich persönlich bei Ihnen. Wenn Sie etwas ergänzen möchten, erreichen Sie uns direkt über die folgenden Kontaktwege.';
      // Rückkehr vom Dienst ist kein Nachweis der Zustellung ins BODA-Postfach.
      window.BodaConsent?.track('form_success_redirect', { form_id: 'hotelshop' });
    }
    // Zufälligen Token auch vor möglicher späterer Analytics-Zustimmung entfernen.
    if (token) history.replaceState(null, '', location.pathname + location.search);
  }
})();
