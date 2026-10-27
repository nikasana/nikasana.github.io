// Upgrade tree data. Plain data only: balancing never touches logic.
//
// effect ops:  add  -> stat += v * level
//              mul  -> stat *= (1 + v) ^ level
//              set  -> stat = v when level >= 1 (tool tiers, one-off mechanics)
// cost of level L (0-based) = c0 * growth^L * planetScale, growth set by econ/model.js
// gx, gy: position inside the tree's region of the node graph; `at` places a node absolutely
// (cross-tree nodes sit between the two trees they join).
// kind:  stat (default) | mech (changes how a tool behaves) | choice (one per `excl` group) |
//        hybrid (parents in two trees) | cap (capstone)

export const TREES = [
  { id: 'dig', name: 'Dig', icon: '⛏️', color: '#e8b46a', origin: [-1, -1] },
  { id: 'melt', name: 'Melt', icon: '🔥', color: '#ff7a45', origin: [1, -1] },
  { id: 'vision', name: 'Vision', icon: '👁️', color: '#7fd4ff', origin: [-1, 1] },
  { id: 'auto', name: 'Automation', icon: '🤖', color: '#b9a4ff', origin: [1, 1] },
];

const N = (tree, id, name, icon, desc, c0, max, parents, effects, gx, gy, extra = {}) =>
  ({ tree, id, name, icon, desc, c0, max, parents, effects, gx, gy, kind: 'stat', ...extra });

