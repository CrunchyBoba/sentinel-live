---
name: Sentinel
description: Airline volatility research. Risk size, not direction, read at a glance.
colors:
  stone-ground: "#f4f5f2"
  sidebar-stone: "#eceee9"
  card-white: "#ffffff"
  card-recess: "#f8f9f6"
  hairline: "#d9ddd6"
  hairline-strong: "#c3c9c0"
  ink: "#17262b"
  ink-secondary: "#46555b"
  ink-muted: "#5d6c71"
  selection-sage: "#dce6e2"
  deep-slate-teal: "#12343b"
  deep-slate-teal-2: "#1a434b"
  on-deep: "#eef3f1"
  on-deep-secondary: "#bcd0cc"
  brass: "#b8893a"
  brass-ink: "#7a5719"
  brass-on-deep: "#dcb76d"
  link-teal: "#1b5a61"
  track: "#e7eae4"
  series-realized: "#6c7b80"
  series-egarch: "#b8893a"
  series-timesfm: "#1d6f73"
  series-timesfm-sector: "#5aa596"
  series-volume: "#c9d0c8"
  series-ma200: "#7d8e93"
  regime-calm: "#5b8a68"
  regime-stress: "#c08a2c"
  regime-crisis: "#b04a3c"
  ramp-low: "#eef3f1"
  ramp-high: "#12343b"
  night-ground: "#0e1a1d"
  night-sidebar: "#112024"
  night-card: "#15262a"
  night-card-recess: "#192c30"
  night-hairline: "#26393e"
  night-ink: "#e6ece9"
  night-ink-secondary: "#b6c3c3"
  night-ink-muted: "#95a5a6"
  night-deep: "#0f363c"
  night-brass: "#d4ad62"
  night-link-mint: "#8fd0c4"
  night-series-timesfm: "#7cc3b8"
  night-regime-calm: "#7fb08b"
  night-regime-stress: "#d9a64a"
  night-regime-crisis: "#df7766"
  night-ramp-low: "#182b2f"
  night-ramp-high: "#9ad8cc"
typography:
  display:
    fontFamily: "Libre Caslon Display, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.1rem, 3.6vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Libre Caslon Display, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2rem, 3.4vw, 2.85rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Libre Caslon Display, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(1.45rem, 2.4vw, 1.85rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  figure:
    fontFamily: "Libre Caslon Display, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 4.2rem)"
    fontWeight: 400
    lineHeight: 1
  subtitle:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "'tnum' 1"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.9em"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  gutter: "1.1rem"
  card-y: "1.25rem"
  card-x: "1.35rem"
  section: "3.2rem"
  page-x: "clamp(1rem, 3.5vw, 2.4rem)"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1.05rem"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1.05rem"
  button-ghost-deep:
    backgroundColor: "{colors.deep-slate-teal}"
    textColor: "{colors.on-deep}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1.05rem"
  button-disabled:
    backgroundColor: "{colors.card-recess}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1.05rem"
  segmented-active:
    backgroundColor: "{colors.deep-slate-teal}"
    textColor: "{colors.on-deep}"
    padding: "0.55rem 0.9rem"
  feature-panel:
    backgroundColor: "{colors.deep-slate-teal}"
    textColor: "{colors.on-deep}"
    rounded: "{rounded.md}"
    padding: "clamp(1.4rem, 2.6vw, 2.1rem)"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1.25rem 1.35rem"
  notlive-panel:
    backgroundColor: "{colors.card-recess}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "1.1rem 1.25rem"
  tag:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "0.12rem 0.5rem"
  chip:
    backgroundColor: "{colors.card-recess}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.7rem"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 0.75rem"
  nav-item:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.7rem"
  nav-item-active:
    backgroundColor: "{colors.selection-sage}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.7rem"
  chart-readout:
    backgroundColor: "{colors.card-recess}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.8rem"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone-ground}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.8rem"
---

# Design System: Sentinel

## Overview

**Creative North Star: "The Research Desk"**

Sentinel reads like a quiet economics research publication, not a trading terminal. A pale stone ground carries white cards on hairlines; one deep slate-teal panel per page holds the answer; brass is the single warm accent, used for the model range and the one primary action. Headings and the figures that matter are set in Libre Caslon Display, a calm high-contrast serif; everything else is Public Sans with tabular figures so columns of percentages line up.

