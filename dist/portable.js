// Assemble a self-contained HTML copy of the dashboard. Used by build.mjs to
// produce dist/index.html and by the "Save portable HTML" button in the page.
// Only the data snapshot and labels are embedded; never keys, notes or briefs.

export function buildPortableCopy({ template, styleHtml, vendorHtml, templateDataHtml, runtimeHtml, csv, labels }) {
  const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
  const dataHtml = '<script id="embedded-data" type="application/json">' + json({ csv, labels }) + '<' + '/script>';
  return template
    .replace('<!--styles-->', () => styleHtml)
    .replace('<!--scripts-->', () => vendorHtml + templateDataHtml + dataHtml + runtimeHtml);
}
