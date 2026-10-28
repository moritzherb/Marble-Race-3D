# The hundred levels

Every level is a different machine built from the same block kit, using only the blocks the track needs. Levels unlock in order: finishing one opens the next. The data lives in `prototype/src/levels.js`: levels 1–10 list their pieces, and levels 11–100 are drawn as text maps (see `prototype/src/grid.js` for the characters). Each level ships with a scripted reference solution and, where it has them, "traps": wrong opening moves that make it unwinnable. `npm test` plays every solution and every trap headlessly.

## How the levels were made and checked

Levels 11–100 started as hand-drawn machines. For most of the new ones, `tools/generate.mjs` searched the drawn machine for the hardest fair placement of goals, plates, gates and marbles; the rest are hand-made. Every level then went through `tools/finalize.mjs` and `tools/audit.mjs`, and only ships if:

- **Every lock has a purpose.** The audit jams each gate (or shutter) open and solves again. "Costs" means the level gets shorter with that lock open; "reroutes" means the shortest solutions with it open all fail in the real level, so the lock forces a different plan. A gate that changes nothing is cut.
- **Nothing is decoration.** Every gate, plate and goal is used by the reference solution or a designed trap. Dead ends that don't change the puzzle were removed; the few stubs left hold the machine together or give a marble somewhere to go wrong.
- **People can repeat it.** The reference solution still wins with every hold and pause made longer and less precise (six randomised replays).
- **Tunnels show.** Wood may only sit on a straight groove, which then gets a visible tunnel opening.

## Difficulty

Levels are ordered by a difficulty score:

- the **fewest moves** (a move means tilting one of the 8 directions until everything stops; from `npm run solve`);
- plus 0.3 for each **losing opening**;
- plus the share of **dead positions** (positions reachable from the start that can no longer be won);
- minus a little for each extra **shortest solution**;
- plus 0.3 for each marble beyond two.

New mechanics get a level of their own first:

- shutters at 14 (Level Crossing);
- the third link at 34 (Silver Key);
- the fifth marble at 64 (Grand Machine);
- two linked machines at 82 (Twin Machines).

Timers come from the reference solution, so they stay fair when the physics is retuned:

- **time limit** = max(20 s, solution × time factor + 10 s), between 20 and 60 s; the time factor tightens from 3.0 at level 11 to about 1.9 at level 100
- **2 stars (par)** = solution × 1.5 + 2 s
- **3 stars (gold)** = solution + 1 s

