// Assemble the single-file dashboard. Every dist/*.js module is joined inside
// one async closure (so the page works from file:// without module loading),
// the CSV snapshot and vendored ECharts are inlined, and the result is written
// to dist/index.html and portable/Material Desk.html.
import fs from 'node:fs';
import { buildPortableCopy } from './dist/portable.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const inlineSafe = (text) => text.replaceAll('</script', '<\\/script');

// Turn an ES module into plain script text: drop imports, drop `export`.
const asScript = (path) =>
  read(path)
    .replace(/^import[\s\S]*?from\s+'[^']+';\r?\n/gm, '')
    .replace(/^export (const|let|async function|function)/gm, '$1');

const template = read('index.template.html');
const data = {
  csv: Object.fromEntries(['WPU08', 'WPU101', 'WPU133'].map((id) => [id, read('dist/data/' + id + '.csv')])),
  labels: {},
};

const modules = ['dist/data-utils.js', 'dist/workspace.js', 'dist/portable.js', 'dist/brief-core.js'].map(asScript);
const bundledData =
  'const initialData = JSON.parse(document.getElementById("embedded-data").textContent);\n' +
  'const BUNDLED_CSV = initialData.csv;\n' +
  'const BUNDLED_LABELS = initialData.labels || {};';
const page = ['dist/app.js', 'dist/month-picker.js', 'dist/brief-ui.js'].map(asScript);

const code =
  '(async function () {\n' +
  [...modules, bundledData, ...page].join('\n') +
  '\n})().catch((error) => {\n' +
  '  document.getElementById("notice").hidden = false;\n' +
  '  document.getElementById("notice").textContent = "Unable to open the dashboard: " + error.message;\n' +
  '});';

const css = read('dist/style.css') + '\n' + read('dist/workspace.css');
const html = buildPortableCopy({
  template,
  styleHtml: '<style id="portable-style">' + css + '</style>',
  vendorHtml: '<script id="vendor-script">' + inlineSafe(read('dist/vendor/echarts.min.js')) + '</script>',
  templateDataHtml: '<script id="template-data" type="application/json">' + json(template) + '</script>',
  runtimeHtml: '<script id="runtime-script">' + inlineSafe(code) + '</script>',
  csv: data.csv,
  labels: data.labels,
});

fs.writeFileSync('dist/index.html', html);
fs.mkdirSync('portable/data', { recursive: true });
fs.writeFileSync('portable/Material Desk.html', html);
for (const id of Object.keys(data.csv)) fs.copyFileSync('dist/data/' + id + '.csv', 'portable/data/' + id + '.csv');
fs.copyFileSync('PORTABLE-README.txt', 'portable/START HERE.txt');
fs.copyFileSync('README.md', 'portable/README.md');
for (const name of ['LICENSE', 'NOTICE']) {
  if (fs.existsSync('dist/vendor/' + name + '.txt'))
    fs.copyFileSync('dist/vendor/' + name + '.txt', 'portable/ECharts-' + name + '.txt');
}
console.log('Built self-contained offline HTML (' + Buffer.byteLength(html) + ' bytes).');
