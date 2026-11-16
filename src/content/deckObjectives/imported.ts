// Deck objectives for library decks imported from shared links (scripts/import-links.ts, docs/DECK_IMPORT.md): decks
// other players built and shared on choom.gg or cyberpunk-tcg-sim.online, whose header's Origin starts "Imported from".
// The command-line step adds one line here for each deck it writes, `'<file>': importedPlaceholder('<listId>', [<the
// three Legends>]),`: a `needs-owner` placeholder tied to the list, so the test suite passes. To write a deck's note,
// the owner replaces that importedPlaceholder(...) call with a full note object (the fields in ./vocabulary.ts, as in
// the other tables of this folder) and sets `status: 'owner'`. The placeholders are one call each because every game
// worker carries this table (src/ai/packages.ts reads the notes' synergies), so a placeholder costs a line, not a note.
import type { DeckObjective, ObjectiveTable } from './vocabulary';

/**
 * The placeholder note of an imported deck, the one definition of its words: tied to the list, the Legends as its key
 * cards, two plan lines and two signals for the owner to replace. A fresh object on every call.
 */
export function importedPlaceholder(listId: string, legends: readonly string[]): DeckObjective {
  return {
    listId,
    objective: 'Placeholder: an imported deck; the owner writes its note.',
    plan: [
      { phase: 'early', text: 'Placeholder: to be written by the owner.' },
      { phase: 'closing', text: 'Placeholder: to be written by the owner.' },
    ],
    keyCards: [...new Set(legends)].map((id) => ({ id, role: 'Legend.' })),
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'The first Gig stolen by round 4', terms: ['first-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  };
}

export const IMPORTED_OBJECTIVES: ObjectiveTable = {
  'import-discord-5k-1-smasher-river-reyes-ryy.txt': importedPlaceholder('b304c27396a06e82', ['river_ward_detective_on_the_hunt', 'adam_smasher_ender_of_legends', 'muamar_reyes_el_capitan']),
  'import-discord-5k-2-jackie-alt-hanako-bbg.txt': importedPlaceholder('ea9c3ecbf1a7f9de', ['jackie_welles_pour_one_out_for_me', 'alt_cunningham_soulkiller_architect', 'hanako_arasaka_daughter_of_the_emperor']),
  'import-discord-5k-3-smasher-river-viktor-ryy.txt': importedPlaceholder('7d4d4fa3bc95f94d', ['adam_smasher_ender_of_legends', 'river_ward_detective_on_the_hunt', 'viktor_vektor_sit_down_and_relax']),
  'import-discord-5k-4-jackie-alt-hanako-bbg.txt': importedPlaceholder('ce2f062981fe76d2', ['jackie_welles_pour_one_out_for_me', 'alt_cunningham_soulkiller_architect', 'hanako_arasaka_daughter_of_the_emperor']),
  'import-discord-5k-5-v-smasher-padre-rrg.txt': importedPlaceholder('ed49b03d1aaca128', ['v_streetkid', 'adam_smasher_ender_of_legends', 'padre_man_of_the_cross']),
  'import-discord-5k-6-jackie-alt-hanako-bbg.txt': importedPlaceholder('1f877a91f82bb1bb', ['alt_cunningham_soulkiller_architect', 'jackie_welles_pour_one_out_for_me', 'hanako_arasaka_daughter_of_the_emperor']),
  'import-discord-5k-7-smasher-river-viktor-ryy.txt': importedPlaceholder('95e79a39a67668bb', ['river_ward_detective_on_the_hunt', 'viktor_vektor_sit_down_and_relax', 'adam_smasher_ender_of_legends']),
  'import-discord-5k-8-v-smasher-saburo-rrg.txt': importedPlaceholder('8f9412a543230da8', ['saburo_arasaka_stubborn_patriarch', 'adam_smasher_ender_of_legends', 'v_streetkid']),
  'import-ladder-s1-1-v-smasher-padre-rrg.txt': importedPlaceholder('8ae99326b1f93b7d', ['adam_smasher_ender_of_legends', 'padre_man_of_the_cross', 'v_streetkid']),
  'import-ladder-s1-2-v-smasher-saburo-rrg.txt': importedPlaceholder('16141b3be2bf22c2', ['adam_smasher_ender_of_legends', 'saburo_arasaka_stubborn_patriarch', 'v_streetkid']),
  'import-ladder-s1-3-smasher-dexter-saburo-rrg.txt': importedPlaceholder('3c962618a3babce7', ['adam_smasher_ender_of_legends', 'dexter_deshawn_off_the_grid', 'saburo_arasaka_stubborn_patriarch']),
  'import-ladder-s1-4-v-padre-jackie-rgg.txt': importedPlaceholder('51a1196a3827dcb4', ['jackie_welles_mama_s_favorite', 'padre_man_of_the_cross', 'v_streetkid']),
  'import-ladder-s1-5-v-smasher-dum-dum-rry.txt': importedPlaceholder('550cfc2b7b685094', ['adam_smasher_ender_of_legends', 'dum_dum_maelstrom_triggerman', 'v_streetkid']),
  'import-ladder-s1-6-dexter-v-reyes-rry.txt': importedPlaceholder('dc379bb349a94491', ['dexter_deshawn_off_the_grid', 'muamar_reyes_el_capitan', 'v_streetkid']),
  'import-ladder-s1-7-dexter-v-padre-rrg.txt': importedPlaceholder('59dc83d3008d81b9', ['dexter_deshawn_off_the_grid', 'padre_man_of_the_cross', 'v_streetkid']),
  'import-ladder-s1-8-smasher-river-viktor-ryy.txt': importedPlaceholder('3750a5b13c344cae', ['adam_smasher_ender_of_legends', 'river_ward_detective_on_the_hunt', 'viktor_vektor_sit_down_and_relax']),
  'import-ladder-s1-9-river-reyes-rogue-yyy.txt': importedPlaceholder('d4c58ffe5fbbc984', ['muamar_reyes_el_capitan', 'river_ward_detective_on_the_hunt', 'rogue_amendiares_preem_solo']),
  'import-ladder-s1-10-jackie-judy-hanako-bbg.txt': importedPlaceholder('7cd8fe59c2bc6286', ['hanako_arasaka_daughter_of_the_emperor', 'jackie_welles_pour_one_out_for_me', 'judy_alvarez_braindance_maestro']),
  // new imported decks are added above this line (scripts/import-links.ts)
};
