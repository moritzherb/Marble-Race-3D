// Every rule and number for lives, gold coins and power-ups, in one place to tune after
// playtesting. docs/economy.md explains the reasoning; nothing here holds logic.

export const ECONOMY = {
  lives: {
    max: 5, // the most lives a player can hold
    start: 5, // lives at first launch
    regenMinutes: 15, // one life comes back this often while below max, also with the game closed
    freeLevels: 10, // levels 1-10 teach the game and never cost a life
    freeRestartSeconds: 10, // restarting or leaving within this much play time is free
  },
  coins: {
    start: 200, // gold coins at first launch
  },
  rewards: {
    levelsPerChapter: 10,
    // Coins for completing a level the first time, by chapter (levels 1-10, 11-20, ...).
    baseByChapter: [20, 30, 35, 40, 45, 50, 55, 60, 65, 70],
    // Paid once each, the first time a level reaches 2 stars and 3 stars: this fraction of the base.
    starBonus: 0.5,
  },
  prices: {
    life: 150,
  },
  // After the clock runs out: pay to carry on the same attempt. It doesn't cost a life.
  secondChance: { cost: 90, seconds: 15, perAttempt: 1 },
  powerUps: {
    unlockLevel: 11, // the power-up row appears from this level on
    // Shown in this order. `perAttempt` limits uses per try at a level.
    list: [
      { id: 'time', name: 'Extra Time', cost: 60, perAttempt: 1, seconds: 10, about: 'Adds 10 seconds to the clock.' },
      { id: 'speed', name: 'Speed Boost', cost: 50, perAttempt: 1, duration: 6, factor: 1.4, about: 'All marbles roll 40% faster for 6 seconds.' },
      { id: 'hint', name: 'Hint', cost: 80, perAttempt: 3, duration: 4, about: 'Shows the best next tilt from where the marbles are.' },
      { id: 'gates', name: 'Open All Gates', cost: 140, perAttempt: 1, duration: 5, about: 'Every gate and shutter stands open for 5 seconds.' },
      // strength: the pull as a fraction of a full tilt (a full tilt the other way still wins); maxRoute: blocks along the grooves.
      { id: 'magnet', name: 'Magnetic Pull', cost: 160, perAttempt: 1, duration: 5, strength: 0.6, maxRoute: 12, about: 'Pick a marble: for 5 seconds it is pulled along the grooves towards its own goal.' },
      { id: 'checkpoint', name: 'Checkpoint', cost: 220, perAttempt: Infinity, about: 'Saves this moment. If you then lose, you can carry on from here once.' },
    ],
  },
};

export const powerUp = (id, config = ECONOMY) => config.powerUps.list.find((p) => p.id === id);
