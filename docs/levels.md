# The hundred levels

Every level is a different machine built from the same block kit, using only the blocks the track needs. Levels unlock in order: finishing one opens the next (for playtesting, `TESTING.unlockAllLevels` opens them all). The data lives in `prototype/src/levels.js`: levels 1–10 list their pieces, and levels 11–100 are drawn as text maps (see `prototype/src/grid.js` for the characters). Each level ships with a scripted reference solution and, where it has them, "traps": wrong opening moves that make it unwinnable. `npm test` plays every solution and every trap headlessly.

## How the levels were made and checked

Levels 11–100 started as hand-drawn machines. `tools/generate.mjs` searched each drawn machine for the hardest fair placement of goals, plates, gates, colour filters, portal pairs and marbles; the machine's fixed pieces (ramps, stairways, whirls, sky rails) are drawn by hand. Every level then went through `tools/finalize.mjs` and `tools/audit.mjs`, and only ships if:

- **Every lock has a purpose.** The audit jams each gate (or shutter) open and solves again. "Costs" means the level gets shorter with that lock open; "reroutes" means the shortest solutions with it open all fail in the real level, so the lock forces a different plan. The generator does the same for each colour filter and portal pair. A piece that changes nothing is cut.
- **Nothing is decoration.** Every gate, plate and goal is used by the reference solution or a designed trap.
- **People can repeat it.** The reference solution still wins with every hold and pause made longer and less precise (six randomised replays).
- **It fits the clock.** Every level has 20 seconds, and an expert's reference run takes at most 14 of them.
- **Tunnels show.** Wood may only sit on a straight groove, which then gets a visible tunnel opening.

## Difficulty

Levels are ordered by a difficulty score:

- the **fewest moves** (a move means tilting one of the 8 directions until everything stops; from `npm run solve`);
- plus 0.3 for each **losing opening**;
- plus the share of **dead positions** (positions reachable from the start that can no longer be won);
- minus a little for each extra **shortest solution**;
- plus 0.3 for each marble beyond two.

The score climbs steadily from level 11 to 100: nothing after the first ten is a beginner level. On top of that curve, 13 **hard levels** (🔥 in the game, and they pay half as many coins again) jump well ahead of it: 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 100.

New pieces get a level of their own before they're combined:

- shutters at 12 (Off the Plate);
- colour filters at 17 (Colour Check);
- portals at 24 (Wormhole);
- stairways at 33 (First Floor);
- whirls at 40 (Whirlpool);
- sky rails at 47 (Sky Bridges);
- a sky rail that ends over a groove, to drop down a tier, at 54 (Drop Zone).

The clock is the same for everyone: **20 seconds**. The stars come from the reference solution, so they stay fair when the physics is retuned:

- **2 stars (par)** = solution × 1.5 + 2 s (at most 18 s)
- **3 stars (gold)** = solution + 1 s

