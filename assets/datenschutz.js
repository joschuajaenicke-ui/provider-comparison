/* Setzt das Datum des Datenstands in die Fußzeile. */
(async () => {
  try {
    const res = await fetch('data/models.json', { cache: 'no-cache' });
    const data = await res.json();
    const stamp = (data.generated_at || '').replace('T', ' ').replace('Z', ' UTC');
    document.getElementById('stand').textContent = stamp || 'unbekannt';
  } catch (e) {
    document.getElementById('stand').textContent = 'unbekannt';
  }
})();