The thesis is risk size, not direction. Every visual device serves "how volatile does this carrier look over the horizon, and why", and the system deliberately has no visual vocabulary for bullish/bearish calls: there are no green-up/red-down headline badges, and directional composite signals are hidden entirely unless the data export contains them. The world replaced an earlier dark neon quant dashboard of tiles and glows; that look is the confirmed anti-reference.

Density is that of an operating dashboard with reading pauses: a fixed sidebar, a breadcrumb bar, a page-leading feature panel, then evidence (ladders, tables, charts) in sections spaced well apart. Light is the default; night mode is a full token swap, not an inversion filter.

**Key Characteristics:**
- Pale stone ground, white hairline cards, one deep slate-teal feature panel per page.
- Brass as the sole warm accent: model range bars, primary button, selection, emphasis inside the deep panel.
- Libre Caslon Display for headings and headline figures; Public Sans with tabular figures for everything else.
- The risk ladder (eight carriers on one shared volatility scale) is the signature, reused wherever carriers are compared.
- Regime colours (sage calm, ochre stress, brick crisis) are semantic only.
- Placeholders are visibly dashed; nothing not-yet-live is dressed as live.
- Light default, night mode via a persisted sidebar switch.

## Colors

A restrained slate-teal and brass palette on stone neutrals, with a semantic regime triad and a dedicated data-series set. All colours are custom properties on `:root`; night mode redefines the same names under `:root[data-theme="dark"]`, and charts read them at draw time through `getComputedStyle`, so a theme switch re-renders the route rather than carrying a second palette in script.

### Primary
- **Deep Slate-Teal** (deep-slate-teal; night: night-deep): the feature panel ground and the active segmented-control segment. It is the page's one heavy mass and carries the answer (Overview head, a stock's risk read). Its companions are On-Deep text, On-Deep Secondary for paragraphs, and Brass-On-Deep for emphasis.
- **Link Teal** (link-teal; night: night-link-mint): links, focus outline, active nav icon, the night-mode switch track when on, the brand mark.

### Secondary
- **Brass** (brass; night: night-brass): the primary button, the risk-ladder range bar (at 45% mix), the EGARCH series and its model band (`rgba(184,137,58,.16)`), text selection, the glossary term flash. Text on brass is always ink `#17262b` in both themes.
- **Brass Ink** (brass-ink): brass at text contrast on light ground; used for the "Not financial advice" heading.
- **Brass On Deep** (brass-on-deep): `em` emphasis, figures and fact-list icons inside the deep panel.

### Tertiary (data and state)
- **Regime Calm / Stress / Crisis** (regime-calm, regime-stress, regime-crisis; night variants lifted for contrast): regime pills, chips, the sidebar regime strip, price-chart background bands (12% alpha), the as-of chip dot, and readout gains/losses. In the Stocks table, "up" volatility change reads crisis and "down" reads calm: colour describes risk, never price direction.
- **Series** (series-realized slate, series-egarch brass, series-timesfm teal, series-timesfm-sector light teal, series-volume pale, series-ma200 grey; MA50 reuses brass): fixed per model across every chart and key.
- **Sequential ramp** (ramp-low to ramp-high; night: night-ramp-low to night-ramp-high): the correlation heatmap interpolates between these two tokens in script; the legend bar is the same gradient.
- **Map ramp**: the Globe colours hubs and arcs by forecast volatility, teal (series-timesfm) to brass to brick (regime-crisis), computed from tokens, so it follows the theme.

### Neutral
- **Stone Ground** (stone-ground; night: night-ground): page background.
- **Sidebar Stone** (sidebar-stone; night: night-sidebar): the sidebar, one step darker than the ground.
- **Card White / Card Recess** (card-white, card-recess; night: night-card, night-card-recess): cards and tables; the recess tone is for table heads, row hover, readouts, placeholders and the map well.
- **Hairline / Hairline Strong** (hairline, hairline-strong; night: night-hairline): all borders and dividers; strong for control borders and the disclaimer.
- **Ink / Ink Secondary / Ink Muted** (ink, ink-secondary, ink-muted; night variants): headings and figures, paragraphs, captions and axis labels.
- **Selection Sage** (selection-sage): active nav item, selected carrier in the Globe list.
- **Track** (track): ladder and regime-strip track, inline code ground.