| # | Level | Marbles | Size (w×d, tiers) | New pieces | Fewest moves | Losing openings | Dead positions | Reference | Par | Gold |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Tilt | 1 | 5×3, 1 | – | 1 | 0 | 0% | 2.1 s | 6 s | 4 s |
| 2 | Two Grooves | 2 | 5×5, 1 | – | 1 | 0 | 0% | 2.2 s | 6 s | 4 s |
| 3 | Fork in the Road | 2 | 5×5, 1 | – | 2 | 0 | 0% | 2.9 s | 7 s | 4 s |
| 4 | Downhill Only | 2 | 6×4, 2 | – | 3 | 2 | 74% | 5.4 s | 11 s | 7 s |
| 5 | Counterweight | 2 | 5×5, 1 | – | 2 | 3 | 40% | 4.1 s | 9 s | 6 s |
| 6 | Hold the Door | 2 | 6×3, 1 | – | 2 | 3 | 14% | 4.9 s | 10 s | 6 s |
| 7 | Blue Goes First | 3 | 6×6, 2 | – | 3 | 0 | 0% | 6.5 s | 12 s | 8 s |
| 8 | Underpass | 3 | 5×6, 2 | – | 2 | 2 | 22% | 6.6 s | 12 s | 8 s |
| 9 | Chain Reaction | 3 | 6×6, 1 | – | 3 | 3 | 38% | 5.8 s | 11 s | 7 s |
| 10 | The Machine | 4 | 6×8, 3 | – | 3 | 3 | 62% | 4.4 s | 9 s | 6 s |
| 11 | Crossroads | 3 | 7×7, 1 | – | 4 | 0 | 2% | 7.3 s | 13 s | 9 s |
| 12 | Off the Plate | 2 | 8×3, 1 | shutter | 4 | 0 | 0% | 6.9 s | 13 s | 8 s |
| 13 | Bridge and Siding | 4 | 5×9, 2 | – | 4 | 2 | 33% | 6.3 s | 12 s | 8 s |
| 14 | Two Doors, One Key | 3 | 7×5, 1 | shutter | 4 | 0 | 1% | 8.4 s | 15 s | 10 s |
| 15 | Summit 🔥 | 3 | 7×5, 1 | – | 6 | 0 | 1% | 7.5 s | 14 s | 9 s |
| 16 | Ring Pair | 3 | 9×5, 1 | – | 4 | 0 | 8% | 8.6 s | 15 s | 10 s |
| 17 | Colour Check | 2 | 7×5, 1 | colour filter | 4 | 0 | 0% | 7.1 s | 13 s | 9 s |
| 18 | Backbone | 3 | 5×7, 1 | – | 4 | 1 | 13% | 4.5 s | 9 s | 6 s |
| 19 | Gatekeeper | 2 | 8×4, 1 | – | 4 | 1 | 8% | 6.4 s | 12 s | 8 s |
| 20 | H-Frame | 3 | 7×7, 1 | – | 6 | 0 | 0% | 12.5 s | 18 s | 14 s |
| 21 | Downhill Swap | 2 | 7×5, 2 | – | 3 | 4 | 79% | 5.1 s | 10 s | 7 s |
| 22 | Gate and Shutter 🔥 | 2 | 7×3, 1 | shutter | 7 | 0 | 11% | 8.5 s | 15 s | 10 s |
| 23 | Pendulum and Siding | 4 | 7×9, 1 | – | 5 | 1 | 25% | 8.8 s | 16 s | 10 s |
| 24 | Wormhole | 3 | 7×4, 1 | portals | 5 | 0 | 0% | 13.0 s | 18 s | 14 s |
| 25 | Top and Bottom | 3 | 9×5, 1 | shutter | 4 | 0 | 0% | 8.7 s | 16 s | 10 s |
| 26 | Crossing Guard | 3 | 6×7, 1 | – | 5 | 0 | 1% | 7.9 s | 14 s | 9 s |
| 27 | Shunting Yard | 3 | 9×5, 1 | – | 5 | 0 | 0% | 10.0 s | 18 s | 12 s |
| 28 | Twin Loops | 3 | 9×5, 1 | – | 6 | 1 | 8% | 9.3 s | 16 s | 11 s |
| 29 | Comb Over 🔥 | 3 | 9×3, 1 | colour filter, portals | 6 | 0 | 44% | 10.2 s | 18 s | 12 s |
| 30 | Lollipop | 3 | 9×7, 1 | – | 5 | 0 | 20% | 9.4 s | 17 s | 11 s |
| 31 | Traffic Circle | 3 | 7×7, 1 | – | 5 | 0 | 1% | 9.6 s | 17 s | 11 s |
| 32 | Ring Road | 3 | 9×5, 1 | shutter | 5 | 0 | 0% | 11.4 s | 18 s | 13 s |
| 33 | First Floor | 3 | 12×3, 2 | stairway | 4 | 1 | 72% | 5.1 s | 10 s | 7 s |
| 34 | Ladder | 3 | 5×7, 1 | – | 6 | 2 | 31% | 9.3 s | 16 s | 11 s |
| 35 | Shortcut | 3 | 9×5, 1 | colour filter, portals | 6 | 0 | 11% | 9.8 s | 17 s | 11 s |
| 36 | Orange Pass 🔥 | 3 | 9×5, 2 | colour filter, stairway | 6 | 2 | 66% | 10.1 s | 18 s | 12 s |
| 37 | Drawbridge | 3 | 6×3, 1 | – | 6 | 0 | 2% | 7.6 s | 14 s | 9 s |
| 38 | Shut, Then Open | 2 | 6×3, 1 | shutter | 6 | 0 | 9% | 7.8 s | 14 s | 9 s |
| 39 | Trident | 3 | 5×7, 1 | – | 6 | 0 | 0% | 7.3 s | 13 s | 9 s |
| 40 | Whirlpool | 3 | 7×6, 2 | whirl | 8 | 0 | 30% | 11.0 s | 18 s | 13 s |
| 41 | Silver Key | 2 | 9×7, 1 | – | 6 | 1 | 17% | 11.0 s | 18 s | 12 s |
| 42 | Two Rings | 3 | 9×5, 1 | – | 6 | 1 | 8% | 8.3 s | 15 s | 10 s |
| 43 | Back of the Queue 🔥 | 3 | 7×5, 1 | shutter | 8 | 0 | 2% | 10.5 s | 18 s | 12 s |
| 44 | Never Both | 3 | 9×5, 1 | shutter | 6 | 0 | 0% | 10.2 s | 18 s | 12 s |
| 45 | Crossbars | 3 | 7×7, 1 | – | 8 | 0 | 0% | 14.0 s | 18 s | 15 s |
| 46 | Waterfall | 3 | 5×8, 3 | – | 7 | 0 | 53% | 10.7 s | 18 s | 12 s |
| 47 | Sky Bridges | 3 | 10×3, 1 | sky rail | 7 | 0 | 1% | 9.7 s | 17 s | 11 s |
| 48 | Loophole | 3 | 9×5, 1 | colour filter, portals | 6 | 0 | 11% | 9.8 s | 17 s | 11 s |
| 49 | Merry-Go-Round | 3 | 7×7, 1 | – | 7 | 0 | 1% | 9.5 s | 17 s | 11 s |
| 50 | Green Lift 🔥 | 3 | 12×3, 2 | colour filter, stairway | 7 | 2 | 55% | 8.2 s | 15 s | 10 s |
| 51 | Tuning Fork | 3 | 5×7, 1 | – | 7 | 1 | 37% | 10.3 s | 18 s | 12 s |
| 52 | Candy Loop | 3 | 9×7, 1 | – | 6 | 0 | 26% | 10.6 s | 18 s | 12 s |
| 53 | Orange Door | 3 | 9×5, 1 | colour filter, portals | 7 | 0 | 1% | 10.5 s | 18 s | 12 s |
| 54 | Drop Zone | 3 | 8×3, 2 | sky rail, drop | 7 | 1 | 80% | 8.5 s | 15 s | 10 s |
| 55 | Either Side | 3 | 7×5, 1 | shutter | 7 | 0 | 2% | 9.2 s | 16 s | 11 s |
| 56 | Warp Comb | 3 | 9×3, 1 | portals | 6 | 0 | 11% | 12.8 s | 18 s | 14 s |
| 57 | Crosscurrent 🔥 | 3 | 7×6, 2 | whirl | 6 | 5 | 85% | 9.5 s | 17 s | 11 s |
| 58 | Push and Pull | 2 | 7×3, 1 | shutter | 7 | 1 | 11% | 9.5 s | 17 s | 11 s |
| 59 | Tower | 3 | 7×8, 3 | – | 5 | 1 | 77% | 6.6 s | 12 s | 8 s |
| 60 | Falls | 3 | 5×8, 3 | – | 7 | 0 | 72% | 11.9 s | 18 s | 13 s |
| 61 | Changing of the Guard | 3 | 7×7, 1 | – | 7 | 0 | 1% | 10.9 s | 18 s | 12 s |
| 62 | Three Turnstiles | 3 | 9×5, 1 | – | 6 | 0 | 73% | 11.8 s | 18 s | 13 s |
| 63 | Pitchfork | 3 | 5×7, 1 | – | 6 | 1 | 37% | 11.0 s | 18 s | 12 s |
| 64 | Orange Escort 🔥 | 3 | 9×5, 2 | colour filter, stairway | 8 | 4 | 67% | 9.7 s | 17 s | 11 s |
| 65 | Climbing Frame | 3 | 5×7, 1 | – | 7 | 0 | 1% | 10.4 s | 18 s | 12 s |
| 66 | Green Door | 3 | 9×5, 1 | colour filter, portals | 7 | 0 | 1% | 10.1 s | 18 s | 12 s |
| 67 | Midfield | 3 | 7×5, 1 | shutter | 8 | 0 | 1% | 10.1 s | 18 s | 12 s |
| 68 | Steps | 3 | 7×5, 1 | – | 7 | 0 | 1% | 10.0 s | 17 s | 11 s |
| 69 | Lock Below | 3 | 7×6, 2 | – | 6 | 2 | 47% | 11.6 s | 18 s | 13 s |
| 70 | Orange Crossing | 3 | 10×3, 1 | colour filter, sky rail | 8 | 0 | 7% | 11.0 s | 18 s | 12 s |
| 71 | Freefall 🔥 | 3 | 8×3, 2 | colour filter, sky rail, drop | 8 | 6 | 79% | 8.2 s | 15 s | 10 s |
| 72 | Night Shift | 3 | 9×3, 1 | – | 7 | 2 | 31% | 10.5 s | 18 s | 12 s |
| 73 | Last One In | 3 | 9×3, 1 | shutter | 6 | 3 | 51% | 10.3 s | 18 s | 12 s |
| 74 | Gauntlet | 3 | 9×5, 1 | – | 7 | 0 | 10% | 10.5 s | 18 s | 12 s |
| 75 | Round Trip | 3 | 9×5, 2 | stairway, whirl | 6 | 2 | 36% | 9.9 s | 17 s | 11 s |
| 76 | Narrow Pass | 2 | 8×3, 1 | – | 8 | 2 | 17% | 10.6 s | 18 s | 12 s |
| 77 | Tree | 3 | 9×7, 1 | – | 7 | 0 | 41% | 10.2 s | 18 s | 12 s |
| 78 | Escalator 🔥 | 3 | 9×5, 2 | stairway | 9 | 2 | 80% | 12.8 s | 18 s | 14 s |
| 79 | Hold the Line | 2 | 7×3, 1 | shutter | 8 | 0 | 8% | 11.1 s | 18 s | 13 s |
| 80 | Rope Ladder | 3 | 5×7, 1 | – | 8 | 0 | 11% | 12.7 s | 18 s | 14 s |
| 81 | Zigzag Up | 3 | 7×5, 1 | – | 8 | 0 | 10% | 10.2 s | 18 s | 12 s |
| 82 | Orange Gap | 3 | 10×3, 1 | colour filter, sky rail | 8 | 0 | 7% | 11.0 s | 18 s | 12 s |
| 83 | Ellipse | 3 | 9×5, 1 | – | 9 | 1 | 7% | 11.5 s | 18 s | 13 s |
| 84 | Upper Deck | 3 | 9×6, 2 | – | 5 | 6 | 97% | 9.9 s | 17 s | 11 s |
| 85 | Comb 🔥 | 3 | 9×3, 1 | – | 11 | 0 | 21% | 13.6 s | 18 s | 15 s |
| 86 | Landing | 3 | 12×3, 2 | stairway | 7 | 2 | 76% | 8.5 s | 15 s | 10 s |
| 87 | Grand Machine | 5 | 7×9, 2 | – | 7 | 2 | 58% | 14.0 s | 18 s | 15 s |
| 88 | Halfway House | 3 | 7×5, 1 | shutter | 8 | 1 | 2% | 9.4 s | 17 s | 11 s |
| 89 | Deep Lock | 3 | 7×6, 2 | – | 7 | 3 | 67% | 11.0 s | 18 s | 12 s |
| 90 | Goods Yard | 3 | 8×5, 1 | – | 8 | 1 | 7% | 10.6 s | 18 s | 12 s |
| 91 | Own Goal | 2 | 6×3, 1 | shutter | 8 | 1 | 47% | 10.0 s | 18 s | 12 s |
| 92 | Bristles 🔥 | 3 | 9×3, 1 | – | 11 | 0 | 35% | 11.7 s | 18 s | 13 s |
| 93 | Mezzanine | 3 | 9×6, 2 | – | 7 | 3 | 71% | 10.7 s | 18 s | 12 s |
| 94 | Locked In | 3 | 9×5, 1 | – | 9 | 1 | 8% | 9.9 s | 17 s | 11 s |
| 95 | Spine | 3 | 9×7, 1 | – | 8 | 0 | 35% | 11.2 s | 18 s | 13 s |
| 96 | Gated Ring | 3 | 8×5, 1 | – | 8 | 1 | 6% | 13.7 s | 18 s | 15 s |
| 97 | High Swap | 3 | 9×5, 2 | – | 6 | 5 | 98% | 5.9 s | 11 s | 7 s |
| 98 | Bench Swap | 2 | 8×3, 1 | – | 10 | 0 | 9% | 12.8 s | 18 s | 14 s |
| 99 | Blue Drop | 3 | 8×3, 2 | colour filter, sky rail, drop | 8 | 2 | 86% | 7.9 s | 14 s | 9 s |
| 100 | Vortex 🔥 | 3 | 7×6, 2 | whirl | 10 | 5 | 92% | 10.9 s | 18 s | 12 s |

