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
  { id: 'planet', name: 'Planet', icon: '🛰️', color: '#ffd27a', origin: [1, 0], label: [1000, -230] },
  { id: 'climate', name: 'Climate', icon: '🌡️', color: '#8fe3c8', origin: [-1, 0], label: [-1000, 420] },
  { id: 'style', name: 'Style', icon: '🎨', color: '#ff9fc4', origin: [1, 0], label: [1000, 420] },
  { id: 'luck', name: 'Luck & Secrets', icon: '🍀', color: '#c8f07a', origin: [-1, 0], label: [-1000, 900] },
  { id: 'audio', name: 'Audio', icon: '🎼', color: '#f2c9ff', origin: [-1, 0], label: [-1000, -230] },
  { id: 'dna', name: 'DNA', icon: '🧬', color: '#7dffb2', origin: [0, 1], label: [0, 1200] },
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
  N('dig', 'dig_sonic', 'Sonic Hammer', '🔊', 'Tool tier 3: a heavy hammer whose every blow sends a shockwave that breaks a ring of ice around the crater.', 1.2e6, 1, ['dig_echo', 'dig_wide'], [['digTier', 'set', 3], ['digRadius', 'add', 0.25], ['digRate', 'mul', -0.25], ['heavyMult', 'add', 0.3]], 3, 4, { gate: true, kind: 'mech' }),
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
  N('melt', 'melt_laser', 'Orbital Laser', '🛰️', 'Tool tier 3: a satellite laser answers your designator: a white-hot beam from the sky melts a wide shaft.', 1.5e6, 1, ['melt_heat'], [['meltTier', 'set', 3], ['meltPower', 'mul', 0.6], ['meltRadius', 'add', 0.5]], 1, 4, { gate: true, kind: 'mech' }),
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
  N('auto', 'auto_pack', 'Bigger Pack', '🎒', 'Carry more before you must go up to the depot.', 2.8, 15, [], [['carry', 'add', 30]], 0, 0, { root: true }),
  N('auto', 'auto_lift', 'Lift Winch', '🛗', 'The lift beacon keeps up faster.', 2.8, 12, ['auto_pack'], [['liftSpeed', 'add', 0.25]], 1, 0),
  N('auto', 'auto_magnet', 'Pack Magnet', '🧲', 'Coins slide into your pack on their own.', 38, 12, ['auto_pack'], [['autoCollect', 'add', 0.02]], 0, 1),
  N('auto', 'auto_stake', 'Seismic Stake', '📍', 'Auto-dig: a planted stake keeps fracturing the floor.', 220, 15, ['auto_lift'], [['autoDig', 'add', 0.03]], 2, 0, { kind: 'mech' }),
  N('auto', 'auto_seep', 'Heat Seep', '♨️', 'Auto-melt: a heat spike keeps melting the floor.', 220, 15, ['auto_magnet'], [['autoMelt', 'add', 0.04]], 0, 2, { kind: 'mech' }),
  N('auto', 'auto_belt', 'Lift Express', '⏫', 'Much faster lift.', 1400, 10, ['auto_lift'], [['liftSpeed', 'add', 0.5]], 1, 1),
  N('auto', 'auto_hopper', 'Coin Hopper', '🪣', 'A deep coin hopper on your back: far fewer trips up.', 2400, 12, ['auto_belt'], [['carry', 'add', 75]], 1, 2),
  N('auto', 'auto_offline', 'Night Seals', '🌙', 'Automation runs better while you are away.', 4800, 10, ['auto_stake'], [['offline', 'add', 0.1], ['autoAll', 'mul', 0.02]], 3, 0),
  N('auto', 'auto_field', 'Stake Field', '🗼', 'Commit to fracture: stakes hit much harder, heat spikes run cooler. Locks Heat Grid.', 3000, 1, ['auto_stake'], [['autoDig', 'mul', 0.6], ['autoMelt', 'mul', -0.2]], 3, 1, { kind: 'choice', excl: 'auto_style' }),
  N('auto', 'auto_grid', 'Heat Grid', '🕸️', 'Commit to heat: spikes melt much faster, stakes ring softer. Locks Stake Field.', 3000, 1, ['auto_seep'], [['autoMelt', 'mul', 0.6], ['autoDig', 'mul', -0.2]], 0, 3, { kind: 'choice', excl: 'auto_style' }),
  N('auto', 'auto_resonator', 'Stake Resonator', '🎵', 'Stakes ring harder.', 9500, 10, ['auto_stake'], [['autoDig', 'mul', 0.05]], 2, 1),
  N('auto', 'auto_vac', 'Vortex Collector', '🌀', 'Pull loose coins from the whole floor.', 19000, 10, ['auto_seep', 'auto_hopper'], [['autoCollect', 'add', 0.025]], 1, 3),
  N('auto', 'auto_bank', 'Depot Relay', '🏦', 'Deliver from farther away: the depot reaches out to you.', 58000, 10, ['auto_hopper'], [['bank', 'add', 0.02]], 2, 3),
  N('auto', 'auto_array', 'Stake Array', '🔱', 'A ring of stakes and spikes.', 140000, 12, ['auto_resonator'], [['autoDig', 'add', 0.15], ['autoMelt', 'add', 0.1]], 2, 2),
  N('auto', 'auto_core', 'Core Tap', '🔋', 'Stakes draw on deep heat.', 1.9e6, 8, ['auto_array'], [['autoDig', 'mul', 0.08], ['autoMelt', 'mul', 0.08]], 3, 3),
  N('auto', 'auto_tool', 'Auto Swing', '🔁', 'Auto-use-tool: while you stand still aiming at ice, your dig or melt tool keeps working on its own.', 32000, 1, ['auto_vac'], [['autoTool', 'set', 1]], 0, 4, { kind: 'mech' }),
  N('auto', 'auto_buyer', 'Quartermaster', '🧾', 'Auto-buy: every few seconds, buys the cheapest upgrade that costs under a quarter of your vault (never a choose-one node). Toggle it in the upgrade screen.', 85000, 1, ['auto_bank'], [['autoBuy', 'set', 1]], 1, 4, { kind: 'mech' }),
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

  // 🛰️ PLANET: satellite mirrors focus sunlight on your pole (tool 3), and arrays of them melt on their own
  N('planet', 'pl_mirror', 'Satellite Mirrors', '🪞', 'Planet tool: hold left mouse to focus a sunbeam from orbit on the ice you point at. A wide, gentle melt from far away.', 25000, 1, [], [['planetTier', 'set', 1], ['mirrorPower', 'add', 0.4]], 0, 0, { root: true, gate: true, kind: 'mech', at: [900, -120] }),
  N('planet', 'pl_lens', 'Focus Lens', '🔎', 'A tighter, hotter sunbeam.', 90000, 10, ['pl_mirror'], [['mirrorPower', 'mul', 0.15]], 0, 0, { at: [1110, -120] }),
  N('planet', 'pl_array', 'Mirror Array', '✨', 'More mirrors in orbit: they keep melting the pole while you work.', 60000, 10, ['pl_mirror'], [['autoMelt', 'add', 0.12]], 0, 0, { at: [900, 30] }),
  N('planet', 'pl_pipe', 'Heat Pipe', '🔥', 'Planet tool tier 2: tap the mantle. Right mouse with the planet tool melts a narrow column straight down; the pipe also melts the pole on its own.', 2.5e6, 1, ['pl_orbit'], [['planetTier', 'set', 2], ['autoMelt', 'add', 0.5]], 0, 0, { gate: true, kind: 'mech', at: [1110, 180] }),
  N('planet', 'pl_orbit', 'Polar Orbit', '🌐', 'The mirrors never set: steadier automatic melting and a stronger beam.', 600000, 8, ['pl_lens', 'pl_array'], [['autoMelt', 'mul', 0.08], ['mirrorPower', 'add', 0.2]], 0, 0, { at: [1110, 30] }),

  // 🌡️ CLIMATE: albedo and the sea
  N('climate', 'cl_soot', 'Soot Dusting', '🌑', 'Darken the ice so it drinks the sun: every melt goes further.', 3000, 10, [], [['meltEff', 'add', 0.05]], 0, 0, { root: true, at: [-900, 180] }),
  N('climate', 'cl_dark', 'Dark Ice', '⬛', 'Deeper albedo: hotter melting.', 12000, 10, ['cl_soot'], [['meltPower', 'mul', 0.04]], 0, 0, { at: [-1110, 180] }),
  N('climate', 'cl_sea', 'Sea Wall', '🌊', 'A managed sea: coins from a warming world fetch more.', 8000, 8, ['cl_soot'], [['valueMult', 'add', 0.02]], 0, 0, { at: [-900, 330] }),
  N('climate', 'cl_shield', 'Storm Shields', '🛡️', 'Wind breaks around your crater: storms steal less of your heat (Gale).', 30000, 5, ['cl_sea'], [['stormShield', 'add', 0.15]], 0, 0, { at: [-900, 480] }),
  N('climate', 'cl_green', 'Greenhouse Vents', '🏭', 'Vents warm the pole from below: the ice melts on its own.', 45000, 10, ['cl_dark'], [['autoMelt', 'add', 0.06]], 0, 0, { at: [-1110, 330] }),

  // 🎨 STYLE: purely cosmetic; each can be switched off in Settings > Game
  N('style', 'sty_gold', 'Gilded Pick', '🌟', 'Tool skin: your pick and hammer heads in polished gold.', 800, 1, [], [['styleGold', 'set', 1]], 0, 0, { root: true, kind: 'mech', at: [900, 330] }),
  N('style', 'sty_obsid', 'Obsidian Tools', '🖤', 'Tool skin: black volcanic glass with a violet edge.', 6000, 1, ['sty_gold'], [['styleObsid', 'set', 1]], 0, 0, { kind: 'mech', at: [1110, 330] }),
  N('style', 'sty_warm', 'Warm Crater Light', '🕯️', 'Crater colour: a warmer, golden grade over the ice.', 2500, 1, ['sty_gold'], [['styleWarm', 'set', 1]], 0, 0, { kind: 'mech', at: [900, 480] }),
  N('style', 'sty_wide', 'Wide Lens', '📷', 'Camera mode: a wider view.', 4000, 1, ['sty_warm'], [['styleWide', 'set', 1]], 0, 0, { kind: 'mech', at: [1110, 480] }),

  // 🍀 LUCK AND SECRETS: better capsules, aurora catches, needle hints, richer finds
  N('luck', 'lk_capsule', 'Lucky Seals', '🎁', 'Time capsules hold more.', 4000, 6, [], [['capsuleMult', 'add', 0.25]], 0, 0, { root: true, at: [-900, 640] }),
  N('luck', 'lk_aurora', 'Aurora Charm', '🌌', 'Auroras come more often and drop more coins.', 9000, 5, ['lk_capsule'], [['auroraRate', 'add', 0.2], ['auroraCoins', 'add', 0.2]], 0, 0, { at: [-1110, 640] }),
  N('luck', 'lk_needle', 'Needle Whisper', '🪡', 'A stronger pull toward the Golden Needle.', 15000, 3, ['lk_capsule'], [['hint', 'add', 1]], 0, 0, { at: [-900, 790] }),
  N('luck', 'lk_finds', 'Treasure Nose', '👃', 'Finds frozen in the ice pay more.', 6000, 8, ['lk_aurora'], [['findMult', 'add', 0.2]], 0, 0, { at: [-1110, 790] }),
  N('luck', 'lk_ledger', 'Hidden Ledger', '📒', 'Capstone of luck: a little more value and a few more clean breaks, everywhere.', 30000, 10, ['lk_finds', 'lk_needle'], [['valueMult', 'add', 0.01], ['crit', 'add', 0.01]], 0, 0, { at: [-1005, 930] }),

  // 🎼 AUDIO: music variations, an ambient layer and a sound pack (no income; for the ears)
  N('audio', 'aud_choir', 'Wind Choir', '🌬️', 'An ambient layer of slow bowed voices under the music. Pick it in the Music screen.', 40, 1, [], [['audioChoir', 'set', 1]], 0, 0, { root: true, kind: 'mech', at: [-900, -120] }),
  N('audio', 'aud_night', 'Night Variation', '🌙', 'A slower, darker version of every theme.', 120, 1, ['aud_choir'], [['audioNight', 'set', 1]], 0, 0, { kind: 'mech', at: [-1110, -120] }),
  N('audio', 'aud_glass', 'Glass Variation', '🔔', 'A quicker, brighter version of every theme, heavy on bells.', 900, 1, ['aud_night'], [['audioGlass', 'set', 1]], 0, 0, { kind: 'mech', at: [-1110, 30] }),
  N('audio', 'aud_pack', 'Crystal Picks', '💎', 'Sound pack: your pick rings like glass.', 2500, 1, ['aud_choir'], [['audioPack', 'set', 1]], 0, 0, { kind: 'mech', at: [-900, 30] }),

  // 🧬 DNA: unlocked by the mutant ice you have found (mutation), and twice the price of comparable nodes
  N('dna', 'dna_eyes', 'Night Eyes', '🌙', 'Glowice DNA. Your lamp reaches farther and the deep ice is brighter.', 300, 5, [], [['nightVision', 'add', 0.25]], 0, 0, { root: true, mutation: 'glowice', at: [-230, 640] }),
  N('dna', 'dna_legs', 'Spring Legs', '🦘', 'Springice DNA. You walk and climb faster.', 240, 8, [], [['walkSpeed', 'add', 0.06]], 0, 0, { root: true, mutation: 'springice', at: [0, 640] }),
  N('dna', 'dna_arms', 'Long Arms', '💪', 'Springice DNA. Reach farther with every tool.', 1600, 6, ['dna_legs'], [['reach', 'add', 0.3]], 0, 0, { mutation: 'springice', at: [0, 790] }),
  N('dna', 'dna_cold', 'Cold Blood', '🧊', 'Glowice DNA. The cold bothers you less: digging and melting both work a little harder.', 2400, 8, ['dna_eyes'], [['digRate', 'mul', 0.03], ['meltPower', 'mul', 0.04]], 0, 0, { mutation: 'glowice', at: [-230, 790] }),
  N('dna', 'dna_steady', 'Steady Hands', '🖐️', 'Tarfrost DNA. Faster, cleaner digging.', 5200, 10, [], [['digRate', 'mul', 0.05], ['digYield', 'add', 0.04]], 0, 0, { root: true, mutation: 'tarfrost', at: [230, 640] }),
  N('dna', 'dna_echo', 'Echo Sense', '📯', 'Chimeice DNA. Feel for treasure, and pull coins in from farther away.', 9000, 5, ['dna_steady'], [['hint', 'add', 1], ['collectRange', 'add', 0.4]], 0, 0, { mutation: 'chimeice', at: [230, 790] }),
  N('dna', 'dna_heatskin', 'Heat Skin', '🧯', 'Emberice DNA. Heat builds slower near lava, and a lava burst no longer scorches your pack.', 4000, 2, [], [['heatSkin', 'add', 0.5]], 0, 0, { root: true, mutation: 'emberice', at: [-460, 640] }),
  N('dna', 'dna_ember', 'Ember Heart', '❤️‍🔥', 'Emberice DNA. Hotter melting.', 7000, 8, ['dna_heatskin'], [['meltPower', 'mul', 0.06]], 0, 0, { mutation: 'emberice', at: [-460, 790] }),
  N('dna', 'dna_glass', 'Glass Eye', '🔮', 'Obsidice DNA. You see the seams in volcanic glass: clean breaks on rich ice.', 6000, 6, [], [['richCrit', 'add', 0.05]], 0, 0, { root: true, mutation: 'obsidice', at: [460, 640] }),
  N('dna', 'dna_hands', 'More Hands', '🙌', 'Capstone. Two tools at once: every strike lands twice, and the second hit opens its own crater.', 120000, 1, ['dna_arms', 'dna_steady'], [['hands', 'set', 1], ['digRate', 'mul', 0.1]], 0, 0, { kind: 'cap', mutation: 'tarfrost', at: [115, 930] }),
  N('dna', 'dna_salt', 'Salt Blood', '🧂', 'Brineice DNA. Your torch cuts a wider hole.', 5000, 6, [], [['meltRadius', 'add', 0.04]], 0, 0, { root: true, mutation: 'brineice', at: [690, 640] }),
  N('dna', 'dna_lungs', 'Deep Lungs', '🫁', 'Pearlice DNA. You carry more before you must go up.', 6000, 5, [], [['carry', 'add', 18]], 0, 0, { root: true, mutation: 'pearlice', at: [690, 790] }),
  N('dna', 'dna_wind', 'Wind Runner', '🌬️', 'Ventice DNA. You walk faster, and storms steal less of your heat.', 6000, 6, [], [['walkSpeed', 'add', 0.04], ['stormShield', 'add', 0.06]], 0, 0, { root: true, mutation: 'ventice', at: [-690, 640] }),
  N('dna', 'dna_storm', 'Storm Heart', '⚡', 'Stormglass DNA. Hotter melting.', 9000, 8, [], [['meltPower', 'mul', 0.05]], 0, 0, { root: true, mutation: 'stormglass', at: [-690, 790] }),
  N('dna', 'dna_sky', 'Sky Eyes', '🌠', 'Lumice DNA. Auroras and lone sky coins come more often.', 8000, 5, [], [['auroraRate', 'add', 0.1]], 0, 0, { root: true, mutation: 'lumice', at: [-345, 930] }),
  N('dna', 'dna_prism', 'Prism Hands', '🌈', 'Prismice DNA. Clean breaks everywhere.', 10000, 6, [], [['crit', 'add', 0.015]], 0, 0, { root: true, mutation: 'prismice', at: [345, 930] }),
  N('dna', 'dna_apex', 'Apex Form', '🧬', 'Capstone of DNA, for a body made from six worlds of ice: faster, longer reach, harder blows, hotter melting, sharper eyes.', 400000, 1, ['dna_hands', 'dna_salt', 'dna_wind', 'dna_sky'], [['walkSpeed', 'add', 0.1], ['reach', 'add', 0.4], ['digRate', 'mul', 0.06], ['meltPower', 'mul', 0.06], ['nightVision', 'add', 0.3]], 0, 0, { at: [0, 1080] }),
];