### Named Rules
**The One Deep Panel Rule.** Deep slate-teal is a feature panel that leads an answer page with its answer. At most one per page; it is never a card style or a decorative band.

**The Brass Is The Range Rule.** Brass means "the model range" in data and "the one primary action" in UI. Don't spend it on decoration, headings or borders.

**The Colour Means Risk Rule.** Sage, ochre and brick describe regime and volatility. They are never used to say buy or sell, and price direction is not colour-coded as good or bad.

## Typography

**Display Font:** Libre Caslon Display (with Iowan Old Style, Georgia, serif)
**Body Font:** Public Sans (with -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif)
**Label/Mono Font:** Public Sans for labels; `ui-monospace` only for inline code.

Both faces load from Google Fonts (Libre Caslon Display 400; Public Sans 400/500/600/700).

**Character:** A calm, literary display serif sets the headline and the number that answers the question; a plain civic sans does all the work, with tabular figures (`font-feature-settings: 'tnum' 1` on body) so every percentage aligns.

### Hierarchy
- **Display** (400, clamp(2.1rem, 3.6vw, 3rem), 1.12): the Overview feature headline only.
- **Headline** (400, clamp(2rem, 3.4vw, 2.85rem), 1.12): page h1.
- **Title** (400, clamp(1.45rem, 2.4vw, 1.85rem), 1.12): section h2; fixed 1.45rem inside the ladder head and risk read.
- **Figure** (400, clamp(3rem, 6vw, 4.2rem), 1): the risk-read headline volatility. The same face at 1.3 to 2rem sets ladder percentages, portfolio stats, Globe detail numbers, the alt-model grid, the Overview regime reading, the sidebar regime reading and the brand name. Units and captions beside a figure drop back to Public Sans.
- **Subtitle** (Public Sans 600, 1.08rem, 1.3): h3 card and chart titles; h4 at 1rem.
- **Body** (Public Sans 400, 16px, 1.6): paragraphs capped at 72ch, ink-secondary.
- **Label** (Public Sans 600, 0.8rem): table column heads, tags, keys. Sentence case, no tracking, never uppercase.

### Named Rules
**The Serif Answers Rule.** Caslon is for headings and the figures that answer the page's question. Controls, tables, axes, labels and running text are Public Sans.

**The Tabular Figures Rule.** Every number is set with tabular figures; never turn `tnum` off for a numeric column.

## Layout

An Operate shell: a 248px sticky sidebar (brand, six routes with counts, the regime card, the night-mode switch and data meta pinned at the bottom) beside a main column. The main column opens with a one-line breadcrumb bar and an as-of chip, then the view, capped at 1160px plus page padding (`clamp(1rem, 3.5vw, 2.4rem)` horizontal).

Pages lead with a two-column 5fr/7fr split: the deep feature panel on the left and evidence on the right (the Overview ladder; the risk-read figure beside its words). Sections are separated by 3.2rem; cards and grid gaps use 1.1rem. Lists of explanations are ruled rows with hairline dividers (read-lists, model tables, lab list, glossary terms) rather than grids of identical cards. Charts sit in cards at 320px height (120px for short strips).

Breakpoints: at 1100px the 5/7 splits and the Globe layout stack to one column. At 860px the sidebar collapses to a sticky top bar with a 44px menu button that opens the nav as a drop-down sheet. At 600px the ladder drops carrier names to tickers, tables reflow to labelled blocks and charts shorten to 260px. The phone layout works but is not a current design priority; desktop is the reference.

## Elevation & Depth