| # | Level | Marbles | Size (w×d, tiers) | Fewest moves | Losing openings | Dead positions | Reference | Limit | Par | Gold |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Tilt | 1 | 5×3, 1 | 1 | 0 | 0% | 2.1 s | 20 s | 6 s | 4 s |
| 2 | Two Grooves | 2 | 5×5, 1 | 1 | 0 | 0% | 2.2 s | 20 s | 6 s | 4 s |
| 3 | Fork in the Road | 2 | 5×5, 1 | 2 | 0 | 0% | 2.9 s | 20 s | 7 s | 4 s |
| 4 | Downhill Only | 2 | 6×4, 2 | 3 | 2 | 74% | 5.4 s | 27 s | 11 s | 7 s |
| 5 | Counterweight | 2 | 5×5, 1 | 2 | 3 | 40% | 4.1 s | 23 s | 9 s | 6 s |
| 6 | Hold the Door | 2 | 6×3, 1 | 2 | 3 | 14% | 5.0 s | 25 s | 10 s | 6 s |
| 7 | Blue Goes First | 3 | 6×6, 2 | 3 | 0 | 0% | 6.5 s | 27 s | 12 s | 8 s |
| 8 | Underpass | 3 | 5×6, 2 | 2 | 2 | 22% | 6.7 s | 27 s | 12 s | 8 s |
| 9 | Chain Reaction | 3 | 6×6, 1 | 3 | 3 | 38% | 5.8 s | 25 s | 11 s | 7 s |
| 10 | The Machine | 4 | 6×8, 3 | 3 | 3 | 62% | 4.6 s | 22 s | 9 s | 6 s |
| 11 | Over and Under | 2 | 5×6, 2 | 2 | 2 | 29% | 4.0 s | 23 s | 9 s | 6 s |
| 12 | Passing Place | 2 | 7×2, 1 | 3 | 0 | 0% | 4.6 s | 24 s | 9 s | 6 s |
| 13 | Shift Change | 2 | 7×6, 1 | 3 | 1 | 8% | 4.7 s | 25 s | 10 s | 6 s |
| 14 | Level Crossing | 3 | 8×5, 1 | 2 | 3 | 36% | 3.6 s | 21 s | 8 s | 5 s |
| 15 | Step Aside | 2 | 8×3, 1 | 4 | 0 | 0% | 9.2 s | 38 s | 16 s | 11 s |
| 16 | Sidings | 3 | 7×3, 1 | 3 | 0 | 0% | 5.9 s | 28 s | 11 s | 7 s |
| 17 | Handover | 2 | 5×8, 1 | 3 | 1 | 7% | 7.7 s | 33 s | 14 s | 9 s |
| 18 | Pendulum | 2 | 7×6, 1 | 3 | 1 | 17% | 6.5 s | 29 s | 12 s | 8 s |
| 19 | One Key, Two Locks | 2 | 7×3, 1 | 4 | 0 | 18% | 7.0 s | 31 s | 13 s | 8 s |
| 20 | Backbone | 3 | 5×7, 1 | 4 | 2 | 7% | 6.9 s | 30 s | 13 s | 8 s |
| 21 | Off the Plate | 2 | 8×3, 1 | 4 | 0 | 0% | 6.9 s | 31 s | 13 s | 8 s |
| 22 | Two Doors, One Key | 3 | 7×5, 1 | 4 | 0 | 1% | 8.4 s | 35 s | 15 s | 10 s |
| 23 | Bridge and Siding | 4 | 5×9, 2 | 4 | 2 | 33% | 6.4 s | 29 s | 12 s | 8 s |
| 24 | Gatekeeper | 2 | 8×4, 1 | 4 | 1 | 8% | 6.4 s | 28 s | 12 s | 8 s |
| 25 | Downhill Swap | 2 | 7×5, 2 | 3 | 4 | 79% | 5.1 s | 25 s | 10 s | 7 s |
| 26 | Pendulum and Siding | 4 | 7×9, 1 | 5 | 1 | 25% | 8.9 s | 35 s | 16 s | 10 s |
| 27 | Crossing Guard | 3 | 6×7, 1 | 4 | 1 | 12% | 7.1 s | 30 s | 13 s | 9 s |
| 28 | Shunting Yard | 3 | 9×5, 1 | 5 | 0 | 0% | 10.0 s | 39 s | 18 s | 12 s |
| 29 | Rail and Rung | 3 | 5×7, 1 | 5 | 0 | 0% | 10.7 s | 40 s | 19 s | 12 s |
| 30 | Ring Road | 3 | 9×5, 1 | 5 | 0 | 0% | 11.4 s | 43 s | 20 s | 13 s |
| 31 | Switchback | 2 | 7×7, 3 | 4 | 4 | 82% | 6.8 s | 30 s | 13 s | 8 s |
| 32 | Traffic Circle | 3 | 7×7, 1 | 5 | 0 | 1% | 9.6 s | 36 s | 17 s | 11 s |
| 33 | Either Or | 3 | 7×5, 1 | 5 | 0 | 2% | 7.7 s | 31 s | 14 s | 9 s |
| 34 | Silver Key | 2 | 9×7, 1 | 6 | 1 | 17% | 11.0 s | 40 s | 19 s | 13 s |
| 35 | Ladder | 3 | 5×7, 1 | 6 | 2 | 31% | 9.3 s | 36 s | 16 s | 11 s |
| 36 | Crossroads | 3 | 7×7, 1 | 5 | 1 | 45% | 8.1 s | 32 s | 15 s | 10 s |
| 37 | Drawbridge | 3 | 6×3, 1 | 6 | 0 | 2% | 7.6 s | 31 s | 14 s | 9 s |
| 38 | Relay | 3 | 5×8, 3 | 5 | 3 | 47% | 5.3 s | 25 s | 10 s | 7 s |
| 39 | Shut, Then Open | 2 | 6×3, 1 | 6 | 0 | 9% | 7.9 s | 32 s | 14 s | 9 s |
| 40 | Trident | 3 | 5×7, 1 | 6 | 0 | 0% | 7.3 s | 29 s | 13 s | 9 s |
| 41 | Never Both | 3 | 9×5, 1 | 6 | 0 | 0% | 10.3 s | 37 s | 18 s | 12 s |
| 42 | Double Lock | 3 | 7×7, 1 | 6 | 0 | 2% | 16.7 s | 54 s | 27 s | 18 s |
| 43 | Waterfall | 3 | 5×8, 3 | 7 | 0 | 53% | 10.7 s | 38 s | 19 s | 12 s |
| 44 | Through the Crossing | 3 | 7×7, 1 | 5 | 3 | 39% | 8.8 s | 33 s | 16 s | 10 s |
| 45 | Out of Order | 3 | 10×4, 1 | 7 | 0 | 0% | 9.7 s | 36 s | 17 s | 11 s |
| 46 | Rush Hour | 3 | 6×3, 1 | 7 | 0 | 2% | 6.4 s | 27 s | 12 s | 8 s |
| 47 | Yard | 3 | 8×5, 1 | 6 | 0 | 33% | 8.4 s | 32 s | 15 s | 10 s |
| 48 | Stairway | 3 | 7×5, 1 | 6 | 0 | 1% | 7.5 s | 29 s | 14 s | 9 s |
| 49 | Merry-Go-Round | 3 | 7×7, 1 | 7 | 0 | 1% | 9.5 s | 34 s | 17 s | 11 s |
| 50 | Push and Pull | 2 | 7×3, 1 | 7 | 1 | 11% | 9.5 s | 34 s | 17 s | 11 s |
| 51 | Tower | 3 | 7×8, 3 | 5 | 1 | 77% | 6.6 s | 27 s | 12 s | 8 s |
| 52 | Changing of the Guard | 3 | 7×7, 1 | 7 | 0 | 1% | 11.0 s | 38 s | 19 s | 12 s |
| 53 | Pitchfork | 3 | 5×7, 1 | 6 | 1 | 37% | 11.0 s | 38 s | 19 s | 13 s |
| 54 | Climbing Frame | 3 | 5×7, 1 | 7 | 0 | 1% | 10.4 s | 37 s | 18 s | 12 s |
| 55 | Two Plates Down | 3 | 5×9, 1 | 7 | 2 | 18% | 9.5 s | 34 s | 17 s | 11 s |
| 56 | Lock Below | 3 | 7×6, 2 | 6 | 2 | 47% | 11.6 s | 38 s | 20 s | 13 s |
| 57 | Waiting Room | 2 | 8×3, 1 | 7 | 2 | 13% | 11.3 s | 38 s | 19 s | 13 s |
| 58 | Night Shift | 3 | 9×3, 1 | 7 | 2 | 31% | 10.5 s | 36 s | 18 s | 12 s |
| 59 | Gauntlet | 3 | 9×5, 1 | 7 | 0 | 10% | 10.5 s | 36 s | 18 s | 12 s |
| 60 | Tree | 3 | 9×7, 1 | 7 | 0 | 41% | 10.2 s | 35 s | 18 s | 12 s |
| 61 | Last One In | 3 | 9×3, 1 | 6 | 3 | 51% | 10.3 s | 35 s | 18 s | 12 s |
| 62 | Back of the Queue | 3 | 7×5, 1 | 8 | 0 | 2% | 10.5 s | 36 s | 18 s | 12 s |
| 63 | Zigzag Up | 3 | 7×5, 1 | 8 | 0 | 10% | 10.2 s | 35 s | 18 s | 12 s |
| 64 | Grand Machine | 5 | 7×9, 2 | 7 | 2 | 58% | 14.0 s | 43 s | 24 s | 16 s |
| 65 | Deep Lock | 3 | 7×6, 2 | 7 | 3 | 67% | 11.0 s | 36 s | 19 s | 13 s |
| 66 | Own Goal | 2 | 6×3, 1 | 8 | 1 | 47% | 10.1 s | 34 s | 18 s | 12 s |
| 67 | Mezzanine | 3 | 9×6, 2 | 7 | 3 | 71% | 10.7 s | 35 s | 19 s | 12 s |
| 68 | Locked In | 3 | 9×5, 1 | 9 | 1 | 8% | 9.9 s | 33 s | 17 s | 11 s |
| 69 | Gated Ring | 3 | 8×5, 1 | 8 | 1 | 6% | 13.8 s | 42 s | 23 s | 15 s |
| 70 | High Swap | 3 | 9×5, 2 | 6 | 5 | 98% | 5.9 s | 24 s | 11 s | 7 s |
| 71 | Bench Swap | 2 | 8×3, 1 | 10 | 0 | 9% | 12.9 s | 40 s | 22 s | 14 s |
| 72 | Combination | 3 | 8×3, 1 | 9 | 0 | 8% | 12.8 s | 39 s | 22 s | 14 s |
| 73 | High Wire | 3 | 9×5, 2 | 7 | 5 | 95% | 8.8 s | 30 s | 16 s | 10 s |
| 74 | Two-Gate Ring | 3 | 9×5, 1 | 9 | 1 | 6% | 10.9 s | 34 s | 19 s | 12 s |
| 75 | Rungs | 3 | 7×7, 1 | 10 | 0 | 14% | 18.5 s | 51 s | 30 s | 20 s |
| 76 | Upstairs, Downstairs | 3 | 9×9, 1 | 9 | 0 | 19% | 18.1 s | 50 s | 30 s | 20 s |
| 77 | Rush Through | 3 | 7×5, 1 | 10 | 0 | 2% | 11.1 s | 35 s | 19 s | 13 s |
| 78 | Split Level | 3 | 9×9, 1 | 10 | 0 | 2% | 24.0 s | 58 s | 38 s | 25 s |
| 79 | Airlock | 3 | 7×7, 1 | 11 | 0 | 54% | 16.2 s | 46 s | 27 s | 18 s |
| 80 | Long Climb | 3 | 7×5, 1 | 9 | 1 | 9% | 11.3 s | 34 s | 19 s | 13 s |
| 81 | In Each Other's Way | 2 | 8×3, 1 | 10 | 0 | 9% | 11.7 s | 35 s | 20 s | 13 s |
| 82 | Twin Machines | 4 | 8×7, 1 | 9 | 2 | 33% | 12.1 s | 36 s | 21 s | 14 s |
| 83 | Shuttle Service | 3 | 9×9, 1 | 10 | 3 | 25% | 16.5 s | 45 s | 27 s | 18 s |
| 84 | Teeth | 3 | 9×3, 1 | 12 | 0 | 16% | 14.5 s | 41 s | 24 s | 16 s |
| 85 | Run the Gauntlet | 3 | 9×5, 1 | 10 | 0 | 18% | 15.0 s | 42 s | 25 s | 16 s |
| 86 | Upside Down | 3 | 5×7, 1 | 10 | 3 | 10% | 20.9 s | 54 s | 34 s | 22 s |
| 87 | Treetop | 3 | 9×7, 1 | 9 | 3 | 36% | 14.1 s | 40 s | 24 s | 16 s |
| 88 | Comb | 3 | 9×3, 1 | 11 | 0 | 21% | 13.6 s | 38 s | 23 s | 15 s |
| 89 | Three Rungs | 3 | 5×7, 1 | 11 | 0 | 13% | 19.2 s | 49 s | 31 s | 21 s |
| 90 | Goalposts | 3 | 7×7, 1 | 12 | 1 | 21% | 21.0 s | 52 s | 34 s | 22 s |
| 91 | Two Yards | 3 | 9×9, 1 | 12 | 0 | 18% | 25.8 s | 60 s | 41 s | 27 s |
| 92 | Long Way Round | 3 | 9×5, 1 | 11 | 0 | 22% | 17.0 s | 44 s | 28 s | 18 s |
| 93 | Branch Line | 3 | 9×7, 1 | 11 | 1 | 37% | 17.7 s | 46 s | 29 s | 19 s |
| 94 | Two Benches | 4 | 8×7, 1 | 13 | 0 | 23% | 19.2 s | 49 s | 31 s | 21 s |
| 95 | Catch-22 | 3 | 9×5, 1 | 13 | 1 | 29% | 15.0 s | 40 s | 25 s | 16 s |
| 96 | Coupled | 5 | 9×7, 1 | 13 | 1 | 39% | 16.0 s | 41 s | 26 s | 17 s |
| 97 | Deep Roots | 3 | 9×7, 1 | 13 | 3 | 41% | 17.8 s | 44 s | 29 s | 19 s |
| 98 | No Shortcuts | 3 | 9×5, 1 | 13 | 3 | 18% | 20.0 s | 48 s | 32 s | 21 s |
| 99 | Long Haul | 4 | 8×7, 1 | 15 | 0 | 32% | 19.6 s | 48 s | 32 s | 21 s |
| 100 | Clockwork | 5 | 9×7, 1 | 14 | 1 | 38% | 18.4 s | 45 s | 30 s | 20 s |

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

