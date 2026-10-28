# Lives, gold coins and power-ups

Design specification for the player resource system. Every number here lives in one file, `prototype/src/economy.js`, and is meant to be tuned through playtesting.

## Principles

- **Skill first.** Power-ups and continues help near the end of a hard attempt; they can't replace solving the machine. Each has a per-attempt limit.
- **One failure, one life.** Nothing charges a life twice, and paying coins never also costs a life.
- **Nothing to grind.** Coins come from progress: the first completion of a level, and the first time each star is reached. Replaying a finished level pays nothing.
- **Honest numbers.** The heart counter, the countdown to the next life and the coin balance are always the real values, recomputed from saved timestamps.
- **Free players finish the game.** Lives come back on their own, levels 1–10 never cost a life, and coins from normal play buy plenty of help.

## Lives

| Rule | Value |
|---|---|
| Maximum lives | 5 |
| Lives at first launch | 5 |
| One life comes back every | 15 minutes, while below 5 |
| At 5 lives | the countdown stops and nothing accumulates |
| Levels that never cost a life | 1–10 (the teaching levels) |
| Playing a level from 11 on needs | at least 1 life |
| Free window for leaving a level | the first 10 seconds of play in an attempt |

### What costs a life

An **attempt** is one try at a level, from the start (or from a restored checkpoint) to a win or a loss.

| Event | Life |
|---|---|
| Completing the level | none |
| The clock runs out, and the player accepts it (Try again, Home, Back to checkpoint) | −1 |
| The clock runs out, and the player continues with coins or a rewarded ad | none for now; the same attempt carries on |
| The continued attempt runs out of time again | −1 (one failure, one life) |
| Restart (the marbles go back to the start; the clock keeps running) | none: it's the same attempt |
| Home or another level within the first 10 s of play | none |
| Home or another level after that | −1, after a confirmation that says so |
| Closing the game mid-attempt after the first 10 s, or on the Time's up card | −1, charged at the next launch, with a message saying why |
| Watching the reference solution | none |
| Restoring a checkpoint after a loss | −1 for the loss, then the restored attempt carries on |

A loss is recorded once: the attempt is marked as lost in the save, and charging it clears the mark. That's why a repeated event, or a crash between the two, can't charge twice.

### Regeneration (works with the game closed)

The save holds `lives` and `regenFrom`, the time the current 15-minute period started; `regenFrom` is empty at 5 lives.

- **Reading lives:** `gained = floor((now − regenFrom) / 15 min)`.
  - `lives` becomes `min(5, lives + gained)`.
  - `regenFrom` moves on by `gained × 15 min`, or is cleared at 5.
- **Losing a life at 5:** the countdown starts now.
- **Losing a life below 5:** the countdown already running carries on; losing doesn't reset it.
- **Buying a life:** it's added at once; the running countdown is unchanged, and it's cleared if that reaches 5.
- **Clock moved backwards** (`now` earlier than `regenFrom`): `regenFrom` is set to `now`, which grants nothing and restarts that period.

Example: 2 lives, and the game is closed for 30 minutes. On return there are 4 lives, and the countdown shows whatever was left of the third period.

### Displays

- **Home and level list:** "♥ 3/5 · Next life in 08:42", or "♥ 5/5 · Full".
- **In a level:** "♥ 3" under the Home button.
- **With no lives:** the out-of-lives card. It shows 0/5, the countdown, Buy a life (with the price, disabled with "You have N" if unaffordable) and Wait. From level 11 on, Play opens this card instead of the level.

## Gold coins

A gameplay currency, earned by playing and never sold for money. A real-money currency, if one ever comes, would be a separate balance.

### Earning

| Source | Coins |
|---|---|
| First launch | 200 |
| First completion of a level | the level's **base** reward |
| First time with 2 stars | + half the base, rounded to 5 |
| First time with 3 stars | + half the base, rounded to 5 |
| Replays | only star bonuses not yet earned; nothing after 3 stars |
| A hard level (🔥, about one in seven) | everything above × 1.5, rounded to 5 (`rewards.hardFactor`) |

