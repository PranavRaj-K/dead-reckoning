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
- Longer walkthrough (optional): `docs/demo/dead-reckoning-demo.mp4`

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
