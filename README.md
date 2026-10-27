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

**How it plays:** the app opens on a home screen showing your next level; press Play. Levels unlock in order.

**Controls:** drag anywhere to tilt; let go to level out. The two round buttons turn the view. On a keyboard, use the arrows or WASD (two keys for a diagonal), R to restart, and Enter on the home screen to play.

**For testers:** Settings → Reset progress starts a fresh run from level 1.

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
| `prototype/src/sim.js` | Rail physics and the rules: junctions, plates, gates, goals, marble collisions |
| `prototype/src/tilt.js` | Machine tilt, direction snapping, gravity in machine coordinates |
| `prototype/src/levels.js` | The ten levels, with reference solutions and traps |
| `prototype/src/replay.js` | Plays a solution headlessly; derives each level's timers |
| `prototype/src/config.js` | Physics and control tuning values |
| `prototype/src/render.js` | three.js scene: wood, grooves, marbles, gates, camera |
| `prototype/src/input.js` | Drag and keyboard to tilt |
| `prototype/src/main.js` | Game flow, HUD, menus, playtest log |

## Adding a level
1. Add an entry to `LEVELS` in `prototype/src/levels.js`. The comment at the top of that file explains piece rotations.
2. Write its `solution` as a list of `[direction, seconds]` steps, and any `traps` that should fail.
3. Use only the blocks the track needs; add a plain block (`blocks: [[x, y, z]]`) only where parts would otherwise float apart.
4. Run `npm test`. It reports open groove ends, overlapping blocks, a machine in separate parts, missing goals, and whether the solution works.

## Docs
- [docs/design.md](docs/design.md): decisions from the concept review (signature mechanic, rules, controls, visual direction)
- [docs/levels.md](docs/levels.md): the first ten levels
- [docs/playtest.md](docs/playtest.md): the first playtest script and go/no-go signals

## Publishing the phone build
`npm run build:artifact` writes `dist/index.html` (the page without its outer HTML wrapper). Publish it with the scripts from `prototype/src/` alongside it under `src/`.