The base reward rises with the chapter, because the levels are ordered by difficulty:

| Levels | 1–10 | 11–20 | 21–30 | 31–40 | 41–50 | 51–60 | 61–70 | 71–80 | 81–90 | 91–100 |
|---|---|---|---|---|---|---|---|---|---|---|
| Base | 20 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 |
| Each star bonus | 10 | 15 | 20 | 20 | 25 | 25 | 30 | 30 | 35 | 35 |
| With all stars | 40 | 60 | 75 | 80 | 95 | 100 | 115 | 120 | 135 | 140 |

Over the whole game that is 4 700 coins for completions and 9 600 with every star, plus the 200 at the start. Levels finished before coins were added count as already paid, so they only pay for stars not reached yet.

#### Proposed rewards, levels 1–20 (provisional)

Difficulty is the fewest whole moves the solver needs.

| Level | Name | Difficulty | Base | 2-star bonus | 3-star bonus | Total possible |
|---|---|---|---|---|---|---|
| 1 | First Tilt | 1 move, teaching | 20 | 10 | 10 | 40 |
| 2 | Two Grooves | 1 move, teaching | 20 | 10 | 10 | 40 |
| 3 | Fork in the Road | 2 moves, teaching | 20 | 10 | 10 | 40 |
| 4 | Downhill Only | 3 moves, teaching | 20 | 10 | 10 | 40 |
| 5 | Counterweight | 2 moves, teaching | 20 | 10 | 10 | 40 |
| 6 | Hold the Door | 2 moves, teaching | 20 | 10 | 10 | 40 |
| 7 | Blue Goes First | 3 moves, teaching | 20 | 10 | 10 | 40 |
| 8 | Underpass | 2 moves, teaching | 20 | 10 | 10 | 40 |
| 9 | Chain Reaction | 3 moves, teaching | 20 | 10 | 10 | 40 |
| 10 | The Machine | 3 moves, teaching | 20 | 10 | 10 | 40 |
| 11 | Crossroads | 4 moves | 30 | 15 | 15 | 60 |
| 12 | Off the Plate | 4 moves, new piece | 30 | 15 | 15 | 60 |
| 13 | Bridge and Siding | 4 moves | 30 | 15 | 15 | 60 |
| 14 | Two Doors, One Key | 4 moves | 30 | 15 | 15 | 60 |
| 15 | Summit | 6 moves, hard | 45 | 25 | 25 | 95 |
| 16 | Ring Pair | 4 moves | 30 | 15 | 15 | 60 |
| 17 | Colour Check | 4 moves, new piece | 30 | 15 | 15 | 60 |
| 18 | Backbone | 4 moves | 30 | 15 | 15 | 60 |
| 19 | Gatekeeper | 4 moves | 30 | 15 | 15 | 60 |
| 20 | H-Frame | 6 moves | 30 | 15 | 15 | 60 |

A player with mostly two-star finishes has about 975 coins at level 20, enough to try every power-up a few times.

### Spending and prices

| Item | Price | What you get | Limit |
|---|---|---|---|
| A life | 150 | +1 life (up to 5) | any time below 5 |
| Second chance | 90 | +15 s after the clock runs out | once per attempt |
| Extra Time | 60 | +10 s now | once per attempt |
| Speed Boost | 50 | all marbles 60% faster for 10 s | once per attempt |
| Hint | 80 | which marble to move next, and where it will go | 3 per attempt |
| Open All Gates | 140 | every gate and shutter open for 5 s | once per attempt |
| Magnetic Pull | 160 | one marble pulled towards its own goal for 5 s | once per attempt |
| Checkpoint | 220 | save this moment; after a loss, resume from it once | one saved at a time |

**Why these prices:**