## Sidings and shutters (11–20)

Parking a marble so another can pass, and the striped shutter: open until its plate is pressed (Level Crossing). From here on one plate often opens a gate and shuts a shutter at the same time.

### 11. Over and Under
- A groove can run under a bridge. The marble on the plate holds the gate, so it goes home last.
- 2 marbles · 2 tiers · fewest moves 2 (4 shortest solutions) · reference: S, E · gate A costs · losing openings: E, SE

### 12. Passing Place
- Marbles can't pass each other in a groove. Park one in the siding to let the other by.
- 2 marbles · fewest moves 3 (2 shortest solutions) · reference: NE, W, SE

### 13. Shift Change
- Each counterweight holds the other one's gate. Take turns.
- 2 marbles · fewest moves 3 (2 shortest solutions) · reference: N, W, SE · gate A costs, gate B costs · losing openings: NE

### 14. Level Crossing
- A striped shutter works the other way round: open until its plate is pressed, then shut.
- 3 marbles · fewest moves 2 (2 shortest solutions) · reference: NE, SE · gate A costs, shutter A blocks · losing openings: SE, S, SW

### 15. Step Aside
- Orange has to leave the plate to open the shutter, but blue is in the way. Use the side groove to swap them.
- 2 marbles · fewest moves 4 (6 shortest solutions) · reference: NE, SW, NE, SE · shutter A costs

