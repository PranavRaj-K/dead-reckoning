# Slide-by-slide outline

**Dead Reckoning — NASA Space Apps 2026**
Twelve slides, roughly **5 minutes** of speaking plus the 90-second live demo. Slide 6 is where the demo
script slots in if you are presenting live rather than showing the recording.

Design note: the deck should look like the app — near-black background, one accent colour, monospace for
numbers, no drop shadows, no stock imagery. Every screenshot is a real screenshot.

---

### 1 — Title

**On screen**
- DEAD RECKONING
- *Design a spacecraft. Fly it. Keep it alive.*
- NASA Space Apps 2026 · Mission design & salvage

**Say (15 s)**
"Six hours of mission, twelve observation windows, three faults. The spacecraft is fictional — the orbit
is not."

---

### 2 — The problem

**On screen**
- Three constraints that fight each other: **mass, power, money**
- A real design review is a trade-off chain, not a checklist
- Most people never get to feel that trade-off

**Say (30 s)**
"Spacecraft design is the art of spending too little of everything. Mass you do not have, power you cannot
generate in eclipse, money that ends the programme. Textbooks describe the trade; they do not let you feel
it. We wanted the moment where you realise your safe design has no backup radio."

---

### 3 — What we built

**On screen**
- A four-phase loop: **Brief → Design → Fly → Debrief**
- Browser game, no install, no account, no backend
- Runs offline from bundled snapshots

**Say (25 s)**
"One polished mission instead of ten shallow ones. You design a 3U Earth-observation bus against hard
limits, launch it, fly six hours in real propagated geometry, and then read a debrief that tells you which
of your decisions caused which failure."

---

### 4 — Real data, labelled honestly

**On screen**
- Orbit: **SGP4** from CelesTrak GP for **SENTINEL-2A · NORAD 40697**
- Space weather: **NASA DONKI** FLR / GST / SEP
- Every source labelled **LIVE**, **CACHED** (with age) or **ERROR**

**Say (35 s)**
"This is the part judges should look at. The sunlight, eclipse timing, ground track and station passes are
propagated from a real element set — the spacecraft rides Sentinel-2A's geometry. Space weather comes from
DONKI as bounded modifiers, not invented physics. And every source carries its provenance in the UI. If the
live fetch fails we fall back to a stored snapshot and say so; we never relabel cached data as live."

---

### 5 — The design constraint

**On screen**
- 7 slots + backup beacon + risk posture
- **4–6 kg by launch** · **$140,000 incl. launch** · recorder and downlink budgets
- No dominant design: three presets, all valid, all flawed

**Say (30 s)**
"Seven decisions. Mass cap 4.5 kilograms, budget 110,000 dollars. The downlink budget cannot clear every
image, so recorder pressure is structural, not random. The mass, energy and data margins update live, and
nothing launches while validation fails."

---

### 6 — The mission (demo slot)

**On screen**
- 6 h · 12 scenes · 3 faults at fixed times
- 60× / 300× / 900× · clock pauses on every fault
- Live telemetry, flight log, predicted passes

**Say (20 s)**
"Faults fire at fixed mission times so two runs are comparable; the consequences depend entirely on what
you built. Here is the 90-second version."

> Insert the recorded demo here (`DEMO_SCRIPT.md`), or run it live from a fresh Brief screen.

---

### 7 — Salvage: decisions with preconditions

**On screen**
- Radio failure → beacon · 45% reset · end mission
- ADCS degradation → magnetic mode · accept · skip three scenes
- Battery loss → sun-safe (blocked) · shed loads
- Preconditions checked against the real design and state

**Say (35 s)**
"Each fault offers two or more recovery paths, and the game refuses the ones that do not apply. No beacon
fitted? No beacon option. Fewer than two windows left? Sun-safe is greyed out and explains why. This is the
educational core: recovery is a design decision you already made, arriving late."

---

### 8 — Determinism and testing

**On screen**
- Seeded RNG, FNV-1a + mulberry32 — no `Math.random()`
- Same seed + same data = identical run, including the reset roll
- **98 unit tests**, 8 files; type-checked build; lint clean
- Chunk-invariant step integration

**Say (30 s)**
"When something goes wrong in a demo, you need to replay it. Nothing in the simulation is random in the
non-reproducible sense: cloud cover and the 45% reset roll are seeded. The simulation is pure TypeScript
with no React and no timers, so it is unit-tested directly — 98 tests, including a check that advancing
time in different chunk sizes produces identical state."

---

### 9 — The debrief

**On screen**
- Grade + score: science **60%**, data **25%**, resources **15%**
- Causal timeline: design choice → fault → recovery → outcome
- Compare-runs table stored in the browser

**Say (30 s)**
"The debrief is read from recorded mission state, not recomputed from a script. You get the grade, the
three score components, and the chain from the decision you made in the workbench to the failure it caused
two hours later. Then the run is stored so you can change one component and see what actually moved."

---

### 10 — Engineering choices

**On screen**
- No chart or UI libraries — hand-rolled SVG orbit view, sparklines, CSS
- No backend, no build-time API calls
- `base: './'` static bundle: any host, any subdirectory
- Keyboard operable, responsive to ~390 px, reduced-motion respected

**Say (25 s)**
"We shipped a static bundle. That means no server to fall over during judging, and it runs from a USB
stick if the venue Wi-Fi dies. The orbit view is SVG we wrote, so it costs kilobytes rather than a charting
library."

---

### 11 — What this is not

**On screen**
- Not a flight dynamics tool
- No thermal model, attitude dynamics, drag evolution, or radiation dose
- Constants are documented game assumptions, not manufacturer data
- Not affiliated with NASA

**Say (25 s)**
"Every constant is listed in `docs/ASSUMPTIONS.md`, and the app says the same thing in its own panel. We
would rather be trusted for the data path and the trade-off model than oversell the physics."

---

### 12 — Close

**On screen**
- **Design it. Fly it. Watch the consequence.**
- Live URL + repository QR code
- `npm install && npm run dev`

**Say (15 s)**
"Dead Reckoning. One mission, honestly sourced, honestly labelled, and reproducible. Try to get an A —
then try to get it with the beacon removed."

---

## Backup slides (only if asked)

- **Data fallback chain** — live → `localStorage` cache → bundled snapshot → ERROR, with the badge proving
  which one answered.
- **Fault timing table** — 6,480 s / 11,880 s / 16,848 s and the 600 s brownout failure rule.
- **Scoring maths** — clamped ratios, resource score as the mean of mass, energy and final-battery ratios.
- **A failed run** — show a FAILURE debrief; it explains the model better than a success does.