Directions below are grid directions. With the default camera, north is up the screen and east is to the right.

---

## First machines (1–10)

One new idea per level: tilting, junctions, counterweight plates, one-way ramps, tunnels and banded goals.

### 1. First Tilt
- **Machine:** an L of blocks carrying one groove. It runs east along the front, curves, and runs a short way north to the goal.
- **Interaction:** drag right and the blue marble rolls east and around the corner. Drag up to finish.
- **Solution:** east, then north. A north-east diagonal does it in one move.
- **Learns:** dragging tilts, marbles roll the way you drag, letting go stops them, and corners follow the groove.

### 2. Two Grooves
- **Machine:** two arms of blocks at right angles, each with its own groove. Blue runs east–west along the front; orange runs north–south on the left.
- **Interaction:** tilt east and only blue moves. Tilt south and only orange moves.
- **Solution:** east, then south. For gold, one south-east diagonal moves both.
- **Learns:** a marble only rolls along its own groove, and diagonals move both axes.
- **Harder because:** two marbles, and the fast solution needs the diagonal.

### 3. Fork in the Road
- **Machine:** a long north–south stem ending in a T. Orange's goal is on the west arm, blue's on the east arm. Orange starts in front.
- **Interaction:** at the T, a marble turns towards the downhill arm. Both marbles share the stem, so whoever is in front must go first.
- **Solution:** up-left (north-west) until orange is home, then up-right (north-east) for blue.
- **Learns:** steering at junctions and traffic order.
- **Harder because:** you must switch direction at the right moment. Too early or too late sends a marble into the wrong goal, where it bounces.

