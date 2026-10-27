// Hidden synergies ("Resonances"). Never listed in the game until discovered.
//
// when:
//   order   { first, then }           first reached level >= 1 before `then` was bought
//   levels  { req: {id: lvl} }         all levels reached
//   balance { a, b, min, maxDiff }     both >= min and |a-b| <= maxDiff (breaks if unbalanced)
//   equal   { a, b, min }              exactly equal levels, both >= min
//   action  { action, count }          the player did something in the world (game counts it)
//   burst   { tree, count, within }    `count` purchases in one tree within `within` s (lasts `hold` s)
// gives:
//   income  multiplier on all income while active
//   red     { nodes: [...] | '*', r }  cost-growth reduction for those nodes (flattens their curve)
//   stats   { stat: mult }             stat multipliers
// hint: the cryptic notebook line shown before discovery (blank-ish riddle).

export const SYNERGIES = [
  {
    id: 'presoftened', name: 'Pre-softened Ice', hint: 'Warm what you mean to break.',
    when: { type: 'action', action: 'meltThenDig', count: 12 },
    gives: { stats: { digYield: 1.2 }, red: { nodes: ['dig_edge', 'dig_swing', 'melt_flame', 'melt_fan'], r: 0.6 } },
    desc: 'Digging ice you have just warmed with the torch frees more coins. Dig and Melt basics grow cheaper.',
  },
  {
    id: 'scanfirst', name: 'Scan Before Strike', hint: 'Light comes before steel.',
    when: { type: 'order', first: 'vis_gradient', then: 'dig_drill' },
    gives: { income: 1.1 },
    desc: 'You trained the Gradient Eye before you built the Drill: revealed veins pay more.',
  },
  {
    id: 'matched', name: 'Matched Edge', hint: 'A wide bite needs a quick arm.',
    when: { type: 'balance', a: 'dig_edge', b: 'dig_swing', min: 3, maxDiff: 1 },
    gives: { red: { nodes: ['dig_edge', 'dig_swing', 'dig_grip', 'dig_chip'], r: 0.84 } },
    desc: 'Honed Edge and Quick Swing within one level of each other.',
  },
  {
    id: 'drillpair', name: 'True Bore', hint: 'The bit and the coil turn as one.',
    when: { type: 'equal', a: 'dig_bit', b: 'dig_torque', min: 2 },
    gives: { stats: { digRate: 1.1 }, red: { nodes: ['dig_bit', 'dig_torque', 'dig_cool', 'dig_wide', 'dig_crunch'], r: 0.84 } },
    desc: 'Diamond Bit and Torque Coil at exactly the same level.',
  },
  {
    id: 'flamefan', name: 'Even Flame', hint: 'Heat that reaches as far as it burns.',
    when: { type: 'equal', a: 'melt_flame', b: 'melt_fan', min: 4 },
    gives: { stats: { meltPower: 0.9 }, red: { nodes: ['melt_flame', 'melt_fan', 'melt_fuel', 'melt_drain'], r: 0.84 } },
    desc: 'Hotter Flame and Fan Nozzle at exactly the same level.',
  },
  {
    id: 'cascade', name: 'Steam Cascade', hint: 'Pressure and bloom, then the lance sings.',
    when: { type: 'levels', req: { melt_pressure: 6, melt_steam: 6, melt_boil: 2 } },
    gives: { stats: { meltPower: 0.9 }, red: { nodes: ['melt_pressure', 'melt_steam', 'melt_boil', 'melt_jet', 'melt_refreeze', 'melt_heat'], r: 0.72 } },
    desc: 'Boiling meltwater makes steam that melts the ice around it.',
  },
  {
    id: 'lightfirst', name: 'Light Trail', hint: 'Reach for them before you make room for them.',
    when: { type: 'order', first: 'vis_halo', then: 'auto_hopper' },
    gives: { income: 1.1 },
    desc: 'Halo Light before Coin Hopper: coins find you on the way to the lift.',
  },
  {
    id: 'liftsync', name: 'Lift Sync', hint: 'What you carry, the lift should match.',
    when: { type: 'equal', a: 'auto_pack', b: 'auto_lift', min: 2 },
    gives: { income: 1.05, red: { nodes: ['auto_pack', 'auto_lift', 'auto_belt', 'auto_bank', 'auto_magnet'], r: 0.84 } },
    desc: 'Bigger Pack and Lift Winch at exactly the same level.',
  },
  {
    id: 'stakedepth', name: 'Deep Focus', hint: 'The stake listens to the swing.',
    when: { type: 'levels', req: { auto_stake: 6, dig_torque: 6 } },
    gives: { stats: { autoDig: 1.4 }, red: { nodes: ['auto_stake', 'auto_resonator', 'auto_array', 'auto_seep', 'auto_core'], r: 0.72 } },
    desc: 'Stakes resonate with the drill.',
  },
  {
    id: 'gradient', name: 'Gradient Reader', hint: 'Dig where the ice is darkest.',
    when: { type: 'action', action: 'richDig', count: 40 },
    gives: { stats: { vision: 1.15 }, red: { nodes: ['vis_gradient', 'vis_prism', 'vis_vein', 'vis_strata'], r: 0.72 } },
    desc: 'You learned to read the ice colour and dig the rich spots.',
  },
  {
    id: 'rhythm', name: 'Cold Rhythm', hint: 'Three in one breath.',
    when: { type: 'burst', count: 3, within: 10, hold: 45 },
    gives: { income: 1.06, red: { nodes: '*', r: 0.29 } },
    desc: 'Three upgrades in one tree within ten seconds: every cost grows slower for a while.',
  },
  {
    id: 'scanmelt', name: 'Prism Flame', hint: 'Split the light before you raise the pressure.',
    when: { type: 'order', first: 'vis_prism', then: 'melt_pressure' },
    gives: { income: 1.12 },
    desc: 'Prism Optics before the Pressure Valve: you melt exactly where it pays.',
  },
  {
    id: 'stakepair', name: 'Twin Stakes', hint: 'Fracture and seep, side by side.',
    when: { type: 'balance', a: 'auto_stake', b: 'auto_seep', min: 2, maxDiff: 1 },
    gives: { red: { nodes: ['auto_stake', 'auto_seep', 'auto_vac', 'auto_offline', 'auto_sync', 'auto_array'], r: 0.72 } },
    desc: 'Seismic Stake and Heat Seep within one level of each other.',
  },
  {
    id: 'master', name: 'Full Kit', hint: 'Every family, held at once.',
    when: { type: 'levels', req: { dig_temper: 1, melt_heat: 1, vis_vein: 1, auto_array: 1 } },
    gives: { income: 1.15, red: { nodes: ['dig_temper', 'dig_master', 'dig_echo', 'melt_plasma', 'melt_master', 'vis_clarity', 'vis_flood', 'auto_core', 'auto_sync', 'dig_core'], r: 0.84 } },
    desc: 'A late tool from every tree at once.',
  },
];

export const SYNERGY_BY_ID = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));
