# Material Desk

Material Desk is a construction-material price dashboard for estimators, quantity surveyors and purchasing teams. It puts long-term trends, recent changes and price variability in one place, with separate date-range views for different questions.

## How to run it

### Portable version - no installation

1. Extract **Material-Desk-Portable.zip** to a folder.
2. Double-click **Material Desk.html** to open it in a modern browser such as Edge, Chrome or Firefox.
3. Choose a material, date range and chart view.

No account, API key, Node.js, Python, package installation, web server or internet connection is required for the charts. **Build purchasing brief** is optional: it requires internet access and your own Google Gemini API key. The HTML contains the chart library, styles and all three data series. Fonts come from the device's built-in system fonts. You can share the HTML file on its own.

The ZIP also contains the raw CSVs, these instructions and the ECharts license. Editing a CSV in the ZIP does not alter the embedded dashboard: use **Import FRED CSV** instead.

### Hosted version

Open https://material-desk-prices-ynov10.brawny-badge-0979.chatgpt.site/ in a browser. Access depends on the site's sharing settings; the current site is private and may require ChatGPT sign-in.

### Developer version

From the source project folder, with Node.js installed:

```sh
node build.mjs
npm test
npm run dev
```

Open http://127.0.0.1:4174 for the optional development preview. There are no npm packages to install. The build assembles `dist/index.html` for static hosting and `portable/Material Desk.html` for distribution. Recipients of the ZIP do not need these developer commands.

## What was built

- Material navigation for lumber and wood products, iron and steel, and concrete products.
- Shared start/end month controls, 1-year/5-year/10-year/full-history presets, and four chart views per material.
- Multiple closable date-range tabs, each keeping its own dates, chart selection and zoom. New view copies the active view. Above ten tabs, the strip scrolls horizontally; smaller screens scroll earlier. Undo close restores the most recently closed view. Closing the last view opens a default view.
- Pointer/pinch zoom, drag-to-pan and a range slider. Use **Reset zoom** in the toolbar to return to the selected dates. The chart's box-zoom buttons are omitted to simplify interaction.
- Individual or multi-chart PNG preparation with width, resolution and background settings, followed by explicit download links.
- Local CSV import and **Save portable HTML**, which creates a shareable single-file copy containing the currently loaded data.
- Optional online **Build purchasing brief** with a session-only Gemini API key, project details, source-backed context, follow-up questions and text download.
- Larger system fonts, higher-contrast chart labels, restrained gray surfaces and clear section boundaries.

Focused range tabs support Left/Right arrows, Home/End and Delete. Active selections have visible states, date errors appear beside the controls, invalid ranges hide stale charts, and export errors remain inside the export dialog.

## Data and chart choices

The data comes from the US Bureau of Labor Statistics through FRED:

| Material | Series | Source |
| --- | --- | --- |
| Lumber and wood products | WPU08 | https://fred.stlouisfed.org/series/WPU08 |
| Iron and steel | WPU101 | https://fred.stlouisfed.org/series/WPU101 |
| Concrete products | WPU133 | https://fred.stlouisfed.org/series/WPU133 |

The included snapshot was downloaded November 10, 2026 (America/Chicago), and runs through September 2026. These are monthly, not seasonally adjusted indices with 1982 = 100. They measure broad producer prices, not local supplier quotes or installed construction costs. Published observations may be revised.

| View | Calculation | Why this chart |
| --- | --- | --- |
| Price index | Published index | A line makes long-term direction and turning points easy to follow. |
| Monthly change | 100 x (current / previous calendar month - 1) | Diverging columns show each month's direction and magnitude around zero. |
| Yearly change | 100 x (current / same month last year - 1) | A line around zero highlights periods of inflation and deflation. |
| Volatility | Sample standard deviation of 12 consecutive monthly percentage changes | An area chart highlights changing levels of variability. Units are percentage points; it is not annualized. |

Cleaning sorts observations by month, rejects missing/nonnumeric/nonpositive values and invalid date formats, and resolves duplicate months with the last valid observation. Missing months remain gaps; there is no interpolation. Exact calendar lags prevent a missing month from being treated as the previous month. Calculations run over the full history before date filtering, retaining the lookback at the left edge. Incomplete volatility windows remain blank.

## Updating data and sharing work

While online, open **Import FRED CSV** and follow the download links. Select one or more CSV files. Headers identify the material automatically; all selected files are validated before applying the update. Nothing is uploaded.

Use **Save portable HTML** after importing to distribute the updated snapshot. The dashboard does not fetch live data in the background.

View settings and imported CSVs are saved in the current browser when local-file storage is available. Moving or renaming the file, changing browsers or clearing site data can change that storage. Save a portable copy to reliably keep the data. Saved browser imports take precedence when reopening; a new recipient sees the embedded snapshot. Date-tab layouts are local preferences and are not embedded in saved copies.

## AI feature: Build purchasing brief

**Build purchasing brief** helps a buyer prepare a supplier conversation. A chart shows what prices have done; a buyer also needs to decide what to ask, which assumptions to challenge and how to frame commercial terms.

The feature uses the selected material and date range, precomputed historical measures and source references, together with a material budget, buy-by date and the buyer's question. An LLM turns that context into a practical brief:

- Questions about quote validity, specifications, freight, geography and delivery timing.
- Fixed-price versus index-linked purchasing tradeoffs, including the risk that a national index differs from a specific quote.
- Hypothetical budget exposure using predefined changes of -10%, -5%, +5% and +10%. Arithmetic is computed in application code; the LLM explains the assumptions rather than inventing the numbers.
- Illustrative escalation-clause wording covering the reference month, review frequency, caps, floors and basis risk.
- Follow-up questions when project constraints are missing, with references to the supplied series and dates.

