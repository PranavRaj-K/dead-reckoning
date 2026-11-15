# Dead Reckoning

A browser-based mission-control game for **NASA Space Apps 2026**. You design a 3U Earth-observation
spacecraft against real mass, power, data and cost limits, then fly a six-hour mission through three
cascading faults. Every choice spends mass, power or money — and every fault traces back to one of them.

The spacecraft is fictional. Its sunlight, eclipse timing, ground-station passes and ground track are
propagated with **SGP4** from the real CelesTrak element set of **SENTINEL-2A (NORAD 40697)**.

- No backend, no build-time API calls, no chart or UI component libraries. 3D views use three.js.
- The spacecraft is a 3D model that assembles part by part as you design it; the mission flies over a
  3D Earth textured with NASA GIBS Blue Marble imagery.
- A first-run walkthrough on every screen ("How to play" brings it back).
- Runs fully offline from bundled snapshots.
- Deterministic: the same seed and the same data always reproduce the same run.

---

## Quick start

Requires **Node 20.19+ or 22.12+** (Vite 8 requirement).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks (`tsc -b`) then builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs the Vitest suite (108 unit tests, no DOM) |
| `npm run lint` | Runs oxlint |

No environment file is needed. To supply your own keys, copy `.env.example` to `.env.local`.

---

## How a run works

1. **Brief** — the mission, the data provenance, and what is real versus modelled.
2. **Design** — seven component slots, a backup beacon, and a risk posture. Mass, cost, panel power,
   eclipse battery, downlink throughput and pointing all update as you change parts. A design that
   exceeds the limits cannot be launched.
3. **Fly** — a six-hour mission at 60×, 300× or 900× speed. Twelve observation windows, real ground-station
   passes, a live flight log. Three faults fire on a fixed timeline and pause the clock; each offers
   two or more recovery paths whose preconditions are checked against the design you actually built.
4. **Debrief** — grade, score breakdown (science 60%, data 25%, resource stewardship 15%), the causal
   timeline from decision to fault, and a comparison table across saved runs. **What to change next**
   reads the run (lost scenes, power cuts, off-pointing imagery, a failed radio reset with no beacon) and
   offers up to four one-part changes, each re-budgeted so it says whether it still launches. One click
   opens the workbench with that part swapped in.
5. **Grade S plan** — one click (on the brief, the workbench or the debrief) loads the highest-scoring
   design for the default seed. Every part and every recovery is a button that explains why it wins, and
   each fault dialog marks the Grade S move.

Everything is operable with mouse or keyboard (standard tab / Enter / Space). There are no hidden
shortcut keys.

---

## Data sources and provenance

| Source | Endpoint | Used for |
| --- | --- | --- |
| CelesTrak GP / OMM JSON | `gp.php?CATNR=40697&FORMAT=json` | Orbital elements for SGP4 propagation |
| NASA DONKI GST / SEP / FLR | `api.nasa.gov/DONKI/*` | Bounded space-weather modifiers |
| NASA GIBS WMS | `gibs.earthdata.nasa.gov` `BlueMarble_ShadedRelief_Bathymetry` | Earth texture for the 3D orbit view (bundled copy offline) |

Each source resolves in this order, and the UI always states which one answered:

1. **LIVE** — fetched over HTTPS with an 8 s timeout and full payload validation.
2. **CACHED** — a stored copy with its real age: the last good response from `localStorage`, or the
   bundled snapshot. A live copy younger than 2 hours (CelesTrak) or 1 hour (DONKI) is reused instead of
   re-fetched, because CelesTrak blocks faster re-downloads and `DEMO_KEY` is rate-limited. The badge note
   says which case applies.
3. **ERROR** — nothing usable. The UI says so; the mission cannot launch without an element set.

A partially failed weather fetch is a normal state, not a hidden error: DONKI's `FLR` endpoint has been
observed returning HTTP 404, so the app reports which sub-source did not respond and continues with the
rest. Cached data is never presented as live.

### Bundled snapshots

`src/data/snapshots/` holds real captured API envelopes, so the demo works with the network switched off.
Refresh them with:

```bash
node scripts/fetch-snapshots.mjs            # uses DEMO_KEY unless NASA_API_KEY is set
node scripts/fetch-snapshots.mjs --days 45 --norad 40697
```

