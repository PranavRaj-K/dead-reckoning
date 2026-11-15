# Model assumptions

Dead Reckoning is an educational trade-off model, not a flight dynamics tool. This file lists every
number and mapping rule the game applies so nothing in the interface is unexplained. Where a value comes
from a real object or a real API, that is stated; everything else is a deliberate game assumption.

The in-app **"What is real, what is modelled"** panel in the briefing says the same thing in short form.

---

## 1. Real inputs

| Input | Source | Notes |
| --- | --- | --- |
| Orbital elements | CelesTrak GP / OMM JSON for three selectable orbits: `CATNR=40697` (Sentinel-2A, default), `49260` (Landsat 9), `25544` (ISS) | Fetched live, cached in `localStorage`, or read from `src/data/snapshots/celestrak-gp*.json`. The Landsat 9 and ISS snapshots were captured as TLEs from a public CelesTrak mirror (CelesTrak was rate-limiting the capture) and converted field by field to OMM; each envelope says so |
| Space-weather events | NASA DONKI `FLR`, `GST`, `SEP` over a rolling 30-day window | Event classes and Kp indices only; never treated as a dose measurement |

Propagation uses **satellite.js** `json2satrec` + `propagate` (SGP4, TEME). Geodetic position comes from
`eciToGeodetic` after a GMST rotation; station look angles from `ecfToLookAngles`; solar position from
satellite.js's low-precision solar ephemeris, which is accurate to a few arcminutes — far finer than the
rest of this model needs.

**The spacecraft is fictional.** Its altitude, sunlight, eclipse timing, ground track and station passes
are those of the reference object's element set, starting at that element's epoch. The app labels this on
the briefing screen and in every run's flight log.

---

## 2. Orbital and environmental geometry

| Quantity | Rule |
| --- | --- |
| Sunlight / shadow | `shadowFraction` from satellite.js; a sample is **sunlit** below 0.5 and in **eclipse** at or above it (penumbra midpoint) |
| Sunlit fraction, eclipse minutes | Sampled over one orbital period at the mission epoch, then held constant for budget display |
| Ground stations | Wallops (37.94°, −75.46°), Goldstone (35.43°, −116.89°), Canberra (−35.40°, 148.98°) — real sites, used as reference geometry |
| Pass detection | Look-angle scan across the mission; a pass exists while elevation ≥ **5°** |
| Link quality | `0.55 + 0.45 × sin(peak elevation)`, so a horizon-grazing pass carries about 55% of nominal throughput |
| Pass windows | Predicted for the full six hours before launch from propagated geometry, not scripted |

Scene **target sites are scripted windows** (Section 3) rather than derived from tasking requests; they are
independent of pass timing, so a scene can be captured with no pass available to downlink it — which is the
intended source of recorder pressure.

---

## 3. Mission timeline

| Constant | Value |
| --- | --- |
| Simulation step | fixed **10 s** (`TICK_SEC`), with at most 500 steps integrated per UI call |
| Mission duration | 6 h (21,600 s) |
| Observation windows | 12 windows, 180 s each, first at t+300 s, spaced 1,500 s apart |
| Science / data target | Set by the mission objective: imaging survey 50 points / 60 MB (default), wide-area mapping 30 / 120 MB, precision science 90 / 40 MB |
| Injected faults | Radio at 6,480 s, ADCS at 11,880 s, battery at 16,848 s |
| Brownout failure | **600 s** of continuous brownout ends the mission; recharging above empty ends the brownout and resets the count |

Faults fire on fixed mission times so that runs are comparable; the fault *consequences* depend on the
design the player built. Time is integrated in fixed steps and is chunk-invariant: advancing 3 × 300 s
produces exactly the same state as 30 × 30 s.

---

## 4. Resource accounting

### Power