### 4. Downhill Only
- **Machine:** the first two-tier machine. A raised row with a curve at each end drops down a ramp to a goal on each front corner. Orange is parked in a side spur.
- **Interaction:** ramps are one-way. Tilting west first sends blue down the wrong ramp for good.
- **Solution:**
  1. East: blue runs along the top and down the east ramp home.
  2. North-west: orange leaves the spur and turns west.
  3. West, then south-west, to steer orange around the corner and down the ramp.
- **Trap:** tilting west first.
- **Learns:** irreversible moves, parking spurs, and steering a marble around a corner.

### 5. Counterweight
- **Machine:** blue's east–west groove ends on a brass plate. Orange's north–south groove runs through the brass gate.
- **Interaction:** blue on the plate holds the gate open. Tilting south moves orange but not blue, because blue's groove runs across that move.
- **Solution:** east (blue onto the plate), south (orange through the gate), west (blue home).
- **Learns:** plates and gates. The signature mechanic appears for the first time.
- **Harder because:** the first level where order matters.

### 6. Hold the Door
- **Machine:** one east–west line. Orange's goal is at the west end behind a gate, blue's at the east end. A T in the middle has a short spur north to the plate.
- **Interaction:** blue is the counterweight. A north-west tilt turns blue into the spur and onto the plate, and the same tilt rolls orange west through the opening gate.
- **Solution:**
  1. North-west: blue onto the plate, and orange through the gate home.
  2. South-east: blue comes out of the spur and goes home.
- **Trap:** tilting east first sends blue home, and nothing is left to hold the gate.
- **Learns:** parking the counterweight with a diagonal, and one tilt doing two jobs.

### 7. Blue Goes First
- **Machine:**
  - A raised track for blue drops down a ramp into a goal with a brass band.
  - Filling that goal opens the gate on the lower row, where green waits.
  - Orange sits in a parking spur off a T.
- **Interaction:** delivery order without a separate rule. Green can only get home after blue.
- **Solution:**
  1. East: blue goes home, the gate opens, and green follows through to its goal. Orange's spur ignores east.
  2. North-west: orange comes out, turns west and goes through the gate home.
- **Trap:** bringing orange out first blocks the row against the shut gate.
- **Learns:** goals can unlock gates.

### 8. Underpass
- **Machine:**
  - A raised row (a bridge) with the plate at its east end and a curve plus ramp down to blue's goal at the west end.
  - Orange's lower groove runs under the bridge (a tunnel), through the gate, and across green's row at a crossing.
- **Interaction:** a hidden route, shown as a coloured outline through the wood, plus a one-way ramp.
- **Solution:**
  1. East: blue onto the plate.
  2. South: orange goes through the tunnel, gate and crossing home.
  3. West: blue goes round the corner and down the ramp, and green crosses home at the same time.
- **Trap:** tilting west first sends blue down the ramp, and nothing else can reach the plate.
- **Learns:** tunnels, crossings and reading two tiers at once.

### 9. Chain Reaction
- **Machine:**
  - Blue's row ends on plate A in the west.
  - Orange passes gate A to a goal with a graphite band, which opens gate B.
  - Green waits behind gate B.
- **Interaction:** a domino of three marbles from one tilt. It's the best candidate for a short gameplay clip.
- **Solution:** south-west (blue onto the plate, orange through and home, gate B opens, green home), then east (blue home).
- **Trap:** tilting east first delivers blue too early, so gate A can never open.
- **Learns:** chains, and delivering the counterweight last.

### 10. The Machine
- **Machine:**
  - A three-tier tower where blue drops down two ramps to gate A.
  - Purple's row runs from plate A in the west to purple's goal in the east. That goal has a graphite band that opens gate B.
  - Green's row has gate B in front of green's goal in the west, and orange's goal at the east end.
- **Interaction:** four marbles, two links and three tiers.
- **Solution:**
  1. South-west: purple onto plate A, and blue down the tower through gate A home. Orange and green bunch up at gate B.
  2. East: purple goes home, which opens gate B, and orange goes home.
  3. West: green through gate B home.
- **Trap:** tilting south-east first sends purple home before blue has come down, which locks blue out.
- **Learns:** combining everything.

## Shutters and filters (11–20)

Crossings that turn the way you tilt (Crossroads), the striped shutter (Off the Plate), and the colour filter (Colour Check), which only lets its own colour through. Summit (15) is the first hard level; from there, every seventh level is one.

### 11. Crossroads
- Orange and green have to swap places, and green needs the gate. Blue can lend a hand.
- 3 marbles · fewest moves 4 (3 shortest solutions) · reference: NE, S, SW, N (7.3 s) · gate A costs

### 12. Off the Plate
- Orange is standing on the shutter's plate. The shutter only opens once orange moves off it.
- 2 marbles · shutter · fewest moves 4 (2 shortest solutions) · reference: E, NW, SW, NE (6.9 s) · shutter A costs

### 13. Bridge and Siding
- Two little machines in one. Every tilt moves both.
- 4 marbles · 2 tiers · fewest moves 4 (16 shortest solutions) · reference: NE, N, SW, E (6.3 s) · gate A costs · losing openings: E, SE

### 14. Two Doors, One Key
- Blue is parked behind a gate and green's goal is behind a shutter. The same plate works both.
- 3 marbles · shutter · fewest moves 4 (2 shortest solutions) · reference: NE, W, SE, NW (8.4 s) · gate A costs, shutter A costs

### 15. Summit (hard)
- Blue's goal is at the very top, behind the only gate. The plate is halfway down.
- 3 marbles · fewest moves 6 (one shortest solution) · reference: W, N, SW, N, SW, SE (7.5 s) · gate A costs

### 16. Ring Pair
- Two rings again, with the gate in the middle of the bridge and its plate on top of the left ring.
- 3 marbles · fewest moves 4 (one shortest solution) · reference: NW, NE, SE, SW (8.6 s) · gate A costs

### 17. Colour Check
- A coloured filter stands in front of each goal. Only the matching colour gets through.
- 2 marbles · colour filter · fewest moves 4 (8 shortest solutions) · reference: NE, NW, E, SW (7.1 s)

### 18. Backbone
- Green can hold the gate from down below while the others climb the spine.
- 3 marbles · fewest moves 4 (2 shortest solutions) · reference: E, N, W, E (4.5 s) · gate A costs · losing openings: W

