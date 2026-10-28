# The fifty levels

Every level is a different machine built from the same block kit, using only the blocks the track needs. Levels unlock in order: finishing one opens the next. The data lives in `prototype/src/levels.js`: levels 1–10 list their pieces, and levels 11–50 are drawn as text maps (see `prototype/src/grid.js` for the characters). Each level ships with a scripted reference solution and, where the level has them, "traps": wrong opening moves that make it unwinnable. `npm test` plays every solution and every trap headlessly.

Timers are derived from the reference solution, so they stay fair when the physics is retuned:

- **time limit** = max(20 s, solution × time factor + 10 s), kept between 20 and 45 s
- **2 stars (par)** = solution × 1.5 + 2 s
- **3 stars (gold)** = solution + 1 s

The reference solution is an expert's run. First-time players need reading time, which the limit allows for.

**Fewest moves** comes from `npm run solve` (`tools/solve.mjs`). It searches for the shortest sequence of moves, where a move means tilting one of the 8 directions until everything stops, then letting go. It is a measure of difficulty, not a speedrun: players can also chain tilts without letting go.

| # | Level | Marbles | Size (w×d, tiers) | Fewest moves | Reference | Limit | Par | Gold |
|---|---|---|---|---|---|---|---|---|
| 1 | First Tilt | 1 | 5×3, 1 | 1 | 2.1 s | 20 s | 6 s | 4 s |
| 2 | Two Grooves | 2 | 5×5, 1 | 1 | 2.2 s | 20 s | 6 s | 4 s |
| 3 | Fork in the Road | 2 | 5×5, 1 | 2 | 2.9 s | 20 s | 7 s | 4 s |
| 4 | Downhill Only | 2 | 6×4, 2 | 3 | 5.4 s | 27 s | 11 s | 7 s |
| 5 | Counterweight | 2 | 5×5, 1 | 2 | 4.1 s | 23 s | 9 s | 6 s |
| 6 | Hold the Door | 2 | 6×3, 1 | 3 | 6.3 s | 30 s | 12 s | 8 s |
| 7 | Blue Goes First | 3 | 6×6, 2 | 3 | 6.5 s | 27 s | 12 s | 8 s |
| 8 | Underpass | 3 | 5×6, 2 | 2 | 6.7 s | 27 s | 12 s | 8 s |
| 9 | Chain Reaction | 3 | 6×6, 1 | 3 | 5.8 s | 25 s | 11 s | 7 s |
| 10 | The Machine | 4 | 6×8, 3 | 2 | 5.5 s | 23 s | 11 s | 7 s |
| 11 | Passing Place | 2 | 7×3, 1 | 3 | 4.6 s | 24 s | 9 s | 6 s |
| 12 | Over and Under | 2 | 5×6, 2 | 2 | 4.0 s | 23 s | 9 s | 6 s |
| 13 | Zigzag | 3 | 7×6, 1 | 2 | 5.3 s | 26 s | 10 s | 7 s |
| 14 | Roundabout | 2 | 7×7, 1 | 3 | 6.9 s | 31 s | 13 s | 8 s |
| 15 | Helter Skelter | 1 | 6×4, 3 | 3 | 5.5 s | 27 s | 11 s | 7 s |
| 16 | Sidings | 3 | 7×3, 1 | 3 | 5.9 s | 28 s | 11 s | 7 s |
| 17 | Double Door | 3 | 8×8, 1 | 2 | 6.4 s | 30 s | 12 s | 8 s |
| 18 | Downhill Swap | 2 | 7×5, 2 | 3 | 5.1 s | 26 s | 10 s | 7 s |
| 19 | Carousel | 2 | 7×5, 1 | 2 | 3.2 s | 20 s | 7 s | 5 s |
| 20 | Pendulum | 2 | 7×6, 1 | 3 | 6.5 s | 30 s | 12 s | 8 s |
| 21 | Shift Change | 2 | 7×6, 1 | 3 | 4.7 s | 24 s | 10 s | 6 s |
| 22 | Handover | 2 | 5×8, 1 | 3 | 7.7 s | 32 s | 14 s | 9 s |
| 23 | Gatekeeper | 2 | 8×4, 1 | 4 | 6.4 s | 28 s | 12 s | 8 s |
| 24 | Backbone | 3 | 5×9, 1 | 4 | 7.5 s | 31 s | 14 s | 9 s |
| 25 | Switchback | 2 | 7×7, 3 | 4 | 6.8 s | 30 s | 13 s | 8 s |
| 26 | Bridge and Siding | 4 | 5×9, 2 | 4 | 6.4 s | 27 s | 12 s | 8 s |
| 27 | Spiral Traffic | 2 | 6×4, 3 | 4 | 8.6 s | 32 s | 15 s | 10 s |
| 28 | Shunting Yard | 3 | 9×5, 1 | 5 | 10.0 s | 36 s | 18 s | 12 s |
| 29 | Twin Rings | 3 | 9×5, 1 | 5 | 10.5 s | 37 s | 18 s | 12 s |
| 30 | Pendulum and Siding | 4 | 7×9, 1 | 5 | 8.9 s | 33 s | 16 s | 10 s |
| 31 | Locked Yard | 3 | 9×3, 1 | 5 | 11.2 s | 38 s | 19 s | 13 s |
| 32 | Crossroads | 3 | 7×7, 1 | 5 | 8.1 s | 31 s | 15 s | 10 s |
| 33 | Ring of Bands | 3 | 7×7, 1 | 5 | 8.6 s | 32 s | 15 s | 10 s |
| 34 | Ring Lock | 3 | 7×7, 1 | 6 | 9.7 s | 34 s | 17 s | 11 s |
| 35 | Silver Key | 2 | 9×7, 1 | 6 | 11.0 s | 37 s | 19 s | 13 s |
| 36 | Delivery Order | 3 | 10×4, 1 | 6 | 8.3 s | 31 s | 15 s | 10 s |
| 37 | Upper Deck | 3 | 9×6, 2 | 6 | 10.2 s | 35 s | 18 s | 12 s |
| 38 | Drawbridge | 3 | 6×3, 1 | 6 | 7.6 s | 29 s | 14 s | 9 s |
| 39 | Ladder | 3 | 5×7, 1 | 6 | 9.3 s | 33 s | 16 s | 11 s |
| 40 | Double Deck | 3 | 9×6, 2 | 6 | 9.2 s | 33 s | 16 s | 11 s |
| 41 | Lock Below | 3 | 7×6, 2 | 6 | 11.6 s | 38 s | 20 s | 13 s |
| 42 | High Swap | 3 | 9×5, 2 | 6 | 5.9 s | 25 s | 11 s | 7 s |
| 43 | Shut In | 3 | 7×7, 1 | 6 | 8.9 s | 32 s | 16 s | 10 s |
| 44 | Merry-Go-Round | 3 | 7×7, 1 | 7 | 9.5 s | 31 s | 17 s | 11 s |
| 45 | Rush Hour | 3 | 6×3, 1 | 7 | 6.4 s | 25 s | 12 s | 8 s |
| 46 | Night Shift | 3 | 9×3, 1 | 7 | 10.5 s | 34 s | 18 s | 12 s |
| 47 | Out of Order | 3 | 10×4, 1 | 7 | 9.7 s | 32 s | 17 s | 11 s |
| 48 | Deep Lock | 3 | 7×6, 2 | 7 | 11.0 s | 35 s | 19 s | 13 s |
| 49 | High Wire | 3 | 9×5, 2 | 7 | 8.8 s | 30 s | 16 s | 10 s |
| 50 | Grand Machine | 5 | 7×9, 2 | 7 | 14.0 s | 43 s | 24 s | 16 s |