- **Help tracks earnings.** The cheap helpers (Speed Boost, Extra Time) cost about two early levels' base reward. The strong ones (Magnetic Pull, Checkpoint) cost about two late levels' full rewards.
- **Lives are worth buying but not cheap.** A life costs about what you earn from two late levels with stars.
- **A second chance is a good deal.** It costs less than a life (90 vs 150) and keeps the attempt going. Using it near the end of a close attempt is the smart move it should be.
- **Help never spirals into debt.** A player who loses every life still has whatever they earned, and the lives refill on their own.
- **Coins can't fix bad play forever.** The per-attempt limits keep the challenge.

## Second chance

**Offered:** only on the Time's up card, after a real time-out. It's never offered after a voluntary restart.

The card's options, in order:

- **Continue · 90 coins:** +15 s, same attempt. It's one tap with the price on the button, and the button says what happens. If unaffordable, it shows "You have N" and is disabled.
- **Watch an ad · +20 s:** in the app builds only (see [ads.md](ads.md)).
- **Back to checkpoint · −1 life:** only if a checkpoint is saved.
- **Try again · −1 life** and **Home · −1 life:** these accept the loss.

**Rules:**

- The machine resumes exactly where it stopped: marbles, gates and plates, with the clock at 15 s.
- One coin continue and one ad continue per attempt. Once both are used, the only way on is a new attempt.

**Does continuing cost a life? No.**

| Option | Verdict |
|---|---|
| Coins only; a later loss costs the normal life | **Chosen.** One failure costs one life, whichever way it ends. Paying for time is clearly the alternative to losing a life, not an addition to it. |
| Coins and a life | Charges twice for the same failure. It feels like a trap and discourages the feature. |
| A life instead of coins (trade a heart for time) | Mixes the two resources and makes lives confusing. It would also let a player at 1 life keep going for free. |
| Free | Removes the clock as a challenge. |

## Power-ups

**When they're available:** they unlock at level 11, after the teaching levels. From then on the level start card offers four of them before the level begins. They only work while a level is being played: not on cards, not during the reference solution, and not after a win.

**Charging:**

- Coins are taken in the same step that turns the effect on. If activation can't happen, nothing is charged.
- The usual cases are no route to the goal, no hint from this position, the per-attempt limit already reached, or not enough coins.

**Timed effects:**

- **Timing:** they run on play time, so they pause with the game, and they end when the level ends.
- **Display:** a meter under the token empties as the effect runs.

### 1. Extra Time

- +10 s on the clock at once. A "+10 s" tag flashes by the clock, and the clock can go above its starting value.
- Once per attempt.

### 2. Speed Boost

- **Effect:** for 10 s, every marble rolls 60% faster. Gravity along the groove and the speed cap are both multiplied by 1.6; drag and bounces are unchanged.
- **All marbles:** one tilt moves every marble anyway, so boosting one would be hard to read and no fairer.
- **Safe at speed:**
  - The fastest marble moves 0.08 blocks per physics step, less than half a marble.
  - Gates are crossing-checked, goals are reached by the groove's end, and plates by position.
  - Nothing can skip a goal or tunnel through a gate.
- **Visual:** marbles get a warm glow, and a flickering lightning bolt lies under each one, pointing the way it rolls.

### 3. Hint

**What it shows:**

- **The marble:** a white ring around the marble that matters most in the best next tilt (one that reaches its goal with it, otherwise the one that rolls furthest).
- **Where it goes:** a trail of glowing dots along the grooves from that marble to where the tilt leaves it, with a see-through marble and a ring at the end. The trail comes from the same physics the game runs.
- **The tilt:** a smaller arrow lying over the machine shows the direction. Everything is drawn in the machine's own space, so it stays correct when the view is turned.
- **How long:** 5 s.
- **The limit:** up to 3 per attempt.

**Where it comes from:**

- **The table:** `tools/hints.mjs` explores every position each level can reach by whole moves (tilt one way until everything stops, then let go). The solver and the audit use the same physics code.
- **What's stored:** for each position, the best direction and the moves left. Positions that can no longer be won are marked.
- **At play time:**
  1. The game looks up the current position.
  2. If the player let go mid-roll, so the marbles aren't where a whole move would leave them, it tries each direction from here with the real physics and looks the results up.
