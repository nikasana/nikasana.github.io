// Upgrade tree data. Plain data only: balancing never touches logic.
//
// effect ops:  add  -> stat += v * level
//              mul  -> stat *= (1 + v) ^ level
//              set  -> stat = v when level >= 1 (tool tiers)
// cost of level L (0-based) = c0 * growth^L * planetScale, growth set by econ/model.js
// gx, gy: position inside the tree's region of the node graph.

export const TREES = [
  { id: 'dig', name: 'Dig', icon: '⛏️', color: '#e8b46a', origin: [-1, -1] },
  { id: 'melt', name: 'Melt', icon: '🔥', color: '#ff7a45', origin: [1, -1] },
  { id: 'vision', name: 'Vision', icon: '👁️', color: '#7fd4ff', origin: [-1, 1] },
  { id: 'auto', name: 'Automation', icon: '🤖', color: '#b9a4ff', origin: [1, 1] },
];

const N = (tree, id, name, icon, desc, c0, max, parents, effects, gx, gy, extra = {}) =>
  ({ tree, id, name, icon, desc, c0, max, parents, effects, gx, gy, ...extra });

export const NODES = [
  // ⛏️ DIG
  N('dig', 'dig_edge', 'Honed Edge', '🪓', 'Wider pick bite.', 2.6, 25, [], [['digRadius', 'add', 0.012]], 0, 0, { root: true }),
  N('dig', 'dig_swing', 'Quick Swing', '💨', 'Faster swings.', 2.6, 25, ['dig_edge'], [['digRate', 'add', 0.06]], 1, 0),
  N('dig', 'dig_grip', 'Steady Grip', '✊', 'Fragile coins survive the strike.', 11, 20, ['dig_edge'], [['digYield', 'add', 0.04]], 0, 1),
  N('dig', 'dig_chip', 'Chip Shower', '✨', 'Chance for a clean break that frees double ice.', 24, 20, ['dig_swing'], [['crit', 'add', 0.02]], 2, 0),
  N('dig', 'dig_reach', 'Long Haft', '📏', 'Reach farther.', 18, 16, ['dig_grip'], [['reach', 'add', 0.25], ['collect', 'add', 0.01]], 0, 2),
  N('dig', 'dig_drill', 'Drill', '🔩', 'Tool tier 2: a whining ice drill.', 520, 1, ['dig_swing', 'dig_grip'], [['digTier', 'set', 2], ['digRate', 'mul', 0.35], ['digRadius', 'add', 0.08]], 1, 1, { gate: true }),
  N('dig', 'dig_bit', 'Diamond Bit', '💠', 'Drill bites wider.', 950, 25, ['dig_drill'], [['digRadius', 'add', 0.015]], 1, 2),
  N('dig', 'dig_torque', 'Torque Coil', '🌀', 'Drill spins faster.', 950, 25, ['dig_drill'], [['digRate', 'add', 0.08]], 2, 1),
  N('dig', 'dig_crunch', 'Crunch Gears', '⚙️', 'Cleaner extraction.', 2300, 20, ['dig_bit'], [['digYield', 'add', 0.05]], 1, 3),
  N('dig', 'dig_frac', 'Fracture Lines', '⚡', 'Clean breaks free more.', 3600, 16, ['dig_chip', 'dig_torque'], [['critMult', 'add', 0.15]], 3, 1),
  N('dig', 'dig_cool', 'Coolant Loop', '❄️', 'Drill runs hot without stalling.', 14000, 20, ['dig_torque'], [['digRate', 'mul', 0.03]], 2, 2),
  N('dig', 'dig_core', 'Core Sampler', '🧪', 'Coins come up purer.', 28000, 20, ['dig_crunch'], [['valueMult', 'add', 0.03]], 1, 4),
  N('dig', 'dig_wide', 'Wide Auger', '🕳️', 'A broad, hungry bit.', 75000, 25, ['dig_bit', 'dig_cool'], [['digRadius', 'add', 0.02]], 2, 3),
  N('dig', 'dig_echo', 'Echo Strike', '🔔', 'Clean breaks happen more often.', 260000, 20, ['dig_frac'], [['crit', 'add', 0.015]], 3, 2),
  N('dig', 'dig_temper', 'Tempered Steel', '🛡️', 'Everything about digging, better.', 900000, 10, ['dig_wide'], [['digRate', 'mul', 0.06]], 2, 4),
  N('dig', 'dig_master', 'Ice Breaker', '🏔️', 'Master extraction.', 3.2e6, 20, ['dig_temper', 'dig_core'], [['digYield', 'add', 0.06]], 2, 5),

  // 🔥 MELT
  N('melt', 'melt_torch', 'Torch', '🔥', 'Tool tier 1: melt ice over an area.', 3.2, 1, [], [['meltTier', 'set', 1], ['meltPower', 'add', 0.22], ['meltRadius', 'add', 0.8]], 0, 0, { root: true }),
  N('melt', 'melt_flame', 'Hotter Flame', '🌡️', 'More heat per second.', 12, 25, ['melt_torch'], [['meltPower', 'add', 0.018]], 1, 0),
  N('melt', 'melt_fan', 'Fan Nozzle', '🪭', 'A wider flame.', 12, 22, ['melt_torch'], [['meltRadius', 'add', 0.03]], 0, 1),
  N('melt', 'melt_fuel', 'Fuel Mix', '⛽', 'Richer fuel.', 55, 20, ['melt_flame'], [['meltPower', 'mul', 0.03]], 2, 0),
  N('melt', 'melt_drain', 'Drain Channels', '🫗', 'Meltwater carries coins to you.', 140, 16, ['melt_fan'], [['collect', 'add', 0.015]], 0, 2),
  N('melt', 'melt_lance', 'Steam Lance', '♨️', 'Tool tier 2: superheated steam.', 2200, 1, ['melt_flame', 'melt_fan'], [['meltTier', 'set', 2], ['meltPower', 'mul', 0.4], ['meltRadius', 'add', 0.3]], 1, 1, { gate: true }),
  N('melt', 'melt_pressure', 'Pressure Valve', '🎛️', 'Steam at higher pressure.', 3600, 25, ['melt_lance'], [['meltPower', 'add', 0.035]], 2, 1),
  N('melt', 'melt_steam', 'Steam Bloom', '☁️', 'Steam spreads wider.', 5200, 22, ['melt_lance'], [['meltRadius', 'add', 0.04]], 1, 2),
  N('melt', 'melt_boil', 'Rolling Boil', '🫧', 'Boiling water melts nearby ice.', 11000, 20, ['melt_pressure'], [['meltPower', 'mul', 0.035]], 3, 1),
  N('melt', 'melt_refreeze', 'Anti-Refreeze', '🧂', 'Meltwater stays liquid longer.', 8500, 16, ['melt_steam'], [['meltEff', 'add', 0.03]], 0, 3),
  N('melt', 'melt_sear', 'Searing Tip', '🔆', 'Heat-polished coins are worth more.', 38000, 20, ['melt_boil'], [['valueMult', 'add', 0.03]], 3, 2),
  N('melt', 'melt_jet', 'Jet Burners', '🚀', 'Twin jets.', 110000, 25, ['melt_pressure', 'melt_steam'], [['meltPower', 'add', 0.06]], 2, 2),
  N('melt', 'melt_heat', 'Latent Heat', '🌋', 'Heat lingers in the ice.', 380000, 20, ['melt_jet'], [['meltPower', 'mul', 0.035]], 2, 3),
  N('melt', 'melt_glow', 'Glow Edge', '🌟', 'Molten edges reveal value.', 950000, 20, ['melt_sear'], [['valueMult', 'add', 0.035]], 3, 3),
  N('melt', 'melt_plasma', 'Plasma Sheath', '🟣', 'A wide, white-hot sheath.', 2.8e6, 20, ['melt_heat'], [['meltRadius', 'add', 0.06]], 2, 4),
  N('melt', 'melt_master', 'Thermal Mastery', '☀️', 'Complete command of heat.', 9e6, 10, ['melt_plasma', 'melt_glow'], [['meltPower', 'mul', 0.08]], 3, 4),

  // 👁️ VISION
  N('vision', 'vis_lamp', 'Lamp', '🔦', 'Tool tier 1: see deeper into the ice.', 3, 1, [], [['visionTier', 'set', 1], ['vision', 'add', 0.04]], 0, 0, { root: true }),
  N('vision', 'vis_beam', 'Focused Beam', '🎯', 'Spot richer seams.', 14, 20, ['vis_lamp'], [['vision', 'add', 0.025]], 1, 0),
  N('vision', 'vis_glint', 'Glint Sense', '💫', 'Collect coins from farther away.', 12, 22, ['vis_lamp'], [['collectRange', 'add', 0.2]], 0, 1),
  N('vision', 'vis_gradient', 'Gradient Eye', '🌈', 'Read richness from ice colour.', 48, 20, ['vis_beam'], [['vision', 'add', 0.025]], 2, 0),
  N('vision', 'vis_magnet', 'Coin Pull', '🧲', 'Freed coins drift toward you.', 190, 20, ['vis_glint'], [['collectRange', 'add', 0.25]], 0, 2),
  N('vision', 'vis_hint', 'Needle Sense', '🪡', 'A faint pull toward hidden treasure.', 480, 10, ['vis_gradient'], [['vision', 'add', 0.02], ['hint', 'add', 1]], 3, 0),
  N('vision', 'vis_depth', 'Depth Lens', '🔍', 'Read deeper layers.', 2800, 20, ['vis_gradient'], [['vision', 'add', 0.03]], 2, 1),
  N('vision', 'vis_halo', 'Halo Light', '😇', 'A wide collection halo.', 7500, 20, ['vis_magnet'], [['collectRange', 'add', 0.3]], 0, 3),
  N('vision', 'vis_prism', 'Prism Optics', '🔺', 'Split light, split value.', 24000, 20, ['vis_depth'], [['valueMult', 'add', 0.03]], 2, 2),
  N('vision', 'vis_strata', 'Strata Reader', '📜', 'Spot capsules in the crater wall.', 16000, 10, ['vis_depth', 'vis_magnet'], [['hint', 'add', 1], ['vision', 'add', 0.025]], 1, 2),
  N('vision', 'vis_vein', 'Vein Tracer', '🧬', 'Trace rich veins through the ice.', 88000, 20, ['vis_prism'], [['vision', 'add', 0.04]], 2, 3),
  N('vision', 'vis_flood', 'Floodlight', '💡', 'Light the whole crater floor.', 290000, 16, ['vis_halo'], [['collectRange', 'add', 0.35]], 0, 4),
  N('vision', 'vis_clarity', 'Deep Clarity', '💎', 'See the ice as it is.', 2e6, 10, ['vis_vein', 'vis_flood'], [['vision', 'mul', 0.05]], 1, 4),

  // 🤖 AUTOMATION
  N('auto', 'auto_pack', 'Bigger Pack', '🎒', 'Carry more coins before banking.', 2.8, 25, [], [['carry', 'add', 10]], 0, 0, { root: true }),
  N('auto', 'auto_lift', 'Lift Winch', '🛗', 'The lift beacon keeps up faster.', 2.8, 25, ['auto_pack'], [['liftSpeed', 'add', 0.25]], 1, 0),
  N('auto', 'auto_magnet', 'Pack Magnet', '🧲', 'Coins slide into your pack on their own.', 38, 20, ['auto_pack'], [['autoCollect', 'add', 0.02]], 0, 1),
  N('auto', 'auto_stake', 'Seismic Stake', '📍', 'Auto-dig: a planted stake keeps fracturing the floor.', 220, 25, ['auto_lift'], [['autoDig', 'add', 0.03]], 2, 0),
  N('auto', 'auto_seep', 'Heat Seep', '♨️', 'Auto-melt: a heat spike keeps melting the floor.', 220, 25, ['auto_magnet'], [['autoMelt', 'add', 0.04]], 0, 2),
  N('auto', 'auto_belt', 'Lift Express', '⏫', 'Much faster lift.', 1400, 20, ['auto_lift'], [['liftSpeed', 'add', 0.5]], 1, 1),
  N('auto', 'auto_hopper', 'Coin Hopper', '🪣', 'A deep coin hopper.', 2400, 25, ['auto_belt'], [['carry', 'add', 25]], 1, 2),
  N('auto', 'auto_offline', 'Night Seals', '🌙', 'Automation runs better while you are away.', 4800, 10, ['auto_stake'], [['offline', 'add', 0.1], ['autoAll', 'mul', 0.02]], 3, 0),
  N('auto', 'auto_resonator', 'Stake Resonator', '🎵', 'Stakes ring harder.', 9500, 20, ['auto_stake'], [['autoDig', 'mul', 0.05]], 2, 1),
  N('auto', 'auto_vac', 'Vortex Collector', '🌪️', 'Pull loose coins from the whole floor.', 19000, 20, ['auto_seep', 'auto_hopper'], [['autoCollect', 'add', 0.025]], 0, 3),
  N('auto', 'auto_bank', 'Auto-Bank Relay', '🏦', 'Bank from farther away.', 58000, 16, ['auto_hopper'], [['bank', 'add', 0.02]], 1, 3),
  N('auto', 'auto_array', 'Stake Array', '🗼', 'A ring of stakes.', 140000, 25, ['auto_resonator'], [['autoDig', 'add', 0.15], ['autoMelt', 'add', 0.1]], 2, 2),
  N('auto', 'auto_core', 'Core Tap', '🔋', 'Stakes draw on deep heat.', 1.9e6, 10, ['auto_array'], [['autoDig', 'mul', 0.08], ['autoMelt', 'mul', 0.08]], 2, 3),
  N('auto', 'auto_sync', 'Sync Clock', '⏱️', 'All automation in step.', 7.5e6, 10, ['auto_core', 'auto_vac'], [['autoAll', 'mul', 0.06]], 1, 4),
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
};