### 16. Sidings
- Three marbles, two sidings. Send each one the right way at each junction.
- 3 marbles · fewest moves 3 (one shortest solution) · reference: NE, W, SE

### 17. Handover
- Two plates can open the same gate. Hand the job over before you leave.
- 2 marbles · fewest moves 3 (one shortest solution) · reference: N, NW, SE · gate A costs · losing openings: NE

### 18. Pendulum
- One counterweight, two plates. Swing it from one to the other.
- 2 marbles · fewest moves 3 (one shortest solution) · reference: NE, SE, NW · gate A costs, gate B costs · losing openings: SW

### 19. One Key, Two Locks
- One plate opens the gate and shuts the shutter. Blue needs both open, one after the other.
- 2 marbles · fewest moves 4 (4 shortest solutions) · reference: NE, SW, NE, SE · gate A costs, shutter A costs

### 20. Backbone
- Green can hold the gate from down below while the others climb the spine.
- 3 marbles · fewest moves 4 (18 shortest solutions) · reference: NE, SW, NW, E · gate A costs · losing openings: W, NW

## Gates and shutters together (21–30)

Plates that work two locks at once, crossings marbles can't turn at, and the first ladders and rings.

### 21. Off the Plate
- Orange is standing on the shutter's plate. The shutter only opens once orange moves off it.
- 2 marbles · fewest moves 4 (2 shortest solutions) · reference: E, NW, SW, NE · shutter A costs

### 22. Two Doors, One Key
- Blue is parked behind a gate and green's goal is behind a shutter. The same plate works both.
- 3 marbles · fewest moves 4 (2 shortest solutions) · reference: NE, W, SE, NW · gate A costs, shutter A costs

### 23. Bridge and Siding
- Two little machines in one. Every tilt moves both.
- 4 marbles · 2 tiers · fewest moves 4 (16 shortest solutions) · reference: NE, N, SW, E · gate A costs · losing openings: E, SE

### 24. Gatekeeper
- The counterweight starts in the way. Get it onto its plate first.
- 2 marbles · fewest moves 4 (one shortest solution) · reference: SW, NE, W, SE · gate A costs · losing openings: SE

### 25. Downhill Swap
- Swap the marbles before either one goes down a ramp. There is no way back up.
- 2 marbles · 2 tiers · fewest moves 3 (2 shortest solutions) · reference: NE, W, SE · losing openings: E, SE, SW, W

### 26. Pendulum and Siding
- Swing the counterweight and swap the pair below. Every tilt does both.
- 4 marbles · fewest moves 5 (20 shortest solutions) · reference: NE, SE, NW, SW, E · gate A costs, gate B costs · losing openings: SW

### 27. Crossing Guard
- Marbles always go straight over a crossing. Orange's goal is straight down, past the gate.
- 3 marbles · fewest moves 4 (one shortest solution) · reference: E, NE, S, NW · gate A costs · losing openings: NW

### 28. Shunting Yard
- Two marbles share a siding. The one at the back can only leave after the one in front.
- 3 marbles · fewest moves 5 (2 shortest solutions) · reference: SE, NE, W, SE, SW