- **The guarantee:** the hint never relies on a guess about the physics.

**When there's no hint (no charge):**

| Situation | What the player sees |
|---|---|
| The position can't be won any more (only said when the table covers the whole level) | "From here this level can't be won any more. Restart to try again." |
| Not found one or two moves out | "No hint from this position. Let the marbles settle and try again." |
| Feel settings changed in Playtest tools | "Hints need the default feel settings." |

### 4. Open All Gates

- **Effect:** for 5 s, every gate and every striped shutter stands open.
- **Plates:** they keep working underneath. Their cables still show what they're really doing, so the player can see which gates will stay open.
- **When the effect ends:** each gate goes back to what its plate or goal says. A gate closing on a marble pushes it to the side it's on (the normal rule), so nothing gets stuck inside a gate.
- **All gates are eligible:** there are no switches or moving platforms in the game yet.
- Once per attempt.

### 5. Magnetic Pull

**Using it:**

1. Tap the magnet.
2. Pick a marble from the colour buttons that appear. Cancel is free.
3. That marble gets a soft halo, and for 5 s it is pulled along its groove towards its own goal.

**How the pull works:**

- **Strength:** a pull equal to 60% of a full tilt (about 2 blocks a second on a level machine). It's added to the tilt for that marble only, so the player's own tilt can overpower it.
- **Which way:** it follows the shortest route through the track that a marble can actually take. That route goes only through open gates and only down ramps.
- **Near a junction:** the pull points along the route's next branch, so the marble turns the right way.

**What it never does:**

- Move a marble through wood, a closed gate or another marble. Those stay physical, as always.
- Lift a marble up a ramp.
- Pull towards a goal of the wrong colour.

**Ends when:** the marble is delivered, 5 s pass, or the level ends. If a gate on the route shuts, the pull pauses until a route opens again.

**When it can't be used (no charge):**

- **Can't be used:** the marble is already home, or has no open route to its goal right now. The message is "Blue can't reach its goal from here right now".
- **Too far:** the route is longer than 12 blocks. The message is "Blue's goal is too far away".

Once per attempt.

### 6. Checkpoint

**Saving:**

- **What it saves:** a copy of the moment. That means:
  - every marble's groove, position, speed and delivered state;
  - gates, plates and goals;
  - the machine's tilt;
  - the clock (time left and time played).
- **Exactness:** the physics is fully described by these numbers, so restoring is exact. No physics bodies need re-syncing.
- **The token:** stays lit while a checkpoint is held. The banner and the restore button show the saved time ("Back to checkpoint · 0:14").

**Restoring:**

- **Where:** offered on the Time's up card and on the give-up confirmation, as **Back to checkpoint · −1 life**.
- **What it costs:** the life for the loss, then nothing more.
- **What happens:** the game restores the saved moment and the saved time, which is never more than when it was saved. Active power-ups end, and the machine eases back to level until the player tilts.
- **It needs a life to keep playing:** at least 1 left after paying for the loss, unless it's one of levels 1–10.

**Limits:**

- One restore per checkpoint, and one checkpoint saved at a time.
- A checkpoint is dropped by a win, trying again after a loss, leaving the level, or closing the game.

### Considered and not included yet

| Idea | Verdict |
|---|---|
| Slow Motion | Overlaps with Extra Time: the clock is the only pressure, and slower marbles mean less progress per second. |
| Safety Net | Marbles can't fall off in this game, so there is nothing to catch. |
| Gate Control (open one chosen gate) | A good later addition, but it needs gate picking on screen. Open All Gates covers the need for now. |
| Time Freeze | Stopping the clock while marbles move is Extra Time with extra rules. |

## Interface

