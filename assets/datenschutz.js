/* Datenschutzseite: Sprache setzen und den Datenstand aus data/models.json zeigen.
   Kein Netzzugriff außer auf die eigene Datei — die CSP erlaubt nichts anderes. */
(() => {
  'use strict';

  const LS_LANG = 'pc.lang.v1';

  function detect() {
    const param = new URLSearchParams(location.search).get('lang');
    if (param === 'de' || param === 'en') return param;
    try {
      const saved = localStorage.getItem(LS_LANG);
      if (saved === 'de' || saved === 'en') return saved;
    } catch (e) { /* gesperrt */ }
    return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.title = lang === 'de'
      ? 'Datenschutz — Provider-Vergleich'
      : 'Privacy — Provider Comparison';
    document.querySelectorAll('.lang-switch button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  async function main() {
    applyLang(detect());

    document.querySelectorAll('.lang-switch button').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        try { localStorage.setItem(LS_LANG, next); } catch (e) { /* gesperrt */ }
        location.search = '?lang=' + next;
      });
    });

    let stamp = '—';
    try {
      const res = await fetch('data/models.json', { cache: 'no-cache' });
      const data = await res.json();
      stamp = (data.generated_at || '').replace('T', ' ').replace('Z', ' UTC') || '—';
    } catch (e) { /* bleibt bei — */ }

    const de = document.getElementById('stand');
    const en = document.getElementById('standEn');
    if (de) de.textContent = stamp;
    if (en) en.textContent = stamp;
  }

  document.addEventListener('DOMContentLoaded', main);
})();