Directions below are grid directions. With the default camera, north is up the screen and east is to the right.

---

## First machines (1–10)
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

## Sidings and spirals (11–20)

Junctions, sidings, rings and ramps, plus the first levels with two plates or two gates. Most need two or three moves.

### 11. Passing Place
- Marbles can't pass each other in a groove. Park one in the siding to let the other by.
- 2 marbles · fewest moves 3 · reference: NE, W, SE

### 12. Over and Under
- A groove can run under a bridge. The marble on the plate holds the gate, so it goes home last.
- 2 marbles · fewest moves 2 · reference: S, E · 2 losing openings tested

### 13. Zigzag
- A diagonal tilt carries a marble all the way down a zigzag.
- 3 marbles · fewest moves 2 · reference: SE, SW

### 14. Roundabout
- On a ring, a marble runs round to the low side, then takes the exit you tilt towards.
- 2 marbles · fewest moves 3 · reference: SE, NE, NW

### 15. Helter Skelter
- Follow the spiral down. Each ramp turns the marble round the tower.
- 1 marble · fewest moves 3 · reference: E, SW, NE

### 16. Sidings
- Three marbles, two sidings. Send each one the right way at each junction.
- 3 marbles · fewest moves 3 · reference: NE, W, SE

### 17. Double Door
- One plate can hold two gates open at once.
- 3 marbles · fewest moves 2 · reference: SE, SW · 2 losing openings tested