export const NODES = [
  // ⛏️ DIG
  N('dig', 'dig_edge', 'Honed Edge', '🪓', 'Wider pick bite.', 2.6, 15, [], [['digRadius', 'add', 0.012]], 0, 0, { root: true }),
  N('dig', 'dig_swing', 'Quick Swing', '💨', 'Faster swings.', 2.6, 15, ['dig_edge'], [['digRate', 'add', 0.06]], 1, 0),
  N('dig', 'dig_grip', 'Steady Grip', '✊', 'Fragile coins survive the strike.', 11, 12, ['dig_edge'], [['digYield', 'add', 0.05]], 0, 1),
  N('dig', 'dig_heavy', 'Overhead Blow', '🔨', 'Heavy strikes (hold right mouse, release) bite much deeper.', 40, 5, ['dig_swing'], [['heavyMult', 'add', 0.25]], 2, 0, { kind: 'mech' }),
  N('dig', 'dig_chip', 'Chip Shower', '✨', 'Chance for a clean break that frees double ice.', 24, 12, ['dig_swing'], [['crit', 'add', 0.025]], 2, 1),
  N('dig', 'dig_reach', 'Long Haft', '📏', 'Reach farther, and scoop coins as you swing.', 18, 8, ['dig_grip'], [['reach', 'add', 0.25], ['collect', 'add', 0.01]], 0, 2),
  N('dig', 'dig_sledge', 'Sledge Style', '🏋️', 'Commit to the big blow: heavy strikes crater far wider, quick swings slow a little. Locks Flurry Style.', 160, 1, ['dig_heavy'], [['heavyMult', 'add', 0.7], ['digRate', 'mul', -0.08]], 3, 0, { kind: 'choice', excl: 'dig_style' }),
  N('dig', 'dig_flurry', 'Flurry Style', '🌪️', 'Commit to speed: many quick, sharp strikes that break clean more often. Locks Sledge Style.', 160, 1, ['dig_chip'], [['digRate', 'mul', 0.22], ['crit', 'add', 0.08], ['digRadius', 'add', -0.02]], 3, 1, { kind: 'choice', excl: 'dig_style' }),
  N('dig', 'dig_drill', 'Drill', '🔩', 'Tool tier 2: a whining ice drill.', 520, 1, ['dig_swing', 'dig_grip'], [['digTier', 'set', 2], ['digRate', 'mul', 0.35], ['digRadius', 'add', 0.08]], 1, 1, { gate: true, kind: 'mech' }),
  N('dig', 'dig_bit', 'Diamond Bit', '💠', 'Drill bites wider.', 950, 12, ['dig_drill'], [['digRadius', 'add', 0.015]], 1, 2),
  N('dig', 'dig_torque', 'Torque Coil', '🌀', 'Drill spins faster.', 950, 12, ['dig_drill'], [['digRate', 'add', 0.08]], 2, 2),
  N('dig', 'dig_crunch', 'Crunch Gears', '⚙️', 'Cleaner extraction, and clean breaks free a little more.', 2300, 10, ['dig_bit'], [['digYield', 'add', 0.05], ['critMult', 'add', 0.05]], 1, 3),
  N('dig', 'dig_frac', 'Fracture Lines', '⚡', 'Clean breaks free more.', 3600, 10, ['dig_chip', 'dig_torque'], [['critMult', 'add', 0.2]], 3, 2),
  N('dig', 'dig_cool', 'Coolant Loop', '❄️', 'The drill runs cold: faster bores, and heavy drilling loses less speed.', 14000, 8, ['dig_torque'], [['digRate', 'mul', 0.04], ['heavyMult', 'add', 0.05]], 2, 3, { kind: 'mech' }),
  N('dig', 'dig_core', 'Core Sampler', '🧪', 'Coins come up purer.', 28000, 10, ['dig_crunch'], [['valueMult', 'add', 0.03]], 1, 4),
  N('dig', 'dig_wide', 'Wide Auger', '🕳️', 'A broad, hungry bit.', 75000, 12, ['dig_bit', 'dig_cool'], [['digRadius', 'add', 0.02]], 2, 4),
  N('dig', 'dig_echo', 'Echo Strike', '🔔', 'A clean break rings through the seam: more of them, and they free more.', 260000, 8, ['dig_frac'], [['crit', 'add', 0.012], ['critMult', 'add', 0.25]], 3, 3, { kind: 'mech' }),
  N('dig', 'dig_temper', 'Tempered Steel', '🛡️', 'Everything about digging, better.', 900000, 8, ['dig_wide'], [['digRate', 'mul', 0.06], ['digRadius', 'add', 0.01]], 2, 5),
  N('dig', 'dig_master', 'Ice Breaker', '🏔️', 'Capstone. Every strike sends a fracture through the seam: far more yield and a crushing heavy blow.', 3.2e6, 1, ['dig_temper', 'dig_core'], [['digYield', 'add', 0.45], ['heavyMult', 'add', 0.5], ['shock', 'add', 0.2]], 1.5, 6, { kind: 'cap' }),

  // 🔥 MELT
  N('melt', 'melt_torch', 'Torch', '🔥', 'Tool tier 1: melt ice over an area. Ice you warm digs out wider.', 3.2, 1, [], [['meltTier', 'set', 1], ['meltPower', 'add', 0.22], ['meltRadius', 'add', 0.8]], 0, 0, { root: true, kind: 'mech' }),
  N('melt', 'melt_flame', 'Hotter Flame', '🌡️', 'More heat per second.', 12, 15, ['melt_torch'], [['meltPower', 'add', 0.018]], 1, 0),
  N('melt', 'melt_fan', 'Fan Nozzle', '🪭', 'A wider flame.', 12, 12, ['melt_torch'], [['meltRadius', 'add', 0.03]], 0, 1),
  N('melt', 'melt_linger', 'Slow Cooling', '⏳', 'Warmed ice stays soft longer, so you have more time to swap tools and dig it.', 45, 6, ['melt_flame'], [['heatLinger', 'add', 0.25]], 2, 0, { kind: 'mech' }),
  N('melt', 'melt_fuel', 'Fuel Mix', '⛽', 'Richer fuel.', 55, 12, ['melt_flame'], [['meltPower', 'mul', 0.03]], 3, 0),
  N('melt', 'melt_drain', 'Drain Channels', '🫗', 'Meltwater carries coins to you.', 140, 10, ['melt_fan'], [['collect', 'add', 0.015]], 0, 2),
  N('melt', 'melt_focus', 'Focused Jet', '🎯', 'Commit to a needle of flame: far hotter, much narrower, and the ice it touches shatters under the pick. Locks Wide Bloom.', 180, 1, ['melt_fuel'], [['meltPower', 'mul', 0.55], ['meltRadius', 'add', -0.25], ['shock', 'add', 0.25]], 3, 1, { kind: 'choice', excl: 'melt_style' }),
  N('melt', 'melt_bloom', 'Wide Bloom', '🌸', 'Commit to a broad, gentle heat: a much wider flame that keeps ice soft for longer. Locks Focused Jet.', 180, 1, ['melt_drain'], [['meltRadius', 'add', 0.55], ['meltPower', 'mul', -0.08], ['heatLinger', 'add', 0.6]], 0, 3, { kind: 'choice', excl: 'melt_style' }),
  N('melt', 'melt_lance', 'Steam Lance', '♨️', 'Tool tier 2: superheated steam.', 2200, 1, ['melt_flame', 'melt_fan'], [['meltTier', 'set', 2], ['meltPower', 'mul', 0.4], ['meltRadius', 'add', 0.3]], 1, 1, { gate: true, kind: 'mech' }),
  N('melt', 'melt_pressure', 'Pressure Valve', '🎛️', 'Steam at higher pressure.', 3600, 12, ['melt_lance'], [['meltPower', 'add', 0.035]], 2, 1),
  N('melt', 'melt_steam', 'Steam Bloom', '☁️', 'Steam spreads wider.', 5200, 12, ['melt_lance'], [['meltRadius', 'add', 0.04]], 1, 2),
  N('melt', 'melt_boil', 'Rolling Boil', '🫧', 'Boiling water melts nearby ice.', 11000, 10, ['melt_pressure'], [['meltPower', 'mul', 0.035]], 3, 2),
  N('melt', 'melt_refreeze', 'Anti-Refreeze', '🧂', 'Meltwater stays liquid longer, and melting is more efficient.', 8500, 10, ['melt_steam'], [['meltEff', 'add', 0.03]], 1, 3),
  N('melt', 'melt_sear', 'Searing Tip', '🔆', 'Heat-polished coins are worth more.', 38000, 10, ['melt_boil'], [['valueMult', 'add', 0.03]], 3, 3),
  N('melt', 'melt_jet', 'Jet Burners', '🚀', 'Twin jets.', 110000, 12, ['melt_pressure', 'melt_steam'], [['meltPower', 'add', 0.06]], 2, 2),
  N('melt', 'melt_heat', 'Latent Heat', '🌋', 'Heat lingers in the ice.', 380000, 10, ['melt_jet'], [['meltPower', 'mul', 0.035], ['heatLinger', 'add', 0.05]], 2, 3),
  N('melt', 'melt_glow', 'Glow Edge', '🌟', 'Molten edges reveal value.', 950000, 10, ['melt_sear'], [['valueMult', 'add', 0.035]], 3, 4),
  N('melt', 'melt_plasma', 'Plasma Sheath', '🟣', 'A wide, white-hot sheath.', 2.8e6, 10, ['melt_heat'], [['meltRadius', 'add', 0.06]], 2, 4),
  N('melt', 'melt_master', 'Thermal Mastery', '☀️', 'Capstone. Complete command of heat: much stronger melting, and heat pours into every crack.', 9e6, 1, ['melt_plasma', 'melt_glow'], [['meltPower', 'mul', 0.6], ['seep', 'add', 0.4], ['heatLinger', 'add', 0.5]], 2.5, 5, { kind: 'cap' }),

  // 👁️ VISION
  N('vision', 'vis_lamp', 'Lamp', '🔦', 'Tool tier 1: see deeper into the ice.', 3, 1, [], [['visionTier', 'set', 1], ['vision', 'add', 0.04]], 0, 0, { root: true, kind: 'mech' }),
  N('vision', 'vis_beam', 'Focused Beam', '🎯', 'Spot richer seams.', 14, 12, ['vis_lamp'], [['vision', 'add', 0.025]], 1, 0),
  N('vision', 'vis_glint', 'Glint Sense', '💫', 'Collect coins from farther away.', 12, 12, ['vis_lamp'], [['collectRange', 'add', 0.2]], 0, 1),
  N('vision', 'vis_gradient', 'Gradient Eye', '🌈', 'Read richness from ice colour.', 48, 12, ['vis_beam'], [['vision', 'add', 0.025]], 2, 0),
  N('vision', 'vis_magnet', 'Coin Pull', '🧲', 'Freed coins drift toward you.', 190, 10, ['vis_glint'], [['collectRange', 'add', 0.25]], 0, 2),
  N('vision', 'vis_hint', 'Needle Sense', '🪡', 'A faint pull toward hidden treasure.', 480, 5, ['vis_gradient'], [['vision', 'add', 0.02], ['hint', 'add', 1]], 3, 1, { kind: 'mech' }),
  N('vision', 'vis_prospect', "Prospector's Eye", '⛏️', 'Commit to rich ice: strikes on rich seams break clean far more often. Locks Sweeper\'s Eye.', 220, 1, ['vis_gradient'], [['richCrit', 'add', 0.3], ['vision', 'mul', 0.08]], 3, 0, { kind: 'choice', excl: 'vis_style' }),
  N('vision', 'vis_sweep', "Sweeper's Eye", '🧹', 'Commit to the haul: a huge pickup radius and coins slide in on their own. Locks Prospector\'s Eye.', 220, 1, ['vis_magnet'], [['collectRange', 'add', 1.4], ['autoCollect', 'add', 0.05]], 0, 3, { kind: 'choice', excl: 'vis_style' }),
  N('vision', 'vis_depth', 'Depth Lens', '🔍', 'Read deeper layers.', 2800, 10, ['vis_gradient'], [['vision', 'add', 0.03]], 2, 1),
  N('vision', 'vis_xray', 'X-ray', '🩻', 'Tool tier 2: while you focus the lamp, coins show through up to 4 m of ice and finds glow from far away.', 2600, 1, ['vis_depth'], [['visionTier', 'set', 2], ['vision', 'add', 0.05]], 3, 2, { gate: true, kind: 'mech' }),
  N('vision', 'vis_radar', 'Satellite Radar', '🛰️', 'Tool tier 3: a satellite scans the ice from orbit and marks every find near you on the minimap.', 260000, 1, ['vis_vein', 'vis_xray'], [['visionTier', 'set', 3], ['vision', 'add', 0.08]], 3, 3, { gate: true, kind: 'mech' }),
  N('vision', 'vis_halo', 'Halo Light', '😇', 'A wide collection halo.', 7500, 10, ['vis_magnet'], [['collectRange', 'add', 0.3]], 1, 3),
  N('vision', 'vis_prism', 'Prism Optics', '🔺', 'Split light, split value.', 24000, 10, ['vis_depth'], [['valueMult', 'add', 0.03]], 2, 2),
  N('vision', 'vis_strata', 'Strata Reader', '📜', 'Spot capsules in the crater wall.', 16000, 5, ['vis_depth', 'vis_magnet'], [['hint', 'add', 1], ['vision', 'add', 0.025]], 1, 2, { kind: 'mech' }),
  N('vision', 'vis_vein', 'Vein Tracer', '🧬', 'Trace rich veins through the ice.', 88000, 10, ['vis_prism'], [['vision', 'add', 0.04], ['richCrit', 'add', 0.02]], 2, 3),
  N('vision', 'vis_flood', 'Floodlight', '💡', 'Light the whole crater floor.', 290000, 8, ['vis_halo'], [['collectRange', 'add', 0.35]], 1, 4),
  N('vision', 'vis_clarity', 'Deep Clarity', '💎', 'Capstone. See the ice as it is: everything you free is worth more, and rich seams shatter.', 2e6, 1, ['vis_vein', 'vis_flood'], [['vision', 'mul', 0.35], ['richCrit', 'add', 0.2]], 1.5, 5, { kind: 'cap' }),

  // 🤖 AUTOMATION
  N('auto', 'auto_pack', 'Bigger Pack', '🎒', 'Carry more coins before banking.', 2.8, 15, [], [['carry', 'add', 10]], 0, 0, { root: true }),
  N('auto', 'auto_lift', 'Lift Winch', '🛗', 'The lift beacon keeps up faster.', 2.8, 12, ['auto_pack'], [['liftSpeed', 'add', 0.25]], 1, 0),
  N('auto', 'auto_magnet', 'Pack Magnet', '🧲', 'Coins slide into your pack on their own.', 38, 12, ['auto_pack'], [['autoCollect', 'add', 0.02]], 0, 1),
  N('auto', 'auto_stake', 'Seismic Stake', '📍', 'Auto-dig: a planted stake keeps fracturing the floor.', 220, 15, ['auto_lift'], [['autoDig', 'add', 0.03]], 2, 0, { kind: 'mech' }),
  N('auto', 'auto_seep', 'Heat Seep', '♨️', 'Auto-melt: a heat spike keeps melting the floor.', 220, 15, ['auto_magnet'], [['autoMelt', 'add', 0.04]], 0, 2, { kind: 'mech' }),
  N('auto', 'auto_belt', 'Lift Express', '⏫', 'Much faster lift.', 1400, 10, ['auto_lift'], [['liftSpeed', 'add', 0.5]], 1, 1),
  N('auto', 'auto_hopper', 'Coin Hopper', '🪣', 'A deep coin hopper.', 2400, 12, ['auto_belt'], [['carry', 'add', 25]], 1, 2),
  N('auto', 'auto_offline', 'Night Seals', '🌙', 'Automation runs better while you are away.', 4800, 10, ['auto_stake'], [['offline', 'add', 0.1], ['autoAll', 'mul', 0.02]], 3, 0),
  N('auto', 'auto_field', 'Stake Field', '🗼', 'Commit to fracture: stakes hit much harder, heat spikes run cooler. Locks Heat Grid.', 3000, 1, ['auto_stake'], [['autoDig', 'mul', 0.6], ['autoMelt', 'mul', -0.2]], 3, 1, { kind: 'choice', excl: 'auto_style' }),
  N('auto', 'auto_grid', 'Heat Grid', '🕸️', 'Commit to heat: spikes melt much faster, stakes ring softer. Locks Stake Field.', 3000, 1, ['auto_seep'], [['autoMelt', 'mul', 0.6], ['autoDig', 'mul', -0.2]], 0, 3, { kind: 'choice', excl: 'auto_style' }),
  N('auto', 'auto_resonator', 'Stake Resonator', '🎵', 'Stakes ring harder.', 9500, 10, ['auto_stake'], [['autoDig', 'mul', 0.05]], 2, 1),
  N('auto', 'auto_vac', 'Vortex Collector', '🌀', 'Pull loose coins from the whole floor.', 19000, 10, ['auto_seep', 'auto_hopper'], [['autoCollect', 'add', 0.025]], 1, 3),
  N('auto', 'auto_bank', 'Auto-Bank Relay', '🏦', 'Bank from farther away.', 58000, 10, ['auto_hopper'], [['bank', 'add', 0.02]], 2, 3),
  N('auto', 'auto_array', 'Stake Array', '🔱', 'A ring of stakes and spikes.', 140000, 12, ['auto_resonator'], [['autoDig', 'add', 0.15], ['autoMelt', 'add', 0.1]], 2, 2),
  N('auto', 'auto_core', 'Core Tap', '🔋', 'Stakes draw on deep heat.', 1.9e6, 8, ['auto_array'], [['autoDig', 'mul', 0.08], ['autoMelt', 'mul', 0.08]], 3, 3),
  N('auto', 'auto_sync', 'Sync Clock', '⏱️', 'Capstone. All automation in step, ringing as one.', 7.5e6, 1, ['auto_core', 'auto_vac'], [['autoAll', 'mul', 0.5]], 2, 4, { kind: 'cap' }),

  // ✳️ CROSS-TREE: need a node from each of two trees, and make the two work together
  N('dig', 'hy_shock', 'Thermal Shock', '💥', 'Dig + Melt. Strikes on ice you have just warmed blow out a much bigger crater.', 60, 8, ['dig_swing', 'melt_flame'], [['shock', 'add', 0.12]], 0, 0, { kind: 'hybrid', join: ['dig', 'melt'], at: [0, -300] }),
  N('melt', 'hy_seep', 'Crack Seep', '🫠', 'Dig + Melt. Heat pours into fresh pick cracks: melting cracked ice is much faster.', 140, 8, ['dig_chip', 'melt_fan'], [['seep', 'add', 0.12]], 0, 0, { kind: 'hybrid', join: ['dig', 'melt'], at: [0, -450] }),
  N('dig', 'hy_burst', 'Steam Burst', '🌋', 'Dig + Melt. A heavy strike on warmed ice flashes it to steam and blasts a wide crater.', 6000, 1, ['hy_shock', 'hy_seep'], [['steamBurst', 'set', 1], ['shock', 'add', 0.2]], 0, 0, { kind: 'hybrid', join: ['dig', 'melt'], at: [0, -610] }),
  N('melt', 'hy_forge', 'Cryo Forge', '🔥', 'Dig + Melt. Coins struck from warm ice come out polished; shock craters grow.', 120000, 8, ['dig_core', 'melt_sear', 'hy_burst'], [['valueMult', 'add', 0.05], ['shock', 'add', 0.04]], 0, 0, { kind: 'hybrid', join: ['dig', 'melt'], at: [0, -780] }),
  N('dig', 'hy_seam', 'Seam Striker', '🎯', 'Dig + Vision. You strike where the lamp shows gold: clean breaks on rich ice, better yield.', 70, 8, ['dig_grip', 'vis_beam'], [['richCrit', 'add', 0.06], ['digYield', 'add', 0.02]], 0, 0, { kind: 'hybrid', join: ['dig', 'vision'], at: [-470, 0] }),
  N('vision', 'hy_assay', 'Field Assay', '⚖️', 'Dig + Vision. Read each chip as it flies: more value from every clean break.', 9000, 8, ['hy_seam', 'dig_frac', 'vis_depth'], [['critMult', 'add', 0.15], ['valueMult', 'add', 0.02]], 0, 0, { kind: 'hybrid', join: ['dig', 'vision'], at: [-680, 0] }),
  N('auto', 'hy_pipes', 'Heat Pipes', '🔧', 'Melt + Automation. Stakes feed on the heat spikes: automatic digging grows with automatic melting.', 900, 10, ['melt_fuel', 'auto_stake'], [['pipes', 'add', 0.08]], 0, 0, { kind: 'hybrid', join: ['melt', 'auto'], at: [470, 0] }),
  N('melt', 'hy_kiln', 'Kiln Stakes', '🧱', 'Melt + Automation. Your torch heat lingers in the stakes, and stake craters are warm for your pick.', 30000, 8, ['hy_pipes', 'melt_boil'], [['autoDig', 'mul', 0.05], ['heatLinger', 'add', 0.1]], 0, 0, { kind: 'hybrid', join: ['melt', 'auto'], at: [680, 0] }),
  N('vision', 'hy_sort', 'Sorting Lens', '🔬', 'Vision + Automation. The lift sorts as it hauls: banking pays more.', 160, 8, ['vis_glint', 'auto_magnet'], [['bank', 'add', 0.02], ['valueMult', 'add', 0.01]], 0, 0, { kind: 'hybrid', join: ['vision', 'auto'], at: [0, 300] }),
  N('auto', 'hy_drones', 'Survey Drones', '🛸', 'Vision + Automation. Drones sweep the floor for coins and treasure.', 40000, 1, ['hy_sort', 'vis_strata', 'auto_vac'], [['autoCollect', 'add', 0.15], ['hint', 'add', 1]], 0, 0, { kind: 'hybrid', join: ['vision', 'auto'], at: [0, 470] }),
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

// Base stats before any upgrade.
export const BASE_STATS = {
  digTier: 1, digRadius: 0.5, digRate: 1.5, digYield: 1, crit: 0, critMult: 2,
  meltTier: 0, meltPower: 0, meltRadius: 0, meltEff: 1,
  visionTier: 0, vision: 1, hint: 0,
  collectRange: 2.2, collect: 0, autoCollect: 0, reach: 3.2,
  carry: 40, liftSpeed: 1.5, bank: 0,
  autoDig: 0, autoMelt: 0, autoAll: 1, offline: 0.25,
  valueMult: 1,
  // tool interplay: warmed ice digs out wider (shock), cracked ice melts faster (seep)
  shock: 0.6, seep: 0.5, heatLinger: 1, heavyMult: 1.55, richCrit: 0, steamBurst: 0, pipes: 0,
};
