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
4. **Crossing:** an open square where two grooves cross: a four-way junction under the same rule as a T-junction. A marble rolling through goes straight on unless the tilt points down a side arm; a marble resting in it rolls into whichever arm you tilt towards. (It used to be two separate grooves, so a marble stopped in the middle couldn't turn, which looked like a bug.)
5. **Plate and gate:** a marble resting on the plate keeps the linked gate open.
6. **Shutter:** the opposite of a gate. It stands open until its link is powered (a plate pressed or a banded goal filled) and shuts while it is. One plate can open a gate and shut a shutter at the same time.
7. **Goal:** the matching colour locks in. A wrong colour bounces back, which costs time but does not fail the level. A goal with a metal band also acts as a plate, which gives you delivery order.
8. **Traffic:** marbles block each other in a groove.
9. **Colour filter:** a coloured hood over a groove. The marble of that colour rolls through; every other colour bounces off it as off a closed gate.
10. **Portal:** two vortex cups of the same colour are a pair. A marble that rolls into one comes out of the other, moving away from it at the same speed.
11. **Stairway:** carries a marble up one tier at a steady pace (1.6 blocks/s), whatever the tilt. One-way: a marble arriving at the top is pushed back out. With ramps and whirls going down, stairways make loops.
12. **Whirl:** a funnel fed by grooves on its tier. The marble circles down (steeper than any tilt, so one-way), drops through the hole into the block below, and leaves through that block's grooves. If it has two ways out, the tilt picks one.
13. **Sky rail:** a magnetic beam over a gap that a marble hangs from. Kept moving, it crosses. If it stops for a quarter of a second (slower than 0.5 blocks/s), it falls: into the groove directly below, which is how a marble gets down to a lower deck on purpose, or, with nothing below, out of the game. A sky rail can end over a groove (the marble rolls to the end, stops and drops).
14. **Fail:** the clock reaches zero (20 seconds on every level), or a marble falls off a sky rail into nothing.

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
  - **Mechanism blocks:** goal, plate, gate, shutter, colour filter, portal.
  - **Two-cell pieces:** ramp (down) and stairway (up), each spanning two tiers.
  - **Whirl:** a funnel block over the block its marbles drop into.
  - **Sky rail:** a steel beam with a glowing magnet strip, held by brackets on the blocks at its ends. No wood: what's under it is air, or a lower groove.
- A machine is only its track blocks and the supports under raised parts, with no filler slabs. Every block must touch the rest so the machine tilts as one piece; the level tests check this.
- Raised blocks get support columns automatically.
- **Wood:** light, procedural grain, five tint variants. Small gaps between blocks show the seams that make it read as a real toy.
- **Grooves:** carved into the block tops as a smooth U-shaped channel about a third of the block wide, darker where deeper. Marbles rest on the channel floor, so they visibly roll in the groove. Goals and plates sit in round cups.
- **Marbles:** glossy, with a pale band so rolling is visible. Marbles inside tunnels show as coloured outlines through the wood.
- **Junctions:** where grooves meet (T-junctions, crossings), the channels merge into one carved floor. Dead ends are rounded.
- **Tunnels:** a block sitting on a straight groove gets an arched tunnel through its base, with a dark inside, so the marble rolls into a visible opening. Only straight grooves can run under wood: the level check rejects wood over a curve, junction, dead end or ramp, because a marble there would disappear into solid wood with no opening to show where it went.
- **Mechanisms:** goals are a coloured ring and inlay. Plates and gates are metal (brass for link A, graphite for link B, silver for link C). Shutters are striped red and white and sit in a red frame, so they read as "the other way round" even while open. A cable is strung between two posts, one beside each plate (or banded goal) and one beside the gate it opens. When the gate is open, the cable glows and beads run along it towards the gate.
- **Background:** teal backdrop.
- **Interface:** a casual mobile-game look: chunky glossy buttons, indigo card frames with cream panels, and the rounded Fredoka font. Every icon (coin, heart, stars, the six power-ups, settings, profile, levels) is a glossy SVG from `icons.js`. Text is kept to a few words; feedback is an animation (a power-up's icon pops, a heart breaks when a life goes, coins fly to the counter).

## Flow

- **Home screen:** the app opens here. The next level turns slowly behind "Level N" and a big Play button. Profile (an icon for now) top left; coins, lives and Settings top right; Levels bottom right.
- **A level:** from level 11 a start card offers power-ups to begin with. A win shows the Bravo screen (stars, coins, an optional ad that multiplies them); Next goes home, where the level number rolls on.
- **Settings:** three round toggles (Sound, Vibration, Tips) and How to play. Vibration only appears where the browser supports it, so not on iPhone. Testing options sit behind a small "Playtest tools" link.
- **Progression:** 100 levels in ten chapters that unlock in order; finishing one opens the next. The level list shows locked levels. New mechanics get a level of their own before they're combined: shutters (Level Crossing), the third link (Silver Key), the fifth marble (Grand Machine) and finally two machines linked into one.
- **Difficulty:** levels are ordered by a score built from the fewest moves the solver needs (one tilt held until everything stops), how many opening moves lose the level, how much of the position space is a dead end, and how few different shortest solutions there are. Every level has the same 20 seconds, so difficulty comes from tricky moves rather than long ones: an expert's reference run never takes more than 14 s. About every seven levels an extra-hard level (flame icon, more coins) jumps well ahead of the curve. See [levels.md](levels.md).
- **Every lock has a purpose:** the audit jams each gate (or shutter) open and re-solves. A level only ships if that makes it shorter or breaks every shortest solution; a gate you can ignore is cut. Nothing may go unused either: every gate, plate and goal is reached by the reference run or by a designed trap.
- **Fair for people, not just the solver:** each reference solution must still win when every hold and pause is made longer and sloppier (six randomised replays), so no level depends on frame-perfect timing.
- **Lives, coins and power-ups:** five lives that refill one per 15 minutes, gold coins earned from first completions and new stars, a paid second chance, and six power-ups from level 11. Every one has a per-attempt limit so the puzzles stay the challenge. See [economy.md](economy.md).
- **For testers:** Settings → Playtest tools → Reset progress locks everything again for the next person. The same panel changes lives and coins. The level list lives there too, since players just play the next level.

## Biggest risk, and the first test

Can a first-time player, under a countdown, predict what every marble will do before they tilt? See [playtest.md](playtest.md).