### 18. Downhill Swap
- Swap the marbles before either one goes down a ramp. There is no way back up.
- 2 marbles · fewest moves 3 · reference: NE, W, SE · 2 losing openings tested

### 19. Carousel
- A shut gate blocks one way round the ring. Go the other way.
- 2 marbles · fewest moves 2 · reference: NE, SE

### 20. Pendulum
- One counterweight, two plates. Swing it from one to the other.
- 2 marbles · fewest moves 3 · reference: NE, SE, NW · 1 losing opening tested

## Counterweights (21–30)

Who holds the gate, and when do they leave? Counterweights hand over to each other and two small machines share one tilt. Three to five moves.

### 21. Shift Change
- Each counterweight holds the other one's gate. Take turns.
- 2 marbles · fewest moves 3 · reference: N, W, SE · 1 losing opening tested

### 22. Handover
- Two plates can open the same gate. Hand the job over before you leave.
- 2 marbles · fewest moves 3 · reference: N, NW, SE · 1 losing opening tested

### 23. Gatekeeper
- The counterweight starts in the way. Get it onto its plate first.
- 2 marbles · fewest moves 4 · reference: SW, NE, W, SE · 1 losing opening tested

### 24. Backbone
- Green can hold the gate from down below while the others climb the spine.
- 3 marbles · fewest moves 4 · reference: NE, SW, NW, SE · 2 losing openings tested

### 25. Switchback
- Two ramps, two goals. Get the order right before anything drops.
- 2 marbles · fewest moves 4 · reference: NE, S, E, SW · 2 losing openings tested

### 26. Bridge and Siding
- Two little machines in one. Every tilt moves both.
- 4 marbles · fewest moves 4 · reference: NE, N, SW, E · 2 losing openings tested

### 27. Spiral Traffic
- Orange has to get off the spiral before blue catches up.
- 2 marbles · fewest moves 4 · reference: E, W, SE, NE

### 28. Shunting Yard
- Two marbles share a siding. The one at the back can only leave after the one in front.
- 3 marbles · fewest moves 5 · reference: SE, NE, W, SE, SW

### 29. Twin Rings
- Blue is holding the gate. Get green across to the other ring before blue goes home.
- 3 marbles · fewest moves 5 · reference: E, N, SE, NE, NW

### 30. Pendulum and Siding
- Swing the counterweight and swap the pair below. Every tilt does both.
- 4 marbles · fewest moves 5 · reference: NE, SE, NW, SW, E · 1 losing opening tested

## In order (31–40)

Delivery order matters: banded goals, a third lock (silver, link C), decks with ramps. Five or six moves, and some opening moves lose the level.

### 31. Locked Yard
- Purple's goal is past the gate, so someone else has to stand on the plate. And orange is parked in purple's siding.
- 3 marbles · fewest moves 5 · reference: NW, E, SW, E, NW · 1 losing opening tested

### 32. Crossroads
- Orange and green have to swap places, and green needs the gate. Blue can lend a hand.
- 3 marbles · fewest moves 5 · reference: NE, NW, S, E, SW · 1 losing opening tested

### 33. Ring of Bands
- Blue and green are each parked in front of someone else's goal. Blue's goal opens the gate green needs.
- 3 marbles · fewest moves 5 · reference: SE, SW, NE, NW, SE

### 34. Ring Lock
- Orange's exit has a gate, and its plate is at the bottom of the ring. Who waits there?
- 3 marbles · fewest moves 6 · reference: N, NE, S, W, SE, NW

### 35. Silver Key
- Three locks, one counterweight. Walk it from plate to plate as blue moves along.
- 2 marbles · fewest moves 6 · reference: N, NE, SE, SW, E, NW · 1 losing opening tested