### 19. Gatekeeper
- The counterweight starts in the way. Get it onto its plate first.
- 2 marbles · fewest moves 4 (one shortest solution) · reference: SW, NE, W, SE (6.4 s) · gate A costs · losing openings: SE

### 20. H-Frame
- Two rungs across two rails. The plate opens the lower rung; blue's goal opens the upper one.
- 3 marbles · fewest moves 6 (36 shortest solutions) · reference: NW, S, N, SE, N, SE (12.5 s) · gate B costs, gate A costs

## Portals (21–30)

Wormhole brings portal pairs: a marble that rolls into one comes out of its twin. Rings, a portal comb (Comb Over) and a third lock colour (Lollipop) follow.

### 21. Downhill Swap
- Swap the marbles before either one goes down a ramp. There is no way back up.
- 2 marbles · 2 tiers · fewest moves 3 (2 shortest solutions) · reference: NE, W, SE (5.1 s) · losing openings: E, SE, SW, W

### 22. Gate and Shutter (hard)
- Two marbles on one groove with a shutter and a gate. The plate above works both.
- 2 marbles · shutter · fewest moves 7 (2 shortest solutions) · reference: E, SE, NW, S, E, NE, SW (8.5 s) · shutter A costs, gate A costs

### 23. Pendulum and Siding
- Swing the counterweight and swap the pair below. Every tilt does both.
- 4 marbles · fewest moves 5 (20 shortest solutions) · reference: NE, SE, NW, SW, E (8.8 s) · gate A costs, gate B costs · losing openings: SW

### 24. Wormhole
- Roll into one swirl and come out of the other. The two portals join the top groove to the bottom one.
- 3 marbles · portals · fewest moves 5 (5 shortest solutions) · reference: SE, W, NW, SE, NE (13.0 s)

### 25. Top and Bottom
- A loop with a gate on top and a shutter below, both worked by the one plate.
- 3 marbles · shutter · fewest moves 4 (one shortest solution) · reference: W, SE, NE, SW (8.7 s) · gate A reroutes, shutter A reroutes

### 26. Crossing Guard
- A marble stopped in the crossing turns the way you tilt. Orange's goal is straight down, past the gate.
- 3 marbles · fewest moves 5 (one shortest solution) · reference: W, NE, S, NW, SE (7.9 s) · gate A costs

### 27. Shunting Yard
- Two marbles share a siding. The one at the back can only leave after the one in front.
- 3 marbles · fewest moves 5 (2 shortest solutions) · reference: SE, NE, W, SE, SW (10.0 s)

### 28. Twin Loops
- Two rings, with the gate at the left end of the bridge and the plate on top of the left ring.
- 3 marbles · fewest moves 6 (26 shortest solutions) · reference: E, N, E, NE, SE, SW (9.3 s) · gate A costs · losing openings: SW

### 29. Comb Over (hard)
- Three goals on the teeth of a comb. A portal pair joins the left end of the bar to the right-hand tooth, and only green gets through the filter to the plate.
- 3 marbles · colour filter, portals · fewest moves 6 (one shortest solution) · reference: NW, N, E, NW, SW, NE (10.2 s) · gate A costs

### 30. Lollipop
- Three gates: a plate each for the bottom two, and green's goal opens the one at the top of the loop.
- 3 marbles · fewest moves 5 (2 shortest solutions) · reference: W, S, SE, NE, NW (9.4 s) · gate C costs, gate B costs, gate A costs

## Stairs and whirls (31–40)

First Floor brings the stairway, which carries a marble up a tier whatever the tilt, and Whirlpool the whirl, which drops it through its hole to the tier below. Shortcut puts portals on a loop.

### 31. Traffic Circle
- Orange's goal is behind a gate, and its plate is at the top of the ring. Orange is also in green's way.
- 3 marbles · fewest moves 5 (one shortest solution) · reference: SE, NE, NW, SW, SE (9.6 s) · gate A costs

### 32. Ring Road
- Orange starts on the plate, so both shutters on the ring are shut.
- 3 marbles · shutter · fewest moves 5 (one shortest solution) · reference: NW, NE, SE, SW, NW (11.4 s) · shutter A costs

### 33. First Floor
- A stairway carries a marble up a tier, whatever the tilt. One plate is up on the shelf, one down below.
- 3 marbles · 2 tiers · stairway · fewest moves 4 (2 shortest solutions) · reference: S, W, NE, SW (5.1 s) · gate B costs, gate A costs · losing openings: E

### 34. Ladder
- Each rung joins the two rails. A diagonal turns onto a rung; a straight tilt keeps to the rail.
- 3 marbles · fewest moves 6 (32 shortest solutions) · reference: N, SW, NE, SE, N, SW (9.3 s) · gate A costs · losing openings: NE, NW

### 35. Shortcut
- A loop whose two left-hand spurs are a portal pair. Only blue gets through the filter to the plate.
- 3 marbles · colour filter, portals · fewest moves 6 (5 shortest solutions) · reference: NE, E, W, S, NW, SE (9.8 s) · gate A costs

### 36. Orange Pass (hard)
- Only orange gets through the filter to the plate. Green's goal is up the stairs.
- 3 marbles · 2 tiers · colour filter, stairway · fewest moves 6 (2 shortest solutions) · reference: W, SE, W, S, NW, E (10.1 s) · gate A costs · losing openings: NE, E

### 37. Drawbridge
- One gate between two halves, a plate on each side. Cross one at a time.
- 3 marbles · fewest moves 6 (4 shortest solutions) · reference: NE, W, SW, NE, SW, NW (7.6 s) · gate A costs

### 38. Shut, Then Open
- Blue has to pass the shutter while the plate is empty, then the gate while it is pressed.
- 2 marbles · shutter · fewest moves 6 (2 shortest solutions) · reference: NE, S, E, N, SE, NW (7.8 s) · shutter A costs, gate A costs

### 39. Trident
- Three goals on three prongs. The right-hand gate is a shortcut, but only while someone holds the plate at the bottom.
- 3 marbles · fewest moves 6 (3 shortest solutions) · reference: W, N, W, S, E, NW (7.3 s) · gate A costs