### 29. Rail and Rung
- The bottom-left plate opens the top rung but shuts the left rail. Blue's goal opens the middle rung.
- 3 marbles · fewest moves 5 (2 shortest solutions) · reference: N, SW, SE, NE, NW · gate A costs, shutter A costs, gate B reroutes

### 30. Ring Road
- Orange starts on the plate, so both shutters on the ring are shut.
- 3 marbles · fewest moves 5 (one shortest solution) · reference: NW, NE, SE, SW, NW · shutter A costs

## The third link (31–40)

Silver plates and gates (link C) arrive with Silver Key, and Relay chains three floors together with goals instead of plates.

### 31. Switchback
- Two ramps, two goals. Get the order right before anything drops.
- 2 marbles · 3 tiers · fewest moves 4 (4 shortest solutions) · reference: NE, S, E, SW · losing openings: E, SE, SW, W

### 32. Traffic Circle
- Orange's goal is behind a gate, and its plate is at the top of the ring. Orange is also in green's way.
- 3 marbles · fewest moves 5 (one shortest solution) · reference: SE, NE, NW, SW, SE · gate A costs

### 33. Either Or
- Green needs the plate pressed and blue needs it empty. Who stands on it, and when?
- 3 marbles · fewest moves 5 (one shortest solution) · reference: SE, NE, W, SW, NW · gate A costs, shutter A costs

### 34. Silver Key
- Three locks, one counterweight. Walk it from plate to plate as blue moves along.
- 2 marbles · fewest moves 6 (8 shortest solutions) · reference: N, NE, SE, SW, E, NW · gate A costs, gate C costs, gate B costs · losing openings: NW

### 35. Ladder
- Each rung joins the two rails. A diagonal turns onto a rung; a straight tilt keeps to the rail.
- 3 marbles · fewest moves 6 (32 shortest solutions) · reference: N, SW, NE, SE, N, SW · gate A costs · losing openings: NE, NW

### 36. Crossroads
- Orange and green have to swap places, and green needs the gate. Blue can lend a hand.
- 3 marbles · fewest moves 5 (3 shortest solutions) · reference: NE, NW, S, E, SW · gate A costs · losing openings: SW

### 37. Drawbridge
- One gate between two halves, a plate on each side. Cross one at a time.
- 3 marbles · fewest moves 6 (4 shortest solutions) · reference: NE, W, SW, NE, SW, NW · gate A costs

### 38. Relay
- No plates at all: blue's goal opens orange's gate at the top, and orange's goal opens green's gate in the middle.
- 3 marbles · 3 tiers · fewest moves 5 (8 shortest solutions) · reference: N, S, NE, NW, SW · gate B costs, gate A costs · losing openings: E, SE, S

### 39. Shut, Then Open
- Blue has to pass the shutter while the plate is empty, then the gate while it is pressed.
- 2 marbles · fewest moves 6 (2 shortest solutions) · reference: NE, S, E, N, SE, NW · shutter A costs, gate A costs

### 40. Trident
- Three goals on three prongs. The right-hand gate is a shortcut, but only while someone holds the plate at the bottom.
- 3 marbles · fewest moves 6 (3 shortest solutions) · reference: W, N, W, S, E, NW · gate A costs

## Order matters (41–50)

Who goes home first starts to decide everything: two gates in a row, three-floor towers, and the long yard.

### 41. Never Both
- The bottom of the ring has a shutter and a gate worked by the same plate, so one of them is always shut.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: N, E, SW, NW, NE, SE · shutter A costs, gate A costs

### 42. Double Lock
- The top rung has two gates in a row: the plate opens one, blue's goal opens the other.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: NE, W, SW, NE, NW, SE · gate B costs, gate A reroutes

### 43. Waterfall
- Blue is shut in on the top floor, and the plate for its gate is a floor below. Blue's goal opens the middle floor's gate.
- 3 marbles · 3 tiers · fewest moves 7 (31 shortest solutions) · reference: E, W, SE, NW, S, NE, SW · gate B costs, gate A costs

### 44. Through the Crossing
- Green starts next to its goal, but the plate is on the far side of the crossing. Blue and orange both need the gate.
- 3 marbles · fewest moves 5 (2 shortest solutions) · reference: N, W, NE, SW, E · gate A costs · losing openings: NE, E, SE

### 45. Out of Order
- Blue has to go first, but orange is sitting in blue's way.
- 3 marbles · fewest moves 7 (8 shortest solutions) · reference: N, SE, SW, NE, SE, NE, SE · gate A costs, gate B costs

### 46. Rush Hour
- Blue and orange both have to cross the drawbridge, in opposite directions.
- 3 marbles · fewest moves 7 (8 shortest solutions) · reference: E, S, SW, N, W, SW, N · gate A costs

### 47. Yard
- Orange is shut in behind one gate and its goal is behind the other. Green starts on the plate that lets orange out.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: SE, W, NE, S, W, SE · gate B costs, gate A costs

### 48. Stairway
- Blue's goal is at the very top, behind the only gate. The plate is halfway down.
- 3 marbles · fewest moves 6 (one shortest solution) · reference: W, N, SW, N, SW, SE · gate A costs

### 49. Merry-Go-Round
- Orange is standing on the plate for its own gate. Someone has to take over.
- 3 marbles · fewest moves 7 (7 shortest solutions) · reference: N, NE, NW, S, W, SE, NW · gate A costs

