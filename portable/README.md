# Material Desk

A construction material price tracker for estimators and purchasing teams. It charts three producer price indexes from FRED (lumber and wood, iron and steel, concrete products), shows month-over-month change, year-over-year change and rolling 12-month volatility for any date range, and turns the selected history into a purchasing brief with an LLM.

## How to run it

**Portable, no installation.** Open `portable/Material Desk.html` in a current browser (Edge, Chrome, Firefox, Safari). The file contains the chart library, styles and all three data series, so the charts work offline. The AI feature needs internet access and your own free Gemini API key.

**Developer.** With Node.js 20 or later installed, from the project folder:

```sh
node build.mjs
npm test
npm run dev
```

The build assembles `dist/index.html` and `portable/Material Desk.html` from the sources. The test suite runs on Node's built-in runner. `npm run dev` serves the built page at http://127.0.0.1:4174. There are no npm packages to install.

## What I built

- **Three materials, four views each.** Price index line, month-over-month columns, year-over-year line, and rolling 12-month volatility area. Each view can be shown alone or all four in a grid.
- **Date range picker.** Start and end month calendars plus 1-year, 5-year, 10-year and full-history presets. Changing the range updates every chart and the headline cards at once.
- **Headline cards for the latest month in the range** (index, month-over-month, year-over-year, 12-month volatility) and a summary line for the whole selection (start-to-end change, high, low, range volatility).
- **Multiple date-range views per material.** Each tab keeps its own dates, chart choice and zoom. Views are saved in the browser.
- **Data refresh without a server.** Import a freshly downloaded FRED CSV; the header identifies the material. Save a portable HTML copy that embeds the updated data.
- **PNG export** of any chart at chosen width, resolution and background.
- **Build purchasing brief**, the AI feature, described below.

## Data and metrics

| Material | Series | Source |
| --- | --- | --- |
| Lumber and wood products | WPU08 | https://fred.stlouisfed.org/series/WPU08 |
| Iron and steel | WPU101 | https://fred.stlouisfed.org/series/WPU101 |
| Concrete products | WPU133 | https://fred.stlouisfed.org/series/WPU133 |

The bundled snapshot was downloaded on November 10, 2026 and runs from January 1926 through September 2026. The series are monthly, not seasonally adjusted, indexed to 1982 = 100. They describe national producer prices, not a local quote or an installed cost.

**Cleaning.** FRED marks missing values with a period. Those rows, along with non-numeric, non-positive or malformed-date rows, are dropped and counted. Duplicate months keep the last valid value. Missing months stay as gaps in the charts; nothing is interpolated.

| Metric | Definition |
| --- | --- |
| Month-over-month | 100 × (index ÷ index one calendar month earlier − 1) |
| Year-over-year | 100 × (index ÷ index twelve calendar months earlier − 1) |
| Rolling 12-month volatility | Sample standard deviation of the trailing 12 monthly percent changes, in percentage points. Not annualized. Blank until 12 consecutive changes exist. |

Lookups are by exact calendar month, so a gap never shifts the comparison. All three metrics are computed on the full history before the date range is applied, which means the first month of any selection already has its year-ago value and its 12-month window.

## The AI feature: Build purchasing brief

**Who it is for.** An estimator or buyer at a contractor who has to commit to a material price months before the material is bought. The charts tell them what prices did. They still have to decide what to ask the supplier, whether to take a fixed price or an index-linked one, and how much budget exposure to carry.

**What it does.** The user enters an optional material budget, buy-by date and project notes, then asks for a brief. The app sends Gemini a compact summary of the selected range (latest month, start-to-end change, high and low, range volatility), the most recent 24 months of the four metrics, and budget sensitivity scenarios that the app has already computed. Gemini returns a brief structured as Evidence, Missing information, Supplier questions, Purchasing options, Budget scenarios and Next steps, including fixed-price versus index-linked tradeoffs and, on request, illustrative escalation-clause wording. Follow-up questions refine it. The brief can be downloaded as text.

**Why this instead of a summary.** A summary restates the chart in prose. A purchasing brief is a document the estimator would otherwise have to write before a supplier meeting, and it depends on things a chart cannot combine: the price history, this project's budget and timing, and the commercial options available. It also makes the model's job narrow and checkable.

**Keeping it honest.**