The style is a casual, playful mobile game: glossy, colourful icons (coin, heart, stars and one for each power-up, all in `icons.js`), chunky buttons, bright indigo cards with a gold trim, the round Baloo 2 font, and as little text as possible. Feedback is shown, not explained: a power-up's icon pops up when it starts, "+10s" floats up when time is added, and a heart cracks in two and falls with "−1" when a life is lost.

- **Home screen:**
  - **Top left:** Profile (only the icon for now; a later update).
  - **Top middle:** ♥ lives (with the next-life countdown, opens the lives card) and coins, side by side.
  - **Top right:** Settings.
  - **Middle:** the game's name, the next machine turning slowly behind it, and "Level N" above a big green Play button. A hard level shows a flame and "Hard".
  - **Bottom right:** Levels.
  - **After a win,** Next brings the player here: the level number rolls on to the next one and the machine springs into place.
- **Level start card** (from level 11): Play on the home screen opens it over the home screen, with the machine still turning behind it. It shows the level number, the stars earned so far, the time limit, and four power-ups to take into the level (Extra Time, Speed Boost, Hint, Open All Gates). Tap a tile to pick it (a green tick), tap again to drop it. Picks that the coins can't cover shake instead. Its Play button starts the level: the coins are taken, and the picked power-ups pop on one after another in the row at the bottom. Each counts as that power-up's use for the attempt.
- **Top of a level:** Pause (Resume, Home, Settings) on the left; ♥ lives, the clock and coins together in the middle.
- **Bottom of a level:**
  - **The power-up row:** six tiles, each with its icon and price, above the view and Restart buttons. The tiles sit outside the 3D canvas, so a drag that tilts the machine can't press one, and a tap on a tile never tilts the machine.
  - **Tile states:** ready, too expensive (price in red), used up (grey), active (glow and a draining meter), or saved (Checkpoint).
  - **Tap to choose, tap again to use:** the first tap opens a small tag above the row with the name, a few words on the effect and a Use button. A second tap on the same tile, or Use, buys it. A stray tap never spends coins.
  - **Restart** puts every marble back where it started, for instance after one went into its goal too early. The clock keeps running, power-ups already used stay used, and it never costs a life.
- **Success (a win):** it appears about a fifth of a second after the last marble goes in. "Success" in gold, the stars pop in, and a panel shows the time and the coins won, which fly to the coin counter. Next goes home. With ads available, a bar of multipliers (x2 x3 x5 x3 x2) sits under the panel with a pointer sweeping across it, and the blue ad button shows the coins the ad would pay where the pointer is, changing as it moves. After the ad, the pointer lands on a multiplier drawn by chance (`winMultiplier` in `economy.js`: x2 60%, x3 30%, x5 10%, about x2.6 on average), and the extra coins are paid. "Play again" under Next replays the level.
- **Time's up:** a shaking clock and the marbles that made it home, then the ways to carry on: +15s for 90 coins, +20s for an ad, or back to a checkpoint. Home and Try again carry a "−1 ♥" tag when the loss costs a life, and the heart breaks when one of them is pressed.
- **Lives, coins:** a big heart with the count and the countdown, or a big coin with the balance. "+1 ♥ for 150 coins" when lives aren't full.
- **Level list:** numbered tiles with their stars: green when done, red with a flame for hard levels, grey with a padlock when locked.
- **Tips:** a few words at the start of levels that bring in something new (`TIPS` in `levels.js`), and none elsewhere. Settings → Tips turns them off.

## Architecture

