# The first ten levels

Every level is a different machine built from the same block kit, using only the blocks the track needs. Levels unlock in order: finishing one opens the next. The data lives in `prototype/src/levels.js`. Each level ships with a scripted reference solution and, from level 4 on, "traps": wrong opening moves the level is designed to punish. `npm test` plays every solution and every trap headlessly.

Timers are derived from the reference solution, so they stay fair when the physics is retuned:

- **time limit** = max(20 s, solution × time factor + 10 s)
- **2 stars (par)** = solution × 1.5 + 2 s
- **3 stars (gold)** = solution + 1 s

The reference solution is an expert's run. First-time players need reading time, which the limit allows for.

| # | Level | Marbles | Size (w×d, tiers) | Reference | Limit | Par | Gold |
|---|---|---|---|---|---|---|---|
| 1 | First Tilt | 1 | 5×3, 1 | 2.1 s | 20 s | 6 s | 4 s |
| 2 | Two Grooves | 2 | 5×5, 1 | 2.2 s | 20 s | 6 s | 4 s |
| 3 | Fork in the Road | 2 | 5×5, 1 | 2.9 s | 20 s | 7 s | 4 s |
| 4 | Downhill Only | 2 | 6×4, 2 | 5.4 s | 27 s | 11 s | 7 s |
| 5 | Counterweight | 2 | 5×5, 1 | 4.1 s | 23 s | 9 s | 6 s |
| 6 | Hold the Door | 2 | 6×3, 1 | 6.3 s | 30 s | 12 s | 8 s |
| 7 | Blue Goes First | 3 | 6×6, 2 | 6.5 s | 27 s | 12 s | 8 s |
| 8 | Underpass | 3 | 5×6, 2 | 6.7 s | 27 s | 12 s | 8 s |
| 9 | Chain Reaction | 3 | 6×6, 1 | 5.8 s | 25 s | 11 s | 7 s |
| 10 | The Machine | 4 | 6×8, 3 | 5.5 s | 23 s | 11 s | 7 s |

Directions below are grid directions. With the default camera, north is up the screen and east is to the right.

---

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
- **Machine:** one east–west line with a gate near the west end, plus a T whose north spur ends on the plate.
- **Interaction:** orange must go west through the gate, which is the same axis blue is on. So blue has to leave the line and hold the plate from the spur.
- **Solution:**
  1. North-east: blue reaches the T and turns into the spur onto the plate. Orange bounces off blue's goal meanwhile.
  2. West: orange goes through the gate home, while blue in the spur doesn't move.
  3. South-east: blue comes out and goes home.
- **Trap:** tilting west first jams both marbles against the shut gate.
- **Learns:** parking the counterweight across the next move, and diagonal turns into spurs.

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
  - Purple is the counterweight on plate A, and purple's goal has a graphite band that opens gate B for green.
  - Orange is free.
- **Interaction:** four marbles, two links, three tiers, and the tightest time factor.
- **Solution:** south-east (purple onto the plate, blue down the tower through gate A home, orange home), then west (purple home, gate B opens, green home).
- **Trap:** tilting west first sends purple home early, which locks blue out.
- **Learns:** combining everything.

---

## Notes for the next pass
- Machines are only their track blocks plus supports, with no filler. Level 9 needs one extra block to join its rows. The tests fail if any machine falls apart into separate pieces.
- Level 10 is 8 deep. That fits a portrait phone, but check readability on small screens.
- The solve times here are for direction assist on. Re-run `npm test` after any physics change.
