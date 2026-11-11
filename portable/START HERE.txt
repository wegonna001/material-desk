MATERIAL DESK - PORTABLE DASHBOARD

1. Extract the ZIP to any folder.
2. Double-click "Material Desk.html" to open it in a current browser.

No installation, account, server, Node.js or internet connection is needed for the charts. The HTML contains the dashboard, the chart library, styles and all three data series. The optional AI purchasing brief needs internet access and your own Gemini API key.

DATA SNAPSHOT
Downloaded November 10, 2026; latest observation September 2026. Source: US Bureau of Labor Statistics via FRED. Monthly, not seasonally adjusted, 1982 = 100. The raw CSVs are included for reference. Editing them does not change the embedded data; use Import FRED CSV instead.

USING THE DASHBOARD
Pick a material, a date range (calendars or the 1Y/5Y/10Y/ALL presets) and a chart view. The headline cards show the latest month in the range: its index, month-over-month change, year-over-year change and rolling 12-month volatility. The line beneath summarises the whole selection. New view copies the current dates; each view keeps its own dates, chart and zoom. Close with x, Undo close restores it. Scroll or pinch to zoom, drag to pan, or use the slider. Export PNG prepares download links for the selected charts.

UPDATING AND SHARING DATA
While online, download CSVs from FRED using the links in Import FRED CSV and select one or more files. Nothing is uploaded. Save portable HTML downloads a new self-contained copy with the currently loaded data. View settings and imported CSVs are kept in the browser when it allows local-file storage.

OPTIONAL AI: BUILD PURCHASING BRIEF
Open Build purchasing brief, paste your Gemini API key (https://aistudio.google.com/apikey), optionally enter a budget, buy-by date and project notes, and generate. The app sends a summary of the selected range, the latest 24 months, your details and the conversation directly to Google over HTTPS. Figures in the reply that do not appear in the data sent are flagged under the brief. The key, notes and brief stay in page memory only and are never written to storage, saved HTML or the ZIP. Forget key & clear brief ends the session.

SOURCES AND METHODS
https://fred.stlouisfed.org/series/WPU08 - Lumber and wood
https://fred.stlouisfed.org/series/WPU101 - Iron and steel
https://fred.stlouisfed.org/series/WPU133 - Concrete products
Month-over-month = 100 * (index / index one calendar month earlier - 1).
Year-over-year = 100 * (index / index twelve calendar months earlier - 1).
Volatility = sample standard deviation of the trailing 12 monthly percentage changes, in percentage points, not annualized.
All three are computed on full history before the date range is applied. Missing months remain gaps; nothing is interpolated. Indices are not quotes or installed costs. Data may be revised.

Apache ECharts 5.6.0 is bundled under the Apache License 2.0; see the included LICENSE and NOTICE. README.md has the full project description.