### 36. Delivery Order
- Blue's goal opens the first gate and orange's the second, so green goes last. Green is parked in blue's way, though.
- 3 marbles · fewest moves 6 · reference: S, E, NW, SE, NE, SE · 1 losing opening tested

### 37. Upper Deck
- Purple starts on the plate. Blue's goal is on the far side of the gate downstairs.
- 3 marbles · fewest moves 6 · reference: NW, S, E, W, N, SW · 2 losing openings tested

### 38. Drawbridge
- One gate between two halves, a plate on each side. Cross one at a time.
- 3 marbles · fewest moves 6 · reference: NE, W, SW, NE, SW, NW · 1 losing opening tested

### 39. Ladder
- Each rung joins the two rails. A diagonal turns onto a rung; a straight tilt keeps to the rail.
- 3 marbles · fewest moves 6 · reference: N, SW, NE, SE, N, SW · 2 losing openings tested

### 40. Double Deck
- Purple holds the gate from up on the deck. Whoever comes down the east ramp needs it open.
- 3 marbles · fewest moves 6 · reference: NE, S, E, SW, E, SW · 2 losing openings tested

## Grand machines (41–50)

Harder starts on earlier machines, then the five-marble finale with the red marble. Six or seven moves; usually only one or two openings work.

### 41. Lock Below
- Blue starts on the plate upstairs, but its goal is past the gate downstairs. Hand the plate to purple.
- 3 marbles · fewest moves 6 · reference: NE, S, E, SW, NW, SE · 2 losing openings tested

### 42. High Swap
- Blue and orange have to swap ends before they go down. Nothing comes back up a ramp.
- 3 marbles · fewest moves 6 · reference: NW, S, W, S, E, SE · 2 losing openings tested

### 43. Shut In
- Blue is shut in at the bottom. Orange's goal holds the key.
- 3 marbles · fewest moves 6 · reference: N, SE, SW, NW, NE, SE

### 44. Merry-Go-Round
- Orange is standing on the plate for its own gate. Someone has to take over.
- 3 marbles · fewest moves 7 · reference: N, NE, NW, S, W, SE, NW

### 45. Rush Hour
- Blue and orange both have to cross the drawbridge, in opposite directions.
- 3 marbles · fewest moves 7 · reference: E, S, SW, N, W, SW, N · 2 losing openings tested

### 46. Night Shift
- Purple is right under the plate, but its goal is past the gate. Find someone to take its place.
- 3 marbles · fewest moves 7 · reference: E, SW, NE, S, E, NE, SW · 2 losing openings tested

### 47. Out of Order
- Blue has to go first, but orange is sitting in blue's way.
- 3 marbles · fewest moves 7 · reference: N, SE, SW, NE, SE, NE, SE · 2 losing openings tested

### 48. Deep Lock
- Nobody is on the plate yet. Choose who holds it, and who goes down first.
- 3 marbles · fewest moves 7 · reference: SW, NE, S, E, S, W, SE · 2 losing openings tested

### 49. High Wire
- Green starts right at the top of the wrong ramp.
- 3 marbles · fewest moves 7 · reference: NW, NE, SE, N, E, N, W · 2 losing openings tested

### 50. Grand Machine
- Five marbles, two floors, one lock. Everything you have learned.
- 5 marbles · fewest moves 7 · reference: NE, W, S, E, SW, NW, SE · 2 losing openings tested

---

## Notes for the next pass
- Machines are only their track blocks plus supports, with no filler. Level 9 needs one extra block to join its rows. The tests fail if any machine falls apart into separate pieces.
- Several late levels reuse an earlier machine with a harder start (34/44 on the ring, 31/46 in the yard, 36/47 with banded goals, 41/48 below the deck, 38/45 on the drawbridge, 42/49 on the high deck, 33/43 on the banded ring). Playtest whether that reads as "same puzzle again" or as a satisfying return.
- From level 34 on, most levels have exactly one shortest solution and several losing first moves. Watch the playtest log for restarts on those levels; if testers stall, move a 5-move level later or add a hint.
- Levels 10, 17, 22, 24, 26, 30 and 50 are 8–9 blocks deep, and 36 and 47 are 10 wide. They fit a portrait phone, but check readability on small screens.
- The solve times here are for direction assist on. Re-run `npm test` after any physics change, and `npm run solve` to see if move counts changed.