// The outer rings: costlier upgrades for the rest of every planet, and an endless Mastery in each main
// tree, so there is always something worth buying until the very end. Placed with explicit positions in
// the free space around each tree.
const RING = (tree, id, name, icon, desc, c0, max, parents, effects, at, extra = {}) => N(tree, id, name, icon, desc, c0, max, parents, effects, 0, 0, { at, ...extra });
NODES.push(
  // ⛏️ DIG: above the tree
  RING('dig', 'dig2_chisel', 'Frost Chisel', '🪛', 'A second edge for fine work: more of every coin comes out whole.', 4.5e6, 15, ['dig_master'], [['digYield', 'add', 0.04]], [-230, -1000]),
  RING('dig', 'dig2_balance', 'Balanced Head', '⚖️', 'A perfectly weighted head: quicker swings.', 6e6, 15, ['dig2_chisel'], [['digRate', 'mul', 0.03]], [-440, -1000]),
  RING('dig', 'dig2_split', 'Seam Splitter', '🪓', 'Clean breaks follow rich seams.', 9e6, 12, ['dig2_chisel'], [['richCrit', 'add', 0.03], ['crit', 'add', 0.006]], [-230, -1130]),
  RING('dig', 'dig2_granite', 'Granite Grip', '🧱', 'Heavy blows land harder.', 1.4e7, 12, ['dig2_balance'], [['heavyMult', 'add', 0.08]], [-650, -1000]),
  RING('dig', 'dig2_forge', 'Cold Forge', '🔥', 'Clean breaks free far more.', 2.2e7, 12, ['dig2_split'], [['critMult', 'add', 0.12]], [-440, -1130]),
  RING('dig', 'dig2_bore', 'Deep Bore', '🕳️', 'A wider bite at every tier.', 4e7, 15, ['dig2_granite', 'dig2_forge'], [['digRadius', 'add', 0.012]], [-650, -1130], { kind: 'mech' }),
  RING('dig', 'dig2_quake', 'Quake Strike', '💥', 'Every strike shakes loose a little more ice around it.', 9e7, 10, ['dig2_bore'], [['digRadius', 'mul', 0.025], ['digYield', 'add', 0.03]], [-860, -1130]),
  RING('dig', 'dig2_mastery', 'Dig Mastery', '♾️', 'Endless: every level makes digging a little better, forever.', 2e7, 400, ['dig2_bore'], [['digRate', 'mul', 0.012], ['digYield', 'add', 0.008]], [-650, -1260], { kind: 'cap' }),
  // 🔥 MELT: above the tree
  RING('melt', 'melt2_blue', 'Blue Flame', '🔵', 'A hotter, cleaner flame.', 1.2e7, 15, ['melt_master'], [['meltPower', 'add', 0.05]], [230, -1000]),
  RING('melt', 'melt2_sink', 'Heat Sink', '🧊', 'Less heat wasted on the air.', 1.6e7, 12, ['melt2_blue'], [['meltEff', 'add', 0.04]], [440, -1000]),
  RING('melt', 'melt2_lens', 'Thermal Lens', '🔍', 'Spread the heat wider without losing it.', 2.2e7, 12, ['melt2_blue'], [['meltRadius', 'add', 0.04]], [230, -1130]),
  RING('melt', 'melt2_flash', 'Flash Melt', '⚡', 'Ice you warm shatters wider under the pick.', 3e7, 10, ['melt2_sink'], [['shock', 'add', 0.08]], [650, -1000], { kind: 'mech' }),
  RING('melt', 'melt2_coil', 'Plasma Coil', '🌀', 'Coiled plasma: much stronger melting.', 5e7, 12, ['melt2_lens'], [['meltPower', 'mul', 0.035]], [440, -1130]),
  RING('melt', 'melt2_turbine', 'Steam Turbine', '♨️', 'Your steam drives a turbine that melts on its own.', 8e7, 12, ['melt2_flash', 'melt2_coil'], [['autoMelt', 'add', 0.06]], [650, -1130]),
  RING('melt', 'melt2_sun', 'Sun Core', '☀️', 'A pocket sun in the lance.', 1.6e8, 10, ['melt2_turbine'], [['meltPower', 'mul', 0.05], ['meltRadius', 'add', 0.03]], [860, -1130]),
  RING('melt', 'melt2_mastery', 'Melt Mastery', '♾️', 'Endless: every level makes melting a little better, forever.', 3e7, 400, ['melt2_turbine'], [['meltPower', 'mul', 0.012], ['meltEff', 'add', 0.006]], [650, -1260], { kind: 'cap' }),
  // 👁️ VISION: out to the left
  RING('vision', 'vis2_optics', 'Night Optics', '🌙', 'See further in the dark deep.', 3e6, 10, ['vis_clarity'], [['nightVision', 'add', 0.1], ['vision', 'add', 0.05]], [-1340, 560]),
  RING('vision', 'vis2_sense', 'Coin Sense', '🪙', 'Coins come to you from further away.', 5e6, 12, ['vis2_optics'], [['collectRange', 'add', 0.3]], [-1550, 560]),
  RING('vision', 'vis2_map', 'Seam Map', '🗺️', 'Read the seams further ahead: richer cuts.', 8e6, 12, ['vis2_optics'], [['vision', 'add', 0.08]], [-1340, 690]),
  RING('vision', 'vis2_glint', 'Glint Lens', '💎', 'Coins seen through the lens are worth more.', 1.5e7, 12, ['vis2_map'], [['valueMult', 'add', 0.02]], [-1550, 690]),
  RING('vision', 'vis2_scope', 'Prism Scope', '🔭', 'A stronger pull toward the Golden Needle, and finds glow brighter.', 3e7, 5, ['vis2_sense'], [['hint', 'add', 1]], [-1760, 560]),
  RING('vision', 'vis2_appraise', 'Appraiser', '🧐', 'You know a good coin when you see one.', 6e7, 12, ['vis2_glint'], [['valueMult', 'add', 0.025]], [-1550, 820]),
  RING('vision', 'vis2_mastery', 'Vision Mastery', '♾️', 'Endless: every level, coins are worth a little more, forever.', 2.5e7, 400, ['vis2_appraise'], [['valueMult', 'add', 0.004], ['collectRange', 'add', 0.02]], [-1340, 820], { kind: 'cap' }),
  // 🤖 AUTOMATION and the depot: out to the right
  RING('auto', 'dep_belt', 'Depot Conveyor', '🛤️', 'The depot takes your pack faster.', 120, 15, ['auto_pack'], [['deliver', 'mul', 0.22]], [1340, 110]),
  RING('auto', 'dep_intake', 'Twin Intakes', '🚪', 'A second intake at the depot.', 3500, 10, ['dep_belt'], [['deliver', 'add', 6]], [1550, 110]),
  RING('auto', 'dep_frame', 'Pack Frame', '🧳', 'A frame for a far bigger pack: trips up get rare.', 15000, 15, ['dep_belt'], [['carry', 'add', 60]], [1340, 240]),
  RING('auto', 'dep_chute', 'Pneumatic Chute', '📯', 'A chute from your pack to the depot: a trickle of coins goes up on its own while you dig.', 250000, 1, ['dep_intake', 'dep_frame'], [['chute', 'add', 0.8]], [1550, 240], { kind: 'mech' }),
  RING('auto', 'dep_pressure', 'Chute Pressure', '🌬️', 'More through the chute.', 900000, 12, ['dep_chute'], [['chute', 'add', 0.5]], [1760, 240]),
  RING('auto', 'auto2_picker', 'Auto Picker', '🦾', 'A picker arm that digs on its own.', 4e6, 12, ['auto_core'], [['autoDig', 'add', 0.08]], [1340, 560]),
  RING('auto', 'auto2_drone', 'Steam Drone', '🛸', 'A drone that melts on its own.', 6e6, 12, ['auto2_picker'], [['autoMelt', 'add', 0.08]], [1550, 560]),
  RING('auto', 'auto2_shift', 'Night Shift', '🌒', 'Work goes on while you are away.', 9e6, 10, ['auto2_picker'], [['offline', 'add', 0.04]], [1340, 690]),
  RING('auto', 'auto2_overdrive', 'Overdrive', '⏩', 'All automation runs harder.', 2.5e7, 12, ['auto2_drone', 'auto2_shift'], [['autoAll', 'mul', 0.035]], [1550, 690]),
  RING('auto', 'auto2_mastery', 'Automation Mastery', '♾️', 'Endless: every level, all automation a little stronger, forever.', 3e7, 400, ['auto2_overdrive'], [['autoAll', 'mul', 0.01], ['deliver', 'mul', 0.01]], [1550, 820], { kind: 'cap' }),
  // 🛰️ PLANET: up and right
  RING('planet', 'pl2_polish', 'Mirror Polish', '✨', 'Brighter mirrors.', 1.2e6, 12, ['pl_orbit'], [['mirrorPower', 'add', 0.25]], [1340, -150]),
  RING('planet', 'pl2_tune', 'Orbit Tuning', '🛰️', 'Mirrors hold their aim: more of the sunlight reaches the ice.', 4e6, 10, ['pl2_polish'], [['meltEff', 'add', 0.03]], [1550, -150]),
  RING('planet', 'pl2_ring', 'Sun Ring', '💍', 'A ring of mirrors in orbit.', 1.5e7, 10, ['pl2_tune'], [['mirrorPower', 'add', 0.4], ['autoMelt', 'add', 0.03]], [1550, -280]),
  // 🌡️ CLIMATE: left
  RING('climate', 'cl2_albedo', 'Albedo Drop', '🌑', 'Darker ice drinks in the sun.', 2e5, 10, ['cl_green'], [['meltEff', 'add', 0.03]], [-1340, 250]),
  RING('climate', 'cl2_current', 'Warm Current', '🌊', 'A warmer sea: coins rise with the water.', 8e5, 10, ['cl2_albedo'], [['valueMult', 'add', 0.015]], [-1550, 250]),
  RING('climate', 'cl2_jet', 'Jet Stream', '🌪️', 'Steady winds carry heat to the pole.', 3e6, 10, ['cl2_current'], [['meltPower', 'mul', 0.025], ['stormShield', 'add', 0.05]], [-1550, 380]),
  // 🍀 LUCK: below
  RING('luck', 'lk2_chest', 'Chest Hunter', '🧰', 'Chests hold more.', 50000, 10, ['lk_ledger'], [['chestMult', 'add', 0.15]], [-900, 1060]),
  RING('luck', 'lk2_strike', 'Lucky Strike', '🎲', 'Clean breaks come more often.', 2e5, 10, ['lk2_chest'], [['crit', 'add', 0.006]], [-1110, 1060]),
  RING('luck', 'lk2_gold', 'Golden Touch', '👑', 'Everything you find is worth a little more.', 1.5e6, 12, ['lk2_strike'], [['valueMult', 'add', 0.015]], [-1110, 1190]),
);