### 50. Push and Pull
- Blue's goal needs the plate pressed, but the shutter on the way needs it empty.
- 2 marbles · fewest moves 7 (8 shortest solutions) · reference: SW, E, NW, S, E, N, SW · gate A costs, shutter A costs · losing openings: W

## Taking turns on the plate (51–60)

Marbles start on the plate for their own gate and must hand it over. Gauntlet and Tree bring three gates and three plates.

### 51. Tower
- Three floors. Orange's goal at the top opens the ground floor's gate; the plate down there opens the middle one.
- 3 marbles · 3 tiers · fewest moves 5 (one shortest solution) · reference: NE, N, SW, E, SW · gate B costs, gate A costs · losing openings: E

### 52. Changing of the Guard
- Orange starts on the plate for its own gate. Someone has to take its place.
- 3 marbles · fewest moves 7 (5 shortest solutions) · reference: E, N, E, S, SW, N, SE · gate A costs

### 53. Pitchfork
- Orange's goal is behind a gate, and orange starts on that gate's plate. Green is right behind it.
- 3 marbles · fewest moves 6 (2 shortest solutions) · reference: SW, N, E, NE, SW, NW · gate A costs · losing openings: NE

### 54. Climbing Frame
- Green's goal opens the gate on the right-hand rail. The top rung's gate needs someone on the plate.
- 3 marbles · fewest moves 7 (3 shortest solutions) · reference: E, NW, SE, W, N, NE, S · gate A costs, gate B costs

### 55. Two Plates Down
- Either plate at the bottom opens the gate at the top. Somebody has to stay down there.
- 3 marbles · fewest moves 7 (8 shortest solutions) · reference: N, NE, SW, E, S, SW, NE · gate A costs · losing openings: NE, NW

### 56. Lock Below
- Blue starts on the plate upstairs, but its goal is past the gate downstairs. Hand the plate to purple.
- 3 marbles · 2 tiers · fewest moves 6 (one shortest solution) · reference: NE, S, E, SW, NW, SE · gate A costs · losing openings: E, SE

### 57. Waiting Room
- Orange has to hold the plate for blue's gate. They can only pass each other in the side grooves.
- 2 marbles · fewest moves 7 (2 shortest solutions) · reference: SE, SW, NE, S, E, NE, SW · gate A costs · losing openings: SW, W

### 58. Night Shift
- Purple is right under the plate, but its goal is past the gate. Find someone to take its place.
- 3 marbles · fewest moves 7 (5 shortest solutions) · reference: E, SW, NE, S, E, NE, SW · gate A costs · losing openings: NE, W

### 59. Gauntlet
- Blue starts locked in, and its goal is behind another gate. Three gates, three plates.
- 3 marbles · fewest moves 7 (one shortest solution) · reference: NW, SW, NE, SE, NE, W, NE · gate C costs, gate B costs, gate A reroutes

### 60. Tree
- Green starts on the plate for the gate in the trunk. Orange's goal is behind a gate whose plate is up the tree.
- 3 marbles · fewest moves 7 (one shortest solution) · reference: NE, W, N, E, NW, SE, NW · gate A costs, gate C costs, gate B costs

## Five marbles (61–70)

Grand Machine adds the fifth marble, and Mezzanine splits a machine over two decks. Most levels now have one or two shortest solutions.

### 61. Last One In
- When green reaches its goal, the striped shutter in front of blue's goal shuts.
- 3 marbles · fewest moves 6 (one shortest solution) · reference: SW, NE, S, E, NW, SE · gate A costs, shutter B costs · losing openings: E, SE, NW

### 62. Back of the Queue
- Blue's goal needs the plate pressed and orange's needs it empty. And blue starts stuck behind green.
- 3 marbles · fewest moves 8 (2 shortest solutions) · reference: SW, N, E, NW, S, W, N, SW · gate A costs, shutter A costs

### 63. Zigzag Up
- Green's goal is at the top, past the gate, and the plate is further down the zigzag.
- 3 marbles · fewest moves 8 (2 shortest solutions) · reference: SE, N, SW, N, S, SW, NW, SE · gate A costs

### 64. Grand Machine
- Five marbles, two floors, one lock. Everything you have learned.
- 5 marbles · 2 tiers · fewest moves 7 (5 shortest solutions) · reference: NE, W, S, E, SW, NW, SE · gate A costs · losing openings: E, SE

### 65. Deep Lock
- Nobody is on the plate yet. Choose who holds it, and who goes down first.
- 3 marbles · 2 tiers · fewest moves 7 (3 shortest solutions) · reference: SW, NE, S, E, S, W, SE · gate A costs · losing openings: E, SE, NW

### 66. Own Goal
- Orange starts on the plate, but orange's own goal is behind the gate that plate opens.
- 2 marbles · fewest moves 8 (2 shortest solutions) · reference: E, S, SW, NE, S, E, NW, SE · gate A costs, shutter A costs · losing openings: SE

### 67. Mezzanine
- The plate is on the top deck and its gate is on the bottom one.
- 3 marbles · 2 tiers · fewest moves 7 (2 shortest solutions) · reference: NE, NW, S, E, SW, NW, SE · gate A costs · losing openings: SE, SW, W

### 68. Locked In
- Orange is locked in at the bottom, behind a gate that only green's goal can open.
- 3 marbles · fewest moves 9 (8 shortest solutions) · reference: S, E, SW, NW, S, W, N, E, SW · gate A costs, gate B costs · losing openings: SW

