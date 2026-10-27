// Planet milestones (coin bonuses) and crew milestones (permanent shared bonuses).
// bonus: seconds of current income paid out (so it scales with progress).

export const MILESTONES = [
  { id: 'crater25', name: 'Crater 25 m', icon: '🕳️', planet: '*', kind: 'depth', value: 25, bonusSec: 60, motif: 0 },
  { id: 'sea5', name: '5 cm sea level rise', icon: '🌊', planet: '*', kind: 'sea', value: 5, bonusSec: 90, motif: 1 },
];

export const CREW_MILESTONES = [
  { id: 'crew_melt1k', name: 'Melt 1,000 m³ together', icon: '🔥', kind: 'crewVolume', value: 1000, bonus: { income: 1.05 } },
  { id: 'crew_coins', name: 'Bank 10,000 coins together', icon: '🪙', kind: 'crewBanked', value: 1e4, bonus: { income: 1.05 } },
  { id: 'crew_depth', name: 'Reach 50 m as a crew', icon: '⛏️', kind: 'crewDepth', value: 50, bonus: { dig: 1.05 } },
];

// Time capsules. puzzle: a trick needed before it opens.
//   heat:  frost-sealed; melt the ice right next to it for `need` seconds
//   light: fog-sealed; hold the focused lamp on it for `need` seconds
export const CAPSULES = [
  { id: 'cap_frost_1', planet: 'frostara', depth: 14, name: 'Survey Capsule', contents: { coinsSec: 120, lore: 'A brass tube of star charts. The stars are in the wrong places.' } },
  { id: 'cap_frost_2', planet: 'frostara', depth: 42, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 4 }, contents: { coinsSec: 240, lore: 'A logbook in a language of dots. The last page is a drawing of this crater, already dug.' } },
  { id: 'cap_frost_3', planet: 'frostara', depth: 130, name: 'Choir Capsule', contents: { coinsSec: 420, lore: 'A music box that plays the planet\'s theme a little faster than you have heard it.' } },
  { id: 'cap_mist_1', planet: 'mistral', depth: 9, name: 'Lantern Capsule', puzzle: { kind: 'light', need: 3 }, contents: { coinsSec: 150, lore: 'A lantern with no wick. It lights when you look at it.' } },
  { id: 'cap_mist_2', planet: 'mistral', depth: 48, name: 'Frost-sealed Capsule', puzzle: { kind: 'heat', need: 5 }, contents: { coinsSec: 280, lore: 'Seeds, still frozen, labelled with the names of seven worlds.' } },
  { id: 'cap_mist_3', planet: 'mistral', depth: 150, name: 'Breath Capsule', puzzle: { kind: 'light', need: 4 }, contents: { coinsSec: 480, lore: 'A glass jar of fog. When you open it the fog outside thins for a moment.' } },
];

export const NEEDLES = {
  frostara: { depthMin: 35, depthMax: 60, rewardSec: 600 },
};
