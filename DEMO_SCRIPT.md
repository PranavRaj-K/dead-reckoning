# 90-second demo script

**Dead Reckoning — NASA Space Apps 2026**

Target length **1:30**. Record at 1440×900, browser zoom 100%, one tab, no dev tools. Every beat below is
something the app actually does; nothing here is aspirational.

---

## Before you hit record

1. `npm run dev` and open `http://localhost:5173`.
2. Sit on the **Brief** screen. Do **not** launch a run yet — the recording opens on a fresh state.
3. Check the two data badges in the top bar. Either **LIVE** or **CACHED** is fine, and saying why is part
   of the pitch. Avoid opening the app with both badges **ERROR**.
4. Hard-refresh once so the briefing is not mid-load.
5. Have the console closed. A live DONKI 429 is expected and harmless, but it looks like a defect on video.

---

## The script

| Time | On screen | Say |
| --- | --- | --- |
| **0:00–0:08** | Brief screen, headline visible | "A satellite fails at 22,000 kilometres an hour. You have minutes, not meetings. **Dead Reckoning** is a mission-control game about the decisions that decide whether it survives." |
| **0:08–0:22** | Point at the two badges and the reference orbit panel | "This is not a scripted diorama. The orbit is propagated with **SGP4** from the real CelesTrak element set of Sentinel-2A. Space weather comes from **NASA DONKI**. Each source is labelled **live** or **cached** with its real age — if the network dies, the game says so instead of pretending." |
| **0:22–0:28** | Click **Open the workbench**; hover the three presets | "Seven component slots and a risk posture. Three starting designs, all valid, none dominant." |
| **0:28–0:40** | Click **Balanced**; scroll the Budgets panel | "Every choice spends mass, power or money. Rideshare mass cap 4.5 kilograms, mission budget 140,000 dollars including launch, and a downlink budget that cannot clear every image. Watch the mass margin and the energy margin move as the design changes." |
| **0:40–0:48** | Point at **Review**: 0 blocking issues; click **Launch mission** | "Nothing flies until the design passes validation. This one is legal — and thin." |
| **0:48–0:55** | Fly screen; click **900×** | "Six hours of mission, twelve observation windows, real ground-station passes computed from the propagated geometry." |
| **0:55–1:04** | Radio-failure dialog at **T+01:48:00** | "First fault: the main radio fails during a pass. The clock stops. Three ways out, and each one is a real trade — the beacon keeps you alive at a trickle, the reset is a 45% roll, ending the mission banks the data you already have." Click **Switch to backup beacon**. |
| **1:04–1:12** | Second fault at **T+03:18:00**; click **Switch to magnetorquer mode** | "Second: the reaction wheels degrade. Coarse magnetic pointing costs you image quality but almost no power. That is a design conversation, not a quick-time event." |
| **1:12–1:20** | Third fault at **T+04:40:50**; point at the **greyed-out** sun-safe option | "Third: half the battery capacity is gone. Sun-safe is greyed out — and it tells you why: fewer than two observation windows remain. The game checks preconditions against the spacecraft you actually built." Click **Shed loads and continue**. |
| **1:20–1:28** | Debrief: grade, score bars, causal timeline | "The debrief is generated from recorded state, not a script: grade, science / data / resource scores, and the causal chain from design choice to fault to recovery. Every run is deterministic, so this exact result replays." |
| **1:28–1:30** | Scroll to **Compare runs** | "Runs stack up for comparison. Redesign, refly, see what actually changed." |

---

## Narration notes

- **Do not read the numbers off the screen unless they are already there.** Scores vary with the seed; the
  run above lands in the C/B range, which is the point — a safe design is not a winning design.
- The strongest single beat is the **greyed-out recovery path**. Slow down on it.
- If the network is unavailable, the badges read **CACHED** and the run still works end to end from the
  bundled snapshots. Say that plainly: offline capability is a feature, not a failure.
- Never call the spacecraft real. It is a fictional 3U bus flying on Sentinel-2A's propagated geometry.
  Say "the orbit is real, the spacecraft is modelled" once, early.

## Recording checklist

- [ ] No browser bookmarks bar, no personal tabs.
- [ ] Badges readable at 1080p (top bar, right side).
- [ ] Each fault dialog fully settled before clicking — the 900× clock must be paused.
- [ ] Debrief reached, compare-runs table visible at least once.
- [ ] Audio normalised; no keystroke clicks over narration.