// Spread the graph so no two nodes overlap: the side trees move outward, DNA moves down below Vision and
// Automation, and the outer columns of Vision, Automation, Planet and Climate go further out still.
{
  const SHIFT = { planet: [260, 0], style: [260, 0], climate: [-260, 0], luck: [-260, 0], audio: [-260, 0], dna: [0, 440] };
  const OUTER = { vision: -300, auto: 300, planet: 300, climate: -300 };
  const T = Object.fromEntries(TREES.map((t) => [t.id, t]));
  for (const n of NODES) {
    const [ox, oy] = T[n.tree].origin;
    const at = n.at ? [...n.at] : [ox * (230 + n.gx * 210), oy * (110 + n.gy * 124)];
    const sh = SHIFT[n.tree] || [0, 0];
    at[0] += sh[0]; at[1] += sh[1];
    if (OUTER[n.tree] && /2_|^dep_/.test(n.id)) at[0] += OUTER[n.tree] + (n.tree === 'planet' || n.tree === 'climate' ? sh[0] : 0);   // the new outer columns
    if (sh[0] || sh[1] || n.at) n.at = at;
  }
  for (const t of TREES) if (SHIFT[t.id] && t.label) t.label = [t.label[0] + SHIFT[t.id][0], t.label[1] + SHIFT[t.id][1]];
}

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

