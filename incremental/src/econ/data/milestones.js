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

export const CAPSULES = [
  { id: 'cap_frost_1', planet: 'frostara', depth: 14, name: 'Survey Capsule', contents: { coinsSec: 120, lore: 'A brass tube of star charts. The stars are in the wrong places.' } },
];

export const NEEDLES = {
  frostara: { depthMin: 35, depthMax: 60, rewardSec: 600 },
};