This was chosen instead of a basic chart summary because a purchasing brief is a concrete artifact an estimator can review and use in a supplier meeting. It connects historical evidence to a workflow while keeping assumptions visible. The design avoids price forecasts, treats scenarios as hypothetical rather than probabilities, and calls for professional review of contract wording.

### Using the online AI feature

1. Open **Build purchasing brief** in the header. Charts can stay open offline; this button opens the optional online form.
2. Get a Gemini API key from https://aistudio.google.com/apikey and paste it into the password field. The portable edition supports **Google Gemini** directly; GitHub and Groq tokens are not supported by this form.
3. Keep the default model (gemini-3.5-flash-lite) or enter a model ID available to your account. Availability, quota, pricing and key restrictions depend on Google; no free tier is guaranteed.
4. Optionally enter material budget, buy-by date and project details. The active material and date tab provide the chart evidence. Expand **Review data sent to Gemini** to inspect the full selected history and calculated scenarios.
5. Click **Generate purchasing brief** while online. Read the result, ask a follow-up, or download the brief as plain text.
6. **Forget key & clear brief** clears the session. Closing the dialog cancels a pending request. Requests time out after 90 seconds. Errors such as missing key, lost connection, invalid model and provider quota do not disable the charts.

Requests go directly from the browser to Google's Gemini API over HTTPS. There is no application proxy or backend. The key is sent in the x-goog-api-key header; it is never put in a URL, browser storage, saved HTML or the ZIP. Project details, selected historical data and conversation are sent to Google only when Generate is clicked. Generated text is rendered as text, not executable HTML. This is a bring-your-own-key tool: use your own trusted copy and a key you control. Browser extensions and Google's data handling remain outside the application's control.

Keys, project notes, generated briefs and conversations stay in session memory and are excluded from **Save portable HTML**. That function saves the original blank AI form and current chart data. The explicit **Download brief as text** action exports the result separately. Changing project details or chart context starts a fresh conversation context; old results retain their material/date labels.

The direct browser preflight was checked for a local-file origin. Browser policies, network filters, provider API changes, key restrictions or account access can still prevent requests. If a request fails, use the reported error to check the connection, model and key settings. No installation or hosted application server is needed by the portable copy.

Implementation reference: [Gemini generateContent API](https://ai.google.dev/api/generate-content), [models](https://ai.google.dev/gemini-api/docs/models). Numerical measures and budget scenarios are calculated by application code; the model explains them.

## How a human used AI to build it

The human supplied the problem, selected the three FRED series and specified the chart, date-filter, export and AI requirements. They then steered successive iterations: clearer material navigation, independent closable range tabs, scrolling after ten tabs, gray/charcoal styling, a portable ZIP, and larger readable fonts and simpler chart controls.

The AI coding assistant translated those requests into code, retrieved and inspected the CSV data, implemented cleaning and calculations, selected chart types, built the interface, wrote tests and documentation, packaged the offline HTML and ZIP, and deployed the hosted version. Browser checks informed fixes to stale charts after invalid input, export feedback and tab recovery.

The human's role was to define the use case and direct revisions; the assistant's role was implementation and verification. This account does not imply the human manually wrote every line, checked every observation, or completed a formal accessibility/usability review. Those checks remain valuable before wider use.

## Verification and limitations

Automated checks cover cleaning, exact calendar lookbacks, a known sample standard deviation, independent view state, close/recovery behavior, saved-workspace validation, CSV identification and standalone packaging. They also compile embedded JavaScript and check that saved portable copies retain chart data and the optional AI feature, exclude session credentials and project content, and have no external runtime assets. AI adapter tests cover request context, scenario arithmetic, successful responses, quota/auth/model failures, cancellation and network errors using mocked responses.

Live authenticated generation has not been verified with a valid user API key. Browser checks cover the AI form, missing-key feedback and an invalid-key request, as well as material/range changes, tab overflow, close/undo, invalid dates, chart rendering and PNG generation. ZIP extraction and the HTML checksum were verified. Direct local-file launch could not be exercised in the automated preview browser because it only permits HTTP/HTTPS; the self-contained artifact was checked structurally and through a local HTTP preview. Cross-browser and cross-platform local-file behavior still needs broader manual testing.

## What I would improve with more time

1. Test file-opening, CSV import, PNG downloads, keyboard navigation, touch gestures and screen-reader use across Windows/macOS and current browsers, including browsers that block local-file storage.
2. Run usability sessions with estimators and quantity surveyors to refine chart labels, date-range workflows and procurement terminology. Check text/background contrast systematically across every interaction state.
3. Add named workspace export/import so tab layouts and zoom can travel with a data snapshot, rather than depending on one browser's local storage.
4. Add a data-vintage/revision comparison and a clearer per-series import history so users can distinguish market movement from revised observations.
5. Evaluate purchasing-brief outputs with representative procurement tasks: source attribution, arithmetic consistency, handling of missing facts and unsupported recommendations. Have a qualified reviewer assess suggested clause language.
6. Support a wider range of official CSV formats with more descriptive row-level import diagnostics, while preserving atomic updates and explicit missing-data handling.

## Project structure and license

`index.template.html` provides the page structure. `dist/brief-core.js` builds Gemini requests and `dist/brief-ui.js` manages the optional AI form. `dist/app.js`, `dist/data-utils.js` and `dist/workspace.js` implement the interactions, calculations and view state. The CSS files define the layout and typography. `build.mjs` embeds these assets, the CSV snapshot and vendored Apache ECharts 5.6.0 into a single HTML file.

ECharts is distributed under Apache License 2.0. Its LICENSE and NOTICE are included in the portable ZIP. FRED pages identify the BLS source and provide the series attribution.