### 69. Gated Ring
- Each gate's plate sits just outside the ring. Orange has to get through the bottom gate to reach its goal.
- 3 marbles · fewest moves 8 (one shortest solution) · reference: N, SE, SW, N, W, SW, NE, NW · gate B costs, gate A costs · losing openings: NE

### 70. High Swap
- Blue and orange have to swap ends before they go down. Nothing comes back up a ramp.
- 3 marbles · 2 tiers · fewest moves 6 (one shortest solution) · reference: NW, S, W, S, E, SE · losing openings: NE, E, SE, SW, W

## Long shuffles (71–80)

Mostly nine to eleven moves. Benches, ladders and yards where every marble has to wait its turn somewhere.

### 71. Bench Swap
- Two marbles, two side grooves and one gate. Shuffle them past each other.
- 2 marbles · fewest moves 10 (12 shortest solutions) · reference: NE, NW, SW, E, NW, S, W, N, SW, NE · gate A costs

### 72. Combination
- Orange's goal opens green's gate, but orange's own gate needs someone on the plate.
- 3 marbles · fewest moves 9 (2 shortest solutions) · reference: S, E, NW, SW, NE, S, E, NE, SW · gate B costs, gate A costs

### 73. High Wire
- Green starts right at the top of the wrong ramp.
- 3 marbles · 2 tiers · fewest moves 7 (3 shortest solutions) · reference: NW, NE, SE, N, E, N, W · losing openings: NE, E, SE, SW, W

### 74. Two-Gate Ring
- Both gates start open, because orange and green are standing on the plates. Both of them have to leave.
- 3 marbles · fewest moves 9 (2 shortest solutions) · reference: N, W, E, N, SE, NW, NE, SE, SW · gate B costs, gate A costs · losing openings: NE

### 75. Rungs
- Blue starts on the corner plate, so both rungs are open. As soon as blue leaves, they shut.
- 3 marbles · fewest moves 10 (8 shortest solutions) · reference: SE, NW, NE, SE, NW, E, S, W, N, SW · gate A costs

### 76. Upstairs, Downstairs
- Two yards joined by a gated stem. The plate up top opens the stem; the plate down below opens the top yard's gate.
- 3 marbles · fewest moves 9 (one shortest solution) · reference: W, SW, NE, SE, W, SW, NW, E, NW · gate A costs, gate B reroutes

### 77. Rush Through
- Everyone has to get through the one gate: orange on its way down, blue and green on their way up.
- 3 marbles · fewest moves 10 (5 shortest solutions) · reference: SE, N, SW, N, E, S, NE, NW, NE, S · gate A costs

### 78. Split Level
- Green's goal is behind a gate in the top yard, and that gate's plate is down in the bottom yard. The top plate opens the other gate.
- 3 marbles · fewest moves 10 (5 shortest solutions) · reference: N, W, SE, NE, NE, NW, SW, SE, NW, E · gate A costs, gate B costs

### 79. Airlock
- The stem has a gate and a striped shutter worked by the same plate. Blue's goal opens green's gate.
- 3 marbles · fewest moves 11 (94 shortest solutions) · reference: SE, N, E, N, W, SW, N, SE, NE, W, SE · gate C costs, gate A costs, shutter A costs, gate B costs

### 80. Long Climb
- Blue starts at the bottom and its goal is at the very top, behind the gate. The plate is at the very bottom.
- 3 marbles · fewest moves 9 (one shortest solution) · reference: NW, S, SE, N, E, NE, SW, N, SW · gate A costs · losing openings: S

## Two machines, one tilt (81–90)

Twin Machines joins two machines: a goal on top powers the machine below, and every tilt moves both.

### 81. In Each Other's Way
- Blue starts in orange's goal groove, and blue's own goal is behind the gate. Orange has to hold the plate.
- 2 marbles · fewest moves 10 (2 shortest solutions) · reference: SE, NW, SW, E, NW, S, E, NE, SW, NE · gate A costs

### 82. Twin Machines
- One tilt moves both machines. Orange's goal on top opens green's gate below, but shuts the shutter purple needs.
- 4 marbles · fewest moves 9 (4 shortest solutions) · reference: SE, SW, NE, S, E, NE, S, SW, NE · gate A costs, gate C costs, shutter C reroutes · losing openings: SW, W

### 83. Shuttle Service
- The bottom plate opens the top yard's gate and the top plate opens the stem. Green's goal is past the top gate.
- 3 marbles · fewest moves 10 (15 shortest solutions) · reference: SW, NE, S, W, SE, W, S, NE, SE, W · gate A costs, gate B costs · losing openings: NE, E, SE

### 84. Teeth
- Blue's goal opens orange's gate. The plate at the end opens green's gate but shuts the shutter in the middle.
- 3 marbles · fewest moves 12 (54 shortest solutions) · reference: S, SW, NE, SE, SW, NE, S, E, N, SE, NW, N · gate A costs, gate B costs, shutter A costs

### 85. Run the Gauntlet
- Blue starts on the far-left plate, and its goal is at the far right, past two gates.
- 3 marbles · fewest moves 10 (one shortest solution) · reference: E, NE, S, E, N, SE, NE, W, SW, NE · gate C costs, gate A costs, gate B costs

### 86. Upside Down
- The plate at the top opens the bottom rung. Green's goal opens the top one.
- 3 marbles · fewest moves 10 (5 shortest solutions) · reference: E, SW, N, SE, SW, NE, W, N, NE, SE · gate B costs, gate A costs · losing openings: SE, S, NW

