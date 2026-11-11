// Main dashboard: materials, date-range views, headline cards, charts, CSV
// import, PNG export and the portable copy. At build time this file is
// concatenated with the other dist/*.js files inside one closure, so the
// globals BUNDLED_CSV and BUNDLED_LABELS are provided by build.mjs.
import { createView, closeView, readWorkspace } from './workspace.js';
import { parseCSV, derive, completeMonths, shiftMonth, identifyCSV, summarizeRange } from './data-utils.js';
import { buildPortableCopy } from './portable.js';

const $ = (id) => document.getElementById(id);
const materials = { WPU08: 'Lumber & wood', WPU101: 'Iron & steel', WPU133: 'Concrete products' };
const defs = {
  index: ['Price index', 'Monthly producer price index · 1982 = 100'],
  mom: ['Month-over-month change', 'Monthly percentage change · positive / negative'],
  yoy: ['Year-over-year change', 'Percentage change from the same month last year'],
  vol: [
    'Rolling 12-month volatility',
    'Sample standard deviation of the trailing 12 monthly % changes · percentage points',
  ],
};

let datasets = {};
let quality = {};
let material = 'WPU08';
let view = 'index';
let charts = {};
let groups = {};
let closed = null;

const dataKey = 'material-desk-csv-v1';
const workspaceKey = 'material-desk-workspaces-v1';
let csvData = { ...BUNDLED_CSV };
let dataLabels = { ...BUNDLED_LABELS };

const uid = () =>
  crypto.randomUUID?.() || 'view-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const current = () => groups[material]?.tabs.find((t) => t.id === groups[material].active);