| Constant | Value | Meaning |
| --- | --- | --- |
| `PANEL_LOSS_FACTOR` | 0.9 | Array orientation, conversion and wiring loss |
| `HOUSEKEEPING_W` | 1.2 W | OBC, receiver, thermistors, deployment keeps |
| `HEATER_ECLIPSE_W` | 3.5 W | Survival heater, applied in eclipse (and included in the average load weighted by eclipse fraction) |
| `RADIO_DUTY_ESTIMATE` | 0.11 | Fraction of the mission the transmitter is assumed to run |
| `BATTERY_DOD_LIMIT` | 0.8 | Usable fraction of rated capacity |

- Average generation = `peak W × 0.9 × sunlit fraction`, minus the space-weather generation penalty.
- Average load = housekeeping + ADCS + instrument × (scene seconds ÷ mission seconds) + radio × 0.11 +
  heater × (1 − sunlit fraction).
- Energy margin = average generation − average load.
- Eclipse energy need = `(average load + heater) × eclipse hours`.
- Available eclipse energy = `rated capacity × 0.8`.
- Charging is capped at rated capacity; discharge stops at 0 Wh and raises a brownout.

### Downlink and recorder

- Effective downlink = `radio kbps × antenna gain factor × link quality`.
- Antenna gain factor is the part's rating, **collapsed to 55%** when the design's pointing error exceeds
  that antenna's requirement.
- Recorder capacity comes from the bus. Imagery is written as it is captured and overwritten **oldest
  first** when the recorder fills, which loses that scene permanently.
- Data downlinked during a pass is credited to scenes oldest-first; science is credited in proportion to
  the fraction of a scene's data that reaches the ground.

### Pointing and scene quality

- Pointing error = ADCS accuracy + attitude-mode penalty + space-weather disturbance, where the magnetic
  mode penalty is `max(0, 2.5° − base)` and the degraded mode adds `1.2°`.
