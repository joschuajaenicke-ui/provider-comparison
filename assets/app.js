/* ==========================================================================
   Provider-Vergleich — Anwendungslogik
   Reine Browser-Anwendung: lädt data/models.json, rechnet im Tab, sendet nichts.
   Aufbau: Texte (de/en) · Konstanten · Zustand · Formatierung · Kostenrechnung ·
           Tabelle · Anbieterfilter · Export · Grafik · Modellsuche · CSV ·
           Filterliste · Start
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ============================================================== Texte (i18n) */

  const STR = {
    de: {
      'meta.title': 'OpenRouter-Provider vergleichen — Preise, Tempo, Ausfälle',

      'search.placeholder': 'Modellname oder Kennung — z. B. claude, gpt, deepseek …',
      'search.empty': 'Kein Modell gefunden. Andere Schreibweise probieren — z. B. „claude“ statt „Claude 4“.',
      'search.providers': '{n} Anbieter',
      'search.from': 'ab {p}/Mio',
      'search.clear': 'Suche leeren',

      'presets.label': 'Schnellauswahl',

      'col.provider': 'Anbieter',
      'col.quant': 'Quant',
      'col.in': 'Input $/Mio',
      'col.out': 'Output $/Mio',
      'col.cache': 'Cache $/Mio',
      'col.projTotal': 'Kosten gesamt',
      'col.proj1000': 'Kosten / 1.000 Calls',
      'col.projIn': 'davon Input',
      'col.projCache': 'davon Cache',
      'col.projOut': 'davon Output',
      'col.ctx': 'Kontext',
      'col.toks': 'tok/s',
      'col.ttft': 'TTFT',
      'col.uptime': 'Uptime',
      'col.hit': 'Cache-Quote',
      'col.discount': 'Rabatt',
      'col.maxOut': 'Max Output',

      'tip.provider': 'Wer den Endpoint betreibt. Ein Anbieter kann dasselbe Modell in mehreren Varianten führen — jede Variante ist eine eigene Zeile.',
      'tip.quant': 'Quantisierungsstufe: wie stark das Modell für den Anbieter komprimiert wurde. Kleiner heißt meist schneller und günstiger, kann aber Qualität kosten.',
      'tip.in': 'Listenpreis für 1 Mio. Input-Token, die nicht aus dem Cache kommen.',
      'tip.out': 'Listenpreis für 1 Mio. erzeugte Token.',
      'tip.cache': 'Preis für 1 Mio. Token aus dem Prompt-Cache. „—“ bedeutet: kein Cache-Tarif, Cache-Token kosten dann den vollen Input-Preis.',
      'tip.projTotal': 'Kosten für dein gesamtes Nutzungsprofil: alle Calls mit ihren Tokenmengen × die Preise dieses Endpoints.',
      'tip.proj1000': 'Derselbe Wert, normiert auf 1.000 Calls — unabhängig davon, wie groß dein Log ist. Damit lassen sich Anbieter vergleichen.',
      'tip.projIn': 'Anteil der Kosten, der auf Input-Token ohne Cache entfällt.',
      'tip.projCache': 'Anteil der Kosten, der auf Cache-Lesevorgänge entfällt.',
      'tip.projOut': 'Anteil der Kosten, der auf erzeugte Token entfällt.',
      'tip.ctx': 'Maximale Kontextlänge dieses Endpoints in Token. Kleiner als beim Modell bedeutet: lange Prompts passen hier nicht.',
      'tip.toks': 'Median-Durchsatz der letzten 30 Minuten: erzeugte Token pro Sekunde. Median statt Mittelwert, damit einzelne Ausreißer die Zahl nicht verzerren.',
      'tip.ttft': 'Time to First Token, Median der letzten 30 Minuten: wie lange es dauert, bis das erste Token ankommt. Entscheidend für gefühlte Latenz.',
      'tip.uptime': 'Anteil erfolgreicher Anfragen in den letzten 30 Minuten, gemessen von OpenRouter.',
      'tip.hit': 'Anteil des Inputs, der in der letzten Woche aus dem Cache kam. Je höher, desto stärker senkt der Cache-Preis die Kosten — wenn der Endpoint einen Cache-Tarif hat.',
      'tip.discount': 'Rabatt, den OpenRouter auf den Listenpreis dieses Endpoints gibt.',
      'tip.maxOut': 'Maximal erzeugbare Token pro Anfrage laut Endpoint-Angabe.',

      'quant.unknown': 'k. A.',
      'badge.fastest': 'schnellste',
      'badge.cheapest': 'günstigste',
      'badge.degraded': 'degradiert',
      'badge.inLog': 'im Log',
      'badge.log': 'Log',

      'table.empty': 'Keine Anbieter für dieses Modell.',
      'table.noRows': 'Alle Anbieter sind ausgeblendet — Filter zurücksetzen.',
      'table.eps': '{n} Endpoints',
      'table.prov': '{n} Anbieter',
      'table.hidden': '{n} ausgeblendet',
      'table.degraded': '{n} degradiert',
      'table.missing': '{n} ohne Messwerte',
      'table.range': 'Preise: {min}–{max} Output',
      'model.hint': '{id} · {ctx} Kontext · {modes} als Ausgabe',

      'cache.provider': 'je Anbieter (OpenRouter)',
      'cache.log': 'aus dem Log',
      'cache.none': 'kein Cache',
      'usage.perCall': 'Ø {in} Input / {out} Output pro Call',
      'usage.perCallUnknown': 'Calls steht auf 0 — bitte Anzahl eintragen',
      'usage.cacheAvg': 'Ø der Anbieter',
      'usage.cacheLog': 'aus dem Log',
      'usage.cacheNone': 'kein Cache',

      'msg.reading': 'lese {name} …',
      'msg.readOk': '{name} · {calls} Calls · Ø {in} Input, {out} Output · Cache-Quote {hit}',
      'msg.readErr': '✗ {name}: {msg}',
      'msg.fileError': '✗ Datei konnte nicht gelesen werden',
      'csv.missingColumn': 'Spalte fehlt: {cols}',
      'csv.noRows': 'keine Datenzeilen gefunden',
      'csv.noModel': 'keine Zeilen mit model_permaslug/tokens_*',

      'kpi.calls': 'Calls',
      'kpi.inputPerCall': 'Input / Call',
      'kpi.outputPerCall': 'Output / Call',
      'kpi.cacheHit': 'Cache-Quote',
      'kpi.period': 'Zeitraum',
      'kpi.logged': 'laut Log',
      'kpi.loggedPerCall': 'laut Log je Call',
      'kpi.models': 'Modelle im Log',
      'kpi.switchTo': 'Zu {name} wechseln',

      'chart.empty': 'Für diese Achsenkombination liegen keine Messwerte vor.',
      'chart.skipped': '{n} Punkt(e) ohne Wert für diese Achsen ausgeblendet',
      'chart.logNote': 'logarithmische Achse: gleiche Abstände = gleicher Faktor',
      'legend.degraded': 'degradiert',
      'legend.size': 'Kreisgröße = Uptime · {cost}',
      'legend.costLog': 'Kosten aus deinem Log',
      'legend.costModel': 'Kosten aus dem Nutzungsprofil',

      'tip.quantRow': 'Quant',
      'tip.io': 'Input / Output',
      'tip.cacheRow': 'Cache',
      'tip.noTariff': 'kein Tarif',
      'tip.costRow': 'Kosten gesamt',
      'tip.hitRow': 'Cache-Quote',
      'tip.uptimeRow': 'Uptime',
      'tip.degradedRow': 'degradiert',

      'metric.projTotal': 'Kosten gesamt',
      'metric.projTotalAxis': 'Kosten gesamt ({n} Calls)',
      'metric.proj1000': 'Kosten je 1.000 Calls',
      'metric.in': 'Input-Preis $/Mio',
      'metric.out': 'Output-Preis $/Mio',
      'metric.cache': 'Cache-Preis $/Mio',
      'metric.toks': 'Durchsatz tok/s',
      'metric.ttft': 'TTFT (ms)',
      'metric.uptime': 'Uptime (%)',
      'metric.hit': 'Cache-Quote (%)',
      'metric.ctx': 'Kontext (Token)',
      'metric.discount': 'Rabatt (%)',

      'preset.valueList': 'Preis/Leistung (Liste)',
      'preset.valueList.tip': 'Listenpreis gegen Geschwindigkeit: links unten ist günstig, oben ist schnell. Unabhängig von deinem eigenen Verbrauch.',
      'preset.valueUsage': 'Preis/Leistung (Nutzung)',
      'preset.valueUsage.tip': 'Kosten aus deinem Nutzungsprofil gegen Geschwindigkeit: links unten kostet dein Verbrauch am wenigsten, oben ist der Anbieter schneller.',
      'preset.latency': 'Latenz',
      'preset.latency.tip': 'Antwortzeit gegen Durchsatz: links kommt das erste Token früher, oben fließt der Text schneller.',
      'preset.reliable': 'Zuverlässigkeit',
      'preset.reliable.tip': 'Uptime gegen Antwortzeit: oben rechts ist beides gut — selten Ausfälle und schnelle erste Antwort.',
      'preset.cache': 'Cache-Nutzen',
      'preset.cache.tip': 'Cache-Preis gegen Trefferquote: links hohe Quote bei niedrigem Preis spart am meisten — nur wirksam, wenn ein Cache-Tarif existiert.',
      'preset.all': 'Alles zeigen',
      'preset.all.tip': 'Blendet alle Spalten ein; Achsen wie bei Preis/Leistung (Nutzung).',

      'provider.search': 'Anbieter filtern …',
      'provider.all': 'Alle',
      'provider.none': 'Keine',
      'provider.empty': 'Kein Anbieter passt zum Filter.',


      'export.done': 'exportiert: {name}',
      'export.empty': 'Keine Zeilen zum Exportieren.',

      'footer.built': 'Seite gebaut am {date}',
      'footer.loadFailed': 'Die Modelldaten konnten nicht geladen werden ({msg}).',
    },

    en: {
      'meta.title': 'Compare OpenRouter providers — prices, speed, outages',

      'search.placeholder': 'Model name or ID — e.g. claude, gpt, deepseek …',
      'search.empty': 'No model found. Try a different spelling — e.g. “claude” instead of “Claude 4”.',
      'search.providers': '{n} providers',
      'search.from': 'from {p}/M',
      'search.clear': 'Clear search',

      'presets.label': 'Quick presets',

      'col.provider': 'Provider',
      'col.quant': 'Quant',
      'col.in': 'Input $/M',
      'col.out': 'Output $/M',
      'col.cache': 'Cache $/M',
      'col.projTotal': 'Total cost',
      'col.proj1000': 'Cost / 1,000 calls',
      'col.projIn': 'of which input',
      'col.projCache': 'of which cache',
      'col.projOut': 'of which output',
      'col.ctx': 'Context',
      'col.toks': 'tok/s',
      'col.ttft': 'TTFT',
      'col.uptime': 'Uptime',
      'col.hit': 'Cache hit',
      'col.discount': 'Discount',
      'col.maxOut': 'Max output',

      'tip.provider': 'Who operates the endpoint. A provider can run the same model in several variants — each variant is its own row.',
      'tip.quant': 'Quantization level: how far the model was compressed for this provider. Smaller usually means faster and cheaper, but can cost quality.',
      'tip.in': 'List price for 1 million input tokens that do not come from the cache.',
      'tip.out': 'List price for 1 million generated tokens.',
      'tip.cache': 'Price for 1 million tokens read from the prompt cache. “—” means no cache rate: cache tokens then cost the full input price.',
      'tip.projTotal': 'Cost for your whole usage profile: all calls with their token counts × this endpoint\u2019s prices.',
      'tip.proj1000': 'The same value normalized to 1,000 calls — independent of how large your log is. This is what makes providers comparable.',
      'tip.projIn': 'Share of the cost that falls on input tokens without cache.',
      'tip.projCache': 'Share of the cost that falls on cache reads.',
      'tip.projOut': 'Share of the cost that falls on generated tokens.',
      'tip.ctx': 'Maximum context length of this endpoint in tokens. Smaller than the model means long prompts do not fit here.',
      'tip.toks': 'Median throughput of the last 30 minutes: generated tokens per second. Median rather than mean, so single outliers do not skew the number.',
      'tip.ttft': 'Time to first token, median of the last 30 minutes: how long until the first token arrives. Decides perceived latency.',
      'tip.uptime': 'Share of successful requests in the last 30 minutes, measured by OpenRouter.',
      'tip.hit': 'Share of the input that came from the cache in the last week. The higher it is, the more the cache price lowers the cost — if the endpoint has a cache rate at all.',
      'tip.discount': 'Discount OpenRouter grants on this endpoint\u2019s list price.',
      'tip.maxOut': 'Maximum tokens per request according to the endpoint.',

      'quant.unknown': 'n/a',
      'badge.fastest': 'fastest',
      'badge.cheapest': 'cheapest',
      'badge.degraded': 'degraded',
      'badge.inLog': 'in log',
      'badge.log': 'log',

      'table.empty': 'No providers for this model.',
      'table.noRows': 'All providers are hidden — reset the filter.',
      'table.eps': '{n} endpoints',
      'table.prov': '{n} providers',
      'table.hidden': '{n} hidden',
      'table.degraded': '{n} degraded',
      'table.missing': '{n} without measurements',
      'table.range': 'Prices: {min}–{max} output',
      'model.hint': '{id} · {ctx} context · {modes} output',

      'cache.provider': 'per provider (OpenRouter)',
      'cache.log': 'from the log',
      'cache.none': 'no cache',
      'usage.perCall': 'avg. {in} input / {out} output per call',
      'usage.perCallUnknown': 'calls is 0 — please enter a count',
      'usage.cacheAvg': 'avg of providers',
      'usage.cacheLog': 'from the log',
      'usage.cacheNone': 'no cache',

      'msg.reading': 'reading {name} …',
      'msg.readOk': '{name} · {calls} calls · avg. {in} input, {out} output · cache hit {hit}',
      'msg.readErr': '✗ {name}: {msg}',
      'msg.fileError': '✗ could not read the file',
      'csv.missingColumn': 'missing column: {cols}',
      'csv.noRows': 'no data rows found',
      'csv.noModel': 'no rows with model_permaslug/tokens_*',

      'kpi.calls': 'Calls',
      'kpi.inputPerCall': 'Input / call',
      'kpi.outputPerCall': 'Output / call',
      'kpi.cacheHit': 'Cache hit',
      'kpi.period': 'Period',
      'kpi.logged': 'billed in log',
      'kpi.loggedPerCall': 'billed per call',
      'kpi.models': 'Models in log',
      'kpi.switchTo': 'Switch to {name}',

      'chart.empty': 'No measurements for this axis combination.',
      'chart.skipped': '{n} point(s) hidden — no value for these axes',
      'chart.logNote': 'logarithmic axis: equal spacing = equal factor',
      'legend.degraded': 'degraded',
      'legend.size': 'Dot size = uptime · {cost}',
      'legend.costLog': 'costs from your log',
      'legend.costModel': 'costs from the usage profile',

      'tip.quantRow': 'Quant',
      'tip.io': 'Input / Output',
      'tip.cacheRow': 'Cache',
      'tip.noTariff': 'no cache rate',
      'tip.costRow': 'Total cost',
      'tip.hitRow': 'Cache hit',
      'tip.uptimeRow': 'Uptime',
      'tip.degradedRow': 'degraded',

      'metric.projTotal': 'Total cost',
      'metric.projTotalAxis': 'Total cost ({n} calls)',
      'metric.proj1000': 'Cost per 1,000 calls',
      'metric.in': 'Input price $/M',
      'metric.out': 'Output price $/M',
      'metric.cache': 'Cache price $/M',
      'metric.toks': 'Throughput tok/s',
      'metric.ttft': 'TTFT (ms)',
      'metric.uptime': 'Uptime (%)',
      'metric.hit': 'Cache hit (%)',
      'metric.ctx': 'Context (tokens)',
      'metric.discount': 'Discount (%)',

      'preset.valueList': 'Price/performance (list)',
      'preset.valueList.tip': 'List price against speed: bottom left is cheap, top is fast. Independent of your own consumption.',
      'preset.valueUsage': 'Price/performance (usage)',
      'preset.valueUsage.tip': 'Cost from your usage profile against speed: bottom left costs your consumption the least, higher up the provider is faster.',
      'preset.latency': 'Latency',
      'preset.latency.tip': 'Response time against throughput: left means the first token arrives earlier, up means text flows faster.',
      'preset.reliable': 'Reliability',
      'preset.reliable.tip': 'Uptime against response time: top right is good on both — few outages and a fast first response.',
      'preset.cache': 'Cache benefit',
      'preset.cache.tip': 'Cache price against hit rate: a high rate at a low price saves the most — only effective if a cache rate exists.',
      'preset.all': 'Show all',
      'preset.all.tip': 'Shows every column; axes as in price/performance (usage).',

      'provider.search': 'Filter providers …',
      'provider.all': 'All',
      'provider.none': 'None',
      'provider.empty': 'No provider matches the filter.',


      'export.done': 'exported: {name}',
      'export.empty': 'No rows to export.',

      'footer.built': 'Page built on {date}',
      'footer.loadFailed': 'The model data could not be loaded ({msg}).',
    },
  };

  let lang = 'de';

  function t(key, vars) {
    let s = (STR[lang] && STR[lang][key]) ?? STR.de[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  const loc = () => (lang === 'de' ? 'de-DE' : 'en-US');

  /* ---------------------------------------------------------------- Konstanten */

  // Farbe je Quantisierungsstufe — identisch in Tabelle (CSS-Klasse) und Grafik (fill).
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

  const COLUMNS = [
    { key: 'provider', always: true },
    { key: 'quant' },
    { key: 'in' },
    { key: 'out' },
    { key: 'cache' },
    { key: 'projTotal' },
    { key: 'proj1000' },
    { key: 'projIn' },
    { key: 'projCache' },
    { key: 'projOut' },
    { key: 'ctx' },
    { key: 'toks' },
    { key: 'ttft' },
    { key: 'uptime' },
    { key: 'hit' },
    { key: 'discount' },
    { key: 'maxOut' },
  ];

  const COL_LABEL = {
    provider: 'col.provider', quant: 'col.quant', in: 'col.in', out: 'col.out',
    cache: 'col.cache', projTotal: 'col.projTotal', proj1000: 'col.proj1000',
    projIn: 'col.projIn', projCache: 'col.projCache', projOut: 'col.projOut',
    ctx: 'col.ctx', toks: 'col.toks', ttft: 'col.ttft', uptime: 'col.uptime',
    hit: 'col.hit', discount: 'col.discount', maxOut: 'col.maxOut',
  };

  const COL_TIP = {
    provider: 'tip.provider', quant: 'tip.quant', in: 'tip.in', out: 'tip.out',
    cache: 'tip.cache', projTotal: 'tip.projTotal', proj1000: 'tip.proj1000',
    projIn: 'tip.projIn', projCache: 'tip.projCache', projOut: 'tip.projOut',
    ctx: 'tip.ctx', toks: 'tip.toks', ttft: 'tip.ttft', uptime: 'tip.uptime',
    hit: 'tip.hit', discount: 'tip.discount', maxOut: 'tip.maxOut',
  };

  const COL_PRESETS = {
    overview: ['provider', 'quant', 'in', 'out', 'cache', 'projTotal', 'proj1000', 'toks', 'ttft', 'uptime', 'hit'],
    price: ['provider', 'quant', 'in', 'out', 'cache', 'hit', 'proj1000'],
    usage: ['provider', 'quant', 'projTotal', 'proj1000', 'hit', 'toks', 'ttft', 'uptime'],
    perf: ['provider', 'quant', 'toks', 'ttft', 'uptime', 'hit'],
    compact: ['provider', 'quant', 'proj1000', 'toks'],
    all: COLUMNS.map(c => c.key),
  };

  const DEFAULT_COLS = COL_PRESETS.overview;

  const METRICS = [
    { key: 'projTotal', unit: 'usd', log: true },
    { key: 'proj1000', unit: 'usd', log: true },
    { key: 'in', unit: 'usd', log: true },
    { key: 'out', unit: 'usd', log: true },
    { key: 'cache', unit: 'usd', log: true },
    { key: 'toks', unit: 'toks', log: false },
    { key: 'ttft', unit: 'ms', log: false },
    { key: 'uptime', unit: 'pct', log: false },
    { key: 'hit', unit: 'pct', log: false },
    { key: 'ctx', unit: 'ctx', log: true },
    { key: 'discount', unit: 'pct100', log: false },
  ];

  const METRIC_LABEL = {
    projTotal: 'metric.projTotal', proj1000: 'metric.proj1000', in: 'metric.in',
    out: 'metric.out', cache: 'metric.cache', toks: 'metric.toks', ttft: 'metric.ttft',
    uptime: 'metric.uptime', hit: 'metric.hit', ctx: 'metric.ctx', discount: 'metric.discount',
  };

  // Zwei getrennte Preis/Leistungs-Presets: Listenpreis und eigenes Nutzungsprofil.
  // Kontext ist bewusst kein Preset mehr — in der Praxis selten entscheidungsrelevant.
  const PRESETS = [
    { id: 'valueList', x: 'out', y: 'toks', cols: 'price', sort: 'out', dir: 1 },
    { id: 'valueUsage', x: 'proj1000', y: 'toks', cols: 'usage', sort: 'proj1000', dir: 1 },
    { id: 'latency', x: 'ttft', y: 'toks', cols: 'perf', sort: 'ttft', dir: 1 },
    { id: 'reliable', x: 'uptime', y: 'ttft', cols: 'perf', sort: 'uptime', dir: -1 },
    { id: 'cache', x: 'cache', y: 'hit', cols: 'price', sort: 'cache', dir: 1 },
    { id: 'all', x: 'proj1000', y: 'toks', cols: 'all', sort: 'proj1000', dir: 1 },
  ];

  const LS = {
    theme: 'pc.theme.v1',
    lang: 'pc.lang.v1',
    model: 'pc.model.v1',
    cost: 'pc.cost.v1',
    cols: 'pc.cols.v1',
    axes: 'pc.axes.v1',
  };

  /* ------------------------------------------------------------------- Zustand */

  const state = {
    data: null,
    modelId: null,
    sort: { key: 'proj1000', dir: 1 },
    hidden: new Set(),
    hiddenProviders: new Set(),
    axes: { x: 'proj1000', y: 'toks', logX: true, logY: false },
    preset: 'valueUsage',
    // Absolute Tokenmengen — so, wie sie im Dashboard stehen.
    cost: { calls: 1000, inputTotal: 2000000, outputTotal: 500000, cacheMode: 'provider' },
    profile: null,          // aus CSV: { calls, prompt, completion, inputTotal, outputTotal, logHit, logged, ... }
    linked: null,           // hervorgehobener Endpoint (Tabelle <-> Grafik)
  };

  /* -------------------------------------------------------------- Formatierung */

  function fmtInt(v) {
    if (v == null || Number.isNaN(v)) return '—';
    return Math.round(v).toLocaleString(loc(), { maximumFractionDigits: 0 });
  }

  function fmtNum(v, d = 1) {
    if (v == null || Number.isNaN(v)) return '—';
    return v.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtPrice(v) {
    if (v == null) return '—';
    const d = v === 0 ? 0 : v < 0.01 ? 4 : v < 0.1 ? 3 : v < 10 ? 2 : 1;
    return '$' + v.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtMs(v) {
    if (v == null) return '—';
    return v >= 1000 ? fmtNum(v / 1000, 1) + ' s' : fmtInt(v) + ' ms';
  }

  function fmtCtx(v) {
    if (v == null) return '—';
    if (v >= 1_000_000) {
      return fmtNum(v / 1_000_000, v >= 10_000_000 ? 0 : 1) + (lang === 'de' ? ' Mio' : 'M');
    }
    return fmtInt(Math.round(v / 1000)) + 'k';
  }

  function fmtPct(v, d = 1) {
    return v == null ? '—' : fmtNum(v, d) + ' %';
  }

  function fmtDiscount(v) {
    return !v ? '—' : fmtNum(v * 100, 0) + ' %';
  }

  const metricByKey = key => METRICS.find(m => m.key === key) || METRICS[0];

  // Achsenbeschriftung; die Kostenspalte nennt die Bezugsgröße mit.
  function metricLabel(key) {
    if (key === 'projTotal') return t('metric.projTotalAxis', { n: fmtInt(costBase()) });
    return t(METRIC_LABEL[key] || 'metric.proj1000');
  }

  function fmtMetric(key, v) {
    const m = metricByKey(key);
    switch (m.unit) {
      case 'usd': return fmtPrice(v);
      case 'toks': return v == null ? '—' : fmtInt(v) + ' tok/s';
      case 'ms': return fmtMs(v);
      case 'pct': return fmtPct(v);
      case 'pct100': return v == null ? '—' : fmtNum(v * 100, 0) + ' %';
      case 'ctx': return fmtCtx(v);
      default: return String(v);
    }
  }

  function fmtAxis(key, v) {
    const dec = lang === 'de' ? ',' : '.';
    const m = metricByKey(key);
    switch (m.unit) {
      case 'usd':
        if (v === 0) return '$0';
        if (v < 0.01) return '$' + v.toFixed(4).replace('.', dec);
        if (v < 1) return '$' + v.toFixed(2).replace('.', dec);
        if (v < 100) return '$' + (v < 10 ? v.toFixed(1) : String(Math.round(v))).replace('.', dec);
        return '$' + fmtInt(v);
      case 'toks': return fmtInt(v);
      case 'ms': return v >= 1000 ? fmtNum(v / 1000, 1) + 's' : fmtInt(v);
      case 'pct': return fmtInt(v);
      case 'pct100': return fmtInt(v * 100);
      case 'ctx': return fmtCtx(v);
      default: return String(v);
    }
  }

  function quantColor(q) {
    return QUANT_COLORS[(q || 'unknown').toLowerCase()] || QUANT_COLORS.unknown;
  }

  // Gleiche Farbe als CSS-Klasse (die CSP erlaubt keine Inline-Styles)
  function quantClass(q) {
    const key = (q || 'unknown').toLowerCase();
    return 'qdot q-' + (QUANT_COLORS[key] ? key : 'unknown');
  }

  /* ---------------------------------------------------------- Kostenrechnung */

  // Nutzungsprofil: entweder aus der CSV oder aus den absoluten Eingabefeldern.
  function profile() {
    if (state.profile) {
      return {
        calls: Math.max(1, state.profile.calls),
        prompt: state.profile.prompt,           // pro Call
        completion: state.profile.completion,   // pro Call
        logHit: state.profile.logHit,
        source: 'csv',
      };
    }
    const calls = Math.max(1, state.cost.calls || 1);
    return {
      calls,
      prompt: Math.max(0, state.cost.inputTotal || 0) / calls,
      completion: Math.max(0, state.cost.outputTotal || 0) / calls,
      logHit: null,
      source: 'manual',
    };
  }

  function cacheHitFor(ep, prof) {
    if (state.cost.cacheMode === 'none') return 0;
    if (state.cost.cacheMode === 'log') return prof.logHit == null ? 0 : prof.logHit;
    if (ep.hit != null) return ep.hit;
    return prof.logHit == null ? 0 : prof.logHit;
  }

  // Kosten für das gesamte Profil an diesem Endpoint, aufgeschlüsselt.
  function costFor(ep, prof) {
    const hit = Math.max(0, Math.min(100, cacheHitFor(ep, prof))) / 100;
    const cached = prof.prompt * hit;
    const fresh = prof.prompt - cached;
    const priceCache = ep.cache == null ? ep.in : ep.cache;
    const inCost = (fresh * (ep.in ?? 0)) / 1e6;
    const cacheCost = (cached * (priceCache ?? 0)) / 1e6;
    const outCost = (prof.completion * (ep.out ?? 0)) / 1e6;
    const perCall = inCost + cacheCost + outCost;
    return {
      total: perCall * prof.calls,
      per1000: perCall * 1000,
      input: inCost * prof.calls,
      cache: cacheCost * prof.calls,
      output: outCost * prof.calls,
      perCall,
      hit: hit * 100,
    };
  }

  // Bezugsgröße der Kostenspalten
  function costBase() {
    return state.profile ? Math.max(1, state.profile.calls) : Math.max(1, state.cost.calls || 1);
  }

  /* --------------------------------------------------------------- Datenzugriff */

  function currentModel() {
    if (!state.data) return null;
    return state.data.models.find(m => m.id === state.modelId) || null;
  }

  function allRows() {
    const m = currentModel();
    if (!m) return [];
    const prof = profile();
    const perProvider = new Map();
    for (const ep of m.endpoints) perProvider.set(ep.provider, (perProvider.get(ep.provider) || 0) + 1);

    return m.endpoints.map((ep, i) => {
      const c = costFor(ep, prof);
      return {
        ...ep,
        _i: i,
        _cost: c,
        _proj: c.total,
        _proj1000: c.per1000,
        _projIn: c.input,
        _projCache: c.cache,
        _projOut: c.output,
        _hitUsed: c.hit,
        _multiProvider: (perProvider.get(ep.provider) || 0) > 1,
      };
    });
  }

  // Angezeigte Zeilen: Anbieterfilter angewandt
  function rows() {
    return allRows().filter(r => !state.hiddenProviders.has(r.provider));
  }

  function providerStats() {
    const map = new Map();
    for (const r of allRows()) {
      const e = map.get(r.provider) || { name: r.provider, eps: 0, hidden: state.hiddenProviders.has(r.provider) };
      e.eps++;
      map.set(r.provider, e);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, loc()));
  }

  function sortValue(row, key) {
    switch (key) {
      case 'projTotal': return row._proj;
      case 'proj1000': return row._proj1000;
      case 'projIn': return row._projIn;
      case 'projCache': return row._projCache;
      case 'projOut': return row._projOut;
      case 'hit': return row._hitUsed;
      case 'provider': return row.provider.toLowerCase();
      default: return row[key];
    }
  }

  function sortedRows() {
    const list = rows().slice();
    const { key, dir } = state.sort;
    list.sort((a, b) => {
      const x = sortValue(a, key), y = sortValue(b, key);
      if (x == null && y == null) return a.provider.localeCompare(b.provider, loc());
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'string') return x.localeCompare(y, loc()) * dir;
      return (x - y) * dir;
    });
    return list;
  }

  /* ------------------------------------------------------------------- Tabelle */

  function visibleColumns() {
    return COLUMNS.filter(c => c.always || !state.hidden.has(c.key));
  }

  function columnLabel(col) {
    return t(COL_LABEL[col.key]);
  }

  function cellValue(row, key) {
    switch (key) {
      case 'quant':
        return `<span class="${quantClass(row.quant)}"></span>${row.quant === 'unknown'
          ? `<span class="dim">${escapeHtml(t('quant.unknown'))}</span>`
          : escapeHtml(row.quant)}`;
      case 'in': return fmtPrice(row.in);
      case 'out': return fmtPrice(row.out);
      case 'cache': return row.cache == null ? '<span class="dim">—</span>' : fmtPrice(row.cache);
      case 'projTotal': return `<span class="num-strong">${fmtPrice(row._proj)}</span>`;
      case 'proj1000': return `<span class="num-strong">${fmtPrice(row._proj1000)}</span>`;
      case 'projIn': return `<span class="dim">${fmtPrice(row._projIn)}</span>`;
      case 'projCache': return `<span class="dim">${fmtPrice(row._projCache)}</span>`;
      case 'projOut': return `<span class="dim">${fmtPrice(row._projOut)}</span>`;
      case 'ctx': return fmtCtx(row.ctx);
      case 'toks': return row.toks == null ? '<span class="dim">—</span>' : fmtInt(row.toks);
      case 'ttft': return row.ttft == null ? '<span class="dim">—</span>' : fmtMs(row.ttft);
      case 'uptime': {
        if (row.uptime == null) return '<span class="dim">—</span>';
        // 0 % ohne Messwerte heißt bei OpenRouter "keine Daten", nicht "Ausfall"
        if (row.uptime === 0 && row.toks == null && row.ttft == null) return '<span class="dim">—</span>';
        const cls = row.uptime >= 99 ? '' : row.uptime >= 95 ? 'class="dim"' : 'class="neg"';
        return `<span ${cls}>${fmtPct(row.uptime)}</span>`;
      }
      case 'hit': {
        // Ohne Cache-Tarif ist die Quote bedeutungslos
        if (row.cache == null) return '<span class="dim">—</span>';
        if (state.cost.cacheMode === 'none') return '<span class="dim">0 %</span>';
        // Fällt die Seite auf die Log-Quote zurück, wird das markiert
        const fromLog = state.cost.cacheMode === 'provider' && row.hit == null;
        const badge = fromLog ? ` <span class="badge">${escapeHtml(t('badge.log'))}</span>` : '';
        return fmtPct(row._hitUsed) + badge;
      }
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
      return `<th ${aria}><button type="button" data-key="${col.key}" data-tip="${escapeAttr(t(COL_TIP[col.key]))}">${escapeHtml(columnLabel(col))}${ind}</button></th>`;
    }).join('') + '</tr>';

    $$('#tbl thead button').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (state.sort.key === key) state.sort.dir *= -1;
        else state.sort = { key, dir: 1 };
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
      const msg = allRows().length ? t('table.noRows') : t('table.empty');
      tbody.innerHTML = `<tr><td colspan="${cols.length}" class="dim is-left">${escapeHtml(msg)}</td></tr>`;
      return;
    }

    const cheapest = Math.min(...list.map(r => r._proj1000));
    const fastest = Math.max(...list.map(r => r.toks ?? -Infinity));

    tbody.innerHTML = list.map(row => {
      const cls = [
        row.status !== 0 ? 'is-degraded' : '',
        state.linked === row.tag ? 'is-linked' : '',
      ].filter(Boolean).join(' ');

      const cells = cols.map(col => {
        if (col.key === 'provider') {
          const badges = [];
          if (row.toks != null && row.toks === fastest) badges.push(`<span class="badge badge--good">${escapeHtml(t('badge.fastest'))}</span>`);
          if (row._proj1000 === cheapest) badges.push(`<span class="badge badge--good">${escapeHtml(t('badge.cheapest'))}</span>`);
          if (row.status !== 0) badges.push(`<span class="badge badge--bad">${escapeHtml(t('badge.degraded'))}</span>`);
          if (state.profile && state.profile.provs && state.profile.provs[row.provider]) {
            badges.push(`<span class="badge">${escapeHtml(t('badge.inLog'))}</span>`);
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
      return `<button class="colchip" type="button" data-key="${col.key}" aria-pressed="${on}">${escapeHtml(columnLabel(col))}</button>`;
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
    const total = allRows().length;
    const degraded = list.filter(r => r.status !== 0).length;
    const missing = list.filter(r => r.toks == null && r.ttft == null).length;
    const parts = [t('table.eps', { n: fmtInt(list.length) })];

    if (list.length !== total) parts.push(t('table.hidden', { n: fmtInt(total - list.length) }));
    parts.push(t('table.prov', { n: fmtInt(new Set(list.map(r => r.provider)).size) }));
    if (degraded) parts.push(t('table.degraded', { n: fmtInt(degraded) }));
    if (missing) parts.push(t('table.missing', { n: fmtInt(missing) }));

    const outs = list.map(r => r.out).filter(v => v != null);
    if (outs.length) {
      parts.push(t('table.range', { min: fmtPrice(Math.min(...outs)), max: fmtPrice(Math.max(...outs)) }));
    }
    $('#tableNote').textContent = parts.join(' · ');

    if (m) {
      $('#modelHint').textContent = t('model.hint', {
        id: m.id,
        ctx: fmtCtx(m.ctx),
        modes: m.outputs ? m.outputs.join('/') : '?',
      });
    }
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

  /* ------------------------------------------------------------ Anbieterfilter */

  let providerQuery = '';

  function renderProviderFilter() {
    const stats = providerStats();
    const shown = stats.filter(s => !s.hidden).length;
    $('#providerCount').textContent = state.hiddenProviders.size
      ? `${fmtInt(shown)}/${fmtInt(stats.length)}`
      : fmtInt(stats.length);

    const list = $('#providerList');
    const q = providerQuery.trim().toLowerCase();
    const items = stats.filter(s => !q || s.name.toLowerCase().includes(q));

    if (!items.length) {
      list.innerHTML = `<div class="provider-panel__empty">${escapeHtml(t('provider.empty'))}</div>`;
      return;
    }

    list.innerHTML = items.map(s => `
      <label class="provider-opt">
        <input type="checkbox" data-provider="${escapeAttr(s.name)}" ${s.hidden ? '' : 'checked'}>
        <span class="provider-opt__name">${escapeHtml(s.name)}</span>
        <span class="provider-opt__eps">${fmtInt(s.eps)}</span>
      </label>`).join('');

    $$('#providerList input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.dataset.provider;
        if (cb.checked) state.hiddenProviders.delete(name); else state.hiddenProviders.add(name);
        render();
      });
    });
  }

  function setAllProviders(hidden) {
    state.hiddenProviders = hidden ? new Set(providerStats().map(s => s.name)) : new Set();
    render();
  }

  function initProviderFilter() {
    const btn = $('#providerBtn');
    const panel = $('#providerPanel');

    const toggle = open => {
      const next = open == null ? panel.hidden : open;
      panel.hidden = !next;
      btn.setAttribute('aria-expanded', String(next));
      if (next) $('#providerSearch').focus();
    };

    btn.addEventListener('click', () => toggle());
    // Klick außerhalb schließt das Panel — Klicks darin (auch auf die Häkchen) nicht
    document.addEventListener('pointerdown', e => {
      if (!$('#providerFilter').contains(e.target)) toggle(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

    $('#providerSearch').addEventListener('input', e => {
      providerQuery = e.target.value;
      renderProviderFilter();
    });
    $('#providerAll').addEventListener('click', () => setAllProviders(false));
    $('#providerAllEn').addEventListener('click', () => setAllProviders(false));
    $('#providerNone').addEventListener('click', () => setAllProviders(true));
    $('#providerNoneEn').addEventListener('click', () => setAllProviders(true));
  }

  /* -------------------------------------------------------------------- Export */

  const round4 = v => (v == null ? null : Math.round(v * 10000) / 10000);

  function quoteCsv(s, sep) {
    const str = String(s ?? '');
    return (str.includes(sep) || str.includes('"') || str.includes('\n'))
      ? '"' + str.replace(/"/g, '""') + '"'
      : str;
  }

  function exportCsv() {
    const cols = visibleColumns();
    const list = sortedRows();
    const msg = $('#csvMsg');

    if (!list.length) {
      flashMsg(msg, t('export.empty'), true);
      return;
    }

    // Semikolon + Komma-Dezimal in der deutschen Fassung (Excel-Standard),
    // Komma + Punkt in der englischen — so öffnet sich die Datei ohne Import-Dialog.
    const sep = lang === 'de' ? ';' : ',';
    const dec = v => (v == null ? '' : String(v).replace('.', lang === 'de' ? ',' : '.'));

    const lines = [cols.map(c => quoteCsv(columnLabel(c), sep)).join(sep)];

    for (const row of list) {
      const cells = cols.map(col => {
        switch (col.key) {
          case 'provider': return quoteCsv(row.provider, sep);
          case 'quant': return row.quant;
          case 'in': return dec(row.in);
          case 'out': return dec(row.out);
          case 'cache': return row.cache == null ? '' : dec(row.cache);
          case 'projTotal': return dec(round4(row._proj));
          case 'proj1000': return dec(round4(row._proj1000));
          case 'projIn': return dec(round4(row._projIn));
          case 'projCache': return dec(round4(row._projCache));
          case 'projOut': return dec(round4(row._projOut));
          case 'ctx': return row.ctx ?? '';
          case 'toks': return row.toks == null ? '' : dec(row.toks);
          case 'ttft': return row.ttft == null ? '' : dec(row.ttft);
          case 'uptime':
            return (row.uptime == null || (row.uptime === 0 && row.toks == null && row.ttft == null))
              ? '' : dec(row.uptime);
          case 'hit': return row.hit == null ? '' : dec(row.hit);
          case 'discount': return row.discount ? dec(round4(row.discount * 100)) : '';
          case 'maxOut': return row.maxOut ?? '';
          default: return '';
        }
      });
      lines.push(cells.join(sep));
    }

    const model = (state.modelId || 'model').replace(/[^a-z0-9.-]+/gi, '-');
    const date = new Date().toISOString().slice(0, 10);
    const name = `openrouter-provider-${model}-${date}.csv`;

    const blob = new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    flashMsg(msg, t('export.done', { name }), false);
  }

  function flashMsg(el, text, isError) {
    if (!el) return;
    el.className = 'msg ' + (isError ? 'is-err' : 'is-ok');
    el.textContent = text;
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(() => {
      el.className = 'msg';
      el.textContent = '';
    }, 4500);
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
    svg.innerHTML = '';
    const list = rows();
    const { x: xk, y: yk, logX, logY } = state.axes;

    const pts = list
      .map(r => ({ r, x: sortValue(r, xk), y: sortValue(r, yk) }))
      .filter(p => p.x != null && p.y != null && (!logX || p.x > 0) && (!logY || p.y > 0));

    const skipped = list.length - pts.length;

    if (!pts.length) {
      const empty = svgEl('text', { x: CH.w / 2, y: CH.h / 2, 'text-anchor': 'middle', class: 'axis-label' });
      empty.textContent = t('chart.empty');
      svg.append(empty);
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

    const xt = logX ? logTicks(xlo, xhi) : linearTicks(xlo, xhi, 6);
    const yt = logY ? logTicks(ylo, yhi) : linearTicks(ylo, yhi, 6);

    for (const v of yt) {
      const y = Y(v);
      g.append(svgEl('line', { x1: CH.l, y1: y, x2: CH.w - CH.r, y2: y, class: 'grid-line' }));
      const el = svgEl('text', { x: CH.l - 8, y: y + 3.5, 'text-anchor': 'end', class: 'tick-label' });
      el.textContent = fmtAxis(yk, v);
      g.append(el);
    }
    for (const v of xt) {
      const x = X(v);
      g.append(svgEl('line', { x1: x, y1: CH.t, x2: x, y2: CH.h - CH.b, class: 'grid-line' }));
      const el = svgEl('text', { x, y: CH.h - CH.b + 17, 'text-anchor': 'middle', class: 'tick-label' });
      el.textContent = fmtAxis(xk, v);
      g.append(el);
    }

    g.append(svgEl('line', { x1: CH.l, y1: CH.h - CH.b, x2: CH.w - CH.r, y2: CH.h - CH.b, class: 'grid-line grid-line--base' }));
    g.append(svgEl('line', { x1: CH.l, y1: CH.t, x2: CH.l, y2: CH.h - CH.b, class: 'grid-line grid-line--base' }));

    const logSuffix = lang === 'de' ? ' · logarithmisch' : ' · logarithmic';
    const xl = svgEl('text', { x: (CH.l + CH.w - CH.r) / 2, y: CH.h - 10, 'text-anchor': 'middle', class: 'axis-label' });
    xl.textContent = metricLabel(xk) + (logX ? logSuffix : '');
    g.append(xl);
    const yl = svgEl('text', {
      x: 14, y: (CH.t + CH.h - CH.b) / 2, 'text-anchor': 'middle', class: 'axis-label',
      transform: `rotate(-90 14 ${(CH.t + CH.h - CH.b) / 2})`,
    });
    yl.textContent = metricLabel(yk) + (logY ? logSuffix : '');
    g.append(yl);

    // Beschriftungsschwellen: 3 günstigste auf X, 2 schnellste auf Y
    const xsSorted = pts.map(p => p.x).sort((a, b) => a - b);
    const ysSorted = pts.map(p => p.y).sort((a, b) => b - a);
    const xCut = xsSorted[Math.min(2, xsSorted.length - 1)];
    const yCut = ysSorted[Math.min(1, ysSorted.length - 1)];

    const ptsG = svgEl('g');
    g.append(ptsG);
    for (const p of pts) {
      const r = p.r;
      const cx = X(p.x), cy = Y(p.y);
      const rad = 4.5 + ((r.uptime ?? 50) / 100) * 6.5;
      const pg = svgEl('g', { class: 'point', 'data-tag': r.tag, tabindex: '0' });
      const dot = svgEl('circle', {
        cx, cy, r: rad, 'data-r': rad,
        fill: quantColor(r.quant), 'fill-opacity': 0.82,
        stroke: r.status !== 0 ? '#b3261e' : 'none',
        'stroke-width': r.status !== 0 ? 2 : 0,
      });
      dot.setAttribute('class', 'dot');
      pg.append(dot);

      const showLabel = pts.length <= 14 || p.x <= xCut || p.y >= yCut;
      if (showLabel) {
        const lbl = svgEl('text', { x: cx + rad + 5, y: cy + 3.5, class: 'tick-label point-label' });
        lbl.textContent = r.provider.length > 18 ? r.provider.slice(0, 17) + '…' : r.provider;
        pg.append(lbl);
      }

      pg.addEventListener('pointerenter', e => { showTip(e, r, xk, yk); linkRow(r.tag); });
      pg.addEventListener('pointermove', moveTip);
      pg.addEventListener('pointerleave', () => { hideTip(); linkRow(null); });
      pg.addEventListener('focus', () => { showTip({ clientX: cx, clientY: cy }, r, xk, yk); });
      pg.addEventListener('blur', hideTip);
      ptsG.append(pg);
    }

    const note = [];
    if (skipped) note.push(t('chart.skipped', { n: fmtInt(skipped) }));
    if (logX || logY) note.push(t('chart.logNote'));
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
      ? `<span class="chart-legend__item"><span class="qdot qdot--ring"></span>${escapeHtml(t('legend.degraded'))}</span>`
      : '';
    const cost = state.profile ? t('legend.costLog') : t('legend.costModel');
    box.innerHTML = items + degraded +
      `<span class="chart-legend__item chart-legend__note">${escapeHtml(t('legend.size', { cost }))}</span>`;
  }

  /* ------------------------------------------------------------------- Tooltip */

  const tipEl = () => $('#tip');

  function showTip(ev, row, xk, yk) {
    const tip = tipEl();
    const line = (k, v) => `<div class="tip-row"><span class="tip-k">${escapeHtml(k)}</span><span>${v}</span></div>`;
    tip.innerHTML =
      `<div><b>${escapeHtml(row.provider)}</b></div>` +
      (row.tag ? `<div class="tip-mono">${escapeHtml(row.tag)}</div>` : '') +
      line(t('tip.quantRow'), escapeHtml(row.quant === 'unknown' ? t('quant.unknown') : row.quant)) +
      line(metricLabel(xk), fmtMetric(xk, sortValue(row, xk))) +
      line(metricLabel(yk), fmtMetric(yk, sortValue(row, yk))) +
      line(t('tip.io'), `${fmtPrice(row.in)} / ${fmtPrice(row.out)}`) +
      line(t('tip.cacheRow'), row.cache == null ? t('tip.noTariff') : fmtPrice(row.cache)) +
      line(t('tip.costRow'), fmtPrice(row._proj)) +
      line(t('tip.hitRow'), fmtPct(row._hitUsed)) +
      line('TTFT · tok/s', `${fmtMs(row.ttft)} · ${row.toks == null ? '—' : fmtInt(row.toks)}`) +
      line(t('tip.uptimeRow'), fmtPct(row.uptime)) +
      (row.status !== 0 ? `<div class="tip-row tip-bad">${escapeHtml(t('tip.degradedRow'))}</div>` : '');
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

  // Tooltip-Text je Sprache: data-tip-de / data-tip-en, sonst data-tip
  function tipOf(el) {
    return el.dataset['tip' + (lang === 'de' ? 'De' : 'En')] || el.dataset.tip || '';
  }

  function bindTips(root) {
    $$('[data-tip],[data-tip-de],[data-tip-en]', root).forEach(el => {
      if (el.dataset.tipBound) return;
      el.dataset.tipBound = '1';
      const show = e => {
        const text = tipOf(el);
        if (!text) return;
        const tip = tipEl();
        tip.innerHTML = `<div>${escapeHtml(text)}</div>`;
        tip.classList.add('is-on');
        moveTip(e);
      };
      el.addEventListener('pointerenter', show);
      el.addEventListener('pointermove', moveTip);
      el.addEventListener('pointerleave', hideTip);
      el.addEventListener('focus', () => {
        const text = tipOf(el);
        if (!text) return;
        const tip = tipEl();
        tip.innerHTML = `<div>${escapeHtml(text)}</div>`;
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
      return models.slice().sort((a, b) => b.endpoints.length - a.endpoints.length).slice(0, 60);
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
      list.innerHTML = `<div class="picker__empty">${escapeHtml(t('search.empty'))}</div>`;
    } else {
      list.innerHTML = pickerResults.map((m, i) => {
        const outs = m.endpoints.map(e => e.out).filter(v => v != null);
        const minOut = outs.length ? Math.min(...outs) : null;
        return `<div class="picker__opt" role="option" id="opt-${i}" data-id="${escapeAttr(m.id)}" aria-selected="${i === pickerIndex}">
          <span class="picker__opt-name">${escapeHtml(m.name || m.id)}</span>
          <span class="picker__opt-meta">${escapeHtml(t('search.providers', { n: m.endpoints.length }))}<br>${escapeHtml(t('search.from', { p: fmtPrice(minOut) }))}</span>
          <span class="picker__opt-id">${escapeHtml(m.id)}</span>
        </div>`;
      }).join('');
    }
    list.hidden = false;
    $('#modelSearch').setAttribute('aria-expanded', 'true');
    $$('#modelList .picker__opt').forEach(el => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); selectModel(el.dataset.id); });
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
    if (state.modelId !== m.id) state.hiddenProviders = new Set();   // Filter gilt je Modell
    state.modelId = m.id;
    try { localStorage.setItem(LS.model, m.id); } catch (e) { /* gesperrt */ }
    $('#modelSearch').value = m.name || m.id;
    $('#pickerClear').hidden = true;
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
    if (rowsCsv.length < 2) throw new Error(t('csv.noRows'));
    const head = rowsCsv[0].map(h => h.trim().toLowerCase());
    const ix = name => head.indexOf(name);
    const missing = ['tokens_prompt', 'tokens_completion', 'model_permaslug'].filter(n => ix(n) < 0);
    if (missing.length) throw new Error(t('csv.missingColumn', { cols: missing.join(', ') }));

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
    if (!st.calls) throw new Error(t('csv.noModel'));
    return st;
  }

  function applyProfile(st, fileName) {
    const promptTotal = st.tok.in + st.tok.cached;
    state.profile = {
      calls: st.calls,
      prompt: promptTotal / st.calls,
      completion: st.tok.out / st.calls,
      inputTotal: promptTotal,
      outputTotal: st.tok.out,
      logHit: promptTotal ? (st.tok.cached / promptTotal) * 100 : 0,
      logged: st.logged,
      hasCost: st.hasCost,
      models: st.models,
      provs: st.provs,
      from: st.from,
      to: st.to,
      name: fileName,
    };

    // Eingabefelder zeigen die Log-Summen und sind gesperrt
    syncCostInputs(true);
    if (state.cost.cacheMode === 'none') setCacheMode('provider');

    const msg = $('#csvMsg');
    msg.className = 'msg is-ok';
    msg.textContent = t('msg.readOk', {
      name: fileName,
      calls: fmtInt(st.calls),
      in: fmtInt(state.profile.prompt),
      out: fmtInt(state.profile.completion),
      hit: fmtPct(state.profile.logHit),
    });

    renderCsvKpis();
    $('#csvReset').hidden = false;
    render();
  }

  // "02.11. 19:58 – 15:59" bzw. mit Datum, wenn der Log über Mitternacht geht
  function fmtSpan(from, to) {
    const withDate = ts => `${ts.slice(8, 10)}.${ts.slice(5, 7)}. ${ts.slice(11, 16)}`;
    const sameDay = from.slice(0, 10) === to.slice(0, 10);
    return `${withDate(from)} – ${sameDay ? to.slice(11, 16) : withDate(to)}`;
  }

  function renderCsvKpis() {
    const p = state.profile;
    const box = $('#csvKpis');
    if (!p) { box.innerHTML = ''; return; }
    const models = Object.entries(p.models).sort((a, b) => b[1].calls - a[1].calls);
    const top = models[0];
    const kpi = (k, v) => `<div class="kpi"><span class="kpi__k">${escapeHtml(k)}</span><span class="kpi__v">${v}</span></div>`;
    const parts = [
      kpi(t('kpi.calls'), fmtInt(p.calls)),
      kpi(t('kpi.inputPerCall'), fmtInt(p.prompt)),
      kpi(t('kpi.outputPerCall'), fmtInt(p.completion)),
      kpi(t('kpi.cacheHit'), fmtPct(p.logHit)),
      kpi(t('kpi.period'), p.from ? fmtSpan(p.from, p.to) : '—'),
    ];
    if (p.hasCost) parts.push(kpi(t('kpi.logged'), fmtPrice(p.logged)));
    if (p.hasCost && p.calls) parts.push(kpi(t('kpi.loggedPerCall'), fmtPrice(p.logged / p.calls)));
    if (models.length > 1) parts.push(kpi(t('kpi.models'), String(models.length)));
    box.innerHTML = parts.join('');

    // Hinweis, wenn das Log ein anderes Modell nutzt als die Ansicht.
    // Die CSV enthält den datierten Permaslug (…-20261017), die Seite arbeitet
    // mit der Modell-Kennung — deshalb über id UND slug suchen.
    const match = top && state.data.models.find(m => m.id === top[0] || m.slug === top[0]);
    if (match && match.id !== state.modelId) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.textContent = t('kpi.switchTo', { name: match.name || match.id });
      btn.addEventListener('click', () => selectModel(match.id));
      const wrap = document.createElement('div');
      wrap.className = 'kpi';
      wrap.append(btn);
      box.append(wrap);
    }
  }

  function resetProfile() {
    state.profile = null;
    state.cost.calls = 1000;
    state.cost.inputTotal = 2000000;
    state.cost.outputTotal = 500000;
    syncCostInputs(false);
    $('#csvMsg').className = 'msg';
    $('#csvMsg').textContent = '';
    $('#csvKpis').innerHTML = '';
    $('#csvReset').hidden = true;
    render();
  }

  function readCsvFile(file) {
    const msg = $('#csvMsg');
    msg.className = 'msg';
    msg.textContent = t('msg.reading', { name: file.name });
    const rd = new FileReader();
    rd.onload = () => {
      try {
        applyProfile(profileFromCSV(String(rd.result)), file.name);
      } catch (e) {
        msg.className = 'msg is-err';
        msg.textContent = t('msg.readErr', { name: file.name, msg: e.message });
      }
    };
    rd.onerror = () => {
      msg.className = 'msg is-err';
      msg.textContent = t('msg.fileError');
    };
    rd.readAsText(file);
  }

  function initCsv() {
    const input = $('#csvFile');
    const panel = $('#nutzung');

    $('#csvBtn').addEventListener('click', () => input.click());
    $('#csvReset').addEventListener('click', resetProfile);
    input.addEventListener('change', () => {
      if (input.files[0]) readCsvFile(input.files[0]);
      input.value = '';
    });

    // Datei überall auf dem Nutzungsprofil ablegen
    ['dragenter', 'dragover'].forEach(ev => panel.addEventListener(ev, e => {
      e.preventDefault();
      panel.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach(ev => panel.addEventListener(ev, e => {
      e.preventDefault();
      panel.classList.remove('is-over');
    }));
    panel.addEventListener('drop', e => {
      const f = e.dataTransfer?.files?.[0];
      if (f) readCsvFile(f);
    });
  }

  /* ------------------------------------------------------------- Kostenmodell */

  // Tokenmengen stehen in Millionen im Feld, intern wird in Token gerechnet.
  const toMio = v => Math.round(((v || 0) / 1e6) * 1000) / 1000;

  function syncCostInputs(disabled) {
    const p = state.profile;
    $('#inCalls').value = Math.round(p ? p.calls : state.cost.calls);
    $('#inInputTotal').value = toMio(p ? p.inputTotal : state.cost.inputTotal);
    $('#inOutputTotal').value = toMio(p ? p.outputTotal : state.cost.outputTotal);
    ['#inCalls', '#inInputTotal', '#inOutputTotal'].forEach(sel => { $(sel).disabled = !!disabled; });
    updateUsageInfo();
  }

  // Absolute Summen des aktuellen Profils (aus CSV oder aus den Feldern)
  function profileTotals() {
    if (state.profile) {
      return { calls: state.profile.calls, input: state.profile.inputTotal, output: state.profile.outputTotal };
    }
    const calls = Math.max(0, Number($('#inCalls').value) || 0);
    return {
      calls,
      input: Math.max(0, Number($('#inInputTotal').value) || 0) * 1e6,
      output: Math.max(0, Number($('#inOutputTotal').value) || 0) * 1e6,
    };
  }

  // Welche Cache-Quote gilt im Profil? Bei „je Anbieter“ der Durchschnitt der
  // Endpoints, sonst die Log-Quote bzw. 0.
  function usageCache() {
    if (state.cost.cacheMode === 'none') return { value: 0, note: 'none' };
    if (state.cost.cacheMode === 'log') return { value: state.profile ? state.profile.logHit : null, note: 'log' };
    const list = rows().filter(r => r.cache != null && r.hit != null);
    if (!list.length) return { value: state.profile ? state.profile.logHit : null, note: 'log' };
    return { value: list.reduce((s, r) => s + r.hit, 0) / list.length, note: 'avg' };
  }

  // Infozeile: Ø pro Call, Input/Output-Verhältnis, Cache-Quote des Profils
  function updateUsageInfo() {
    const el = $('#infoPerCall');
    if (!el) return;
    const { calls, input, output } = profileTotals();

    el.textContent = calls
      ? t('usage.perCall', { in: fmtInt(input / calls), out: fmtInt(output / calls) })
      : t('usage.perCallUnknown');

    const ratio = output > 0 ? input / output : null;
    $('#infoRatio').textContent = ratio == null ? '—' : fmtNum(ratio, 1) + ' : 1';

    const cache = usageCache();
    $('#infoCache').textContent = cache.value == null
      ? '—'
      : (cache.note === 'none' ? '0 %' : fmtPct(cache.value));
    $('#infoCacheNote').textContent = cache.note === 'avg'
      ? t('usage.cacheAvg')
      : cache.note === 'log' ? t('usage.cacheLog') : cache.note === 'none' ? t('usage.cacheNone') : '';
  }

  function setCacheMode(mode) {
    state.cost.cacheMode = mode;
    $('#cacheMode').value = mode;
    saveCost();
  }

  function initCostModel() {
    const bind = (sel, key, factor = 1) => {
      $(sel).addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        state.cost[key] = Number.isFinite(v) ? v * factor : 0;
        updateUsageInfo();
        saveCost();
        render();
      });
    };
    bind('#inCalls', 'calls');
    bind('#inInputTotal', 'inputTotal', 1e6);    // Feld in Mio
    bind('#inOutputTotal', 'outputTotal', 1e6);  // Feld in Mio
    $('#cacheMode').addEventListener('change', e => {
      state.cost.cacheMode = e.target.value;
      saveCost();
      render();
    });
  }

  /* ------------------------------------------------------------------- Presets */

  function renderPresets() {
    const box = $('#presets');
    box.innerHTML =
      `<span class="presets__label" data-lang-block="de">${escapeHtml(STR.de['presets.label'])}</span>` +
      `<span class="presets__label" data-lang-block="en">${escapeHtml(STR.en['presets.label'])}</span>` +
      PRESETS.map(p => {
        const tip = t('preset.' + p.id + '.tip');
        return `<button class="chip" type="button" data-id="${p.id}" data-tip="${escapeAttr(tip)}" aria-pressed="${state.preset === p.id}">${escapeHtml(t('preset.' + p.id))}</button>`;
      }).join('');
    $$('#presets .chip').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.id));
    });
    bindTips(box);
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
    const opts = METRICS.map(m => `<option value="${m.key}">${escapeHtml(t(METRIC_LABEL[m.key]))}</option>`).join('');
    $('#axisX').innerHTML = opts;
    $('#axisY').innerHTML = opts;
    syncAxisControls();

    const onAxis = (sel, key) => $(sel).addEventListener('change', e => {
      state.axes[key] = e.target.value;
      state.axes[key === 'x' ? 'logX' : 'logY'] = metricByKey(state.axes[key]).log;
      state.preset = null;
      syncAxisControls();
      saveAxes();
      renderPresets();
      renderChart();
    });
    onAxis('#axisX', 'x');
    onAxis('#axisY', 'y');

    const onLog = (sel, key) => $(sel).addEventListener('change', e => {
      state.axes[key] = e.target.checked;
      state.preset = null;
      saveAxes();
      renderPresets();
      renderChart();
    });
    onLog('#logX', 'logX');
    onLog('#logY', 'logY');
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
    const defaultHidden = COLUMNS
      .filter(c => !c.always && !DEFAULT_COLS.includes(c.key))
      .map(c => c.key);
    try {
      const hidden = JSON.parse(localStorage.getItem(LS.cols) || 'null');
      state.hidden = new Set(Array.isArray(hidden) ? hidden : defaultHidden);

      const axes = JSON.parse(localStorage.getItem(LS.axes) || 'null');
      const valid = axes && METRICS.some(m => m.key === axes.x) && METRICS.some(m => m.key === axes.y);
      state.axes = valid
        ? { ...state.axes, ...axes }
        : { x: 'proj1000', y: 'toks', logX: true, logY: false };

      const cost = JSON.parse(localStorage.getItem(LS.cost) || 'null');
      if (cost && typeof cost === 'object') {
        // Ältere Fassung (prompt/completion pro Call) auf absolute Summen übertragen
        if (cost.inputTotal == null && cost.prompt != null) {
          cost.calls = cost.calls || 1000;
          cost.inputTotal = cost.prompt * cost.calls;
          cost.outputTotal = (cost.completion || 0) * cost.calls;
        }
        state.cost = { ...state.cost, ...cost };
      }
    } catch (e) {
      state.hidden = new Set(defaultHidden);
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

  /* -------------------------------------------------------------------- Sprache */

  function detectLang() {
    const param = new URLSearchParams(location.search).get('lang');
    if (param === 'de' || param === 'en') return param;
    try {
      const saved = localStorage.getItem(LS.lang);
      if (saved === 'de' || saved === 'en') return saved;
    } catch (e) { /* gesperrt */ }
    return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  function applyLang(next) {
    lang = next;
    const html = document.documentElement;
    html.lang = lang;
    html.dataset.lang = lang;
    document.title = t('meta.title');

    // Optionen und Platzhalter tragen ihre Texte im data-Attribut
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });

    const input = $('#modelSearch');
    if (input) input.placeholder = t('search.placeholder');
    const psearch = $('#providerSearch');
    if (psearch) psearch.placeholder = t('provider.search');
    const clear = $('#pickerClear');
    if (clear) clear.setAttribute('aria-label', t('search.clear'));

    $('#langDe').setAttribute('aria-pressed', String(lang === 'de'));
    $('#langEn').setAttribute('aria-pressed', String(lang === 'en'));

    renderAll();
  }

  function initLang() {
    $('#langDe').addEventListener('click', () => switchLang('de'));
    $('#langEn').addEventListener('click', () => switchLang('en'));
  }

  function switchLang(next) {
    if (next === lang) return;
    try { localStorage.setItem(LS.lang, next); } catch (e) { /* gesperrt */ }
    applyLang(next);
  }

  /* -------------------------------------------------------------------- Render */

  function renderAll() {
    if (!state.data) return;
    renderPresets();
    renderChips();
    renderHead();
    renderBody();
    renderTableNote();
    renderProviderFilter();
    renderChart();
    renderCsvKpis();
    updateUsageInfo();
    renderBuiltNote();
  }

  function render() {
    if (!state.data) return;
    renderChips();
    renderHead();
    renderBody();
    renderTableNote();
    renderProviderFilter();
    renderChart();
    updateUsageInfo();
  }

  function renderBuiltNote() {
    const date = new Date().toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    $('#footBuilt').textContent = t('footer.built', { date });
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
    initLang();
    restore();
    initPicker();
    initCsv();
    initCostModel();
    initChartControls();
    initProviderFilter();
    $('#exportBtn').addEventListener('click', exportCsv);
    bindTips(document);
    syncCostInputs(false);
    setCacheMode(state.cost.cacheMode || 'provider');

    let payload;
    try {
      const res = await fetch('data/models.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
    } catch (e) {
      $('#factStamp').textContent = lang === 'de' ? 'nicht ladbar' : 'not available';
      $('#factCounts').textContent = '—';
      $('#tableNote').textContent = t('footer.loadFailed', { msg: e.message });
      return;
    }

    state.data = payload;
    const counts = payload.counts || {};
    const stamp = (payload.generated_at || '').replace('T', ' ').replace('Z', ' UTC');

    $('#factStamp').textContent = stamp || '—';
    $('#factCounts').textContent = lang === 'de'
      ? `${fmtInt(counts.models)} Modelle · ${fmtInt(counts.endpoints)} Endpoints · ${fmtInt(counts.providers)} Anbieter`
      : `${fmtInt(counts.models)} models · ${fmtInt(counts.endpoints)} endpoints · ${fmtInt(counts.providers)} providers`;
    $('#footStamp').textContent = stamp || '—';
    $('#footCounts').textContent = lang === 'de'
      ? `${fmtInt(counts.models)} Modelle · ${fmtInt(counts.endpoints)} Endpoints`
      : `${fmtInt(counts.models)} models · ${fmtInt(counts.endpoints)} endpoints`;

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

    applyLang(detectLang());
  }

  document.addEventListener('DOMContentLoaded', start);
})();