| File | Job |
|---|---|
| `prototype/src/economy.js` | All rules and numbers (this page's tables), no logic |
| `prototype/src/player.js` | The resource manager: lives and regeneration, coins, level rewards, attempts and loss charging, first-time flags. One saved object, every change written in a single step |
| `prototype/src/powerups.js` | Power-up rules and effects: limits per attempt, activation checks, timed effects, applying them to the simulation, checkpoints |
| `prototype/src/route.js` | Shortest open route along the track, for Magnetic Pull |
| `prototype/src/hints.js` + `prototype/hints/*.json` | Hint lookup and the per-level tables |
| `prototype/src/sim.js` | Three small hooks: `sim.speedScale`, `gate.forced` and `marble.pull` |
| `prototype/src/render.js` | Hint ring, trail and arrow, Speed Boost bolts, marble halo and glow, gate cables lit by what plates really do |
| `prototype/src/main.js` | Screens and cards: HUD, power-up row, home screen, level start card, Success and Time's up |
| `prototype/src/icons.js`, `fx.js` | The icon set, and the little animations (pops, the breaking heart, flying coins) |
| `prototype/src/bonus.js` | The win multiplier: draws x2/x3/x5 with the configured chances |

### Saved data (`localStorage['mmr-player']`)

```js
{
  v: 1,                        // format version, for later migrations
  lives: 3,
  regenFrom: 1767000000000,    // ms; null at 5 lives
  coins: 450,
  paid: { 'level-id': 2 },     // star tier already paid per level: 1 = completion, 2, 3
  attempt: { level: 'level-id', staked: true, lost: false },   // or null
  seen: { lives: true, coins: true, powerups: false },
  log: [{ t, kind: 'earn' | 'spend' | 'life', amount, why }],  // last 50, for support and tests
}
```

Level progress and stars stay where they were (`mmr-progress`).

**Safe updates:**

- **One write per change:** every change is a single read–change–write of the whole object. Browser JavaScript is single-threaded and `localStorage` writes are synchronous, so a purchase is written completely or not at all.
- **No double charges:** a purchase checks and deducts in the same step as it applies the item. The buttons also lock while a purchase runs.
- **No double rewards:** rewards pay only star tiers above `paid`, so a repeated completion event pays nothing.

### Attempt flow

- **Starting a level:**
  - It needs a life (from level 11 on). `attempt` is set to `{ staked: false }`.
  - After 10 s of play it becomes `staked`.
- **The clock runs out:**
  - `lost` is set. The Time's up card can clear it (a continue) or charge it (accepting the loss).
- **A win:** clears the attempt with no charge.
- **Restart:** the same attempt carries on; nothing changes.
- **Leave (Home or another level):**
  - while `staked`, the attempt is charged after a confirmation;
  - otherwise it's cleared for free.
- **At launch:** an attempt left `staked` or `lost` is charged once, with a note.

### Limits of local saving

- **Clock cheating:** moving the device clock forward refills lives early. Moving it back is caught, as above.
- **Losing the save:** clearing site data, reinstalling or switching devices loses coins and progress.

### Going online later

To add cloud saves or server checks:

1. Keep `player.js`'s interface.
2. Swap its storage for a sync layer that sends the same object, plus the change log, to a server.
3. Let the server own `coins` and `regenFrom`, using server time for regeneration, and validate rewards against completed levels.

Nothing in the game code outside `player.js` needs to change.

## Edge cases and tests

| Case | Behaviour | Test |
|---|---|---|
| Losing at 0 lives | Impossible: a level from 11 on can't start with 0 lives, and a loss charges the attempt's own life | player.test |
| One life back after 15 min | lives +1, countdown restarts from the remainder | player.test |
| Reaching 5 | countdown cleared; later losses start a fresh 15 min | player.test |
| Closed for 30 min at 2 lives | 4 lives on return | player.test |
| Reaching 5 while a countdown runs | extra time is dropped, not banked | player.test |
| Clock moved back | no lives granted; period restarts | player.test |
| Buying a life without coins, or at 5 | refused, nothing charged | player.test |
| Buying a power-up without coins | refused, nothing charged, token says why | powerups.test |
| Activating a power-up twice | second tap refused (limit or already active), one charge | powerups.test |
| Failing after a second chance | one life for the attempt, not two | player.test |
| Winning with a power-up active | effects end, reward paid once | powerups.test |
| Leaving in the free window, and after it; Restart at any time | free, −1 with a confirmation; free | player.test + browser check |
| Repeated completion event | second call pays nothing | player.test |
| Closing the game mid-attempt or on the Time's up card | charged once at the next launch, with a note | player.test |
| Interrupted purchase | single write: coins and item change together or not at all | player.test |
| Save and load | round-trips; a damaged save falls back to defaults | player.test |
| Checkpoint restore | exact marble, gate and clock state; once only; −1 life | powerups.test |
| Checkpoint across levels | dropped on leaving or restarting | powerups.test |
| Magnetic Pull | straight and curved approach, closed gate, no route, tilt against it, delivered early, expiry | powerups.test |
| Hint tables | each level's start position is listed with its fewest moves, and following the hints wins in that many moves | hints.test |

## How it was built, and how to check each part

The system went in as five steps, each tested before the next. To check one by hand:

1. Start the game with `npm run serve` and open http://localhost:8000.
2. Use **Settings → Playtest tools** to set lives and coins:
   - **Lives:** −1, Skip 15 min, Fill and Reset.
   - **Gold coins:** +500.
3. Run `npm test` for the automated checks.

### Step 1: lives and regeneration

**Files:**

- `economy.js` (the `lives` section)
- `player.js`
- `main.js`: the heart in the HUD, the home token, and the Lives, Out of lives and Restart this level? cards
- `prototype/test/player.test.js`

**Checklist:**

- [ ] Home shows ♥ 5/5 · Full. Lose a life: it shows 4/5 and a 15:00 countdown that ticks.
- [ ] Playtest tools → Skip 15 min brings the life back, and the countdown disappears at 5/5.
- [ ] In level 11 or later, Home within 10 s is free; after 10 s it asks first and costs a life. Restart is always free: the marbles go back to the start and the clock keeps running.
- [ ] Let the clock run out: the card says what accepting costs, and Try again takes exactly one life.
- [ ] At 0 lives, Play on level 11+ opens Out of lives. Levels 1–10 still play.
- [ ] Reload the page mid-level, after 10 s of play. A note says a life was used, and only once.

### Step 2: gold coins

**Files:**

- `economy.js` (the `coins`, `rewards` and `prices` sections)
- `player.js` (`grantLevel`, `pay`, `buyLife`)
- `main.js`: the coin pill and token, the reward on the win card, coins left in the level list, Buy a life

**Checklist:**

- [ ] A new player has 200 coins.
- [ ] A first completion with 3 stars on level 11 pays 30 + 15 + 15. Playing it again pays nothing.
- [ ] The level list shows "+60" on a level not yet played.
- [ ] Buy a life takes 150, adds a life, and a double tap buys only one. With too few coins the button is disabled and says how many you have.

### Step 3: second chance

**Files:**

- `economy.js` (`secondChance`)
- `main.js` (the Time's up card)

**Checklist:**

- [ ] When time runs out, Continue +15 s · 90 resumes the same machine with 15 s and the same lives.
- [ ] It's offered once per attempt. Running out again costs one life.

### Step 4: power-up row, Extra Time, Speed Boost, Hint, Open All Gates

**Files:**

- `powerups.js`
- `powerbar.js`
- `hints.js` with `prototype/hints/` (built by `tools/hints.mjs`)
- `sim.js` (`speedScale`, `gate.forced`)
- `render.js` (the hint arrow and the marble glow)

**Checklist:**

- [ ] Level 11 opens with the level start card. The row sits under the machine.
- [ ] The first tap on a token opens its tag without spending. A second tap uses it.
- [ ] Extra Time adds 10 s once. Speed Boost glows the marbles, with a bolt under each, for 10 s. Open All Gates lifts every gate for 5 s, then they return to what the plates say.
- [ ] Hint rings one marble and draws a dotted trail to where the next tilt takes it, with a small arrow for the tilt. After a losing first move it says the level can't be won from here, and charges nothing.

### Step 5: Magnetic Pull and Checkpoint

**Files:**

- `route.js`
- `powerups.js` (`magnet`, `checkpoint`, `snapshotOf`, `restoreInto`)
- `main.js` (the picker and Back to checkpoint)
- `render.js` (the halo)

**Checklist:**

- [ ] Magnetic Pull asks which marble, and Cancel is free. A marble behind a shut gate is refused with no charge. A pulled marble gets a gold halo and heads for its goal. A full tilt the other way still wins.
- [ ] Checkpoint saves with the time shown. Let the clock run out: Back to checkpoint · −1 ♥ restores the moment and the time, once. With only one life left it's disabled and explains why.
- [ ] Finishing or leaving the level drops the checkpoint; Restart keeps it.

### What the automated tests cover

| File | What it checks |
|---|---|
| `player.test.js` (27 tests) | Regeneration, including closed for 30 minutes, the cap at 5 and the clock moved back. What costs a life, and never twice. Charging at relaunch. Rewards and replays. Buying with too few coins. Interrupted purchases. Damaged saves |
| `powerups.test.js` (20 tests) | Each power-up's effect, price and limit, and refusals that cost nothing. Boosted marbles staying on their grooves. Gates returning after Open All Gates. The pull: straight and curved approaches, closed gate, ramps, tilting against it, expiry. Checkpoints restoring exactly and continuing identically |
| `hints.test.js` | Every level's table matches its machine. Following the hints wins each level in its fewest moves. Lost positions are recognised |

## Tuning (for beginners)

Open `prototype/src/economy.js`. Every value has a comment. Common changes:

- **Make lives come back faster:** change `lives.regenMinutes`.
- **Change what a level pays:** edit `rewards.baseByChapter` (one number per ten levels) or `rewards.starBonus` (a fraction of the base).
- **Change a power-up's price, duration or limit:** edit its entry in `powerUps`.

Run `npm test` after any change, then play a level to see it. The prices on the buttons and cards come from this file, so they update everywhere at once.

To add a power-up later:

1. Add an entry to `powerUps` in `economy.js`.
2. Write its `activate`/`tick`/`end` in `powerups.js`.
3. Add an icon in `main.js`'s `POWER_ICONS`.

The bar, prices, limits and charging are shared.

## Future updates

- **More power-ups:** each one is a config entry plus a small effect handler.
- **Worlds and level packs:** rewards are by chapter, so a new world adds a row to `baseByChapter`. Packs can be unlocked with an `owned` list in the save.
- **Cosmetics (marble skins, wood finishes):** a `cosmetics` section in the save and a price list. The renderer already takes colours and wood tints as parameters.
- **New gates and mechanisms:** Open All Gates acts on whatever is in `sim.gates`. New mechanism types decide whether they're eligible.
- **Daily challenges:** a daily level and a coin bonus fit the existing `earn` call. A date check belongs in `player.js`.
- **Real money:** a premium balance would be a separate field and never convert into gold coins silently. A one-time "no forced ads" purchase is a flag the ad rules read.

## Monetization and fairness

- **Free-to-play:** ads plus optional purchases. Paying is never required to finish a level.
  - Every level can be finished with no power-ups; the reference solutions prove it.
  - Lives come back on their own.
  - Coins from normal play cover regular help.
- **Rewarded ads:** they fit as an alternative to coins (a life, a second chance), never as the only way.
  - The app builds already offer an ad for extra time after a time-out.
  - An ad for a life would plug into the out-of-lives card the same way. It isn't built yet.
- **Interstitials:** they stay between levels only (every 3 levels from 11, see [ads.md](ads.md)), never during play.
- **Balancing retention against scarcity:**
  - **Scarcity:** lives pace sessions without blocking them. Five failures, then a short break, and the teaching levels are always free.
  - **Rewards:** these come from progress and skill (stars), not repetition.
  - **Prices:** these make help a decision ("is this attempt worth 90?") rather than a habit.
  - **Difficulty:** it rises smoothly; no level is a wall designed to sell help.
  - **What to watch:** after playtesting, if many players sit at 0 lives and 0 coins on the same level, the fix is that level or the regen time, not a cheaper purchase.