### 40. Whirlpool
- The whirl drops a marble through its hole to the groove below. There is no way back up.
- 3 marbles · 2 tiers · whirl · fewest moves 8 (15 shortest solutions) · reference: E, NW, NE, S, E, N, W, SE (11.0 s) · gate A costs, gate B costs

## Sky rails (41–50)

Sky Bridges: rails over open gaps. Keep a marble rolling across; if it stops over the gap it falls, and the level is lost. From here on, levels take six to eight moves.

### 41. Silver Key
- Three locks, one counterweight. Walk it from plate to plate as blue moves along.
- 2 marbles · fewest moves 6 (8 shortest solutions) · reference: N, NE, SE, SW, E, NW (11.0 s) · gate A costs, gate C costs, gate B costs · losing openings: NW

### 42. Two Rings
- Two rings with a gate on the bridge between them, and its plate on top of the left ring.
- 3 marbles · fewest moves 6 (6 shortest solutions) · reference: N, NE, SW, SE, NE, NW (8.3 s) · gate A costs · losing openings: SW

### 43. Back of the Queue (hard)
- Blue's goal needs the plate pressed and orange's needs it empty. And blue starts stuck behind green.
- 3 marbles · shutter · fewest moves 8 (2 shortest solutions) · reference: SW, N, E, NW, S, W, N, SW (10.5 s) · gate A costs, shutter A costs

### 44. Never Both
- The bottom of the ring has a shutter and a gate worked by the same plate, so one of them is always shut.
- 3 marbles · shutter · fewest moves 6 (2 shortest solutions) · reference: N, E, SW, NW, NE, SE (10.2 s) · shutter A costs, gate A costs

### 45. Crossbars
- Two rails and two rungs. Orange's goal opens the upper rung, the plate the lower.
- 3 marbles · fewest moves 8 (83 shortest solutions) · reference: SE, SW, NW, SW, N, SE, N, SE (14.0 s) · gate B costs, gate A costs

### 46. Waterfall
- Blue is shut in on the top floor, and the plate for its gate is a floor below. Blue's goal opens the middle floor's gate.
- 3 marbles · 3 tiers · fewest moves 7 (31 shortest solutions) · reference: E, W, SE, NW, S, NE, SW (10.7 s) · gate B costs, gate A costs

### 47. Sky Bridges
- Two islands joined by sky rails: a marble that stops over a gap falls. The plate opens one gate, blue's goal the other.
- 3 marbles · sky rail · fewest moves 7 (8 shortest solutions) · reference: SW, N, E, SE, W, SE, SW (9.7 s) · gate A costs, gate B costs

### 48. Loophole
- The portal loop again, with the filter and the gate in other places.
- 3 marbles · colour filter, portals · fewest moves 6 (4 shortest solutions) · reference: NE, E, W, S, NW, SE (9.8 s) · gate A costs

### 49. Merry-Go-Round
- Orange is standing on the plate for its own gate. Someone has to take over.
- 3 marbles · fewest moves 7 (7 shortest solutions) · reference: N, NE, NW, S, W, SE, NW (9.5 s) · gate A costs

### 50. Green Lift (hard)
- Only green gets through the filter to the stairway; green's own goal is behind the gate down below.
- 3 marbles · 2 tiers · colour filter, stairway · fewest moves 7 (2 shortest solutions) · reference: SE, NE, SW, N, W, S, SE (8.2 s) · gate A costs · losing openings: NE, E

## Dropping down (51–60)

Drop Zone: a sky rail that ends over a groove. Stop there on purpose and the marble drops onto it, a way down to the lower tier. Orange Door and Warp Comb bring the portals back.

### 51. Tuning Fork
- The gate under orange's goal opens from the plate on the middle prong.
- 3 marbles · fewest moves 7 (24 shortest solutions) · reference: SE, NE, S, SE, NW, SE, SW (10.3 s) · gate A costs · losing openings: NE

### 52. Candy Loop
- The lollipop again, with green's gate on the other side of the top.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: W, S, SE, NE, NW, NW (10.6 s) · gate C reroutes, gate B costs, gate A costs

### 53. Orange Door
- A yard with a portal pair: one behind an orange filter at the top left, the other at the right end of the bar.
- 3 marbles · colour filter, portals · fewest moves 7 (6 shortest solutions) · reference: S, W, SE, NW, SW, E, NW (10.5 s) · gate A costs

### 54. Drop Zone
- This sky rail ends over a groove: a marble that stops there drops onto it.
- 3 marbles · 2 tiers · sky rail, drop · fewest moves 7 (24 shortest solutions) · reference: NE, N, SE, SW, NE, SE, SW (8.5 s) · gate B costs, gate A costs · losing openings: NW

### 55. Either Side
- One plate in the middle: pressed, it opens blue's gate and shuts green's shutter.
- 3 marbles · shutter · fewest moves 7 (2 shortest solutions) · reference: S, E, NW, S, W, NW, SE (9.2 s) · gate A costs, shutter A costs

### 56. Warp Comb
- A comb with a portal pair joining the left end of the bar to the right-hand tooth. The plate opens one gate, green's goal the other.
- 3 marbles · portals · fewest moves 6 (2 shortest solutions) · reference: SE, NW, SW, NE, SE, NW (12.8 s) · gate B costs, gate A costs

### 57. Crosscurrent (hard)
- The whirl drops marbles to the crossing below. Each plate opens the gate on the other tier.
- 3 marbles · 2 tiers · whirl · fewest moves 6 (one shortest solution) · reference: SW, NE, S, W, NW, SE (9.5 s) · gate A costs, gate B costs · losing openings: NE, E, SE, W, NW

### 58. Push and Pull
- Blue's goal needs the plate pressed, but the shutter on the way needs it empty.
- 2 marbles · shutter · fewest moves 7 (8 shortest solutions) · reference: SW, E, NW, S, E, N, SW (9.5 s) · gate A costs, shutter A costs · losing openings: W

### 59. Tower
- Three floors. Orange's goal at the top opens the ground floor's gate; the plate down there opens the middle one.
- 3 marbles · 3 tiers · fewest moves 5 (one shortest solution) · reference: NE, N, SW, E, SW (6.6 s) · gate B costs, gate A costs · losing openings: E

### 60. Falls
- Three tiers of ramps, like Cascade, with the bottom gate on the other side.
- 3 marbles · 3 tiers · fewest moves 7 (24 shortest solutions) · reference: SE, NW, SW, SE, NE, W, SE (11.9 s) · gate B costs, gate A costs

