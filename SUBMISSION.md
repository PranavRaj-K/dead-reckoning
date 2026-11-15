# NASA Space Apps 2026 submission kit

Copy these into the project submission form. Submission closes at the deadline your event lists
(November 15, 11:59 PM local time for the main event) and cannot be edited afterwards.

## Challenge

**Space Mission Design Game**

## Project name

Dead Reckoning

## Links

- **Live demo:** https://ronaksarda.github.io/dead-reckoning/
- **Repository:** https://github.com/PranavRaj-K/dead-reckoning
- **30-second demo video:** upload `docs/demo/dead-reckoning-30s.mp4` to YouTube (unlisted) or Google Drive
  and paste that link. The project page does not accept video uploads. English captions are burned in.

## High-level summary

Dead Reckoning is a browser game where you design, launch and fly a 3U Earth-observation CubeSat, and
keep it alive when the hardware fails. You choose a mission objective, one of three real orbits
(Sentinel-2A, NASA/USGS Landsat 9, or the ISS) and a launch vehicle that sets your mass limit and spends
from the same budget as your parts. Then you build the spacecraft from seven subsystems and watch it
assemble in 3D while mass, cost, power, battery, downlink and pointing budgets update live.

The six-hour mission is propagated with SGP4 from real element sets over a 3D Earth textured with NASA
GIBS imagery, with real sunlight, eclipses and ground-station passes, and space weather from NASA DONKI.
Three faults hit on a fixed timeline: the recovery options you get depend on what you built. The
debrief scores science, data and resource stewardship, explains the chain from design choice to
outcome, and suggests one-click design changes for the next run. Up to four players can share one
screen, each owning part of the spacecraft and making the call when their subsystem fails. A coached
"Grade S plan" shows the best run and explains every choice.

## How it addresses the challenge

| Challenge asks for | Dead Reckoning |
| --- | --- |
| Define a mission objective | Imaging survey, wide-area mapping or precision science, each with its own targets |
| Design a spacecraft, select instruments | Seven subsystems (bus, solar, battery, radio, antenna, attitude control, instrument) plus a backup beacon, assembled in 3D |
| Choose a launch vehicle and orbit | Three launches (rideshare, station deploy, dedicated) with real reach limits; three real orbits |
| Manage budget, mass, power, comms, data | Live budgets with launch-blocking validation and risk posture |
| Simulate the mission | Six hours of SGP4-propagated flight with passes, eclipses, recorder and three faults |
| Feedback and scoring | Graded debrief, causal timeline, run comparison, "What to change next" suggestions |
| Team play for up to four | 1–4 players with roles that own subsystems and fault decisions |
| Different levels of knowledge | First-run walkthrough on every screen, a coached Grade S plan, plain-language explanations |

## NASA data used

- **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information): solar flares,
  geomagnetic storms and solar energetic particle events, mapped to bounded power, pointing and sensor
  noise effects. https://api.nasa.gov
- **NASA GIBS** (Global Imagery Browse Services), Blue Marble Shaded Relief and Bathymetry: the Earth in
  the 3D orbit view, fetched live with a bundled copy for offline use. https://nasa-gibs.github.io/gibs-api-docs/
- **Landsat 9** (NASA/USGS) orbit: one of the three flyable orbits, propagated from its element set.

## Other data and references

- CelesTrak GP/OMM element sets for Sentinel-2A (40697), Landsat 9 (49260) and the ISS (25544). https://celestrak.org
- satellite.js (SGP4 propagation, MIT). https://github.com/shashwatak/satellite-js
- three.js (MIT) and React Three Fiber (MIT) for 3D. https://threejs.org · https://r3f.docs.pmnd.rs
- React and Vite (MIT). https://react.dev · https://vite.dev
- Chakra Petch font by Cadson Demak, SIL Open Font License 1.1. `src/assets/fonts/OFL.txt`
- Model assumptions: `docs/ASSUMPTIONS.md`

## Use of AI

<!-- Edit to match your team's actual use; check the 2026 submission guide for any required wording. -->
AI coding assistants were used during development. All design decisions, data sources and results were
reviewed and verified by the team; the simulation is covered by an automated test suite.

## Voiceover for the 30-second demo

Timed to `docs/demo/dead-reckoning-30s.mp4`. About 80 words: speak calmly and land each line inside its
window. Record in a quiet room, phone held 20 cm away, and save it as `voice.m4a` (or `.wav`).

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:04 | Title and 3D spacecraft assembling | "Dead Reckoning. Design a satellite, fly it on a real orbit, and keep it alive when it breaks." |
| 0:04–0:08 | Mission setup: objective, orbit, launch, team | "Pick a goal, a real orbit like NASA's Landsat 9, a rocket, and up to four teammates." |
| 0:08–0:13 | Parts swapping on the 3D model | "Every part costs mass, power or money, and bolts onto your spacecraft." |
| 0:13–0:17 | Earth from NASA GIBS, orbit at 900× | "Then fly it: real orbital mechanics over NASA imagery, with NASA space weather." |
| 0:17–0:24 | Fault dialogs | "Three failures hit. What you built decides how you can save it." |
| 0:24–0:30 | Grade S debrief and suggestions | "The debrief shows exactly what to change. Fly again, and earn your S." |

Add the recording to the video (keeps the picture untouched, trims to the video length):

```bash
ffmpeg -i docs/demo/dead-reckoning-30s.mp4 -i voice.m4a -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest dead-reckoning-30s-voice.mp4
```

The captions are already burned in, which covers the English-subtitle rule.

## Live pitch for local judging (60 seconds)

Use this if judges ask you to present. Open the live site on the Brief screen before you start.

1. **Problem (10 s):** "Mission design is all trade-offs, but students only ever see them one at a time:
   orbits in one class, power budgets in another. Nobody gets to feel how one choice breaks another."
2. **Solution (15 s):** "Dead Reckoning makes you design the whole mission. Goal, orbit, rocket, seven
   subsystems, every budget live, and your spacecraft builds itself in 3D as you choose." Click
   *Design the spacecraft*, pick an orbit, swap one part.
3. **Real science (15 s):** "The orbit is real: SGP4 on actual element sets, sunlight and passes computed,
   Earth from NASA GIBS, space weather from NASA DONKI. When the radio dies, your options depend on what
   you built." Launch, set 900×, wait for the first fault.
4. **Learning loop (10 s):** "The debrief traces every loss back to a decision and suggests the fix. Teams
   of up to four split the roles, and a coached Grade S plan explains the best possible run."
5. **Close (10 s):** "It runs in any browser, works offline, and every number is documented. The orbit is
   real. The spacecraft is yours."

## Likely judge questions

- **"What is real and what is modelled?"** The orbits, sunlight, eclipses, station passes, Earth imagery and
  space-weather events are real data. Part specs, fault timing and scoring are teaching assumptions, every
  one listed in `docs/ASSUMPTIONS.md` and in the app's "What is real" panel.
- **"Is there one right answer?"** No. Every objective and orbit pairing is flyable, and the best grade
  changes with the orbit. The Grade S plan is the best run for one mission and one seed, and it explains
  the gamble it takes.
- **"How would a classroom use it?"** One screen per team of four, each student owning a subsystem and
  its failure. Same seed for every team, so results are directly comparable in the debrief table.
- **"How do you know the simulation is right?"** 114 automated tests: deterministic replays, budget rules,
  fault recovery, data validation, and the Grade S plan replayed at three clock speeds.
