# Material Desk

Construction material price dashboard using official BLS/FRED monthly CSV observations. Bundled snapshot retrieved November 10, 2026 (America/Chicago), through September 2026. No FRED key required. Refresh retrieves updated CSVs through the server; bundled data remains available offline from FRED.

Run `npm run build`, `npm test`, then `npm run dev`. Open http://127.0.0.1:4173. No runtime dependencies or installation required; Apache ECharts 5.6.0 is vendored under dist/vendor (Apache-2.0). Fonts use Google Fonts with system fallbacks.

Material tabs, shared monthly date range and presets, four individual views or a responsive all-chart grid. Scroll/pinch zoom, drag pan, slider, box zoom, restore, data table, and per-chart PNG settings. Exports preserve chart zoom. Each selected chart downloads separately.

AI feature: a purchasing copilot converts project constraints and historical evidence into supplier questions, budget sensitivity scenarios and illustrative escalation clauses. This was chosen because estimators need a reviewable negotiation artifact rather than another narrative chart summary. Budget sensitivities are calculated in code, not by the LLM. The context includes selected history with precomputed measures and source IDs; lookbacks are calculated over full history. No forecast is implied.

Connect Gemini, GitHub Models (token with models:read), or Groq using a session key and editable model name. Keys are in browser memory only, sent over HTTPS to the server, forwarded to allowlisted providers, and never written to storage or logged by application code. Context and conversation go to the selected provider. Forget clears key and chat. Provider accounts, model availability and quota apply. No key is bundled. Live authenticated generation requires a user key; adapter tests use mocked upstream responses.

Formulas and cleaning details are available in the Data & methodology dialog. Not seasonally adjusted; 1982=100. Index levels do not measure local installed cost. Missing months are gaps, no interpolation. Volatility uses sample standard deviation of 12 consecutive monthly returns, in percentage points, not annualized.

Sources: https://fred.stlouisfed.org/series/WPU08, https://fred.stlouisfed.org/series/WPU101, https://fred.stlouisfed.org/series/WPU133.