const number = (v, d = 2) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const percent = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${number(v)}%`);
const pretty = (d) =>
  new Date(d + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function notify(text) {
  $('notice').hidden = !text;
  $('notice').textContent = text;
}

// ---------------------------------------------------------------- views ----

function defaultView() {
  const end = datasets[material].at(-1).date;
  return createView(uid(), shiftMonth(end, -59), end);
}

function persist() {
  try {
    localStorage.setItem(workspaceKey, JSON.stringify({ version: 1, groups }));
  } catch {
    notify('View settings could not be saved in this browser. They remain available until you reload.');
  }
}

function saveView() {
  const t = current();
  if (!t) return;
  t.from = $('from').value;
  t.to = $('to').value;
  t.view = view;
  persist();
}

function updateArrows() {
  const el = $('rangeTabs');
  $('tabsPrev').disabled = el.scrollLeft <= 1;
  $('tabsNext').disabled = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
}

function drawTabs(focus = false) {
  const el = $('rangeTabs');
  el.replaceChildren();
  const g = groups[material];
  if (!g) return;
  el.classList.toggle('scrolling', g.tabs.length > 10);
  g.tabs.forEach((t, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'range-tab' + (t.id === g.active ? ' selected' : '');
    const b = document.createElement('button');
    b.className = 'tab-select';
    b.id = 'tab-' + t.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t.id === g.active));
    b.setAttribute('aria-controls', 'charts');
    b.tabIndex = t.id === g.active ? 0 : -1;
    b.title = `View ${i + 1}: ${pretty(t.from)} to ${pretty(t.to)}`;
    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = 'View ' + (i + 1);
    const dates = document.createElement('span');
    dates.className = 'tab-dates';
    dates.textContent = t.from + ' → ' + t.to;
    b.append(name, dates);
    b.onclick = () => activate(t.id, true);
    b.onkeydown = (e) => {
      const index = g.tabs.findIndex((v) => v.id === t.id);
      let next;
      if (e.key === 'ArrowRight') next = (index + 1) % g.tabs.length;
      if (e.key === 'ArrowLeft') next = (index - 1 + g.tabs.length) % g.tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = g.tabs.length - 1;
      if (next != null) {
        e.preventDefault();
        activate(g.tabs[next].id, true);
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        removeView(t.id);
      }
    };
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close view ' + (i + 1);
    close.setAttribute('aria-label', close.title);
    close.onclick = () => removeView(t.id);
    wrap.append(b, close);
    el.append(wrap);
  });
  $('charts').setAttribute('aria-labelledby', 'tab-' + g.active);
  $('undoClose').hidden = !closed;
  $('addView').disabled = g.tabs.length >= 100;
  $('addView').title =
    g.tabs.length >= 100 ? 'Maximum 100 views per material' : 'Copy current dates and chart settings';
  requestAnimationFrame(() => {
    const active = document.getElementById('tab-' + g.active);
    if (focus) active?.focus();
    if (active) {
      const box = active.parentElement.getBoundingClientRect();
      const bounds = el.getBoundingClientRect();
      if (box.left < bounds.left) el.scrollLeft -= bounds.left - box.left;
      else if (box.right > bounds.right) el.scrollLeft += box.right - bounds.right;
    }
    updateArrows();
  });
}

function activate(id, focus = false) {
  notify('');
  groups[material].active = id;
  const t = current();
  $('from').value = t.from;
  $('to').value = t.to;
  view = t.view;
  document.querySelectorAll('#views button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
  });
  document.querySelectorAll('#presets button').forEach((b) => {
    b.classList.toggle('active', t.preset !== null && +b.dataset.years === t.preset);
  });
  render();
  drawTabs(focus);
}

function removeView(id) {
  const g = groups[material];
  const wasLast = g.tabs.length === 1;
  closed = {
    material,
    tab: structuredClone(g.tabs.find((t) => t.id === id)),
    index: g.tabs.findIndex((t) => t.id === id),
  };
  groups[material] = closeView(g, id, defaultView);
  activate(groups[material].active, true);
  notify(
    wasLast
      ? 'Last view closed. A fresh default view is ready. Undo close restores the original.'
      : 'View closed. Use Undo close to restore it.',
  );
}

function syncMaterials() {
  document.querySelectorAll('#materials button').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === material);
    b.setAttribute('aria-pressed', String(b.dataset.id === material));
  });
}

$('addView').onclick = () => {
  if (!validate() || groups[material].tabs.length >= 100) return;
  const t = createView(uid(), $('from').value, $('to').value, current());
  groups[material].tabs.push(t);
  activate(t.id, true);
};

$('undoClose').onclick = () => {
  if (!closed) return;
  const c = closed;
  if (groups[c.material].tabs.length >= 100) {
    notify('Close a view first; this material already has 100 views.');
    return;
  }
  groups[c.material].tabs.splice(c.index, 0, c.tab);
  closed = null;
  material = c.material;
  syncMaterials();
  activate(c.tab.id, true);
  notify('Closed view restored.');
};

$('tabsPrev').onclick = () => $('rangeTabs').scrollBy({ left: -450, behavior: 'smooth' });
$('tabsNext').onclick = () => $('rangeTabs').scrollBy({ left: 450, behavior: 'smooth' });
$('rangeTabs').onscroll = updateArrows;
new ResizeObserver(updateArrows).observe($('rangeTabs'));

// ------------------------------------------------------------ rendering ----

function validate() {
  const start = $('from').value;
  const end = $('to').value;
  let error = '';
  if (!start || !end) error = 'Choose both a start and an end month.';
  else if (start > end) error = 'The start month must be on or before the end month.';
  else if (start < $('from').min || end > $('to').max) {
    error = 'Choose dates within the available history: ' + $('from').min + ' to ' + $('to').max + '.';
  }
  $('rangeError').hidden = !error;
  $('rangeError').textContent = error;
  for (const id of ['from', 'to']) {
    $(id).setAttribute('aria-invalid', String(!!error));
    $(id).setAttribute('aria-describedby', 'rangeError');
  }
  $('export').disabled = !!error;
  $('reset').disabled = !!error;
  return !error;
}

function disposeCharts() {
  Object.values(charts).forEach((c) => c.dispose());
  charts = {};
}

// Headline cards show the latest month in the selection: its index, its
// month-over-month and year-over-year change, and its rolling 12-month
// volatility. These are properties of that month, so they do not change when
// only the start of the range moves. The summary line describes the whole
// selection instead.
function renderHeadline(summary) {
  const last = summary.last;
  $('level').textContent = number(last?.index, 3);
  $('mom').textContent = percent(last?.mom);
  $('yoy').textContent = percent(last?.yoy);
  $('vol').textContent = last?.vol == null ? '—' : number(last.vol) + ' pp';
  $('metricDate').textContent = last ? pretty(last.date) : 'No observations';
  const parts = [
    `${pretty($('from').value)} – ${pretty($('to').value)} · ${summary.months} selected month${summary.months === 1 ? '' : 's'}`,
    'Start-to-end change: ' + percent(summary.rangeChange),
  ];
  if (summary.high) parts.push(`High ${number(summary.high.index, 3)} (${pretty(summary.high.date)})`);
  if (summary.low) parts.push(`Low ${number(summary.low.index, 3)} (${pretty(summary.low.date)})`);
  parts.push(
    summary.rangeVolatility == null
      ? 'Range volatility: n/a (needs a complete run of monthly changes)'
      : `Range volatility: ${number(summary.rangeVolatility)} pp (sample SD of ${summary.returnCount} monthly changes)`,
  );
  $('rangeSummary').textContent = parts.join(' · ');
}

function render() {
  if (!validate()) {
    disposeCharts();
    $('charts').innerHTML = '<div class="empty-chart">Correct the date range above to display charts.</div>';
    for (const id of ['level', 'mom', 'yoy', 'vol']) $(id).textContent = '—';
    $('metricDate').textContent = 'Invalid date range';
    $('rangeSummary').textContent = 'Correct the range to calculate statistics.';
    window.dispatchEvent(new Event('materialdesk:context'));
    return;
  }
  saveView();
  drawTabs();
  const summary = summarizeRange(datasets[material], $('from').value, $('to').value);
  renderHeadline(summary);
  $('freshness').textContent =
    `Latest: ${pretty(datasets[material].at(-1).date)} · ${dataLabels[material] || 'bundled snapshot · Nov 10, 2026'}`;
  $('seriesSource').replaceChildren();
  const link = document.createElement('a');
  link.href = 'https://fred.stlouisfed.org/series/' + material;
  link.textContent = material + ' ↗';
  link.target = '_blank';
  link.rel = 'noreferrer';
  $('seriesSource').append('Source: BLS via FRED · ', link, ' · Monthly · Not seasonally adjusted');

  disposeCharts();
  $('charts').replaceChildren();
  $('charts').classList.toggle('all', view === 'all');
  for (const key of view === 'all' ? Object.keys(defs) : [view]) {
    const section = document.createElement('section');
    section.className = 'chart-section';
    const head = document.createElement('div');
    head.className = 'chart-heading';
    head.innerHTML = `<div><h2>${materials[material]} / ${defs[key][0]}</h2><p>${defs[key][1]}</p></div>`;
    const exportButton = document.createElement('button');
    exportButton.textContent = '↓ PNG';
    exportButton.setAttribute('aria-label', `Export ${defs[key][0]} as PNG`);
    exportButton.onclick = () => exportDialog(key);
    head.append(exportButton);
    const canvas = document.createElement('div');
    canvas.className = 'chart';
    section.append(head, canvas);
    $('charts').append(section);
    const chart = echarts.init(canvas, null, { renderer: 'canvas' });
    charts[key] = chart;
    chart.setOption(option(key, summary.rows));
    const saved = current()?.zoom[key];
    if (saved) chart.dispatchAction({ type: 'dataZoom', start: saved.start, end: saved.end });
    chart.on('datazoom', () => {
      const zoom = chart.getOption().dataZoom[0];
      current().zoom[key] = { start: zoom.start, end: zoom.end };
      persist();
    });
    chart.on('restore', () => {
      delete current().zoom[key];
      persist();
    });
  }
  window.dispatchEvent(new Event('materialdesk:context'));
  $('quality').textContent = Object.entries(quality)
    .map(
      ([id, q]) =>
        `${id}: ${q.rows.length} valid observations, ${q.dropped} missing/invalid rows excluded, ${q.duplicates} duplicate months resolved.`,
    )
    .join(' ');
}

function option(key, rows) {
  const isChange = ['mom', 'yoy'].includes(key);
  const available = rows.filter((r) => r[key] != null).length;
  return {
    animationDuration: 400,
    textStyle: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 13 },
    aria: {
      enabled: true,
      label: {
        description: `${materials[material]} ${defs[key][0]}, ${$('from').value} to ${$('to').value}. ${available} available values across ${rows.length} selected months. Use View chart data for the numerical table.`,
      },
    },
    color: ['#274b70'],
    grid: { top: 34, right: 28, bottom: 80, left: 67 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#aeb8c4',
      textStyle: { color: '#253342', fontSize: 14 },
      valueFormatter: (v) => (key === 'index' ? number(v, 3) : number(v) + (key === 'vol' ? ' pp' : '%')),
    },
    toolbox: { right: 15, top: 0, itemSize: 13, feature: { dataView: { readOnly: true, title: 'View chart data' } } },
    xAxis: {
      type: 'category',
      boundaryGap: key === 'mom',
      data: rows.map((r) => r.date),
      axisLine: { lineStyle: { color: '#b5bdc8' } },
      axisTick: { show: false },
      axisLabel: { color: '#505b68', fontSize: 12, formatter: (d) => (d.endsWith('-01') ? d.slice(0, 4) : pretty(d)) },
    },
    yAxis: {
      type: 'value',
      scale: !isChange,
      min: isChange ? (value) => Math.min(value.min, 0) : undefined,
      max: isChange ? (value) => Math.max(value.max, 0) : undefined,
      splitNumber: 4,
      axisLabel: {
        color: '#505b68',
        fontSize: 10,
        formatter: (v) => number(v, Math.abs(v) < 5 ? 1 : 0) + (isChange ? '%' : ''),
      },
      splitLine: { lineStyle: { color: '#d3d8de', type: 'dashed' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      {
        type: 'slider',
        height: 20,
        bottom: 15,
        borderColor: '#bac2cd',
        backgroundColor: '#eef0f3',
        fillerColor: '#7289a330',
        handleStyle: { color: '#5c718b' },
        textStyle: { fontSize: 11 },
        dataBackground: { lineStyle: { color: '#9eacbe' }, areaStyle: { color: '#dce2e9' } },
        selectedDataBackground: { lineStyle: { color: '#536b88' }, areaStyle: { color: '#dce2e9' } },
      },
    ],
    series: [
      {
        name: defs[key][0],
        type: key === 'mom' ? 'bar' : 'line',
        data: rows.map((r) =>
          key === 'mom' ? { value: r[key], itemStyle: { color: r[key] < 0 ? '#a4442f' : '#315b84' } } : r[key],
        ),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2.5 },
        barMaxWidth: 15,
        areaStyle: key === 'vol' ? { color: '#63798f', opacity: 0.2 } : undefined,
        markLine: isChange
          ? {
              silent: true,
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: '#939fae', type: 'solid' },
              data: [{ yAxis: 0 }],
            }
          : undefined,
      },
    ],
    graphic: available
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: 'No data for this view in the selected range', fill: '#798774', fontSize: 13 },
          },
        ],
  };
}

function preset(years) {
  if (!datasets[material]) return;
  if (current()) {
    current().preset = years;
    current().zoom = {};
  }
  const rows = datasets[material];
  const end = rows.at(-1).date;
  $('to').value = end;
  $('from').value = years ? shiftMonth(end, -12 * years + 1) : rows[0].date;
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('active', +b.dataset.years === years));
  render();
}

$('materials').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  material = b.dataset.id;
  syncMaterials();
  if (groups[material]) activate(groups[material].active);
};
$('views').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  view = b.dataset.view;
  document.querySelectorAll('#views button').forEach((x) => {
    x.classList.toggle('active', x === b);
    x.setAttribute('aria-pressed', String(x === b));
  });
  render();
};
$('presets').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) preset(+b.dataset.years);
};
['from', 'to'].forEach((id) => {
  $(id).onchange = () => {
    if (current()) {
      current().preset = null;
      current().zoom = {};
    }
    document.querySelectorAll('#presets button').forEach((b) => b.classList.remove('active'));
    render();
  };
});
$('reset').onclick = () => Object.values(charts).forEach((c) => c.dispatchAction({ type: 'restore' }));
new ResizeObserver(() => Object.values(charts).forEach((c) => c.resize())).observe($('charts'));

// ----------------------------------------------------------------- data ----

function installData() {
  const parsed = Object.fromEntries(Object.entries(csvData).map(([id, text]) => [id, parseCSV(text)]));
  for (const id of Object.keys(materials)) {
    const q = parsed[id];
    if (!q || q.rows.length < 13) throw Error('Not enough valid data for ' + id);
  }
  for (const id of Object.keys(materials)) {
    quality[id] = parsed[id];
    datasets[id] = completeMonths(derive(parsed[id].rows));
  }
  const all = Object.values(datasets).flat();
  const min = all.reduce((a, r) => (r.date < a ? r.date : a), all[0].date);
  const max = all.reduce((a, r) => (r.date > a ? r.date : a), all[0].date);
  for (const id of ['from', 'to']) {
    $(id).min = min;
    $(id).max = max;
  }
}

async function load() {
  try {
    const cached = JSON.parse(localStorage.getItem(dataKey));
    if (cached?.csv && Object.keys(materials).every((id) => typeof cached.csv[id] === 'string')) {
      csvData = cached.csv;
      dataLabels = cached.labels || {};
      installData();
      return;
    }
  } catch {
    // Fall through to the bundled snapshot.
  }
  csvData = { ...BUNDLED_CSV };
  dataLabels = { ...BUNDLED_LABELS };
  installData();
}

$('importBtn').onclick = () => {
  $('csvFiles').value = '';
  $('importStatus').textContent = '';
  $('importDialog').showModal();
};

$('applyImport').onclick = async () => {
  const files = [...$('csvFiles').files];
  if (!files.length) {
    $('importStatus').textContent = 'Select one or more FRED CSV files first.';
    return;
  }
  $('applyImport').disabled = true;
  try {
    const updates = {};
    const labels = {};
    for (const file of files) {
      if (file.size > 2000000) throw Error(file.name + ': file is too large (maximum 2 MB).');
      const text = await file.text();
      const id = identifyCSV(text);
      if (updates[id]) throw Error('Choose only one CSV for ' + materials[id] + '.');
      updates[id] = text;
      labels[id] = 'Imported ' + new Date().toLocaleDateString();
    }
    csvData = { ...csvData, ...updates };
    dataLabels = { ...dataLabels, ...labels };
    installData();
    let saved = true;
    try {
      localStorage.setItem(dataKey, JSON.stringify({ csv: csvData, labels: dataLabels }));
    } catch {
      saved = false;
    }
    render();
    $('importDialog').close();
    notify(
      'Updated ' +
        Object.keys(updates)
          .map((id) => materials[id])
          .join(', ') +
        '. Dates are preserved. Use Save portable HTML to share the updated data.' +
        (saved ? '' : ' Browser storage is unavailable; save a copy before closing.'),
    );
  } catch (error) {
    $('importStatus').textContent = error.message;
  } finally {
    $('applyImport').disabled = false;
  }
};

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Save a self-contained copy with the currently loaded data. Only the data
// snapshot and import labels are embedded; keys, notes and briefs never are.
$('saveCopy').onclick = () => {
  const html = buildPortableCopy({
    template: JSON.parse($('template-data').textContent),
    styleHtml: $('portable-style').outerHTML,
    vendorHtml: $('vendor-script').outerHTML,
    templateDataHtml: $('template-data').outerHTML,
    runtimeHtml: $('runtime-script').outerHTML,
    csv: csvData,
    labels: dataLabels,
  });
  downloadFile('Material Desk.html', html, 'text/html');
  notify(
    'Portable HTML download requested. This copy includes your currently loaded data. Chart views are saved separately in each browser.',
  );
};

// --------------------------------------------------------------- export ----

function exportDialog(only) {
  if (!validate() || !Object.keys(charts).length) return;
  $('exportError').hidden = true;
  $('exportResults').replaceChildren();
  $('exportChoices').replaceChildren();
  for (const key of Object.keys(charts)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = key;
    input.checked = !only || only === key;
    label.append(input, defs[key][0]);
    $('exportChoices').append(label);
  }
  $('exportDialog').showModal();
}

$('export').onclick = () => exportDialog();

$('download').onclick = async () => {
  const chosen = [...$('exportChoices').querySelectorAll('input:checked')];
  if (!chosen.length) {
    $('exportError').hidden = false;
    $('exportError').textContent = 'Select at least one chart to export.';
    return;
  }
  $('exportError').hidden = true;
  $('exportResults').replaceChildren();
  $('download').disabled = true;
  try {
    for (const input of chosen) {
      const key = input.value;
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + $('imageWidth').value + 'px;height:650px';
      document.body.append(host);
      const c = echarts.init(host);
      const opt = charts[key].getOption();
      opt.animation = false;
      opt.title = {
        text: `${materials[material]} / ${defs[key][0]}`,
        subtext: `${$('from').value} – ${$('to').value} · BLS via FRED · ${material}`,
        left: 28,
        top: 15,
        textStyle: { fontSize: 18 },
      };
      opt.grid = [{ ...opt.grid[0], top: 90 }];
      opt.toolbox = [];
      c.setOption(opt);
      const a = document.createElement('a');
      a.download = `material-desk-${material}-${key}-${$('from').value}-${$('to').value}.png`;
      a.href = c.getDataURL({
        type: 'png',
        pixelRatio: +$('pixelRatio').value,
        backgroundColor: $('background').value,
      });
      a.textContent = 'Download ' + defs[key][0] + ' PNG';
      $('exportResults').append(a);
      c.dispose();
      host.remove();
      await new Promise((r) => setTimeout(r, 180));
    }
  } catch {
    $('exportError').hidden = false;
    $('exportError').textContent = 'Image generation failed. Try a smaller width or resolution.';
  } finally {
    $('download').disabled = false;
  }
};

$('methodBtn').onclick = () => $('methodDialog').showModal();

// -------------------------------------------------------------- startup ----

async function initialize() {
  await load();
  let saved = null;
  try {
    saved = readWorkspace(localStorage.getItem(workspaceKey));
  } catch {
    // Ignore unreadable storage and start with defaults.
  }
  for (const id of Object.keys(materials)) {
    material = id;
    const t = defaultView();
    groups[id] = saved?.[id] || { tabs: [t], active: t.id };
  }
  material = 'WPU08';
  syncMaterials();
  activate(groups[material].active);
}

const controls = [
  ...document.querySelectorAll('#materials button,#presets button,#views button,#addView,#from,#to,#export'),
];
controls.forEach((b) => (b.disabled = true));
notify('Loading FRED observations…');
try {
  await initialize();
  notify('');
} catch {
  notify('Unable to load bundled data. Reload the page to try again.');
} finally {
  controls.forEach((b) => (b.disabled = !datasets[material]));
  if (datasets[material]) drawTabs();
}
