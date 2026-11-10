/* ==========================================================================
   Provider-Vergleich — Anwendungslogik
   Reine Browser-Anwendung: lädt data/models.json, rechnet im Tab, sendet nichts.
   Aufbau: Konstanten · Zustand · Formatierung · Kostenrechnung · Tabelle ·
           Grafik · Modellsuche · CSV · Filterliste · Start
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------------------------------------------------------------- Konstanten */

  // Farbe je Quantisierungsstufe. Reihenfolge = Legende; unbekannte Stufen
  // bekommen der Reihe nach eine Restfarbe, damit nie zwei gleich aussehen.
  const QUANT_COLORS = {
    fp4: '#2563eb',
    fp8: '#0d9488',
    nvfp4: '#7c3aed',
    mxfp4: '#c2410c',
    fp16: '#0369a1',
    bf16: '#4d7c0f',
    fp32: '#9f1239',
    int8: '#a16207',
    int4: '#be185d',
    unknown: '#8b929b',
  };

  const QUANT_LABEL = {
    fp4: 'fp4 — 4 Bit, klein und schnell',
    fp8: 'fp8 — 8 Bit, guter Kompromiss',
    nvfp4: 'nvfp4 — 4 Bit (NVIDIA-Format)',
    mxfp4: 'mxfp4 — 4 Bit (Microscaling)',
    fp16: 'fp16 — 16 Bit',
    bf16: 'bf16 — 16 Bit (Brain-Float)',
    fp32: 'fp32 — 32 Bit, volle Genauigkeit',
    unknown: 'unbekannt — Anbieter macht keine Angabe',
  };

  const COLUMNS = [
    { key: 'provider', label: 'Anbieter', align: 'left', always: true,
      tip: 'Wer den Endpoint betreibt. Ein Anbieter kann dasselbe Modell in mehreren Varianten führen — jede Variante ist eine eigene Zeile.' },
    { key: 'quant', label: 'Quant', group: 'price',
      tip: 'Quantisierungsstufe: wie stark das Modell für den Anbieter komprimiert wurde. Kleiner heißt meist schneller und günstiger, kann aber Qualität kosten.' },
    { key: 'in', label: 'Input $/Mio', group: 'price',
      tip: 'Listenpreis für 1 Mio. Input-Token, die nicht aus dem Cache kommen.' },
    { key: 'out', label: 'Output $/Mio', group: 'price',
      tip: 'Listenpreis für 1 Mio. erzeugte Token.' },
    { key: 'cache', label: 'Cache $/Mio', group: 'price',
      tip: 'Preis für 1 Mio. Token aus dem Prompt-Cache. „—“ bedeutet: kein Cache-Tarif, Cache-Token kosten dann den vollen Input-Preis.' },
    { key: 'proj', label: 'Kosten', group: 'price', dynamic: true,
      tip: 'Hochgerechnet auf dein Kostenmodell: Tokenprofil pro Call × Preise dieses Endpoints. Unabhängig davon, wie viele Calls im Log stehen.' },
    { key: 'projIn', label: 'davon Input', group: 'split',
      tip: 'Anteil der hochgerechneten Kosten, der auf Input-Token ohne Cache entfällt.' },
    { key: 'projCache', label: 'davon Cache', group: 'split',
      tip: 'Anteil der hochgerechneten Kosten, der auf Cache-Lesevorgänge entfällt.' },
    { key: 'projOut', label: 'davon Output', group: 'split',
      tip: 'Anteil der hochgerechneten Kosten, der auf erzeugte Token entfällt.' },
    { key: 'ctx', label: 'Kontext', group: 'perf',
      tip: 'Maximale Kontextlänge dieses Endpoints in Token. Kleiner als beim Modell bedeutet: lange Prompts passen hier nicht.' },
    { key: 'toks', label: 'tok/s', group: 'perf',
      tip: 'Median-Durchsatz der letzten 30 Minuten: erzeugte Token pro Sekunde. Median statt Mittelwert, damit einzelne Ausreißer die Zahl nicht verzerren.' },
    { key: 'ttft', label: 'TTFT', group: 'perf',
      tip: 'Time to First Token, Median der letzten 30 Minuten: wie lange es dauert, bis das erste Token ankommt. Entscheidend für gefühlte Latenz.' },
    { key: 'uptime', label: 'Uptime', group: 'perf',
      tip: 'Anteil erfolgreicher Anfragen in den letzten 30 Minuten, gemessen von OpenRouter.' },
    { key: 'hit', label: 'Cache-Quote', group: 'perf',
      tip: 'Anteil des Inputs, der in der letzten Woche aus dem Cache kam. Je höher, desto stärker senkt der Cache-Preis die Kosten — wenn der Endpoint einen Cache-Tarif hat.' },
    { key: 'discount', label: 'Rabatt', group: 'more',
      tip: 'Rabatt, den OpenRouter auf den Listenpreis dieses Endpoints gibt.' },
    { key: 'maxOut', label: 'Max Output', group: 'more',
      tip: 'Maximal erzeugbare Token pro Anfrage laut Endpoint-Angabe.' },
  ];

  const COL_PRESETS = {
    value: ['provider', 'quant', 'in', 'out', 'cache', 'proj', 'toks', 'ttft', 'uptime'],
    price: ['provider', 'quant', 'in', 'out', 'cache', 'proj'],
    perf: ['provider', 'quant', 'ctx', 'toks', 'ttft', 'uptime', 'hit'],
    compact: ['provider', 'quant', 'proj', 'toks'],
    all: COLUMNS.map(c => c.key),
  };

  // Spalten, die ohne gespeicherte Wahl sichtbar sind
  const DEFAULT_COLS = COL_PRESETS.value;

  const METRICS = [
    { key: 'proj', label: 'Kosten (Kostenmodell)', unit: 'usd', log: true },
    { key: 'in', label: 'Input-Preis $/Mio', unit: 'usd', log: true },
    { key: 'out', label: 'Output-Preis $/Mio', unit: 'usd', log: true },
    { key: 'cache', label: 'Cache-Preis $/Mio', unit: 'usd', log: true },
    { key: 'toks', label: 'Durchsatz tok/s', unit: 'toks', log: false },
    { key: 'ttft', label: 'TTFT (ms)', unit: 'ms', log: false },
    { key: 'uptime', label: 'Uptime (%)', unit: 'pct', log: false },
    { key: 'hit', label: 'Cache-Quote (%)', unit: 'pct', log: false },
    { key: 'ctx', label: 'Kontext (Token)', unit: 'ctx', log: true },
    { key: 'discount', label: 'Rabatt (%)', unit: 'pct100', log: false },
  ];

  const PRESETS = [
    { id: 'value', label: 'Preis/Leistung', x: 'proj', y: 'toks', cols: 'value', sort: 'proj', dir: 1 },
    { id: 'latency', label: 'Latenz', x: 'ttft', y: 'toks', cols: 'perf', sort: 'ttft', dir: 1 },
    { id: 'reliable', label: 'Zuverlässigkeit', x: 'uptime', y: 'ttft', cols: 'perf', sort: 'uptime', dir: -1 },
    { id: 'cache', label: 'Cache-Nutzen', x: 'cache', y: 'hit', cols: 'price', sort: 'cache', dir: 1 },
    { id: 'context', label: 'Kontext', x: 'ctx', y: 'in', cols: 'compact', sort: 'ctx', dir: -1 },
    { id: 'all', label: 'Alles zeigen', x: 'proj', y: 'toks', cols: 'all', sort: 'proj', dir: 1 },
  ];

  const LS = {
    theme: 'pc.theme.v1',
    model: 'pc.model.v1',
    cost: 'pc.cost.v1',
    cols: 'pc.cols.v1',
    axes: 'pc.axes.v1',
  };

  /* ------------------------------------------------------------------- Zustand */

  const state = {
    data: null,
    modelId: null,
    sort: { key: 'proj', dir: 1 },
    hidden: new Set(),
    axes: { x: 'proj', y: 'toks', logX: true, logY: false },
    preset: 'value',
    cost: { calls: 1000, prompt: 2000, completion: 500, cacheMode: 'provider' },
    profile: null,          // aus CSV: { calls, prompt, completion, logHit, logged, hasCost, models, from, to }
    rules: { toks: 0, ttft: 5000, uptime: 0 },
    linked: null,           // hervorgehobener Endpoint (Tabelle <-> Grafik)
  };

  /* -------------------------------------------------------------- Formatierung */

  const nfInt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

  const deInt = v => (v == null || Number.isNaN(v)) ? '—' : nfInt.format(v);

  function deNum(v, d = 1) {
    if (v == null || Number.isNaN(v)) return '—';
    return v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtPrice(v) {
    if (v == null) return '—';
    const d = v === 0 ? 0 : v < 0.01 ? 4 : v < 0.1 ? 3 : v < 10 ? 2 : 1;
    return '$' + v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtMs(v) {
    if (v == null) return '—';
    return v >= 1000 ? deNum(v / 1000, 1) + ' s' : deInt(v) + ' ms';
  }

  function fmtCtx(v) {
    if (v == null) return '—';
    if (v >= 1_000_000) return deNum(v / 1_000_000, v >= 10_000_000 ? 0 : 1) + ' Mio';
    return deInt(Math.round(v / 1000)) + ' k';
  }

  function fmtPct(v, d = 1) {
    return v == null ? '—' : deNum(v, d) + ' %';
  }

  function fmtDiscount(v) {
    return !v ? '—' : deNum(v * 100, 0) + ' %';
  }

  const metricByKey = key => METRICS.find(m => m.key === key) || METRICS[0];

  // Achsenbeschriftung; die Kostenspalte nennt die Bezugsgröße mit
  function metricLabel(key) {
    if (key === 'proj') return `Kosten je ${deInt(costBase())} Calls`;
    return metricByKey(key).label;
  }

  function fmtMetric(key, v) {
    const m = metricByKey(key);
    switch (m.unit) {
      case 'usd': return fmtPrice(v);
      case 'toks': return v == null ? '—' : deInt(v) + ' tok/s';
      case 'ms': return fmtMs(v);
      case 'pct': return fmtPct(v);
      case 'pct100': return v == null ? '—' : deNum(v * 100, 0) + ' %';
      case 'ctx': return fmtCtx(v);
      default: return String(v);
    }
  }

  function fmtAxis(key, v) {
    const m = metricByKey(key);
    switch (m.unit) {
      case 'usd':
        if (v === 0) return '$0';
        if (v < 0.01) return '$' + v.toFixed(4).replace('.', ',');
        if (v < 1) return '$' + v.toFixed(2).replace('.', ',');
        if (v < 100) return '$' + (v < 10 ? v.toFixed(1) : Math.round(v)).toString().replace('.', ',');
        return '$' + deInt(v);
      case 'toks': return deInt(v);
      case 'ms': return v >= 1000 ? deNum(v / 1000, 1) + 's' : deInt(v);
      case 'pct': return deInt(v);
      case 'pct100': return deInt(v * 100);
      case 'ctx': return fmtCtx(v);
      default: return String(v);
    }
  }

  function quantColor(q) {
    return QUANT_COLORS[(q || 'unknown').toLowerCase()] || QUANT_COLORS.unknown;
  }

  // Gleiche Farbe als CSS-Klasse (CSP erlaubt keine Inline-Styles)
  function quantClass(q) {
    const key = (q || 'unknown').toLowerCase();
    return 'qdot q-' + (QUANT_COLORS[key] ? key : 'unknown');
  }

  /* ---------------------------------------------------------- Kostenrechnung */

  // Tokenprofil pro Call: entweder aus dem Kostenmodell oder aus der CSV.
  function profile() {
    if (state.profile) {
      return {
        prompt: state.profile.prompt,
        completion: state.profile.completion,
        logHit: state.profile.logHit,
        source: 'csv',
      };
    }
    const c = Math.max(1, state.cost.calls || 1);
    return {
      prompt: Math.max(0, state.cost.prompt || 0),
      completion: Math.max(0, state.cost.completion || 0),
      logHit: null,
      source: 'manual',
    };
  }

  // Cache-Anteil, mit dem für diesen Endpoint gerechnet wird (0–100).
  function cacheHitFor(ep, prof) {
    if (state.cost.cacheMode === 'none') return 0;
    if (state.cost.cacheMode === 'log') return prof.logHit == null ? 0 : prof.logHit;
    // je Anbieter: gemeldete Quote, sonst Log-Quote, sonst 0
    if (ep.hit != null) return ep.hit;
    return prof.logHit == null ? 0 : prof.logHit;
  }

  // Kosten für n Calls an diesem Endpoint, aufgeschlüsselt.
  function costFor(ep, prof, calls) {
    const hit = Math.max(0, Math.min(100, cacheHitFor(ep, prof))) / 100;
    const cached = prof.prompt * hit;
    const fresh = prof.prompt - cached;
    const priceCache = ep.cache == null ? ep.in : ep.cache;
    const inCost = (fresh * (ep.in ?? 0)) / 1e6;
    const cacheCost = (cached * (priceCache ?? 0)) / 1e6;
    const outCost = (prof.completion * (ep.out ?? 0)) / 1e6;
    const perCall = inCost + cacheCost + outCost;
    return {
      total: perCall * calls,
      input: inCost * calls,
      cache: cacheCost * calls,
      output: outCost * calls,
      perCall,
      hit: hit * 100,
    };
  }

  function callCount() {
    return state.profile ? Math.max(1, state.profile.calls) : Math.max(1, state.cost.calls || 1);
  }

  // Bezugsgröße der Kostenspalte: bei CSV-Logs die echten Calls, sonst das Modell.
  function costBase() {
    return state.profile ? state.profile.calls : Math.max(1, state.cost.calls || 1);
  }

  /* --------------------------------------------------------------- Datenzugriff */

  function currentModel() {
    if (!state.data) return null;
    return state.data.models.find(m => m.id === state.modelId) || null;
  }

  function rows() {
    const m = currentModel();
    if (!m) return [];
    const prof = profile();
    const calls = callCount();
    const perProvider = new Map();
    for (const ep of m.endpoints) perProvider.set(ep.provider, (perProvider.get(ep.provider) || 0) + 1);

    return m.endpoints.map((ep, i) => {
      const c = costFor(ep, prof, calls);
      return {
        ...ep,
        _i: i,
        _cost: c,
        _proj: c.total,
        _projIn: c.input,
        _projCache: c.cache,
        _projOut: c.output,
        _hitUsed: c.hit,
        _multiProvider: (perProvider.get(ep.provider) || 0) > 1,
      };
    });
  }

  function sortValue(row, key) {
    switch (key) {
      case 'proj': return row._proj;
      case 'projIn': return row._projIn;
      case 'projCache': return row._projCache;
      case 'projOut': return row._projOut;
      case 'provider': return row.provider.toLowerCase();
      default: return row[key];
    }
  }

  function sortedRows() {
    const list = rows().slice();
    const { key, dir } = state.sort;
    list.sort((a, b) => {
      const x = sortValue(a, key), y = sortValue(b, key);
      if (x == null && y == null) return a.provider.localeCompare(b.provider, 'de');
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'string') return x.localeCompare(y, 'de') * dir;
      return (x - y) * dir;
    });
    return list;
  }

  /* ------------------------------------------------------------------- Tabelle */

  function visibleColumns() {
    return COLUMNS.filter(c => c.always || !state.hidden.has(c.key));
  }

  function columnLabel(col) {
    if (col.key === 'proj') return `Kosten / ${deInt(costBase())} Calls`;
    return col.label;
  }

  function cellValue(row, key) {
    switch (key) {
      case 'quant':
        return `<span class="${quantClass(row.quant)}"></span>${row.quant === 'unknown' ? '<span class="dim">k. A.</span>' : escapeHtml(row.quant)}`;
      case 'in': return fmtPrice(row.in);
      case 'out': return fmtPrice(row.out);
      case 'cache': return row.cache == null ? '<span class="dim">—</span>' : fmtPrice(row.cache);
      case 'proj': return `<span class="num-strong">${fmtPrice(row._proj)}</span>`;
      case 'projIn': return `<span class="dim">${fmtPrice(row._projIn)}</span>`;
      case 'projCache': return `<span class="dim">${fmtPrice(row._projCache)}</span>`;
      case 'projOut': return `<span class="dim">${fmtPrice(row._projOut)}</span>`;
      case 'ctx': return fmtCtx(row.ctx);
      case 'toks': return row.toks == null ? '<span class="dim">—</span>' : deInt(row.toks);
      case 'ttft': return row.ttft == null ? '<span class="dim">—</span>' : fmtMs(row.ttft);
      case 'uptime': {
        if (row.uptime == null) return '<span class="dim">—</span>';
        const cls = row.uptime >= 99 ? '' : row.uptime >= 95 ? 'class="dim"' : 'class="neg"';
        return `<span ${cls}>${fmtPct(row.uptime)}</span>`;
      }
      case 'hit': return row.hit == null ? '<span class="dim">—</span>' : fmtPct(row.hit);
      case 'discount': return fmtDiscount(row.discount);
      case 'maxOut': return row.maxOut == null ? '<span class="dim">—</span>' : fmtCtx(row.maxOut);
      default: return '';
    }
  }

  function renderHead() {
    const thead = $('#tbl thead');
    const cols = visibleColumns();
    thead.innerHTML = '<tr>' + cols.map(col => {
      const active = state.sort.key === col.key;
      const aria = active ? `aria-sort="${state.sort.dir === 1 ? 'ascending' : 'descending'}"` : '';
      const ind = active ? `<span class="sort-ind">${state.sort.dir === 1 ? '▲' : '▼'}</span>` : '';
      return `<th ${aria}><button type="button" data-key="${col.key}" data-tip="${escapeAttr(col.tip)}">${escapeHtml(columnLabel(col))}${ind}</button></th>`;
    }).join('') + '</tr>';

    $$('#tbl thead button').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (state.sort.key === key) state.sort.dir *= -1;
        else state.sort = { key, dir: key === 'provider' ? 1 : 1 };
        render();
      });
    });
    bindTips($('#tbl thead'));
  }

  function renderBody() {
    const tbody = $('#tbl tbody');
    const cols = visibleColumns();
    const list = sortedRows();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length}" class="dim is-left">Keine Anbieter für dieses Modell.</td></tr>`;
      return;
    }

    const cheapest = Math.min(...list.map(r => r._proj));
    const fastest = Math.max(...list.map(r => r.toks ?? -Infinity));

    tbody.innerHTML = list.map(row => {
      const cls = [
        row.status !== 0 ? 'is-degraded' : '',
        state.linked === row.tag ? 'is-linked' : '',
      ].filter(Boolean).join(' ');

      const cells = cols.map(col => {
        if (col.key === 'provider') {
          const badges = [];
          if (row.toks != null && row.toks === fastest) badges.push('<span class="badge badge--good">schnellste</span>');
          if (row._proj === cheapest) badges.push('<span class="badge badge--good">günstigste</span>');
          if (row.status !== 0) badges.push('<span class="badge badge--bad">degradiert</span>');
          if (state.profile && state.profile.provs && state.profile.provs[row.provider]) {
            badges.push('<span class="badge">im Log</span>');
          }
          const sub = row.tag && row._multiProvider
            ? `<div class="cell-sub">${escapeHtml(row.tag)}</div>` : '';
          return `<td><div class="cell-provider">${escapeHtml(row.provider)}${badges.join('')}</div>${sub}</td>`;
        }
        return `<td>${cellValue(row, col.key)}</td>`;
      }).join('');

      return `<tr class="${cls}" data-tag="${escapeAttr(row.tag)}" data-i="${row._i}">${cells}</tr>`;
    }).join('');

    $$('#tbl tbody tr').forEach(tr => {
      tr.addEventListener('pointerenter', () => linkRow(tr.dataset.tag));
      tr.addEventListener('pointerleave', () => linkRow(null));
    });
  }

  function renderChips() {
    const box = $('#colChips');
    box.innerHTML = COLUMNS.filter(c => !c.always).map(col => {
      const on = !state.hidden.has(col.key);
      return `<button class="colchip" type="button" data-key="${col.key}" aria-pressed="${on}">${escapeHtml(col.label)}</button>`;
    }).join('');
    $$('#colChips .colchip').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (state.hidden.has(key)) state.hidden.delete(key); else state.hidden.add(key);
        saveCols();
        render();
      });
    });
  }

  function renderTableNote() {
    const m = currentModel();
    const list = rows();
    const degraded = list.filter(r => r.status !== 0).length;
    const missing = list.filter(r => r.toks == null && r.ttft == null).length;
    const parts = [`${list.length} Endpoints`, `${new Set(list.map(r => r.provider)).size} Anbieter`];
    if (degraded) parts.push(`${degraded} degradiert`);
    if (missing) parts.push(`${missing} ohne Messwerte`);
    parts.push(`Preise: ${fmtPrice(list.length ? Math.min(...list.map(r => r.out ?? Infinity)) : null)}–${fmtPrice(list.length ? Math.max(...list.map(r => r.out ?? 0)) : null)} Output`);
    $('#tableNote').textContent = parts.join(' · ');
    if (m) $('#modelHint').textContent = `${m.id} · ${fmtCtx(m.ctx)} Kontext · ${m.outputs ? m.outputs.join('/') : '?'} als Ausgabe`;
  }

  function linkRow(tag) {
    if (state.linked === tag) return;
    state.linked = tag;
    $$('#tbl tbody tr').forEach(tr => tr.classList.toggle('is-linked', tr.dataset.tag === tag));
    $$('#chart .point').forEach(g => {
      const on = g.dataset.tag === tag;
      g.classList.toggle('is-linked', on);
      const c = g.querySelector('circle.dot');
      if (c) c.setAttribute('r', on ? (+c.dataset.r + 2.5) : c.dataset.r);
    });
  }

  /* -------------------------------------------------------------------- Grafik */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CH = { w: 980, h: 420, l: 66, r: 22, t: 18, b: 54 };

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function niceStep(raw) {
    const exp = Math.floor(Math.log10(raw));
    const base = Math.pow(10, exp);
    const f = raw / base;
    const mult = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return mult * base;
  }

  function linearTicks(lo, hi, count = 5) {
    if (!(hi > lo)) return [lo];
    const step = niceStep((hi - lo) / count);
    const start = Math.ceil(lo / step) * step;
    const out = [];
    for (let v = start; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function logTicks(lo, hi) {
    const l0 = Math.floor(Math.log10(Math.max(lo, 1e-9)));
    const l1 = Math.ceil(Math.log10(Math.max(hi, 1e-9)));
    const span = l1 - l0;
    const out = [];
    if (span <= 6) {
      for (let e = l0; e <= l1; e++) out.push(Math.pow(10, e));
    } else {
      for (let e = l0; e <= l1; e += Math.ceil(span / 6)) out.push(Math.pow(10, e));
    }
    const inside = out.filter(v => v >= lo * 0.999 && v <= hi * 1.001);
    // Deckt der Wertebereich weniger als zwei Dekaden ab, sind Zehnerpotenzen
    // zu grob — dann lineare Zwischenschritte auf der logarithmischen Achse.
    if (inside.length < 3) return linearTicks(lo, hi, 5).filter(v => v > 0);
    return inside;
  }

  function scaleFactory(lo, hi, isLog, pxLo, pxHi) {
    const safe = v => Math.max(v, 1e-9);
    if (isLog) {
      const a = Math.log10(safe(lo)), b = Math.log10(safe(hi));
      const span = (b - a) || 1;
      return v => pxLo + ((Math.log10(safe(v)) - a) / span) * (pxHi - pxLo);
    }
    const span = (hi - lo) || 1;
    return v => pxLo + ((v - lo) / span) * (pxHi - pxLo);
  }

  function renderChart() {
    const svg = $('#chart');
    svg.innerHTML = `<title id="chartTitle">Streudiagramm der Anbieter</title>`;
    const list = rows().filter(r => r.toks != null || r._proj != null);
    const { x: xk, y: yk, logX, logY } = state.axes;
    const xm = metricByKey(xk), ym = metricByKey(yk);

    const pts = list
      .map(r => ({ r, x: sortValue(r, xk), y: sortValue(r, yk) }))
      .filter(p => p.x != null && p.y != null && (!logX || p.x > 0) && (!logY || p.y > 0));

    const skipped = list.length - pts.length;

    if (!pts.length) {
      svg.append(svgEl('text', {
        x: CH.w / 2, y: CH.h / 2, 'text-anchor': 'middle', class: 'axis-label',
      })).textContent = 'Für diese Achsenkombination liegen keine Messwerte vor.';
      $('#chartNote').textContent = '';
      renderLegend([]);
      return;
    }

    let xlo = Math.min(...pts.map(p => p.x)), xhi = Math.max(...pts.map(p => p.x));
    let ylo = Math.min(...pts.map(p => p.y)), yhi = Math.max(...pts.map(p => p.y));
    if (xhi === xlo) { xlo *= 0.9; xhi = xhi * 1.1 || 1; }
    if (yhi === ylo) { ylo *= 0.9; yhi = yhi * 1.1 || 1; }
    if (logX) { xlo /= 1.25; xhi *= 1.25; } else { const p = (xhi - xlo) * 0.06; xlo -= p; xhi += p; }
    if (logY) { ylo /= 1.25; yhi *= 1.25; } else { const p = (yhi - ylo) * 0.08; ylo -= p; yhi += p; }
    if (logX) xlo = Math.max(xlo, 1e-9);
    if (logY) ylo = Math.max(ylo, 1e-9);

    const X = scaleFactory(xlo, xhi, logX, CH.l, CH.w - CH.r);
    const Y = scaleFactory(ylo, yhi, logY, CH.h - CH.b, CH.t);

    const g = svgEl('g');
    svg.append(g);

    // Gitter + Achsen
    const xt = logX ? logTicks(xlo, xhi) : linearTicks(xlo, xhi, 6);
    const yt = logY ? logTicks(ylo, yhi) : linearTicks(ylo, yhi, 6);

    for (const v of yt) {
      const y = Y(v);
      g.append(svgEl('line', { x1: CH.l, y1: y, x2: CH.w - CH.r, y2: y, class: 'grid-line' }));
      const t = svgEl('text', { x: CH.l - 8, y: y + 3.5, 'text-anchor': 'end', class: 'tick-label' });
      t.textContent = fmtAxis(yk, v);
      g.append(t);
    }
    for (const v of xt) {
      const x = X(v);
      g.append(svgEl('line', { x1: x, y1: CH.t, x2: x, y2: CH.h - CH.b, class: 'grid-line' }));
      const t = svgEl('text', { x, y: CH.h - CH.b + 17, 'text-anchor': 'middle', class: 'tick-label' });
      t.textContent = fmtAxis(xk, v);
      g.append(t);
    }

    // Achsenrahmen
    g.append(svgEl('line', { x1: CH.l, y1: CH.h - CH.b, x2: CH.w - CH.r, y2: CH.h - CH.b, class: 'grid-line grid-line--base' }));
    g.append(svgEl('line', { x1: CH.l, y1: CH.t, x2: CH.l, y2: CH.h - CH.b, class: 'grid-line grid-line--base' }));

    // Achsentitel
    const xl = svgEl('text', { x: (CH.l + CH.w - CH.r) / 2, y: CH.h - 10, 'text-anchor': 'middle', class: 'axis-label' });
    xl.textContent = metricLabel(xk) + (logX ? ' · logarithmisch' : '');
    g.append(xl);
    const yl = svgEl('text', {
      x: 14, y: (CH.t + CH.h - CH.b) / 2, 'text-anchor': 'middle', class: 'axis-label',
      transform: `rotate(-90 14 ${(CH.t + CH.h - CH.b) / 2})`,
    });
    yl.textContent = metricLabel(yk) + (logY ? ' · logarithmisch' : '');
    g.append(yl);

    // Beschriftungsschwellen: 3 günstigste auf X, 2 schnellste auf Y
    const xsSorted = pts.map(p => p.x).sort((a, b) => a - b);
    const ysSorted = pts.map(p => p.y).sort((a, b) => b - a);
    const xCut = xsSorted[Math.min(2, xsSorted.length - 1)];
    const yCut = ysSorted[Math.min(1, ysSorted.length - 1)];

    // Punkte
    const ptsG = svgEl('g');
    g.append(ptsG);
    for (const p of pts) {
      const r = p.r;
      const cx = X(p.x), cy = Y(p.y);
      const rad = 4.5 + ((r.uptime ?? 50) / 100) * 6.5;
      const pg = svgEl('g', { class: 'point', 'data-tag': r.tag, tabindex: '0', role: 'listitem' });
      const dot = svgEl('circle', {
        cx, cy, r: rad, 'data-r': rad,
        fill: quantColor(r.quant), 'fill-opacity': 0.82,
        stroke: r.status !== 0 ? '#b3261e' : 'none',
        'stroke-width': r.status !== 0 ? 2 : 0,
      });
      dot.setAttribute('class', 'dot');
      pg.append(dot);

      // Beschriften: alle, wenn es wenige sind; sonst nur die Randpunkte
      const showLabel = pts.length <= 14 || p.x <= xCut || p.y >= yCut;
      if (showLabel) {
        const lbl = svgEl('text', { x: cx + rad + 5, y: cy + 3.5, class: 'tick-label point-label' });
        lbl.textContent = r.provider.length > 18 ? r.provider.slice(0, 17) + '…' : r.provider;
        pg.append(lbl);
      }

      pg.addEventListener('pointerenter', e => {
        showTip(e, r, xk, yk);
        linkRow(r.tag);
      });
      pg.addEventListener('pointermove', e => moveTip(e));
      pg.addEventListener('pointerleave', () => { hideTip(); linkRow(null); });
      pg.addEventListener('focus', () => { showTip({ clientX: cx, clientY: cy }, r, xk, yk); });
      pg.addEventListener('blur', hideTip);
      ptsG.append(pg);
    }

    const note = [];
    if (skipped) note.push(`${skipped} Punkt(e) ohne Wert für diese Achsen ausgeblendet`);
    if (state.axes.logX || state.axes.logY) note.push('logarithmische Achse: gleiche Abstände = gleicher Faktor');
    $('#chartNote').textContent = note.join(' · ');

    renderLegend(pts.map(p => p.r.quant));
  }

  function renderLegend(quants) {
    const box = $('#chartLegend');
    const uniq = [...new Set(quants.map(q => (q || 'unknown').toLowerCase()))].sort();
    const items = uniq.map(q =>
      `<span class="chart-legend__item"><span class="${quantClass(q)}"></span>${escapeHtml(q)}</span>`
    ).join('');
    const degraded = quants.length
      ? '<span class="chart-legend__item"><span class="qdot qdot--ring"></span>degradiert</span>'
      : '';
    box.innerHTML = items + degraded +
      `<span class="chart-legend__item chart-legend__note">Kreisgröße = Uptime · ${state.profile ? 'Kosten aus deinem Log' : 'Kosten aus dem Kostenmodell'}</span>`;
  }

  /* ------------------------------------------------------------------- Tooltip */

  const tipEl = () => $('#tip');

  function showTip(ev, row, xk, yk) {
    const tip = tipEl();
    const line = (k, v) => `<div class="tip-row"><span class="tip-k">${escapeHtml(k)}</span><span>${v}</span></div>`;
    tip.innerHTML =
      `<div><b>${escapeHtml(row.provider)}</b></div>` +
      (row.tag ? `<div class="tip-mono">${escapeHtml(row.tag)}</div>` : '') +
      line('Quant', escapeHtml(row.quant || 'k. A.')) +
      line(metricLabel(xk), fmtMetric(xk, sortValue(row, xk))) +
      line(metricLabel(yk), fmtMetric(yk, sortValue(row, yk))) +
      line('Input / Output', `${fmtPrice(row.in)} / ${fmtPrice(row.out)}`) +
      line('Cache', row.cache == null ? 'kein Tarif' : fmtPrice(row.cache)) +
      line('Kostenmodell', fmtPrice(row._proj)) +
      line('Cache-Quote', fmtPct(row._hitUsed)) +
      line('TTFT · tok/s', `${fmtMs(row.ttft)} · ${row.toks == null ? '—' : deInt(row.toks)}`) +
      line('Uptime', fmtPct(row.uptime)) +
      (row.status !== 0 ? '<div class="tip-row tip-bad">degradiert</div>' : '');
    tip.classList.add('is-on');
    tip.setAttribute('aria-hidden', 'false');
    moveTip(ev);
  }

  function moveTip(ev) {
    const tip = tipEl();
    const pad = 14;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = (ev.clientX ?? 0) + pad;
    let y = (ev.clientY ?? 0) + pad;
    if (x + w > window.innerWidth - 8) x = (ev.clientX ?? 0) - w - pad;
    if (y + h > window.innerHeight - 8) y = (ev.clientY ?? 0) - h - pad;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  function hideTip() {
    const tip = tipEl();
    tip.classList.remove('is-on');
    tip.setAttribute('aria-hidden', 'true');
  }

  // Tooltips für Tabellenköpfe und andere Elemente mit data-tip
  function bindTips(root) {
    $$('[data-tip]', root).forEach(el => {
      if (el.dataset.tipBound) return;
      el.dataset.tipBound = '1';
      el.addEventListener('pointerenter', e => {
        const tip = tipEl();
        tip.innerHTML = `<div>${escapeHtml(el.dataset.tip)}</div>`;
        tip.classList.add('is-on');
        moveTip(e);
      });
      el.addEventListener('pointermove', moveTip);
      el.addEventListener('pointerleave', hideTip);
      el.addEventListener('focus', e => {
        const tip = tipEl();
        tip.innerHTML = `<div>${escapeHtml(el.dataset.tip)}</div>`;
        tip.classList.add('is-on');
        const r = el.getBoundingClientRect();
        moveTip({ clientX: r.left + r.width / 2, clientY: r.bottom });
      });
      el.addEventListener('blur', hideTip);
    });
  }

  /* ------------------------------------------------------------------ Modellsuche */

  let pickerIndex = -1;
  let pickerResults = [];

  function searchModels(q) {
    const models = state.data ? state.data.models : [];
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return models
        .slice()
        .sort((a, b) => b.endpoints.length - a.endpoints.length)
        .slice(0, 60);
    }
    const scored = [];
    for (const m of models) {
      const id = m.id.toLowerCase();
      const name = (m.name || '').toLowerCase();
      let score = -1;
      if (id === needle || name === needle) score = 0;
      else if (id.startsWith(needle) || name.startsWith(needle)) score = 1;
      else if (id.includes(needle) || name.includes(needle)) score = 2;
      else if (subsequence(needle, id) || subsequence(needle, name)) score = 3;
      if (score >= 0) scored.push({ m, score });
    }
    scored.sort((a, b) => a.score - b.score || b.m.endpoints.length - a.m.endpoints.length);
    return scored.slice(0, 60).map(s => s.m);
  }

  function subsequence(needle, hay) {
    let i = 0;
    for (let j = 0; j < hay.length && i < needle.length; j++) {
      if (hay[j] === needle[i]) i++;
    }
    return i === needle.length;
  }

  function renderPicker(q) {
    const list = $('#modelList');
    pickerResults = searchModels(q);
    pickerIndex = pickerResults.length ? 0 : -1;
    if (!pickerResults.length) {
      list.innerHTML = '<div class="picker__empty">Kein Modell gefunden. Andere Schreibweise probieren — z. B. „claude“ statt „Claude 4“.</div>';
    } else {
      list.innerHTML = pickerResults.map((m, i) => {
        const minOut = Math.min(...m.endpoints.map(e => e.out ?? Infinity));
        return `<div class="picker__opt" role="option" id="opt-${i}" data-id="${escapeAttr(m.id)}" aria-selected="${i === pickerIndex}">
          <span class="picker__opt-name">${escapeHtml(m.name || m.id)}</span>
          <span class="picker__opt-meta">${m.endpoints.length} Anbieter<br>ab ${fmtPrice(isFinite(minOut) ? minOut : null)}/Mio</span>
          <span class="picker__opt-id">${escapeHtml(m.id)}</span>
        </div>`;
      }).join('');
    }
    list.hidden = false;
    $('#modelSearch').setAttribute('aria-expanded', 'true');
    $$('#modelList .picker__opt').forEach(el => {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        selectModel(el.dataset.id);
      });
    });
  }

  function closePicker() {
    $('#modelList').hidden = true;
    $('#modelSearch').setAttribute('aria-expanded', 'false');
    pickerIndex = -1;
  }

  function highlightOption(next) {
    const opts = $$('#modelList .picker__opt');
    if (!opts.length) return;
    pickerIndex = Math.max(0, Math.min(opts.length - 1, next));
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === pickerIndex)));
    opts[pickerIndex].scrollIntoView({ block: 'nearest' });
  }

  function selectModel(id) {
    const m = state.data.models.find(x => x.id === id);
    if (!m) return;
    state.modelId = m.id;
    try { localStorage.setItem(LS.model, m.id); } catch (e) { /* gesperrt */ }
    $('#modelSearch').value = m.name || m.id;
    closePicker();
    render();
  }

  function initPicker() {
    const input = $('#modelSearch');
    const clear = $('#pickerClear');

    input.addEventListener('focus', () => {
      input.select();
      renderPicker(input.value === (currentModel()?.name || '') ? '' : input.value);
    });
    input.addEventListener('input', () => {
      clear.hidden = !input.value;
      renderPicker(input.value);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlightOption(pickerIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlightOption(pickerIndex - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (pickerResults[pickerIndex]) selectModel(pickerResults[pickerIndex].id);
      } else if (e.key === 'Escape') { closePicker(); input.blur(); }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      clear.hidden = true;
      input.focus();
      renderPicker('');
    });
    document.addEventListener('pointerdown', e => {
      if (!$('#picker').contains(e.target)) closePicker();
    });
  }

  /* ----------------------------------------------------------------------- CSV */

  function parseCSV(text) {
    const out = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
        } else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field.length || row.length) { row.push(field); out.push(row); }
    return out.filter(r => r.some(c => c.trim() !== ''));
  }

  function profileFromCSV(text) {
    const rowsCsv = parseCSV(text);
    if (rowsCsv.length < 2) throw new Error('keine Datenzeilen gefunden');
    const head = rowsCsv[0].map(h => h.trim().toLowerCase());
    const ix = name => head.indexOf(name);
    const missing = ['tokens_prompt', 'tokens_completion', 'model_permaslug'].filter(n => ix(n) < 0);
    if (missing.length) throw new Error('Spalte fehlt: ' + missing.join(', '));

    const I = {
      prompt: ix('tokens_prompt'), comp: ix('tokens_completion'),
      cached: ix('tokens_cached'), reasoning: ix('tokens_reasoning'),
      model: ix('model_permaslug'), prov: ix('provider_name'),
      cost: ix('cost_total'), created: ix('created_at'),
    };
    const val = (r, k) => (k < 0 ? 0 : (parseFloat(r[k]) || 0));

    const st = {
      calls: 0, models: {}, provs: {},
      tok: { in: 0, cached: 0, out: 0, reasoning: 0 },
      logged: 0, hasCost: I.cost >= 0, from: null, to: null,
    };
    for (const r of rowsCsv.slice(1)) {
      const model = (r[I.model] || '').trim();
      if (!model) continue;
      const prompt = val(r, I.prompt);
      const cached = Math.min(val(r, I.cached), prompt);
      const comp = val(r, I.comp);
      st.calls++;
      st.tok.in += prompt - cached;
      st.tok.cached += cached;
      st.tok.out += comp;
      st.tok.reasoning += val(r, I.reasoning);
      if (st.hasCost) st.logged += val(r, I.cost);
      const m = st.models[model] || (st.models[model] = { calls: 0, in: 0, cached: 0, out: 0 });
      m.calls++; m.in += prompt - cached; m.cached += cached; m.out += comp;
      const prov = (r[I.prov] || '?').trim();
      st.provs[prov] = (st.provs[prov] || 0) + 1;
      const ts = I.created >= 0 ? (r[I.created] || '').slice(0, 16) : '';
      if (ts) {
        if (!st.from || ts < st.from) st.from = ts;
        if (!st.to || ts > st.to) st.to = ts;
      }
    }
    if (!st.calls) throw new Error('keine Zeilen mit model_permaslug/tokens_*');
    return st;
  }

  function applyProfile(st, fileName) {
    const promptTotal = st.tok.in + st.tok.cached;
    const completionTotal = st.tok.out;
    state.profile = {
      calls: st.calls,
      prompt: promptTotal / st.calls,
      completion: completionTotal / st.calls,
      logHit: promptTotal ? (st.tok.cached / promptTotal) * 100 : 0,
      logged: st.logged,
      hasCost: st.hasCost,
      models: st.models,
      provs: st.provs,
      from: st.from,
      to: st.to,
      name: fileName,
    };

    // Eingabefelder auf die Log-Werte setzen und sperren
    state.cost.prompt = Math.round(state.profile.prompt);
    state.cost.completion = Math.round(state.profile.completion);
    syncCostInputs(true);
    if (state.cost.cacheMode === 'none') setCacheMode('provider');

    const msg = $('#csvMsg');
    msg.className = 'msg is-ok';
    msg.textContent = `${fileName} · ${deInt(st.calls)} Calls · Ø ${deInt(state.profile.prompt)} Input, `
      + `${deInt(state.profile.completion)} Output · Cache-Quote ${fmtPct(state.profile.logHit)}`;

    renderCsvKpis();
    $('#csvBtnLabel').textContent = 'CSV geladen';
    $('#csvBtn').classList.add('is-loaded');
    $('#csvReset').hidden = false;

    render();
  }

  // "02.11. 19:58 – 15:59" bzw. mit Datum, wenn der Log über Mitternacht geht
  function fmtSpan(from, to) {
    const d = (ts, withDate) => withDate
      ? `${ts.slice(8, 10)}.${ts.slice(5, 7)}. ${ts.slice(11, 16)}`
      : ts.slice(11, 16);
    const sameDay = from.slice(0, 10) === to.slice(0, 10);
    return `${d(from, true)} – ${d(to, !sameDay)}`;
  }

  function renderCsvKpis() {
    const p = state.profile;
    const box = $('#csvKpis');
    if (!p) { box.innerHTML = ''; return; }
    const models = Object.entries(p.models).sort((a, b) => b[1].calls - a[1].calls);
    const top = models[0];
    const kpi = (k, v) => `<div class="kpi"><span class="kpi__k">${k}</span><span class="kpi__v">${v}</span></div>`;
    const parts = [
      kpi('Calls', deInt(p.calls)),
      kpi('Input / Call', deInt(p.prompt)),
      kpi('Output / Call', deInt(p.completion)),
      kpi('Cache-Quote', fmtPct(p.logHit)),
      kpi('Zeitraum', p.from ? fmtSpan(p.from, p.to) : '—'),
    ];
    if (p.hasCost) parts.push(kpi('laut Log', fmtPrice(p.logged)));
    if (p.hasCost && p.calls) parts.push(kpi('laut Log je Call', fmtPrice(p.logged / p.calls)));
    if (models.length > 1) parts.push(kpi('Modelle im Log', String(models.length)));
    box.innerHTML = parts.join('');

    // Hinweis, wenn das Log ein anderes Modell nutzt als die Ansicht
    if (top && top[0] !== state.modelId && state.data.models.some(m => m.id === top[0])) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.textContent = `Zu ${top[0]} wechseln`;
      btn.addEventListener('click', () => selectModel(top[0]));
      const wrap = document.createElement('div');
      wrap.className = 'kpi';
      wrap.append(btn);
      box.append(wrap);
    }
  }

  function resetProfile() {
    state.profile = null;
    state.cost.prompt = 2000;
    state.cost.completion = 500;
    syncCostInputs(false);
    $('#csvMsg').className = 'msg';
    $('#csvMsg').textContent = '';
    $('#csvKpis').innerHTML = '';
    $('#csvBtnLabel').textContent = 'Activity-CSV laden';
    $('#csvBtn').classList.remove('is-loaded');
    $('#csvReset').hidden = true;
    render();
  }

  function readCsvFile(file) {
    const msg = $('#csvMsg');
    msg.className = 'msg';
    msg.textContent = `lese ${file.name} …`;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        applyProfile(profileFromCSV(String(rd.result)), file.name);
      } catch (e) {
        msg.className = 'msg is-err';
        msg.textContent = `✗ ${file.name}: ${e.message}`;
      }
    };
    rd.onerror = () => {
      msg.className = 'msg is-err';
      msg.textContent = '✗ Datei konnte nicht gelesen werden';
    };
    rd.readAsText(file);
  }

  function initCsv() {
    const drop = $('#drop');
    const input = $('#csvFile');

    const open = () => input.click();
    drop.addEventListener('click', open);
    drop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    $('#csvBtn').addEventListener('click', open);
    $('#csvReset').addEventListener('click', resetProfile);

    input.addEventListener('change', () => {
      if (input.files[0]) readCsvFile(input.files[0]);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('is-over');
    }));
    drop.addEventListener('drop', e => {
      const f = e.dataTransfer?.files?.[0];
      if (f) readCsvFile(f);
    });
  }

  /* ------------------------------------------------------------- Kostenmodell */

  function syncCostInputs(disabled) {
    $('#inCalls').value = state.profile ? state.profile.calls : state.cost.calls;
    $('#inPrompt').value = Math.round(state.cost.prompt);
    $('#inCompletion').value = Math.round(state.cost.completion);
    $('#inCalls').disabled = !!disabled;
    $('#inPrompt').disabled = !!disabled;
    $('#inCompletion').disabled = !!disabled;
  }

  function setCacheMode(mode) {
    state.cost.cacheMode = mode;
    $('#cacheMode').value = mode;
    saveCost();
  }

  function initCostModel() {
    const onNum = (sel, key) => {
      $(sel).addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        state.cost[key] = Number.isFinite(v) ? v : 0;
        saveCost();
        render();
      });
    };
    onNum('#inCalls', 'calls');
    onNum('#inPrompt', 'prompt');
    onNum('#inCompletion', 'completion');
    $('#cacheMode').addEventListener('change', e => {
      state.cost.cacheMode = e.target.value;
      saveCost();
      render();
    });
  }

  /* ---------------------------------------------------------------- Filterliste */

  function slugOf(row) {
    return (row.tag || row.provider || '').split('/')[0].toLowerCase();
  }

  function updateFilterList() {
    const list = rows();
    const excluded = new Set();
    const passed = new Set();
    for (const r of list) {
      const slug = slugOf(r);
      const fails =
        (state.rules.toks > 0 && (r.toks == null || r.toks < state.rules.toks)) ||
        (state.rules.ttft < 100000 && (r.ttft == null || r.ttft > state.rules.ttft)) ||
        (state.rules.uptime > 0 && (r.uptime == null || r.uptime < state.rules.uptime));
      if (fails) excluded.add(slug); else passed.add(slug);
    }
    for (const e of excluded) passed.delete(e);

    const fmt = arr => arr.size ? `[${[...arr].sort().join(', ')}]` : '[]';
    $('#ignoreOut').textContent = fmt(excluded);
    $('#onlyOut').textContent = fmt(passed);
    $('#copyIgnore').disabled = !excluded.size;
    $('#copyOnly').disabled = !passed.size;
    $('#filterNote').textContent = excluded.size
      ? `${excluded.size} Anbieter fallen durch, ${passed.size} bleiben übrig — bezogen auf die ${list.length} Endpoints dieses Modells.`
      : `Aktuell fällt kein Anbieter durch (${list.length} Endpoints geprüft).`;
  }

  function initFilterList() {
    const bind = (sel, key, fallback) => {
      $(sel).addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        state.rules[key] = Number.isFinite(v) ? v : fallback;
        updateFilterList();
      });
    };
    bind('#ruleToks', 'toks', 0);
    bind('#ruleTtft', 'ttft', 5000);
    bind('#ruleUptime', 'uptime', 0);

    const copy = (sel, out) => $(sel).addEventListener('click', async () => {
      const text = $(out).textContent;
      try {
        await navigator.clipboard.writeText(text);
        const btn = $(sel);
        const old = btn.textContent;
        btn.textContent = 'Kopiert';
        setTimeout(() => { btn.textContent = old; }, 1500);
      } catch (e) {
        // Fallback: markieren, damit Strg+C funktioniert
        const range = document.createRange();
        range.selectNodeContents($(out));
        const sel2 = window.getSelection();
        sel2.removeAllRanges();
        sel2.addRange(range);
      }
    });
    copy('#copyIgnore', '#ignoreOut');
    copy('#copyOnly', '#onlyOut');
  }

  /* ------------------------------------------------------------------- Presets */

  function renderPresets() {
    const box = $('#presets');
    box.innerHTML = '<span class="presets__label">Schnellauswahl</span>' + PRESETS.map(p =>
      `<button class="chip" type="button" data-id="${p.id}" aria-pressed="${state.preset === p.id}">${escapeHtml(p.label)}</button>`
    ).join('');
    $$('#presets .chip').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.id));
    });
  }

  function applyPreset(id) {
    const p = PRESETS.find(x => x.id === id);
    if (!p) return;
    state.preset = p.id;
    state.axes = { x: p.x, y: p.y, logX: metricByKey(p.x).log, logY: metricByKey(p.y).log };
    state.sort = { key: p.sort, dir: p.dir };
    state.hidden = new Set(COLUMNS.filter(c => !c.always && !COL_PRESETS[p.cols].includes(c.key)).map(c => c.key));
    syncAxisControls();
    saveCols();
    saveAxes();
    renderPresets();
    render();
  }

  function syncAxisControls() {
    $('#axisX').value = state.axes.x;
    $('#axisY').value = state.axes.y;
    $('#logX').checked = state.axes.logX;
    $('#logY').checked = state.axes.logY;
  }

  function initChartControls() {
    const opts = METRICS.map(m => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join('');
    $('#axisX').innerHTML = opts;
    $('#axisY').innerHTML = opts;
    syncAxisControls();

    $('#axisX').addEventListener('change', e => {
      state.axes.x = e.target.value;
      state.axes.logX = metricByKey(state.axes.x).log;
      state.preset = null;
      syncAxisControls();
      saveAxes();
      renderPresets();
      renderChart();
    });
    $('#axisY').addEventListener('change', e => {
      state.axes.y = e.target.value;
      state.axes.logY = metricByKey(state.axes.y).log;
      state.preset = null;
      syncAxisControls();
      saveAxes();
      renderPresets();
      renderChart();
    });
    $('#logX').addEventListener('change', e => {
      state.axes.logX = e.target.checked;
      state.preset = null;
      saveAxes();
      renderPresets();
      renderChart();
    });
    $('#logY').addEventListener('change', e => {
      state.axes.logY = e.target.checked;
      state.preset = null;
      saveAxes();
      renderPresets();
      renderChart();
    });
  }

  /* ------------------------------------------------------------------ Persistenz */

  function saveCols() {
    try { localStorage.setItem(LS.cols, JSON.stringify([...state.hidden])); } catch (e) { /* gesperrt */ }
  }
  function saveAxes() {
    try { localStorage.setItem(LS.axes, JSON.stringify(state.axes)); } catch (e) { /* gesperrt */ }
  }
  function saveCost() {
    try { localStorage.setItem(LS.cost, JSON.stringify(state.cost)); } catch (e) { /* gesperrt */ }
  }

  function restore() {
    try {
      const hidden = JSON.parse(localStorage.getItem(LS.cols) || 'null');
      if (Array.isArray(hidden)) state.hidden = new Set(hidden);
      else state.hidden = new Set(COLUMNS.filter(c => !c.always && !DEFAULT_COLS.includes(c.key)).map(c => c.key));

      const axes = JSON.parse(localStorage.getItem(LS.axes) || 'null');
      if (axes && axes.x && axes.y) state.axes = { ...state.axes, ...axes };
      else state.axes = { x: 'proj', y: 'toks', logX: true, logY: false };

      const cost = JSON.parse(localStorage.getItem(LS.cost) || 'null');
      if (cost && typeof cost === 'object') state.cost = { ...state.cost, ...cost };
    } catch (e) {
      state.hidden = new Set(COLUMNS.filter(c => !c.always && !DEFAULT_COLS.includes(c.key)).map(c => c.key));
    }
  }

  /* --------------------------------------------------------------------- Theme */

  function initTheme() {
    const saved = (() => { try { return localStorage.getItem(LS.theme); } catch (e) { return null; } })();
    if (saved) document.documentElement.dataset.theme = saved;
    $('#themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(LS.theme, next); } catch (e) { /* gesperrt */ }
    });
  }

  /* -------------------------------------------------------------------- Render */

  function render() {
    renderChips();
    renderHead();
    renderBody();
    renderTableNote();
    renderChart();
    updateFilterList();
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

  /* ---------------------------------------------------------------------- Start */

  async function start() {
    initTheme();
    restore();
    initPicker();
    initCsv();
    initCostModel();
    initFilterList();
    initChartControls();
    renderPresets();
    bindTips(document);
    syncCostInputs(false);
    setCacheMode(state.cost.cacheMode || 'provider');

    let payload;
    try {
      const res = await fetch('data/models.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
    } catch (e) {
      $('#factStamp').textContent = 'nicht ladbar';
      $('#factCounts').textContent = '—';
      $('#tableNote').textContent = 'Die Modelldaten konnten nicht geladen werden (' + e.message + ').';
      return;
    }

    state.data = payload;
    const counts = payload.counts || {};
    const stamp = (payload.generated_at || '').replace('T', ' ').replace('Z', ' UTC');

    $('#factStamp').textContent = stamp || 'unbekannt';
    $('#factCounts').textContent = `${deInt(counts.models)} Modelle · ${deInt(counts.endpoints)} Endpoints · ${deInt(counts.providers)} Anbieter`;
    $('#footStamp').textContent = stamp || 'unbekannt';
    $('#footCounts').textContent = `${deInt(counts.models)} Modelle · ${deInt(counts.endpoints)} Endpoints`;
    $('#footBuilt').textContent = `Seite gebaut am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    // Startmodell: gemerkte Wahl, sonst das Modell mit den meisten Anbietern
    let startId = null;
    try { startId = localStorage.getItem(LS.model); } catch (e) { /* gesperrt */ }
    if (!startId || !payload.models.some(m => m.id === startId)) {
      const best = payload.models
        .filter(m => m.endpoints.length >= 3)
        .sort((a, b) => b.endpoints.length - a.endpoints.length)[0];
      startId = best ? best.id : payload.models[0]?.id;
    }
    state.modelId = startId;
    const m = currentModel();
    $('#modelSearch').value = m ? (m.name || m.id) : '';
    $('#pickerClear').hidden = true;

    render();
  }

  document.addEventListener('DOMContentLoaded', start);
})();