A source that fails is written with `payload: null` rather than invented data. The script records each
request URL with the API key **redacted**, so a personal key cannot end up in a committed snapshot.

---

## Environment variables

Every variable is optional; see [`.env.example`](.env.example).

| Variable | Scope | Default | Notes |
| --- | --- | --- | --- |
| `VITE_NASA_API_KEY` | browser bundle | `DEMO_KEY` | **Public.** `VITE_` values are compiled into the client JavaScript. |
| `NASA_API_KEY` | Node scripts only | `DEMO_KEY` | Used by the snapshot refresh script; never shipped. |

The app is a static client, so a key supplied to the browser cannot be kept secret. `DEMO_KEY` is NASA's
shared rate-limited public key and is the intended default. If you bring your own key, use one you can
revoke, and do not reuse credentials that grant paid quota elsewhere.

---

## What is modelled, and what is not

Real: SGP4 propagation of the reference element set, eclipse and sunlight geometry, station look angles
and pass windows, and the source data itself.

Game assumptions: component masses, costs, power draws, data rates, battery behaviour, recorder capacity,
fault timing, recovery odds and scoring weights. These are chosen to make trade-offs legible, not to
predict a real spacecraft. Every constant and mapping rule is listed in
[`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) and summarised in the in-app "What is real, what is
modelled" panel.

---

## Project layout

```
src/
  app/useGame.ts        single stateful hook: environment, budgets, clock, saved runs
  sim/                  pure, UI-free simulation (no React, no timers, no Math.random)
    mission.ts          fixed-step integration, faults, telemetry, flight log
    orbit.ts            satellite.js SGP4, eclipse, station passes
    resources.ts        mass / power / data budgets, validation, posture rules
    salvage.ts          recovery paths and their preconditions
    scoring.ts          debrief scoring and grades
    catalogue.ts        components, presets, scenario definition
    events.ts           DONKI records -> bounded game modifiers
  data/                 HTTP adapters, validation, cache, bundled snapshots
  components/           briefing, workbench, operations, debrief, walkthrough, 2D fallbacks
  three/                3D spacecraft assembly and 3D orbit (lazy-loaded; 2D fallback without WebGL)
  styles/app.css        the whole visual system (no CSS framework)
  tests/                Vitest unit tests
scripts/                snapshot refresh tool
```

---

## Deployment

The build is a static bundle with `base: './'`, so it works at a domain root or any subdirectory on any
static host — Netlify, Vercel, GitHub Pages, Cloudflare Pages, or S3.

```bash
npm run build
# upload the contents of dist/
```

No server, no runtime configuration, no redirects are required. Cross-origin requests go directly to
CelesTrak, `api.nasa.gov` and NASA GIBS, all of which allow browser access; if a network blocks them, the
app falls back to CACHED and still plays.

The production `index.html` carries a Content-Security-Policy `<meta>` tag (added at build time in
`vite.config.ts`) that allows scripts from the app's own origin only and network access to those three
hosts only. `npm run preview` serves the build with it, so test there before deploying.

---

## Submission materials

| File | What it is |
| --- | --- |
| [`docs/demo/dead-reckoning-demo.mp4`](docs/demo/dead-reckoning-demo.mp4) | 2-minute captioned demo recorded from the production build: 3D assembly, the Grade S plan, all three faults with coaching, the S debrief |
| [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | 90-second recording script, timed shot by shot |
| [`SLIDES.md`](SLIDES.md) | Slide-by-slide outline with speaker notes |
| [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) | Every constant and mapping rule the model uses |

---

## Attribution

Orbital propagation by [satellite.js](https://github.com/shashwatak/satellite-js). 3D rendering by
[three.js](https://threejs.org) and [React Three Fiber](https://r3f.docs.pmnd.rs). Element sets from
[CelesTrak](https://celestrak.org). Space-weather events from NASA's
[DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/). Earth imagery from NASA's
[GIBS](https://nasa-gibs.github.io/gibs-api-docs/) (Blue Marble, public domain). Built for NASA Space Apps 2026.

Display face: **Chakra Petch** by Cadson Demak, [SIL Open Font License 1.1](src/assets/fonts/OFL.txt).
Self-hosted so the app keeps its typography offline.

Not affiliated with NASA. An educational model, not a flight prediction or an operational tool.
