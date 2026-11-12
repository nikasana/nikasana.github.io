// All tunable numbers live here. Starting values from the design doc; tuned where a test missed a target.
export const CFG = {
  version: 1,
  grid: 16,                 // cells per room side
  room: { base: 8, perFloor: 2, max: 30, wallT: 0.3, doorBase: 1.7, doorPerM: 0.04, doorH: 2.4 },
  player: { radius: 0.32, eye: 1.6, walkBase: 2.6, walkPerM: 0.18, slideMult: 2.0, slideFriction: 1.4, accel: 14 },
  tool: { baseRadius: 0.8, reachStep: 0.25, ahead: 0.9 },
  clear: { baseRate: 4, autoFinish: 0.05, comboMax: 2, comboGain: 0.12, comboDecay: 1.2, rareChance: 1 / 500 },
  polish: { baseRate: 4, speedStep: 0.25, shineStep: 0.15, dustRate: 1 / 900 },
  glow: { cellWorth: 1, handSeconds: 0.36 },   // each cell action also pays this many seconds of idle income
  income: { perStrength: 0.5 },
  lamp: { base: 40, growth: 1.25, fadeTime: 3 },
  sealed: { openCost: 25 },
  modifiers: { normal: 0.80, deep: 0.10, warm: 0.05, sealed: 0.05 },
  clutterMult: { normal: 1, deep: 3, warm: 0, sealed: 5 },
  setPieceEvery: 40,
  patch: 8,                 // biome patch size in rooms
  biomeMix: 0.7,
  upgrades: {
    power:  { track: 'shovel', base: 300, growth: 6 },
    reach:  { track: 'shovel', base: 150, growth: 4 },
    speed:  { track: 'brush',  base: 120, growth: 3.5 },
    shine:  { track: 'brush',  base: 400, growth: 4 },
    bright: { track: 'lamp',   base: 250, growth: 6 },
    wiring: { track: 'lamp',   base: 200, growth: 5 },
  },
  helpers: { sweeper: 100, mop: 150, firefly: 200, growth: 1.15, cellsPerSec: 0.5, auraMult: 2 },
  balanceBonus: 0.10,
  catalogBonus: 0.01,
  rankBonus: 0.05,
  clarityBonus: 0.10,
  quietMult: 2,
  offline: { share: 0.5, maxHours: 8, restedEveryHours: 2, restedMax: 3 },
  autosaveSec: 10,
  ability: { unlockLevel: 5, dash: { cd: 12, dist: 6 }, gloss: { cd: 20, dur: 5 }, flash: { cd: 25, radius: 2 }, cdPerHelper: 0.02, cdMin: 0.35 },
  flow: { gain: 0.06, cycleMult: 3, decay: 0.15 },
  tide: {
    wavesFloor0: 3, wavesLater: 5,
    pressure: [0.5, 0.7, 0.9, 1.1, 1.4],
    pressureFloor0: [0.5, 0.65, 0.8],
    contact: 5, step: 2.2, duration: 80, frontStagger: 8,
    playerMax: 0.6, helperMax: 0.2, doorHold: 20, bounce: 3, retryEase: 0.10,
    coopPerPlayer: 1.5, floodClutter: 0.6, randomEvery: 300, randomPressure: 0.4,
    sweepBoost: 0.5, // boost per second of sweeping in a contacted doorway (as share of strength)
  },
  sortie: { rewardBase: 400, rewardGrowth: 1.6, cleanExit: 0.5, extractTime: 90, riskStep: 0.25 },
  signs: { roomShare: 0.35, trueShare: 0.6, testTime: 1.5, region: 10, falseReward: 20 },
  dawn: { minFloor: 3, divisor: 50000 },
  gadgetCost: 30,
  perf: { desktopPixelRatio: 1.5, mobilePixelRatio: 1.25, itemsPerUnitDesktop: 2, itemsPerUnitMobile: 1, maxLights: 4 },
};

export const roomSide = (floor) => Math.min(CFG.room.base + CFG.room.perFloor * floor, CFG.room.max);
export const doorWidth = (side) => CFG.room.doorBase + CFG.room.doorPerM * side;
export const floorScale = (floor) => Math.pow(4, floor);
