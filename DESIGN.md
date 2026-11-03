---
name: Sentinel
description: Risk intelligence. Built on data. Tested against outcomes.
colors:
  ground: "#0b0e12"
  pane: "#12161b"
  pane-raised: "#181d23"
  hairline: "#242a31"
  hairline-strong: "#363d46"
  ink: "#eceef0"
  ink-secondary: "#aab0b7"
  ink-muted: "#848b93"
  selection-green: "#14332a"
  track: "#232930"
  tooltip-ground: "#20262d"
  signal-green: "#4fd1a1"
  on-green: "#06140f"
  link-green: "#6edcb3"
  amber-stress: "#e8b04a"
  coral-crisis: "#f0705f"
  series-realized: "#cfd3d7"
  series-timesfm: "#a4e9cd"
  series-timesfm-sector: "#2f9f78"
  series-volume: "#2a3037"
  series-ma200: "#6b727a"
  series-band: "rgba(79, 209, 161, .12)"
  ramp-low: "#141a1f"
  ground-light: "#f2f4f4"
  pane-light: "#ffffff"
  pane-raised-light: "#f7f8f8"
  hairline-light: "#dde0e3"
  hairline-strong-light: "#c5cacf"
  ink-light: "#12161b"
  ink-secondary-light: "#464d55"
  ink-muted-light: "#5f666e"
  selection-green-light: "#d6f2e6"
  track-light: "#e6e9eb"
  signal-green-light: "#0d7f59"
  link-green-light: "#0b6f4e"
  amber-stress-light: "#8a5d0c"
  coral-crisis-light: "#c8483a"
  series-timesfm-light: "#39a982"
  series-timesfm-sector-light: "#0a5a40"
  series-volume-light: "#d3d7db"
  series-ma200-light: "#979da4"
  series-band-light: "rgba(13, 127, 89, .1)"
  ramp-low-light: "#e9f3ef"