## Mixing the pieces (61–70)

Filters in front of stairways, portals and sky rails: the new pieces start working together.

### 61. Changing of the Guard
- Orange starts on the plate for its own gate. Someone has to take its place.
- 3 marbles · fewest moves 7 (5 shortest solutions) · reference: E, N, E, S, SW, N, SE (10.9 s) · gate A costs

### 62. Three Turnstiles
- Three plates and three gates along one long groove.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: N, SE, NE, W, NE, SE (11.8 s) · gate C costs, gate B reroutes, gate A costs

### 63. Pitchfork
- Orange's goal is behind a gate, and orange starts on that gate's plate. Green is right behind it.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: SW, N, E, NE, SW, NW (11.0 s) · gate A costs · losing openings: NE

### 64. Orange Escort (hard)
- Only orange gets through the filter to the plate, and only the plate opens the gate by the crossing.
- 3 marbles · 2 tiers · colour filter, stairway · fewest moves 8 (4 shortest solutions) · reference: W, SE, W, S, W, N, E, SE (9.7 s) · gate A costs · losing openings: NE, E, SE, SW

### 65. Climbing Frame
- Green's goal opens the gate on the right-hand rail. The top rung's gate needs someone on the plate.
- 3 marbles · fewest moves 7 (3 shortest solutions) · reference: E, NW, SE, W, N, NE, S (10.4 s) · gate A costs, gate B costs

### 66. Green Door
- The portal yard again, with a green filter in place of the orange one.
- 3 marbles · colour filter, portals · fewest moves 7 (5 shortest solutions) · reference: E, S, W, N, SW, E, NW (10.1 s) · gate A costs

### 67. Midfield
- The plate opens the gate to green's goal and shuts the shutter to the dead end.
- 3 marbles · shutter · fewest moves 8 (8 shortest solutions) · reference: N, SE, SW, NE, S, W, N, SW (10.1 s) · gate A costs, shutter A costs

### 68. Steps
- The zigzag again; now green's goal is the one at the top behind the gate.
- 3 marbles · fewest moves 7 (one shortest solution) · reference: NW, S, SE, N, SW, N, SW (10.0 s) · gate A costs

### 69. Lock Below
- Blue starts on the plate upstairs, but its goal is past the gate downstairs. Hand the plate to purple.
- 3 marbles · 2 tiers · fewest moves 6 (one shortest solution) · reference: NE, S, E, SW, NW, SE (11.6 s) · gate A costs · losing openings: E, SE

### 70. Orange Crossing
- Sky rails between two islands, and an orange filter in front of one of them.
- 3 marbles · colour filter, sky rail · fewest moves 8 (6 shortest solutions) · reference: N, NE, SW, NE, S, W, NW, E (11.0 s) · gate A costs

## Long shuffles (71–80)

Six to nine moves. Freefall drops marbles past a filter, and Round Trip sends one up the stairs and back down through a whirl.

### 71. Freefall (hard)
- The filtered drop deck again, with the marbles starting in other places.
- 3 marbles · 2 tiers · colour filter, sky rail, drop · fewest moves 8 (4 shortest solutions) · reference: N, NW, SE, N, E, SW, NW, E (8.2 s) · gate A costs · losing openings: NE, E, SE, SW, W, NW

### 72. Night Shift
- Purple is right under the plate, but its goal is past the gate. Find someone to take its place.
- 3 marbles · fewest moves 7 (5 shortest solutions) · reference: E, SW, NE, S, E, NE, SW (10.5 s) · gate A costs · losing openings: NE, W

### 73. Last One In
- When green reaches its goal, the striped shutter in front of blue's goal shuts.
- 3 marbles · shutter · fewest moves 6 (one shortest solution) · reference: SW, NE, S, E, NW, SE (10.3 s) · gate A costs, shutter B costs · losing openings: E, SE, NW

### 74. Gauntlet
- Blue starts locked in, and its goal is behind another gate. Three gates, three plates.
- 3 marbles · fewest moves 7 (one shortest solution) · reference: NW, SW, NE, SE, NE, W, NE (10.5 s) · gate C costs, gate B costs, gate A reroutes

### 75. Round Trip
- Up the stairs, along the top, and down through the whirl. One plate on each tier.
- 3 marbles · 2 tiers · stairway, whirl · fewest moves 6 (2 shortest solutions) · reference: N, NW, S, E, W, SE (9.9 s) · gate A costs, gate B costs · losing openings: E, SE

### 76. Narrow Pass
- Two marbles in one groove, with a gate at orange's end and the plate on a side branch.
- 2 marbles · fewest moves 8 (9 shortest solutions) · reference: N, SW, E, NW, S, W, NW, SE (10.6 s) · gate A costs · losing openings: E, SE

### 77. Tree
- Green starts on the plate for the gate in the trunk. Orange's goal is behind a gate whose plate is up the tree.
- 3 marbles · fewest moves 7 (one shortest solution) · reference: NE, W, N, E, NW, SE, NW (10.2 s) · gate A costs, gate C costs, gate B costs

### 78. Escalator (hard)
- Up the stairs and round. The gates on either side of the crossing open from the plate and from orange's goal.
- 3 marbles · 2 tiers · stairway · fewest moves 9 (8 shortest solutions) · reference: SE, W, N, W, SW, NE, NW, SE, SW (12.8 s) · gate A costs, gate B costs · losing openings: NE, E

### 79. Hold the Line
- Two marbles. One plate opens the gate and shuts the shutter, both on the bottom groove.
- 2 marbles · shutter · fewest moves 8 (2 shortest solutions) · reference: E, SE, NW, S, E, NE, SW, NE (11.1 s) · shutter A costs, gate A costs

### 80. Rope Ladder
- Two rails, three rungs. The plate opens the top and bottom rungs; orange's goal opens the left rail.
- 3 marbles · fewest moves 8 (3 shortest solutions) · reference: NE, SE, NW, E, S, SW, N, N (12.7 s) · gate A costs, gate B costs

## Hard going (81–90)

Decks, yards, combs and the five-marble Grand Machine, at up to eleven moves.

### 81. Zigzag Up
- Green's goal is at the top, past the gate, and the plate is further down the zigzag.
- 3 marbles · fewest moves 8 (2 shortest solutions) · reference: SE, N, SW, N, S, SW, NW, SE (10.2 s) · gate A costs

