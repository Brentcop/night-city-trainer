// The cards the tutorial's lessons use: plain ones, so each lesson is about one rule and nothing else happens.
export const C = {
  psycho: 'psycho_squad', // Blue Unit, 4 €$, power 6, no text
  atlus: 'emergency_atlus', // Green Unit, 3 €$, power 4, no text
  rocker: 'rockn_rockerboy', // Yellow Unit, 5 €$, power 8, no text
  wrecker: 'animals_wrecker', // Red Unit, 6 €$, power 10, no text
  meredith: 'meredith_stout_stone_cold_corpo', // Red Unit, 4 €$, power 5, Blocker
  corpoSecurity: 'corpo_security', // Green Unit, 2 €$, power 2, Blocker, can't attack
  surveillance: 'corporate_surveillance', // Green Program, 2 €$: spend a rival Unit with cost 4 or less
  takeControl: 'take_control', // Green Program, 2 €$, Quick: a rival Unit steals 1 fewer Gig this turn
  assembly: 'industrial_assembly', // Red Program, 1 €$: increase a Gig by up to 4 (8+: draw 1)
  blades: 'mantis_blades', // Red Gear, 1 €$, +2 power, no text
  v: 'v_corporate_exile', // Blue Legend, Go Solo for 5 €$, power 8
  saburo: 'saburo_arasaka_stubborn_patriarch', // Green Legend: only helps ARASAKA Units (none here)
  yorinobu: 'yorinobu_arasaka_embracing_destruction', // Red Legend: only triggers on ARASAKA Units (none here)
  muamar: 'muamar_reyes_el_capitan', // Yellow Legend (face-down in these lessons)
} as const;

/** Three Legends that do nothing in these lessons (face-down, or face-up with no Unit they help). */
export const QUIET_LEGENDS = [C.saburo, C.yorinobu, C.muamar] as const;
