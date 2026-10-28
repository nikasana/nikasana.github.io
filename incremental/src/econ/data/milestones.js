// Planet milestones (coin bonuses) and crew milestones (permanent shared bonuses).
// bonus: seconds of current income paid out (so it scales with progress).

// kind: depth (crater m), sea (cm), volume (m³ removed), heat (heat spread 0..1), or act (a counter
// in econ.actions: sky coins, finds, capsules, needle, wind windows, best chain or vein combo).
export const MILESTONES = [
  { id: 'crater25', name: 'Crater 25 m', icon: '🕳️', planet: '*', kind: 'depth', value: 25, bonusSec: 60, motif: 0 },
  { id: 'sea5', name: '5 cm sea level rise', icon: '🌊', planet: '*', kind: 'sea', value: 5, bonusSec: 90, motif: 1 },
  { id: 'crater100', name: 'Crater 100 m', icon: '🕳️', planet: '*', kind: 'depth', value: 100, bonusSec: 90, motif: 2 },
  { id: 'lake', name: 'A lake of meltwater: 10,000 m³', icon: '💧', planet: '*', kind: 'volume', value: 1e4, bonusSec: 90, motif: 0 },
  { id: 'capsule1', name: 'First time capsule', icon: '📦', planet: '*', kind: 'act', key: 'capsules', value: 1, bonusSec: 60, motif: 1 },
  { id: 'sea25', name: '25 cm sea level rise', icon: '🌊', planet: '*', kind: 'sea', value: 25, bonusSec: 90, motif: 2 },
  { id: 'needle', name: 'The Golden Needle', icon: '🪡', planet: '*', kind: 'act', key: 'needle', value: 1, bonusSec: 90, motif: 0 },
  { id: 'crater500', name: 'Crater 500 m', icon: '🕳️', planet: '*', kind: 'depth', value: 500, bonusSec: 120, motif: 1 },
  { id: 'poleFree', name: 'Pole ice free', icon: '🧭', planet: '*', kind: 'heat', value: 0.9, bonusSec: 120, motif: 2 },
  { id: 'sea100', name: '1 m sea level rise', icon: '🌊', planet: '*', kind: 'sea', value: 100, bonusSec: 120, motif: 0 },
  { id: 'crater1k', name: 'Crater 1 km', icon: '🕳️', planet: '*', kind: 'depth', value: 1000, bonusSec: 150, motif: 1 },
  // one for each world's own rule
  { id: 'frost_hall', name: 'Ice cathedral: 50,000 m³ cut', icon: '🏛️', planet: 'frostara', kind: 'volume', value: 5e4, bonusSec: 120, motif: 2 },
  { id: 'mist_finds', name: 'Lamp in the fog: 8 finds', icon: '🏮', planet: 'mistral', kind: 'act', key: 'finds', value: 8, bonusSec: 90, motif: 0 },
  { id: 'cind_vein', name: 'Vein runner: a ×4 heat vein combo', icon: '🔥', planet: 'cinderice', kind: 'act', key: 'veinBest', value: 4, bonusSec: 90, motif: 1 },
  { id: 'tide_high', name: 'High tide: 50 cm sea level rise', icon: '🌊', planet: 'tidalis', kind: 'sea', value: 50, bonusSec: 120, motif: 2 },
  { id: 'gale_eye', name: 'Eye of the storm: melt through 10 wind windows', icon: '🌪️', planet: 'gale', kind: 'act', key: 'windows', value: 10, bonusSec: 90, motif: 0 },
  { id: 'aur_chain', name: 'Aurora Chain of 10', icon: '🌌', planet: 'auralis', kind: 'act', key: 'chainBest', value: 10, bonusSec: 90, motif: 1 },
  { id: 'aur_sky', name: 'Sky harvest: 100 sky coins', icon: '✨', planet: 'auralis', kind: 'act', key: 'sky', value: 100, bonusSec: 120, motif: 2 },
];

