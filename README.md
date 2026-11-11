# Material Desk - portable offline dashboard

Recipients extract the ZIP and open **Material Desk.html**. No installation, server, API key or connection is required. The HTML embeds ECharts, CSS and all data; fonts use built-in system fonts. See PORTABLE-README.txt for instructions.

All AI UI, logic, provider adapters and server endpoints are removed. Import FRED CSV updates local data; Save portable HTML embeds it in a new distributable copy. LocalStorage keeps view settings and imported CSVs when available, but is not required to run.

Developer sources: index.template.html, dist/app.js, dist/data-utils.js, dist/workspace.js, CSS and vendored ECharts. Run node build.mjs to assemble dist/index.html and portable/Material Desk.html. npm test checks calculations, workspaces and offline packaging. Only developers rebuilding need Node; no npm packages are needed. npm run dev is an optional preview.