### 87. Treetop
- All three plates are at the top of the tree, and two of the goals are at the bottom, behind gates.
- 3 marbles · fewest moves 9 (one shortest solution) · reference: N, NE, S, W, N, E, SW, SE, SW · gate A costs, gate B costs, gate C costs · losing openings: SW, W, NW

### 88. Comb
- Four teeth, two gates, and orange's goal opens one of them. Plan the whole shuffle first.
- 3 marbles · fewest moves 11 (6 shortest solutions) · reference: SE, SW, NE, S, E, NE, W, SE, NW, SW, NE · gate B costs, gate A costs

### 89. Three Rungs
- The corner plate opens the top and bottom rungs. Orange's goal opens the middle one.
- 3 marbles · fewest moves 11 (3 shortest solutions) · reference: SE, SW, NE, S, NE, SE, NW, E, S, SW, N · gate A costs, gate B costs

### 90. Goalposts
- Both ways across the crossbar have a gate, and green's goal is behind a third one at the bottom. The plates are at the ends of the posts.
- 3 marbles · fewest moves 12 (32 shortest solutions) · reference: N, NE, SE, SW, NE, W, SE, N, SE, NW, SE, SW · gate B costs, gate A costs, gate C costs · losing openings: SW

## Grand finale (91–100)

Eleven to fifteen moves, ending with Clockwork: five marbles, two machines, four locks.

### 91. Two Yards
- Orange starts in the stem. The top plate opens the stem's gate and the bottom plate opens the top yard's gate.
- 3 marbles · fewest moves 12 (14 shortest solutions) · reference: NE, SW, N, E, NW, SW, NW, E, SW, NW, NE, SE · gate A costs, gate B costs

### 92. Long Way Round
- Blue's gate is opened from the far left, and the way to that plate goes through the other gate.
- 3 marbles · fewest moves 11 (2 shortest solutions) · reference: S, W, N, SW, NW, E, SE, SW, NW, E, SW · gate B costs, gate A costs

### 93. Branch Line
- Blue's goal is at the bottom right, behind a gate whose plate orange is standing on.
- 3 marbles · fewest moves 11 (2 shortest solutions) · reference: W, N, E, NW, S, W, N, NW, NE, SE, NW · gate A costs, gate C costs, gate B costs · losing openings: NW

### 94. Two Benches
- Green has to pass the striped shutter while nothing powers C, then the gate while something does. Purple starts on the C plate, and blue's goal powers C too.
- 4 marbles · fewest moves 13 (12 shortest solutions) · reference: E, SE, NW, SW, E, NW, S, W, N, E, SE, SW, NE · gate A costs, shutter C costs, gate C reroutes

### 95. Catch-22
- Blue sits on the plate for its own gate, shut in behind a gate only green's goal opens. And green starts locked in too.
- 3 marbles · fewest moves 13 (4 shortest solutions) · reference: E, N, SW, N, W, NW, S, SE, NW, S, E, NW, SE · gate C costs, gate B costs, gate A costs · losing openings: NE

### 96. Coupled
- Red starts on the plate that shuts the striped shutter, and blue's goal shuts it too. Purple has to get through first.
- 5 marbles · fewest moves 13 (4 shortest solutions) · reference: S, W, N, SW, E, NW, S, W, NW, NE, SE, SW, NE · gate B costs, gate A costs, shutter C costs · losing openings: SE

### 97. Deep Roots
- Orange starts on the plate for its own gate, and the bottom-left plate is itself behind a gate.
- 3 marbles · fewest moves 13 (4 shortest solutions) · reference: NW, E, N, W, N, SE, W, S, E, W, N, NE, SW · gate A costs, gate C costs, gate B reroutes · losing openings: NE, E, SE

### 98. No Shortcuts
- Green could go straight home, but then there aren't enough marbles left to hold the plates.
- 3 marbles · fewest moves 13 (one shortest solution) · reference: SW, NW, E, SW, NW, S, E, N, SE, NE, W, SW, NE · gate C costs, gate A costs, gate B costs · losing openings: N, NE, NW

### 99. Long Haul
- Blue's goal on top acts like the bottom plate: gate open, shutter shut. Get the bottom pair home before blue.
- 4 marbles · fewest moves 15 (4 shortest solutions) · reference: SW, NE, S, E, N, SE, NW, SE, SW, NE, S, W, NW, SE, NW · gate A costs, shutter C costs, gate C costs

### 100. Clockwork
- Five marbles, two machines. Orange's goal opens a gate on top; green's goal opens the bottom gate and shuts the shutter.
- 5 marbles · fewest moves 14 (2 shortest solutions) · reference: E, SE, SW, NE, S, W, NW, E, SE, NW, S, W, NE, SE · gate B costs, gate A costs, shutter C costs, gate C costs · losing openings: SW

## Notes for the next pass
- The hardest stretch (85–100) has 11–15 moves and few shortest solutions. Watch the playtest log for restarts there; if testers stall, the hints say what each lock does without giving the order away.
- Some machines come back with a harder setup: the long yard (Yard, Locked In, Long Way Round, Gauntlet and its follow-ups), the tree (Tree, Treetop, Branch Line, Deep Roots), the ladder and the benches. Playtest whether that reads as "same puzzle again" or as a satisfying return.
- The linked machines (Twin Machines, Coupled, Long Haul, Clockwork) are the deepest levels; one tilt moves both halves. They're 7–8 rows deep, so check readability on small phones.
- The solve times here are for direction assist on. Re-run `npm test` after any physics change, and `npm run solve` / `npm run audit` to see if move counts or lock purposes changed.