export const CREW_MILESTONES = [
  { id: 'crew_melt1k', name: 'Melt 1,000 m³ together', icon: '🔥', kind: 'crewVolume', value: 1000, bonus: { income: 1.05 } },
  { id: 'crew_coins', name: 'Bank 10,000 coins together', icon: '🪙', kind: 'crewBanked', value: 1e4, bonus: { income: 1.05 } },
  { id: 'crew_depth', name: 'Reach 50 m as a crew', icon: '⛏️', kind: 'crewDepth', value: 50, bonus: { dig: 1.05 } },
  { id: 'crew_hour', name: 'Play an hour together', icon: '⏳', kind: 'crewTime', value: 3600, bonus: { income: 1.04 } },
  { id: 'crew_sky', name: 'Catch 100 sky coins together', icon: '🌌', kind: 'crewSky', value: 100, bonus: { income: 1.04 } },
  { id: 'crew_caps', name: 'Open 5 time capsules together', icon: '📦', kind: 'crewCapsules', value: 5, bonus: { melt: 1.05 } },
  { id: 'crew_roles', name: 'A mixed crew: three roles at once', icon: '🤝', kind: 'crewRoles', value: 3, bonus: { income: 1.05 } },
  { id: 'crew_melt50k', name: 'Melt 50,000 m³ together', icon: '🌋', kind: 'crewVolume', value: 5e4, bonus: { melt: 1.06 } },
  { id: 'crew_bank1m', name: 'Bank 1,000,000 coins together', icon: '🏦', kind: 'crewBanked', value: 1e6, bonus: { income: 1.06 } },
  { id: 'crew_world', name: 'Cross to another world together', icon: '🪐', kind: 'crewPlanets', value: 1, bonus: { income: 1.06 } },
  { id: 'crew_km', name: 'Melt 1 km down together', icon: '🕳️', kind: 'crewDepth', value: 1000, bonus: { dig: 1.08 } },
];

// Crew Roles (optional): specialise in one tool tree for a bonus on it; a crew with a mix of roles
// shares an income bonus. Roles only count while you are in a crew.
export const ROLES = [
  { id: 'digger', name: 'Digger', icon: '⛏️', tree: 'dig', desc: 'Dig tree specialist: +15% dig speed.', stat: ['digRate', 1.15] },
  { id: 'melter', name: 'Melter', icon: '🔥', tree: 'melt', desc: 'Melt tree specialist: +15% melt power.', stat: ['meltPower', 1.15] },
  { id: 'seer', name: 'Seer', icon: '👁️', tree: 'vision', desc: 'Vision tree specialist: pull coins from 30% farther.', stat: ['collectRange', 1.3] },
  { id: 'engineer', name: 'Engineer', icon: '⚙️', tree: 'auto', desc: 'Automation tree specialist: +15% automatic work.', stat: ['autoAll', 1.15] },
];
export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));
// shared bonus for the number of different roles in the crew right now
export const roleMix = (distinct) => 1 + 0.04 * Math.max(0, distinct - 1);

