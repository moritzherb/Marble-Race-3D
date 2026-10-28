# Marble Machine Rush (working title)

A grey-box prototype of a mobile puzzle game: tilt a wooden marble machine so every marble reaches the goal of its colour before the clock runs out. One tilt moves every marble, but each only rolls along its own groove.

This prototype exists to answer one question before more is built: **can players predict what every marble will do when they tilt?** See [docs/playtest.md](docs/playtest.md).

## Play it
- **On a phone:** open the [published prototype](https://claude.ai/artifact/PC527UPnnTEibQb9ZzqgDa). It's private until shared from the page's Share menu.
- **Locally:**
  ```sh
  npm run serve        # then open http://localhost:8000
  ```
  It needs an internet connection the first time, to load three.js and the fonts.

**How it plays:** the app opens on a home screen with the next level turning slowly behind a big Play button: Profile top left (an icon for now), lives and coins top centre, Settings top right, Levels bottom right. From level 11 a start card offers power-ups before each level. Restart puts the marbles back at the start; the clock keeps running and it never costs a life. A win shows a Success screen with stars, time and coins (and, in the app, an ad that multiplies them); Next goes back home. Settings has Sound, Vibration (on phones that support it) and Tips toggles, plus How to play. The look is glossy, colourful and playful, with as little text as possible. There are 100 levels, and they unlock in order (during playtesting all of them are open: `TESTING.unlockAllLevels` in `prototype/src/config.js`, to switch off before release). They get steadily harder, with an extra-hard level (🔥) every seventh level from 15; the last ones take up to 11 moves.

**Lives, coins and power-ups:** you have 5 lives, and one comes back every 15 minutes, even with the game closed. Losing a level from 11 on costs one, and so does leaving one after its first 10 seconds; levels 1–10 are free. Levels pay gold coins the first time you finish them, plus bonuses for 2 and 3 stars. Coins buy lives, a second chance when time runs out, and six power-ups from level 11: Extra Time, Speed Boost, Hint, Open All Gates, Magnetic Pull and Checkpoint. The rules and numbers are in [docs/economy.md](docs/economy.md).

**Controls:** drag anywhere to tilt; let go to level out. The two round buttons turn the view. On a keyboard, use the arrows or WASD (two keys for a diagonal), R to restart, and Enter on the home screen to play.

**For testers:** Settings → Playtest tools has the level list, Reset progress (a fresh run from level 1), the clock and direction-assist options, feel tuning and the playtest log.

## Tests
```sh
npm test
```
The tests check the physics rules, and play every level's reference solution and designed traps without graphics. They need Node 20 or newer and nothing else.

## How it's built
Plain JavaScript modules. Only the renderer uses three.js; everything else runs in Node.

| File | What it does |
|---|---|
| `prototype/src/pieces.js` | The block kit: each piece's rail lines, in its own local space |
| `prototype/src/track.js` | Turns a level into a track network; adds support blocks; reports level mistakes |
| `prototype/src/sim.js` | Rail physics and the rules: junctions and crossings, plates, gates, filters, goals, stairways, sky-rail falls, marble collisions |
| `prototype/src/tilt.js` | Machine tilt, direction snapping, gravity in machine coordinates |
| `prototype/src/levels.js` | The hundred levels, with reference solutions and traps |
| `prototype/src/grid.js` | Turns a level drawn as text (levels 11 onwards) into pieces |
| `prototype/src/replay.js` | Plays a solution headlessly; the 30-second clock and each level's star times |
| `prototype/src/config.js` | Physics and control tuning values |
| `prototype/src/render.js` | three.js scene: wood, grooves, marbles, gates, filters, portals, stairways, whirls, sky rails, camera |
| `prototype/src/input.js` | Drag and keyboard to tilt |
| `prototype/src/main.js` | Game flow, home screen, HUD, level start card, Success and Time's up screens, menus, playtest log |
| `prototype/src/icons.js` | The glossy icon set (coins, hearts, stars, power-ups, buttons) |
| `prototype/src/fx.js` | Small animations: icon pops, the breaking heart, flying coins |
| `prototype/src/bonus.js` | The coin multiplier after a win (x2/x3/x5, low ones likelier) |
| `prototype/src/economy.js` | Every number for lives, coins, rewards and power-ups |
| `prototype/src/player.js` | Lives and their regeneration, gold coins, level rewards, and which attempts cost a life; one saved object |
| `prototype/src/powerups.js` | Power-up rules, charging and effects, and checkpoints |
| `prototype/src/powerbar.js` | The power-up row and its tap-to-choose tag |
| `prototype/src/route.js` | The way a marble can roll to its goal, for Magnetic Pull |
| `prototype/src/hints.js` | The Hint power-up's lookup, using the tables in `prototype/hints/` |
| `prototype/src/moves.js` | Whole moves (tilt until everything stops), shared by the game's hints and the tools |
| `prototype/src/ads.js` | Ad rules for the app builds: rewarded extra time, interstitial frequency, timeouts |
| `prototype/src/ads-admob.js` | Google AdMob (with consent) through the Capacitor plugin |
| `prototype/src/ads-sim.js` | Labelled stand-in ads for playtesting in a browser (`TESTING.simulateAds`) |

## Adding a level
1. Add an entry to `DRAWN` in `prototype/src/levels.js`. Draw each tier of the machine as rows of characters (`─ │ ┌ ┐ └ ┘ ┬ ┴ ├ ┤ ┼` for grooves, `*` or `╴ ╵ ╶ ╷` for dead ends, `b o g p r` for goals, `A B C` for plates, `1 2 3` for their gates, `x y z` for shutters, `> < v ^` for ramps, `⇒ ⇐ ⇓ ⇑` for stairways, `ⓑ ⓞ ⓖ ⓟ ⓡ` for colour filters, `% &` for portal pairs, `@` for a whirl, `━ ┃` and `╸ ╹ ╺ ╻` for sky rails). The full key is at the top of `prototype/src/grid.js`.
2. Use only the blocks the track needs; add a plain block (`#`) only where parts would otherwise float apart. Wood may only sit on top of a straight groove, which then becomes a visible tunnel; wood over a curve, junction or ramp is reported as an error.
3. Run `npm run solve -- <level number>`. It prints the fewest moves, which opening moves make the level unwinnable, and a tight reference solution to paste in as `solution`. Add a losing opening as a `trap`.
4. Run `npm run audit -- <level number>`. It checks that every lock has a purpose (jamming it open must make the level shorter or break every shortcut), that no gate, plate or goal goes unused, and how forgiving the level is.
5. Run `npm test`. It reports open groove ends, overlapping blocks, a machine in separate parts, missing goals, whether the solution and traps behave, and whether a marble reaches every gate.

## Level tools
Node scripts in `tools/` that the levels were built and checked with:

| Script | What it does |
|---|---|
| `solve.mjs` (`npm run solve -- N`) | Shortest solution, losing openings and a tight reference run for level N |
| `audit.mjs` (`npm run audit -- N`) | Full move graph: how many solutions, how many positions are dead, what each lock does, which pieces go unused |
| `generate.mjs` | Given a hand-drawn machine with candidate spots, searches goal, plate, gate and marble placements for the hardest fair puzzle it can hold |
| `finalize.mjs` | Removes unused dead ends, finds a reference run a person can repeat, adds traps and sets the time factor |
| `prune.mjs` | Map editing helpers used by `finalize.mjs` |
| `hints.mjs` | Builds the Hint tables in `prototype/hints/`: every position a level can reach, with the best next tilt. Re-run after changing a level or the physics; `npm test` says when they're out of date |

A level only ships if every lock has a purpose, nothing in it goes unused, and its reference solution still wins when the holds and pauses are made longer and less precise, the way a person plays.

## Android and iOS apps
The game is a web page; [Capacitor](https://capacitorjs.com) wraps it in native apps. `android/` is an Android Studio project and `ios/` an Xcode project. Neither has been built in this repo's cloud environment yet.
```sh
npm install
npm run cap:sync        # builds www/ (the game with three.js bundled) and copies it into both apps
npx cap open android    # or: npx cap open ios (needs a Mac)
```
The apps show Google AdMob ads, test ads only for now: an optional rewarded ad for more time when the clock runs out, and an interstitial at most every three levels. The browser version has no ads. See [docs/ads.md](docs/ads.md) for setup, privacy and how to test.

## Docs
- [docs/design.md](docs/design.md): decisions from the concept review (signature mechanic, rules, controls, visual direction)
- [docs/levels.md](docs/levels.md): all hundred levels, with timings, move counts and what each lock does
- [docs/playtest.md](docs/playtest.md): the first playtest script and go/no-go signals
- [docs/economy.md](docs/economy.md): lives, gold coins, the second chance and power-ups: rules, prices, the reasoning, and test checklists
- [docs/ads.md](docs/ads.md): what the project supports for mobile ads, the AdMob setup, privacy and store disclosures, and test steps

## Publishing the phone build
`npm run build:artifact` writes `dist/index.html` (the page without its outer HTML wrapper). Publish it with the scripts from `prototype/src/` alongside it under `src/`.