### 82. Orange Gap
- Sky rails between two islands. The orange filter stands in front of the top one; the gate guards the left end.
- 3 marbles · colour filter, sky rail · fewest moves 8 (6 shortest solutions) · reference: N, NE, SW, NE, S, W, NW, E (11.0 s) · gate A costs

### 83. Ellipse
- A long loop with a plate at one end and another at the bottom. Each opens one gate.
- 3 marbles · fewest moves 9 (24 shortest solutions) · reference: N, W, N, E, N, SE, SW, NW, NE (11.5 s) · gate B costs, gate A costs · losing openings: NE

### 84. Upper Deck
- Three marbles on the upper deck, with ramps down at both ends. Blue's goal is up top; the others are below, by the plate.
- 3 marbles · 2 tiers · fewest moves 5 (one shortest solution) · reference: NW, S, E, W, SE (9.9 s) · gate A costs · losing openings: NE, E, SE, S, SW, W

### 85. Comb (hard)
- Four teeth, two gates, and orange's goal opens one of them. Plan the whole shuffle first.
- 3 marbles · fewest moves 11 (6 shortest solutions) · reference: SE, SW, NE, S, E, NE, W, SE, NW, SW, NE (13.6 s) · gate B costs, gate A costs

### 86. Landing
- Two gates down below, one at the foot of the stairway. One plate is down below, one up on the shelf.
- 3 marbles · 2 tiers · stairway · fewest moves 7 (5 shortest solutions) · reference: N, W, SE, N, E, SW, NW (8.5 s) · gate A costs, gate B costs · losing openings: SE, W

### 87. Grand Machine
- Five marbles, two floors, one lock. Everything you have learned.
- 5 marbles · 2 tiers · fewest moves 7 (5 shortest solutions) · reference: NE, W, S, E, SW, NW, SE (14.0 s) · gate A costs · losing openings: E, SE

### 88. Halfway House
- One plate opens green's gate and shuts blue's shutter. Orange's goal is in the middle.
- 3 marbles · shutter · fewest moves 8 (2 shortest solutions) · reference: S, E, SW, NE, S, W, N, SW (9.4 s) · gate A costs, shutter A costs · losing openings: SE

### 89. Deep Lock
- Nobody is on the plate yet. Choose who holds it, and who goes down first.
- 3 marbles · 2 tiers · fewest moves 7 (3 shortest solutions) · reference: SW, NE, S, E, S, W, SE (11.0 s) · gate A costs · losing openings: E, SE, NW

### 90. Goods Yard
- Two gates in the yard. The plate opens one; green's goal opens the other.
- 3 marbles · fewest moves 8 (2 shortest solutions) · reference: S, E, SW, NW, S, W, NE, SW (10.6 s) · gate A costs, gate B costs · losing openings: SW

## Grand finale (91–100)

The hardest machines that still fit the 20-second clock, ending with Vortex: ten moves through a whirl and a crossing.

### 91. Own Goal
- Orange starts on the plate, but orange's own goal is behind the gate that plate opens.
- 2 marbles · shutter · fewest moves 8 (2 shortest solutions) · reference: E, S, SW, NE, S, E, NW, SE (10.0 s) · gate A costs, shutter A costs · losing openings: SE

### 92. Bristles (hard)
- Four teeth on one bar. The plate opens the gate under blue's goal; orange's goal opens the one on the bar.
- 3 marbles · fewest moves 11 (8 shortest solutions) · reference: SE, NW, SW, E, NW, S, W, S, E, N, NW (11.7 s) · gate A costs, gate B costs

### 93. Mezzanine
- The plate is on the top deck and its gate is on the bottom one.
- 3 marbles · 2 tiers · fewest moves 7 (2 shortest solutions) · reference: NE, NW, S, E, SW, NW, SE (10.7 s) · gate A costs · losing openings: SE, SW, W

### 94. Locked In
- Orange is locked in at the bottom, behind a gate that only green's goal can open.
- 3 marbles · fewest moves 9 (8 shortest solutions) · reference: S, E, SW, NW, S, W, N, E, SW (9.9 s) · gate A costs, gate B costs · losing openings: SW

### 95. Spine
- A spine with three branches: three plates, three gates.
- 3 marbles · fewest moves 8 (one shortest solution) · reference: E, S, W, N, E, SW, SE, SW (11.2 s) · gate A costs, gate B costs, gate C costs

### 96. Gated Ring
- Each gate's plate sits just outside the ring. Orange has to get through the bottom gate to reach its goal.
- 3 marbles · fewest moves 8 (one shortest solution) · reference: N, SE, SW, N, W, SW, NE, NW (13.7 s) · gate B costs, gate A costs · losing openings: NE

### 97. High Swap
- Blue and orange have to swap ends before they go down. Nothing comes back up a ramp.
- 3 marbles · 2 tiers · fewest moves 6 (one shortest solution) · reference: NW, S, W, S, E, SE (5.9 s) · losing openings: NE, E, SE, SW, W

### 98. Bench Swap
- Two marbles, two side grooves and one gate. Shuffle them past each other.
- 2 marbles · fewest moves 10 (12 shortest solutions) · reference: NE, NW, SW, E, NW, S, W, N, SW, NE (12.8 s) · gate A costs

### 99. Blue Drop
- Only blue gets past the filter. The sky rail drops marbles onto the lower deck.
- 3 marbles · 2 tiers · colour filter, sky rail, drop · fewest moves 8 (8 shortest solutions) · reference: N, W, SE, N, E, SW, NW, E (7.9 s) · gate A costs · losing openings: NE, SE

### 100. Vortex (hard)
- The whirl machine at full stretch: three marbles, and each plate opens the gate on the other tier.
- 3 marbles · 2 tiers · whirl · fewest moves 10 (4 shortest solutions) · reference: S, SW, NE, S, E, N, W, S, SW, NE (10.9 s) · gate A costs, gate B costs · losing openings: NE, E, SE, W, NW

## Notes for the next pass
- Twenty seconds is tight on purpose. The playtest log (Settings → Playtest tools) shows restarts and time-ups per level; a level that times out far more often than its neighbours is a candidate for an easier slot.
- Sky rails punish stopping. Check that testers understand why a marble fell (the "Oops!" screen) and don't read it as a bug.
- The solve times here are for direction assist on. Re-run `npm test` after any physics change, and `npm run solve` / `npm run audit` to see if move counts or lock purposes changed.
