# Marble Machine Rush: design decisions

Working title. "Marble Machine" is already used by an iPad game and by Wintergatan's music machine, so the game needs a new name before any store presence.

This file records what Stages 1–4 decided, so later stages build on the same ground. The full critique and competitor research are in the session that produced this repo.

## What changed from the original concept

| Original idea | Decision | Why |
|---|---|---|
| Rotate the whole structure freely in 3D | Tilt it, up to about 20° in any direction; it eases back to level when you let go | Open carved grooves spill marbles if the machine turns far, and the reference look depends on open grooves |
| Normal rigid-body physics | **Rail physics**: each marble rides the centre line of its groove | No bumps at block seams, the same input always gives the same result, and it's easy to debug |
| A long list of mechanics | One signature mechanic plus plates and gates | Everything else waits until the core is proven fun |
| Hand-modelled levels | Levels are grid data built from one kit of blocks | Unique layouts stay cheap to make |
| Full time-attack | Kept, but treated as a hypothesis with a second variant where the clock starts on the first tilt | Timers split puzzle audiences; test both |

## Signature mechanic: one tilt, every marble, each only along its own groove

A marble in a groove can only roll along it, so it only reacts to the part of the tilt that points along its groove. Tilt north and marbles in north–south grooves roll while marbles in east–west grooves stay put. A diagonal tilt moves both.

**Counterweight gates** create the dependency. A gate stays open only while a marble rests on its plate. The tilt that moves one marble through a gate often rolls the counterweight off the plate, unless the counterweight is parked in a groove that runs across that move.

## Rules (all implemented in `prototype/src/sim.js`)

1. **Flat groove:** the marble rolls only while you tilt along it. Let go and it brakes to a stop.
2. **Ramp:** steeper (26.6°) than the max tilt (20°), so it only works downhill.
3. **T-junction:** the marble takes the most downhill branch. A turn wins a tie, so a diagonal tilt means "take this turn". With no branch downhill it keeps going straight; with no straight option it bumps to a stop. The junction is an open square, so a marble resting in it rolls into any branch that is clearly downhill, even if its own groove runs across the tilt.
4. **Crossing:** marbles go straight through.
5. **Plate and gate:** a marble resting on the plate keeps the linked gate open.
6. **Goal:** the matching colour locks in. A wrong colour bounces back, which costs time but does not fail the level. A goal with a metal band also acts as a plate, which gives you delivery order.
7. **Traffic:** marbles block each other in a groove.
8. **Fail:** the clock reaches zero. (Falling off open edges is not in the prototype.)

## Controls

- **Tilt:** drag anywhere with one finger. Marbles roll the way you drag. The tilt grows with drag distance, reaching full tilt at 18% of the screen's short side.
- **Floating anchor:** past that distance, the drag's starting point follows your finger like a floating joystick. Reversing direction responds immediately instead of first undoing a long drag.
- **Smooth response:** the machine follows the finger on a critically damped spring. It eases in, arrives in about 0.2 s and never overshoots.
- **Let go:** the machine eases back to level. This is the brake.
- **Direction assist** (setting, on by default): snaps the tilt to the four groove directions (62° catch zones) or the four diagonals (28° zones). A little stickiness at zone edges stops the machine flicking between two directions.
- **Camera:** fixed three-quarter view (50° down, 24° off the grid axis). Two buttons turn it in 90° steps; gravity doesn't change and dragging stays screen-relative.
- **Keyboard** for desktop testers: arrows or WASD (two keys for a diagonal), R to restart.

## Visual direction

- One cube-grid kit:
  - **Grooved blocks:** solid block, straight groove, curve, T-junction, crossing, dead end.
  - **Mechanism blocks:** goal, plate, gate.
  - **Two-cell ramp.**
- A machine is only its track blocks and the supports under raised parts, with no filler slabs. Every block must touch the rest so the machine tilts as one piece; the level tests check this.
- Raised blocks get support columns automatically.
- **Wood:** light, procedural grain, five tint variants. Small gaps between blocks show the seams that make it read as a real toy.
- **Grooves:** carved into the block tops as a smooth U-shaped channel about a third of the block wide, darker where deeper. Marbles rest on the channel floor, so they visibly roll in the groove. Goals and plates sit in round cups.
- **Marbles:** glossy, with a pale band so rolling is visible. Marbles inside tunnels show as coloured outlines through the wood.
- **Junctions:** where grooves meet (T-junctions, crossings), the channels merge into one carved floor. Dead ends are rounded.
- **Tunnels:** a block sitting on a straight groove gets an arched tunnel through its base, with a dark inside, so the marble rolls into a visible opening.
- **Mechanisms:** goals are a coloured ring and inlay. Plates and gates are metal (brass for link A, graphite for link B). A cable is strung between two posts, one beside each plate (or banded goal) and one beside the gate it opens. When the gate is open, the cable glows and beads run along it towards the gate.
- **Background:** teal backdrop. HUD in pale maple, with Arimo throughout.

## Flow

- **Home screen:** the app opens here. The next unfinished level turns slowly behind a central Play button, with Levels and Settings below.
- **Progression:** levels unlock in order; finishing one opens the next. The level list shows locked levels.
- **For testers:** Settings → Reset progress locks everything again for the next person.

## Biggest risk, and the first test

Can a first-time player, under a countdown, predict what every marble will do before they tilt? See [playtest.md](playtest.md).
