# First playtest: can players predict the marbles?

This tests the single biggest risk before any more art or content: **can a first-time player, under a countdown, predict what every marble will do before they tilt?**

## Who and how many
- Five people who have never seen the game. Not developers, and not people who already love puzzle games.
- Their own phones if possible. Send them the prototype link.

## Procedure (about 15 minutes each)
1. Before each new tester, open Settings, tap Reset progress twice (levels unlock in order, so everyone starts at level 1), and clear the log once you have copied it.
2. Give no instructions beyond "this is a puzzle game, think out loud". The level hints are part of the test.
3. Let them press Play and continue through levels 1–6.
4. **Prediction check:** on levels 2, 5 and 6, pause them before a move (Settings pauses the clock). Ask "what will each marble do if you drag that way?", then let them do it. Note whether they were right.
5. **Timer variant:** let half the testers play with *Clock starts: When it appears* (the default) and half with *On first tilt*. Switch it in Settings before they start.
6. At the end, open Settings, then *Copy log*, and paste the log into a file named after the tester.

## What to watch for
- Do they drag deliberately, or shake the phone at random?
- Can they say why they failed?
- Do they restart on their own after a failure?
- Did they notice that marbles in other grooves stay still?
- Did they understand the plate and gate in level 5 without help?

## Questions afterwards (1–5 scale, plus "why?")
1. I could tell what the marbles would do before I tilted.
2. When I failed, I knew why.
3. The timer made it more exciting rather than more frustrating.
4. Dragging to tilt felt precise.
5. I wanted to play another level.

## Reading the result
These are small-sample signals, not proof. Use them to decide what to change, not to forecast the market.

- **Keep going:** 4 of 5 testers predict correctly on levels 5–6, at most 1 resorts to random shaking, and most rate questions 1 and 2 at 4 or more.
- **Change the controls:** prediction is right but questions 4 scores are low, or they fight the drag. Try direction assist off/on and the tuning sliders.
- **Change the timer:** frustration on question 3, or the first-tilt group clearly enjoys it more.
- **Change the levels:** failures cluster on one level, or the log shows many restarts at the same place.
- **Rethink the signature mechanic:** most testers still can't predict multi-marble moves after level 6. Fall back to single-marble levels with mechanisms.

## What the log records
One entry per attempt, with these fields:
- level and result (won, time-up, restarted, left)
- seconds, number of drags, stars
- marbles delivered out of the total
- timer variant, and whether direction assist was on