// Base stats before any upgrade.
export const BASE_STATS = {
  digTier: 1, digRadius: 0.5, digRate: 1.5, digYield: 1, crit: 0, critMult: 2,
  meltTier: 0, meltPower: 0, meltRadius: 0, meltEff: 1,
  visionTier: 0, vision: 1, hint: 0,
  collectRange: 2.2, collect: 0, autoCollect: 0, reach: 3.2,
  carry: 120, liftSpeed: 1.5, bank: 0, deliver: 12, chute: 0, chestMult: 0,
  autoDig: 0, autoMelt: 0, autoAll: 1, offline: 0.25,
  valueMult: 1,
  // tool interplay: warmed ice digs out wider (shock), cracked ice melts faster (seep)
  shock: 0.6, seep: 0.5, heatLinger: 1, heavyMult: 1.55, richCrit: 0, steamBurst: 0, pipes: 0,
  // DNA
  nightVision: 0, walkSpeed: 1, hands: 0, heatSkin: 0,
  // Audio
  audioChoir: 0, audioNight: 0, audioGlass: 0, audioPack: 0,
  // Planet
  planetTier: 0, mirrorPower: 0, stormShield: 0,
  autoTool: 0, autoBuy: 0,
  // Luck
  capsuleMult: 0, auroraRate: 0, auroraCoins: 0, findMult: 0,
  // Style
  styleGold: 0, styleObsid: 0, styleWarm: 0, styleWide: 0,
};