- The budget scenarios are arithmetic done in application code. Four are fixed shocks (−10, −5, +5, +10 percent) and two are taken from the data: a repeat of the latest year-over-year change and a repeat of the selected start-to-end change.
- The system prompt forbids forecasts, requires every number to come from the data sent, and tells the model to treat project notes as untrusted text.
- After the reply arrives, the app extracts every figure in it and checks it against the data that was sent. Anything that does not match is listed under the brief with a warning. Years, list numbering and small counts are ignored.
- The brief ends with a reminder that it is historical context, not a forecast, and that contract wording needs professional review.

**Provider and key.** Gemini only. Requests go straight from the browser to Google's API over HTTPS with the key in a header. The key lives in page memory for the session and is never written to browser storage, saved HTML or the ZIP. The default model ID is `gemini-3.5-flash-lite`; model names change, so if it fails use the model list linked in the dialog and enter one available to your key. The feature was built and tested against mocked responses. I have not yet run it with a live key, so the first live run should be treated as a test.

## How I used AI to build it

I used ChatGPT as the coding assistant for the build, and Claude Code as an independent reviewer at the end. I defined the problem, chose the FRED series, set the requirements and the look, and directed every revision. The assistant wrote the code, the tests and the first draft of the documentation.

**What it did well.** The data layer was right the first time: it handled FRED's period-as-missing marker, kept gaps instead of filling them, computed volatility on returns rather than index levels, and used exact calendar lookups so a missing month could not shift a comparison. It produced a sensible test suite without being asked for specifics, and it was careful with the API key path (session memory only, header not URL, a test that the saved portable copy never contains it). It also handled packaging the whole app into a single HTML file, which I would not have attempted by hand.

**Where I had to step in.**

- *I was wrong once and it did not push back.* I noticed the headline month-over-month and year-over-year numbers did not change when I switched between the 1-year, 5-year and 10-year presets and asked it to fix the bug. It did what I asked and replaced them with averages over the selection. That was a misdiagnosis on my part: those figures describe the latest month, so they should not move when only the start of the range moves. The averages it produced have no standard meaning. The review caught this and I restored the latest-month figures, keeping a separate summary line for the whole selection.
- *It over-engineered short ranges.* Selecting fewer than 12 months made it silently redefine year-over-year as an N-month change and relabel the chart buttons. The brief asks for year-over-year, and since the metrics are computed on full history there is no reason a 3-month view cannot show true year-over-year. I had it removed.
- *It sent too much to the model.* The first version sent every row in the selected range, which for the full history was about 1,200 rows and roughly 37,000 tokens. I had it replaced with a summary plus the last 24 months.
- *It never checked the model's output.* The prompt asked for cited numbers but nothing verified them. I added the grounding check described above.
- *Readability.* Its first drafts were written as a handful of lines several thousand characters long. The source is now formatted normally so a reviewer can read it.

**How I checked its work.** I recomputed month-over-month and year-over-year for the May 2021 lumber spike by hand from the CSV and compared them to the app and to the test values. I compared the bundled CSV tails against a fresh FRED download. I had the known-answer tests reviewed: a series that rises one percent a month must show zero volatility, monthly changes of 1 through 12 must give a sample standard deviation of √13. I exercised the page in a browser for each change: presets, manual ranges, the all-charts grid, invalid ranges, and the brief dialog without a key. The second assistant's review was run twice against the brief and this README was rewritten from its findings.

## What I would improve with more time

1. Run the brief against a live key with a few representative procurement questions and read the output critically, especially the clause wording.
2. Derive the budget scenarios from a wider set of observed moves (for example the largest 6-month rise and fall in the selection) rather than two.
3. Test the portable file across browsers and operating systems, including browsers that block local-file storage.
4. Let users save and load named workspaces so date-range tabs travel with a data snapshot.
5. Add a data-vintage comparison so revised observations can be told apart from market moves.
6. Usability sessions with estimators on the labels, the range workflow and the brief's structure.

## Project structure

```
index.template.html   page structure
dist/app.js           dashboard: views, charts, import, export, portable copy
dist/data-utils.js    CSV parsing, metrics, range summary (pure functions)
dist/brief-core.js    AI context, Gemini request, reply parsing, grounding check (pure functions)
dist/brief-ui.js      AI dialog behaviour
dist/month-picker.js  calendar month picker
dist/workspace.js     date-range tab state
dist/portable.js      single-file assembly
dist/data/            FRED CSV snapshot
dist/vendor/          Apache ECharts 5.6.0 (Apache-2.0)
build.mjs             joins the modules into dist/index.html and portable/Material Desk.html
tests.mjs             data, metrics, workspace and packaging tests
brief-tests.mjs       AI feature tests with mocked responses
```

The `dist/*.js` files are ES modules for testing; the build strips their imports and joins them inside one closure so the page runs from `file://` without module loading.