- Scene quality = `cloud × pointing factor × radiation factor`, clamped to `[0.05, 1]`.
  - `cloud = 0.65 + 0.35 × seededUnit(seed, 'cloud', sceneIndex)`.
  - Pointing factor is 0.5 when the pointing error exceeds the instrument's rating, otherwise 1.
  - Radiation factor is `1 − 0.25 × radiationNoise`, so sensor noise costs at most 25% of quality.
  - A scene whose instrument lost power at any point in its window (brownout, or shed by the degraded
    battery's discharge limit) is fixed at 0.05.
- Scene science = `instrument science value × quality`.

---

## 5. Design limits and posture

| Constant | Value |
| --- | --- |
| Launch mass limit | Set by the launch: rideshare to sun-synchronous 4.5 kg ($30,000), deploy from the space station 4.0 kg ($20,000), dedicated small launcher 6.0 kg ($45,000) |
| Cost limit | $140,000 for the whole mission, launch included (the default rideshare leaves $110,000 for parts) |
| Launch reach | Rideshare: the two sun-synchronous orbits. Station deploy: the ISS orbit only. Dedicated: any orbit. A launch that cannot reach the chosen orbit blocks launch |
| Team play | 1–4 players on one screen. Roles: mission lead (objective, orbit, launch, posture), spacecraft engineer (bus, arrays, battery; battery fault), communications (radio, antenna, beacon; radio fault), science and attitude (instrument, ADCS; ADCS fault). Roles are shared round-robin when there are fewer than four players |
| Backup beacon | +0.05 kg, +$1,200, 0.4 kbps omni fallback, 0.6 W |

Component masses, costs, power draws, data rates and recorder sizes are game assumptions chosen so that no
single design dominates; they are not manufacturer data.

Risk posture changes only the validation thresholds, never the physics:

| Posture | Minimum generation margin | Eclipse battery reserve |
| --- | --- | --- |
| Conservative | 15% | 30% |
| Balanced | 5% | 20% |
| Aggressive | 0% | 10% |

A design that fails mass, cost, energy or battery validation cannot launch. Thin margins and a missing
beacon are warnings, not blockers.

---

## 6. Faults and recovery

| Fault | Time | Effect | Recovery paths |
| --- | --- | --- | --- |
| Main radio failure | 6,480 s | Downlink falls to zero; recorder keeps filling | Backup beacon (needs the part), risky reset (**45%** success, one attempt), end mission |
| Attitude-control degradation | 11,880 s | Pointing error +1.2°; imagery outside instrument spec | Magnetic mode (2.5° pointing, lower power), accept degraded pointing, skip the next three scenes and recover to nominal |
| Battery degradation | 16,848 s | Capacity × **0.6**, discharge limited to **12 W** | Sun-safe pause (skip two scenes to recharge), shed-and-continue |

Recovery preconditions are checked against the actual design and mission state — for example the beacon
path is unavailable if the part was never fitted, the reset cannot be attempted twice, and schedule trims
are blocked when too few windows remain. When the degraded discharge limit is exceeded, the simulation
sheds the instrument first, then the radio.

The radio reset is a **seeded** roll: the same seed always produces the same outcome, so a run is
reproducible rather than luck-dependent on replay.

---

## 7. Space-weather mapping

DONKI reports events, not conditions at a spacecraft. Each record is converted into a bounded modifier:

| Input | Rule |
| --- | --- |
| Flare severity | Letter base (X 0.75, M 0.5, C 0.25, B 0.1, A 0) + up to 0.25 scaled by the class number, clamped to 1 |
| Radiation noise | `max(strongest flare severity, SEP present ? 0.65 : 0)` |
| Generation penalty | Kp ≥ 7 → 2.0 W; Kp ≥ 5 → 1.2 W; Kp ≥ 4 → 0.6 W; otherwise 0.2 W |
| Pointing penalty | Kp ≥ 7 → 0.5°; Kp ≥ 5 → 0.35°; otherwise 0° |

The strongest flare and the highest Kp in the fetched window set the modifiers for the whole run; there is
no time-varying weather evolution within a mission.

---

## 8. Scoring

| Component | Weight | Definition |
| --- | --- | --- |
| Science | 60% | Delivered science ÷ target, clamped to 100 |
| Data | 25% | Delivered data ÷ target, clamped to 100 |
| Resources | 15% | Mean of mass-margin ratio, energy-margin ratio (against 15% of average load) and final battery ratio |

Status: `SUCCESS` requires the science **and** data targets met; `PARTIAL` requires at least half the
science target; anything less, or a lost spacecraft, is `FAILURE`. Grades: **S** for a `SUCCESS` scoring ≥ 95, then
A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, otherwise F. The in-app **Grade S plan** (`src/sim/perfect.ts`) is the
highest-scoring design, launch and recovery sequence for the default mission and seed (97.4), found by
simulating every launchable design on every launch that reaches the default orbit against every recovery
combination; a test replays it.

An exhaustive sweep of every launchable design on every objective and orbit (default seed, calm weather)
found that every pairing is flyable. The best outcomes differ by orbit: precision science reaches S only
from the Sentinel-2A orbit and tops out at B from Landsat 9 and ISS orbits, and wide-area mapping tops out at
A from the ISS orbit. The orbit is a real decision, not a cosmetic one. The grade is a teaching signal, not a competition score.

Every figure in the debrief is read from recorded mission state; nothing is recomputed from a script.

---

## 9. Determinism and data honesty

- The simulation never calls `Math.random()`. Seeds are mixed with FNV-1a and drawn from a mulberry32
  stream, so the same seed and the same input data reproduce an identical run, including cloud cover and
  the radio reset roll.
- API payloads are validated field by field. Malformed data raises a readable error and produces an ERROR
  badge instead of half-real numbers.
- A failed source falls back to cache, then to the committed snapshot, and the UI always shows which one
  answered and how old it is. Cached data is never labelled live.
- DONKI's `FLR` endpoint has been observed returning HTTP 404. That is reported as a partial failure of a
  named source, not hidden and not replaced with invented flare data.

---

## 10. What this model deliberately does not do

No atmospheric drag evolution beyond the element set, no thermal network, no attitude dynamics or control
loop, no radiation dose accumulation, no link budget beyond the single gain factor, no orbital
manoeuvres, and no real-time weather coupling. These omissions are the reason the app is a teaching tool
rather than a mission-design authority.