typography:
  display:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(3rem, 6.8vw, 6rem)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  page-title:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.6rem, 5.2vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.038em"
  statement:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.7rem, 3.2vw, 2.7rem)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.7rem, 2.8vw, 2.4rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.008em"
  body:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  figure-hero:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(3.6rem, 7vw, 5.6rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.05em"
    fontFeature: "'tnum' 1"
  figure:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Switzer, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.55
  mono-data:
    fontFamily: "'DM Mono', ui-monospace, Menlo, monospace"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  mark: "4px"
  cell: "8px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  pill: "999px"
spacing:
  gap: "1.1rem"
  pane-y: "1.15rem"
  pane-x: "1.25rem"
  gutter: "clamp(1.2rem, 3.4vw, 3rem)"
  section: "4.5rem"
  statement: "5.5rem"
components:
  button-primary:
    backgroundColor: "{colors.signal-green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.pill}"
    padding: ".72rem 1.15rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: ".72rem 1.15rem"
  button-secondary-hover:
    backgroundColor: "{colors.pane-raised}"
  nav-link:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: ".42rem .78rem"
  nav-link-active:
    backgroundColor: "{colors.pane-raised}"
    textColor: "{colors.ink}"
  segmented:
    backgroundColor: "{colors.pane-raised}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.hairline-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: ".36rem .85rem"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: ".12rem .5rem"
  input:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: ".6rem .75rem"
  pane:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1.15rem 1.25rem"
  figure-panel:
    backgroundColor: "{colors.pane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.2rem .8rem"
  tooltip:
    backgroundColor: "{colors.tooltip-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: ".65rem .8rem"
---

# Design System: Sentinel

## Overview

**Creative North Star: "The Open Instrument"**

Sentinel looks like a precise instrument with its cover off. The page opens with one big plain statement, then one signature data graphic, then small pieces of the real product: a ladder, a score table, a console showing the raw data file. Each piece is live model output, so the page's evidence and its decoration are the same thing. Rounded corners and a soft blue-grey ground keep the precision approachable for retail investors who have no terminal and no quant background.

The structural idea of big statement, signature graphic and product fragments softened by rounding draws inspiration from oxide.computer. That is a note of lineage only; Sentinel's identity is the volatility character field and its own palette.

Density is moderate and earned: large type and generous gaps between sections, tight tabular data inside panes. Dark is the default and light is an equal theme, not an afterthought. The honesty line is a visual element: live output and placeholders must be distinguishable at a glance.

**Key Characteristics:**
- One blue-grey neutral family and one signature green; amber and coral appear only for risk states.
- Two-tone headlines: the first clause in ink, the second in grey.
- One signature figure on one timeline, available as characters or ridge lines.
- Small fragments of real product UI in rounded panes with hairline borders.
- Switzer for all language and figures, DM Mono for machine text.
- Charts appear in their final state, with no entrance animation.

## Colors

A cool blue-grey neutral family carries the whole interface; a single green is the only colour that speaks without warning. Values come in matched pairs: unsuffixed tokens are the dark default, and the `-light` tokens are the light theme.

### Primary
- **Signal Green** (#4fd1a1 dark, #0d7f59 light): The EGARCH series, calm regime, primary buttons, brand mark, selection, hatched bars, live dots and the low-to-mid range of the character figure.
- **Link Green** (#6edcb3 dark, #0b6f4e light): Text links and the focus ring, tuned for legibility on the ground. Links carry a soft underline that firms on hover.
- **Selection Green** (#14332a dark, #d6f2e6 light): The current carrier in the stock switcher and selected rows in the Globe lists.

### Risk states
- **Amber Stress** (#e8b04a dark, #8a5d0c light): The stressed regime, a model missing its target, marginal or storm conditions on the Globe, and the hot end of the character figure and volatility ramps.
- **Coral Crisis** (#f0705f dark, #c8483a light): The crisis regime, moves outside the forecast range, delays and wildfires.

### Series
- **Realized Grey** (#cfd3d7 dark, #464d55 light): Realized volatility and the 50-day average, always solid.
- **TimesFM Pale Green** (#a4e9cd dark, #39a982 light): TimesFM forecast and closing price.
- **Sector Deep Green** (#2f9f78 dark, #0a5a40 light): TimesFM with the sector, dotted, and the leading PCA bar.
- **Quiet Greys** (volume #2a3037 / #d3d7db, 200-day average #6b727a / #979da4): Context that must recede.
- **Forecast Band** (green at 12% dark, 10% light): Model range and the area under mini charts.

### Neutral
- **Ground** (#0b0e12 dark, #f2f4f4 light): Page background and the translucent top bar.
- **Pane** and **Pane Raised** (#12161b and #181d23 dark, #ffffff and #f7f8f8 light): Cards, then readouts, hover rows and active nav.
- **Hairline** and **Hairline Strong** (#242a31 and #363d46 dark, #dde0e3 and #c5cacf light): Pane borders and dividers, then control borders.
- **Ink**, **Ink Secondary**, **Ink Muted** (#eceef0, #aab0b7, #848b93 dark; #12161b, #464d55, #5f666e light): Headlines and figures, body copy, then labels and the grey second clause of headlines.
- **Track** (#232930 dark, #e6e9eb light): Ladder rails and empty bar channels.

### Named Rules
**The One Signal Rule.** Green is the only colour with no warning attached. Never add a second brand accent.

**The Risk-Only Rule.** Amber and coral appear only when they report a risk or warning state. If nothing is at risk, neither colour is on screen.

**The Line-Style Rule.** Series stay in the green family and the neutrals, and are told apart by line style: solid, dashed, dotted. Do not separate series by introducing a new hue.

## Typography

**Display Font:** Switzer, from Fontshare (with -apple-system, Helvetica Neue, Arial)
**Body Font:** Switzer, from Fontshare (same stack)
**Label/Mono Font:** DM Mono, from Google Fonts (with ui-monospace, Menlo)

**Character:** Switzer is a neutral grotesque set large and tight, so headlines feel engineered rather than editorial. Tabular numerals let figures align and read as measurements. DM Mono marks text that belongs to the machine.

### Hierarchy
- **Display** (500, clamp 3 to 6rem, 0.98): The Overview headline only.
- **Page Title** (500, clamp 2.6 to 4.6rem, 1): The headline of every other page.
- **Statement** (500, clamp 1.7 to 2.7rem, 1.14, 30ch): The muted full-sentence claim on Overview, with its conclusion in ink.
- **Headline** (500, clamp 1.7 to 2.4rem, 1.05): Section headings.
- **Title** (500, 1.1rem, 1.3): Pane and chart titles.
- **Body** (400, 16px, 1.55, 72ch): Explanatory copy in Ink Secondary. Page intros run 1.02rem at 60ch or less.
- **Figure** (500, 1.5rem, -0.03em) and **Figure Hero** (500, clamp 3.6 to 5.6rem, -0.05em): Status rail values and the stock page's lead forecast, in Switzer with tabular numerals.
- **Label** (400, 0.84rem): Stat labels and captions in sentence case, never uppercase.
- **Mono Data** (DM Mono 400, 0.84rem, 1.65): Tickers, code and console blocks, chart axes and the character figure.

### Named Rules
**The Two-Tone Rule.** Every page headline has two clauses: ink first, Ink Muted second. The second clause does the explaining.

**The Machine Text Rule.** DM Mono is for tickers, code and console blocks, chart axes and the character figure only. Language and figures are always Switzer with tabular numerals.

## Layout

A sticky top bar replaces any sidebar: brand, pill navigation, data date, regime pill and theme switch, over a translucent blurred ground. Content sits in one centred column up to 1320px plus side gutters, and the gutters flex with the viewport.

Overview composes as a two-part hero (7fr headline, 4fr intro and actions), the full-width figure, the status rail, the statement, a 12-column fragment grid with spans of 7, 5 and 4, then the console in a 4fr and 7fr split. Page headers reuse the 7fr and 4fr split. Stock pages run a full-width instrument band, then a main column beside a 340px reading rail that sticks below the top bar.

The rhythm is 1.1rem between sibling panes, 4.5rem between sections, and 5.5rem around the Overview statement and console. The figure's height follows the viewport (clamp 400 to 580px) so the status rail stays near the first screen.

At 1200px the grids stack, the reading rail stops sticking, and the regime pill and data date leave the bar. At 900px the trend mini charts drop from the table. At 860px navigation folds behind a menu button. Phone layouts work and are not a current design priority.

## Elevation & Depth

Depth is tonal first: ground, pane, then raised pane, separated by hairlines. Shadows are barely present on panes: a 3% white top edge in dark and a 5% one-pixel shadow in light. Only the floating tooltip casts a real shadow. The top bar uses 86% ground with a 14px blur. The signature figure and stock instrument band carry a faint radial green wash, the only tinted surfaces in the system.

### Shadow Vocabulary
- **Pane edge, dark** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, .03)`): Default pane treatment in the dark theme.
- **Pane edge, light** (`box-shadow: 0 1px 2px rgba(18, 22, 27, .05)`): Default pane treatment in the light theme.
- **Tooltip** (`box-shadow: 0 10px 24px -14px rgba(0, 0, 0, .7)`): Floating tooltips only.

### Named Rules
**The Hairline-First Rule.** A new surface separates itself with a tone step and a hairline. Reach for a shadow only if it truly floats.

## Shapes

Corners soften a precise system at four sizes: pills (999px) for every control and chip, gently rounded panes (16px), slightly larger panels for the two signature surfaces (20px), and tighter inner elements (10px for inputs, readouts and tooltips; 8px for heat cells; 2 to 4px for bars and marks). Borders are one pixel. Dashed outlines are reserved for placeholders, disabled states, median markers and the self-pairs of the correlation table. Data bars are hatched: 4px of green and a 2px gap.

### Named Rules
**The Dashed Means Not Real Rule.** A dashed outline on a panel, tag or control says "not live, not built, or not available". Do not use it for decoration.

## Components

### Buttons
Quiet pills; the only loud one points at the next step.
- **Shape:** Full pill (999px).
- **Primary:** Signal Green fill with On Green text, weight 500, .92rem.
- **Hover / Focus:** Primary lightens 14% toward white; secondary fills with Pane Raised. All controls take a 2px Link Green focus ring offset by 2px. State transitions run .2s on a soft expo-out curve.
- **Secondary:** Transparent with a Hairline Strong border.
- **Disabled:** Raised pane, dashed border, muted text, and always a label saying why, such as "Study module, not interactive yet".

### Chips and Tags
- **Style:** Small transparent pills with a Hairline Strong border, in Switzer at .76rem.
- **State:** Live has a green dot and a green-tinted border. Placeholder tags (Not live yet, Not built yet, Offline, Study module) are dashed and muted. Reconstructed is a plain tag, distinct from both.

### Segmented Control
- **Style:** A pill channel in Pane Raised with 3px of inner padding; the selected segment fills with Hairline Strong. Used for the figure's Characters and Ridges switch.

### Cards / Containers
- **Corner Style:** 16px, or 20px on signature surfaces.
- **Background:** Pane, with a Hairline border.
- **Shadow Strategy:** Pane edge only, per Elevation & Depth.
- **Internal Padding:** About 1.15rem by 1.25rem.

### Inputs / Fields
- **Style:** Pane background, Hairline Strong border, 10px radius.
- **Focus:** The Link Green ring, with no offset.
- **Disabled:** Raised pane and muted text.

### Navigation
Pill links in Ink Secondary at .92rem, filling with Pane Raised on hover and when current, with no icons in the bar. The Stocks link carries the carrier count. The theme switch is a compact toggle that turns green in dark mode and stores its choice under `sentinel-theme`; with nothing stored, the site is dark. Below 860px the links stack behind a menu button.

### The Sector Figure
The signature. Eight carriers share one timeline: 12 months of realized volatility, then the mean of the model forecasts, split by a dashed Today line over a faint green tint. Two views of the same numbers switch through the segmented control, stored under `sentinel-fig`, and default to Characters:
- **Characters:** Rows of DM Mono characters (`.:-=+*#%`) whose height, density and colour follow volatility, from grey through green to amber. Forecast characters are dimmed to 60%.
- **Ridges:** Overlapping ridge lines in green with a soft fill, solid for realized and dashed for forecast.

Hover and click are shared: hover shows the day's reading in a tooltip and marks the row, and click opens that carrier.

**The Instant Chart Rule.** Charts draw in their final state immediately. Never make data wait for an entrance animation.

### Status Rail
A five-cell band below the figure with hairline dividers: market regime, sector median, highest forecast, lowest forecast and the next-day model check. Each cell has a muted label, a Figure value and a small note. The model check's note turns amber when it misses its target.

### Fragment Cards
Small pieces of real product UI in a pane, followed by plain caption rows outside it: a short bold fact with hairlines between rows. Fragments include the forecast ladder, regime chart, score table, airborne-flight bars and shared-factor split.

### One Forecast, Three Ways
A console pane with pill tabs for Plain English, Data and Model, and the current ticker at the far right. The same forecast appears as prose, as the raw data file and as the model equation, with code in DM Mono, comments in Ink Muted and values in green.

### Stocks Table
A sortable table in a hairline pane, led by carrier ticker and name. Trend mini charts show six months realized and then the dashed forecast, with all carriers on one vertical scale so their heights compare honestly. Risk ladder marks place each carrier's model range (green bar), average (ink tick) and recent level (ring) on a shared track.

### Stock Instrument Band
A full-width panel with the forecast as Figure Hero beside a large risk ladder and scale, over five stat cells. Below it, a sticky rail holds the plain-English reading and a carrier switcher, where each row is a ticker, a miniature ladder and a value. Arrow keys step through carriers.

### Hatched Data Bars
Quantities such as flight counts and portfolio weights use hatched green bars, reading as counted units rather than solid fills.

### Placeholders and Not-Live States
A transparent panel with a dashed border, a heading, a dashed tag and a plain sentence saying what is missing. No example values are ever shown inside.

**The Labelled Placeholder Rule.** Every placeholder says so in words, on the element itself.

### Disclaimer Footer
"Not financial advice" sits at the foot of every page in a 3fr and 9fr grid below a hairline, followed by the data date in a small line.

## Do's and Don'ts

### Do:
- **Do** open a surface with a big plain statement, then let real product output make the argument.
- **Do** write page headlines in two tones, with the second clause in Ink Muted.
- **Do** set every figure in Switzer with tabular numerals, and keep shared-scale comparisons on one shared scale.
- **Do** use amber and coral only when a risk or warning state is actually present.
- **Do** separate series by solid, dashed and dotted line styles within the green family and neutrals.
- **Do** label every placeholder in words and dash its border.
- **Do** keep the "Not financial advice" disclaimer visible: a bordered panel in the footer of every page, a short linked notice near the top of the Overview and stock pages, and a line in the full-screen Globe.
- **Do** draw icons as authored inline SVG with round caps and stroke weights of 1.6 to 1.8.

### Don't:
- **Don't** add eyebrow labels above headlines. Short sentence-case stat labels above a figure are not eyebrows and stay.
- **Don't** use coloured side-stripes on cards, rows or callouts. Neutral hairline dividers between cells are fine.
- **Don't** use emoji or glyph icons. The characters in the Sector Figure are data marks, not icons, and are the one sanctioned use.
- **Don't** apply gradients to text. Gradients are for scales, ramps, chart fills and the faint figure wash.
- **Don't** show directional labels such as BULLISH or BEARISH, or their softer equivalents like Tailwind and Headwind, unless live data backs them.
- **Don't** word anything as a buy, sell or hold recommendation, or show invented example values.
- **Don't** add entrance animation to charts, or a third typeface.

### Known exceptions
- Stock pages use a one-tone heading, because a company's name can't be split into two clauses like the other headlines.
- A few small readouts use DM Mono beyond The Machine Text Rule: the footer meta line, the Stocks count, the regime pill's probability and Chart.js tooltips. Don't extend this further.
- The full-screen Globe console is the one uppercase, instrument-style surface. It stays on the dark tokens in either theme.