Mostly flat with tonal layering: depth comes from ground, card and recess tones and hairlines. Cards and table wraps carry one soft ambient shadow; the deep feature panel has none, its mass is its depth.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 1px 2px rgba(23,38,43,.05), 0 6px 18px -8px rgba(23,38,43,.12)`; night: `0 1px 2px rgba(0,0,0,.25), 0 8px 22px -10px rgba(0,0,0,.5)`): cards, table wraps, the mobile nav sheet.
- **Tooltip lift** (`box-shadow: 0 6px 20px -6px rgba(0,0,0,.4)`): the shared dark tooltip only.
- **Inset outline** (`box-shadow: inset 0 0 0 1px` hairline-strong): the current carrier row in a ladder; `0 0 0 2px` ink ring for the hovered heatmap cell.

### Named Rules
**The Quiet Lift Rule.** One ambient shadow for cards, nothing heavier. No glows, no coloured shadows, no hard offsets.

## Shapes

Gently rounded and consistent: 10px for cards, panels and tables; 6px for buttons, inputs, nav items, segmented controls, readouts and tooltips; 4px for code, kbd, heatmap cells and the crosshair value tag; full pills for tags, chips, the as-of chip and the regime pill. Borders are 1px hairlines. Dashed borders mean "not live" (placeholders, disabled buttons, the heatmap diagonal), and dashed lines in charts and ladders mean reference values (sector median, today, cursor). Icons are authored inline SVG on a 24px grid, stroke only, `stroke-width` 1.6 (nav, theme switch, brand) to 1.8 (buttons, arrows, menu), round caps and joins.

## Components

### Buttons
Plain and confident, never loud.
- **Shape:** gently rounded (6px), 600 weight at 0.9rem.
- **Primary:** brass fill, ink text (`#17262b` in both themes), brass border; hover lightens brass 12% toward white.
- **Secondary:** card fill, hairline-strong border, ink text; hover darkens the border to ink-muted.
- **Ghost on deep:** transparent with an on-deep border at 35%, used only inside the feature panel; hover takes the full on-deep border.
- **Disabled / not built:** recess fill, dashed border, muted text, not-allowed cursor. Disabled buttons say what is missing ("Interactive version not built yet").
- **Focus:** the global 2px link-teal outline, 2px offset.

### Segmented control
A bordered 6px group of text buttons divided by hairlines; the pressed segment takes the deep slate-teal fill with on-deep text.