// Time capsules. puzzle: a trick needed before it opens.
//   heat:  frost-sealed; melt the ice right next to it for `need` seconds
//   light: fog-sealed; hold the focused lamp on it for `need` seconds
//   tide:  tide-sealed; once freed, wait beside it for `need` seconds while the tide turns
export const CAPSULES = [
  { id: 'cap_frost_1', planet: 'frostara', depth: 14, name: 'Survey Capsule', contents: { coinsSec: 120, lore: 'A brass tube of star charts. The stars are in the wrong places.' } },
  { id: 'cap_frost_2', planet: 'frostara', depth: 42, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 4 }, contents: { coinsSec: 240, lore: 'A logbook in a language of dots. The last page is a drawing of this crater, already dug.' } },
  { id: 'cap_frost_3', planet: 'frostara', depth: 130, name: 'Choir Capsule', contents: { coinsSec: 420, lore: 'A music box that plays the planet\'s theme a little faster than you have heard it.' } },
  { id: 'cap_mist_1', planet: 'mistral', depth: 9, name: 'Lantern Capsule', puzzle: { kind: 'light', need: 3 }, contents: { coinsSec: 150, lore: 'A lantern with no wick. It lights when you look at it.' } },
  { id: 'cap_mist_2', planet: 'mistral', depth: 48, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 5 }, contents: { coinsSec: 280, lore: 'Seeds, still frozen, labelled with the names of seven worlds.' } },
  { id: 'cap_mist_3', planet: 'mistral', depth: 150, name: 'Breath Capsule', puzzle: { kind: 'light', need: 4 }, contents: { coinsSec: 480, lore: 'A glass jar of fog. When you open it the fog outside thins for a moment.' } },
  { id: 'cap_cind_1', planet: 'cinderice', depth: 11, name: 'Ash Capsule', contents: { coinsSec: 160, lore: 'A tin of matches, every one struck, packed with care.' } },
  { id: 'cap_cind_2', planet: 'cinderice', depth: 55, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 6 }, contents: { coinsSec: 320, lore: 'A map of the lava veins, drawn by someone who walked along them.' } },
  { id: 'cap_cind_3', planet: 'cinderice', depth: 170, name: 'Ember Capsule', puzzle: { kind: 'light', need: 4 }, contents: { coinsSec: 520, lore: 'A coal that is still warm, wrapped in a letter that says: keep it lit.' } },
  { id: 'cap_tide_1', planet: 'tidalis', depth: 10, name: 'Driftwood Capsule', contents: { coinsSec: 170, lore: 'A bottle with a note in it: the current runs clockwise, and so does time here.' } },
  { id: 'cap_tide_2', planet: 'tidalis', depth: 60, name: 'Tide-sealed Capsule', puzzle: { kind: 'tide', need: 6 }, contents: { coinsSec: 340, lore: 'A tide table for a sea that froze a thousand years ago. Tomorrow is marked high.' } },
  { id: 'cap_tide_3', planet: 'tidalis', depth: 180, name: 'Shell Capsule', puzzle: { kind: 'heat', need: 6 }, contents: { coinsSec: 560, lore: 'A spiral shell. Hold it to your ear and you hear your own pick, far below.' } },
  { id: 'cap_gale_1', planet: 'gale', depth: 12, name: 'Weathervane Capsule', contents: { coinsSec: 180, lore: 'A weathervane that always points down.' } },
  { id: 'cap_gale_2', planet: 'gale', depth: 65, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 7 }, contents: { coinsSec: 360, lore: 'A barometer stuck on "Change". Someone has scratched "soon" beside it.' } },
  { id: 'cap_gale_3', planet: 'gale', depth: 190, name: 'Kite Capsule', puzzle: { kind: 'light', need: 5 }, contents: { coinsSec: 600, lore: 'A paper kite, folded small. The string is very, very long.' } },
  { id: 'cap_aur_1', planet: 'auralis', depth: 12, name: 'Star Capsule', puzzle: { kind: 'light', need: 4 }, contents: { coinsSec: 190, lore: 'A jar of something that glows green, then violet, then green.' } },
  { id: 'cap_aur_2', planet: 'auralis', depth: 70, name: 'Tide-sealed Capsule', puzzle: { kind: 'tide', need: 8 }, contents: { coinsSec: 380, lore: 'A sky chart with the auroras drawn in as rivers.' } },
  { id: 'cap_aur_3', planet: 'auralis', depth: 200, name: 'Choir Capsule', puzzle: { kind: 'heat', need: 8 }, contents: { coinsSec: 640, lore: 'Seven tuning forks, one for each world. Six of them are humming.' } },
];

export const NEEDLES = {
  frostara: { depthMin: 35, depthMax: 60, rewardSec: 600 },
  mistral: { depthMin: 40, depthMax: 70, rewardSec: 700 },
  cinderice: { depthMin: 45, depthMax: 80, rewardSec: 800 },
  tidalis: { depthMin: 45, depthMax: 85, rewardSec: 850 },
  gale: { depthMin: 50, depthMax: 90, rewardSec: 900 },
  auralis: { depthMin: 50, depthMax: 95, rewardSec: 950 },
};