### Tags and chips
- **Tag:** 0.78rem 600 pill on card with a hairline-strong border. `Live` adds a calm dot and a calm-tinted border; `Not live yet` / `Not built yet` / `Study module` use a dashed border and muted text.
- **Chip:** 0.88rem pill on the recess tone, often with a 9px regime dot; for stating regime shares.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** card white on stone ground; recess for heads and placeholders.
- **Shadow Strategy:** card ambient (see Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 1.25rem by 1.35rem.
- **Not-live panel:** dashed hairline-strong border on the recess tone, no shadow; a heading with a dashed tag, then a sentence saying what will appear and when. Used for the composite (fuel, news, operations) and the own-holdings form.

### Feature panel
The page's answer. Deep slate-teal, 10px, generous fluid padding, no shadow. Headings and bold text in on-deep, paragraphs in on-deep secondary, `em` and key figures in brass-on-deep. Used for the Overview head (headline, regime reading with a small regime chart, data date, primary actions) and the stock risk read (Caslon figure with its range and fact list beside plain-English words).

### Inputs / Fields
- **Style:** card fill, 1px hairline-strong border, 6px, 0.6rem by 0.75rem, inherited font.
- **Focus:** the global link-teal outline at 0 offset.
- **Disabled:** recess fill, muted text.

### Navigation
Sidebar links at 0.93rem 500 in ink-secondary with a 19px stroke icon; hover takes a 60% selection-sage wash; the current route takes full selection-sage, ink, 600 weight and a link-teal icon. Counts sit right-aligned in muted text. The night-mode control is a full-width `role="switch"` button at the sidebar foot (moon icon, label, 34 by 20 track whose thumb slides 14px); the choice persists in `localStorage` key `sentinel-theme` and an inline script in the document head applies it before first paint. Breadcrumbs use a muted slash separator.

### Risk ladder (signature)
Eight carriers on one shared volatility scale, sorted high to low, each row linking to its stock. Per row: ticker and short name, a 22px track, and the Caslon model-average percentage with its range in small Public Sans beneath. On the track: a 3px ink **tick** marks the model average; a brass **bar** (45% mix, 8px, rounded) spans the range across the three models; a **hollow ring** (12px, 2px realized-slate stroke) marks the recent 20-day realized volatility; a **dashed line** marks the sector median. A key above names all four marks, and a shared scale of ticks runs beneath.
- Reused on the Overview, on stock pages ("Where X sits among the eight", current row inset-outlined), as median-less mini bars in the Stocks table, inside Globe tooltips (inverted for the dark tooltip) and in the Globe detail card.
- On first Overview render per session the range bars grow from 30% and the marks fade in, staggered 45ms per row; reduced motion removes it.

### Charts
Chart.js themed from tokens: Public Sans 12px, ink-muted ticks, hairline grid on the value axis only. Charts draw in their final state immediately (animation duration 0); they never depend on animation frames to appear.
- **Crosshair:** a solid ink-secondary vertical line snapped to the hovered day, card-filled marker dots on tracked series, a dashed horizontal cursor line with its value in a 4px ink tag on the right axis; linked charts (volume) mirror the vertical line.
- **Readout:** a recess bar with a hairline border above each interactive chart, showing the hovered date in bold and each series value; gains and losses in calm and crisis.
- **Price chart:** regime background bands at 12% alpha and labelled big moves (Public Sans 600 11px, haloed in the card colour).
- **Forecast chart:** a dashed ink-muted "today" divider separating history from forecast, with the model band in brass at 16%.
- **Keys:** short line swatches (solid, dashed, dotted, box, point) in a key row beneath.

### Comparison table
Sortable columns via header buttons (sorted column in ink), sticky first column, recess header row, right-aligned tabular numbers, row hover in the recess tone, whole-row click to the stock, and ladder mini bars with their range.

### Correlation heatmap
A table of 62 by 46px cells with 3px spacing and 4px corners, filled along the sequential ramp; the diagonal is dashed and empty. Hovering dims other cells to 45%, rings the cell in ink and underlines its row and column heads. A ramp legend bar sits beneath.

### Globe map
An SVG world on the recess tone: land at 14% ink, card-coloured borders, hairline graticule. Hubs are card-filled rings stroked by the map ramp, with route arcs from the selected carrier at 55% opacity; unrelated hubs dim to 14%. A carrier list (pressed item in selection sage) drives selection, and a detail card shows Caslon figures and a single ladder row.

### Tooltip
One shared tooltip: ink ground, stone text, 6px, 0.84rem, max 300px, with a bold head, key/value rows and a small note. Follows the pointer or focused element; in the dark theme it naturally inverts to a light card.

## Do's and Don'ts

### Do:
- **Do** lead an answer page (the Overview, a stock's risk read) with one deep slate-teal feature panel that states the answer, then put the evidence beside or below it.
- **Do** use the risk ladder whenever carriers are compared on volatility, keeping tick = model average, brass bar = model range, hollow ring = recent 20-day realized, dashed line = sector median.
- **Do** read every colour from the `:root` custom properties, in CSS and in chart code, so night mode stays a pure token swap.
- **Do** set headings and answering figures in Libre Caslon Display 400 and everything else in Public Sans with tabular figures.
- **Do** mark anything not live with a dashed border and a dashed tag ("Not live yet", "Not built yet"), and say what will appear.
- **Do** draw charts immediately in their final state and give interactive charts the crosshair and readout bar.
- **Do** use authored inline SVG icons, stroke-only, 1.6 to 1.8 stroke width, round caps.

### Don't:
- **Don't** bring back the dark neon quant dashboard: no glows, neon accents or walls of identical metric tiles.
- **Don't** show BULLISH/BEARISH or any directional label as a headline, and don't render directional composite signals unless the data export contains them.
- **Don't** put eyebrow or kicker labels above headings.
- **Don't** use coloured side-stripe borders on cards, rows or callouts.
- **Don't** use emoji or Unicode glyphs as icons.
- **Don't** use gradient text. Gradients appear only as data ramps (heatmap and map legends).
- **Don't** use more than one deep feature panel on a page, or use deep slate-teal as a generic card colour.
- **Don't** add entrance animation to charts.
