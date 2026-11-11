// FAQ conformance matrix: Yellow cards. See tests/faq/matrix.ts for the format.
import type { FaqEntry } from '../matrix';

export const YELLOW: FaqEntry[] = [
  // Adam Smasher: Metal Over Meat #1
  { id: 'a40401c6-6467-486a-9e91-a0e95a95b210', scope: 'card', cardId: 'adam_smasher_metal_over_meat', paraphrase: "Its {Play} still resolves when it is played during the rival's turn (e.g. by The Relic).", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Adrenaline Converter #1
  { id: 'fc82d674-d5c0-42f8-9fd9-a47a71be9ec7', scope: 'card', cardId: 'adrenaline_converter', paraphrase: 'Adrenaline from the Gear is checked when attacking: if the rival is no longer 2+ Gigs ahead, the Unit played this turn cannot attack.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Adrenaline Converter #2
  { id: '21a17dbf-59fe-41b0-a076-015b380c8f44', scope: 'card', cardId: 'adrenaline_converter', paraphrase: "An equipped Unit or Legend does not take on its Gear's tags.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Afterparty at Lizzie's #1
  { id: 'e81b51a1-5dd8-4a2b-9bb8-28b93b227bee', scope: 'card', cardId: 'afterparty_at_lizzie_s', paraphrase: 'Adjusting by 0 still lets you draw if you control 2+ Gigs with different values.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Afterparty at Lizzie's #2
  { id: '76dce69b-77b1-4461-aec1-d2cc7a71526f', scope: 'card', cardId: 'afterparty_at_lizzie_s', paraphrase: 'Playable even when there is no Gig to adjust.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Alt Cunningham: Mother of Daemons #1
  { id: '9c300537-ed1f-4196-a9c7-076dc5fd4603', scope: 'card', cardId: 'alt_cunningham_mother_of_daemons', paraphrase: "Both of its effects work on either player's turn.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Augmented Negotiators #1
  { id: '1dc1d892-bdbf-46a6-a217-ab452b6c0c63', scope: 'card', cardId: 'augmented_negotiators', paraphrase: 'It may use Blocker even if the rival has no cards in hand.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Bootleg Black Sapphire Show #1
  { id: '63c9a5f8-27f2-485d-a779-79587ac49d91', scope: 'card', cardId: 'bootleg_black_sapphire_show', paraphrase: 'The sold top card is not revealed.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Bootleg Black Sapphire Show #2
  { id: '71cfd404-4021-41e1-bebe-a468e11f0a3d', scope: 'card', cardId: 'bootleg_black_sapphire_show', paraphrase: 'You cannot look at the top card to check it can be sold; it is sold regardless of the sell tag.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Bootleg Black Sapphire Show #3
  { id: '68737f4d-0d40-42b9-b490-30d02b06544f', scope: 'card', cardId: 'bootleg_black_sapphire_show', paraphrase: "The effect sells even if you already used this turn's Sell action.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Bootleg Black Sapphire Show #4
  { id: '303bd280-4d2b-40a6-9fa3-662ab125767f', scope: 'card', cardId: 'bootleg_black_sapphire_show', paraphrase: "The effect does not use up this turn's Sell action.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Caliber: Totentanz's Top Dog #1
  { id: '31c66530-6c62-4ba8-a521-e34ec9be6b01', scope: 'card', cardId: 'caliber_totentanz_s_top_dog', paraphrase: 'Its {Play} must defeat a rival Unit with cost 2 or less if one exists.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Caliber: Totentanz's Top Dog #2
  { id: '03bc1552-a6ba-410b-8c26-4fbc895a57d5', scope: 'card', cardId: 'caliber_totentanz_s_top_dog', paraphrase: '{Defeated}: the extra discard does not chain into a third even if its cost also matches a friendly Gig.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Cyberpsychosis #1
  { id: 'b59cc194-67ee-4b3e-9e4e-6858131f2903', scope: 'card', cardId: 'cyberpsychosis', paraphrase: 'It may target an equipped rival Unit or an equipped friendly Unit.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Cyberpsychosis #2
  { id: '0f661d5c-bfc7-4c2a-8174-b4f98e7d8b61', scope: 'card', cardId: 'cyberpsychosis', paraphrase: 'Played on an attacking rival Unit in the React step: if it then steals, it is defeated at the end of the turn.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Cyberpsychosis #3
  { id: '0a4c62a0-f5aa-4b7e-9341-db86caf28c81', scope: 'card', cardId: 'cyberpsychosis', paraphrase: 'A target that attacks but neither fights nor steals is not defeated at the end of the turn.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Cyberpsychosis #4
  { id: '9c061c73-93ac-4b63-bdf4-b7768623dad1', scope: 'card', cardId: 'cyberpsychosis', paraphrase: 'Steals or fights before Cyberpsychosis resolved do not count toward the end-of-turn defeat.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Dexter DeShawn: One Last Chance #1
  { id: 'ac95df60-d8dd-44bc-b04f-1246a08a8540', scope: 'card', cardId: 'dexter_deshawn_one_last_chance', paraphrase: 'Adjusting a Gig by 0 with its {Play}/{Attack} does not count as adjusting a Gig.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Dum Dum: Maelstrom Triggerman #1
  { id: '94144c1c-7f0c-4bb0-898f-a9edaa1d0cd9', scope: 'card', cardId: 'dum_dum_maelstrom_triggerman', paraphrase: 'Its {Quick} ability may target a friendly Unit with no Gear equipped.', status: 'fixed', test: 'tests/faq/yellow.test.ts', note: 'Fixed in src/engine/scripts/yellow.ts: the ability was only usable with, and only offered, a Unit that had Gear.' },
  // Dum Dum: Maelstrom Triggerman #2
  { id: 'bfb1adc4-7e30-4d4c-8219-c62ee23df515', scope: 'card', cardId: 'dum_dum_maelstrom_triggerman', paraphrase: 'The +1 per Gear is locked in when it resolves; defeating the Gear later does not remove it.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Gilded Matón #1
  { id: 'db8d72b0-4892-45a9-82fb-9d7cf1df3791', scope: 'card', cardId: 'gilded_maton', paraphrase: 'Its {Play} may defeat a friendly Gear even when there is no rival Unit with cost 3 or less.', status: 'fixed', test: 'tests/faq/yellow.test.ts', note: 'Fixed in src/engine/scripts/yellow.ts: the {Play} skipped the Gear choice when no rival Unit with cost 3 or less existed.' },
  // Gorilla Arms #1
  { id: '978f0a21-058a-4676-8366-ce220a6f6aa4', scope: 'card', cardId: 'gorilla_arms', paraphrase: "Its extra steal is a steal by the equipped Unit, so the Unit's own steal triggers fire for it.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Gorilla Arms #2
  { id: 'cc4b6cc1-d357-448e-a021-7181a3b51b81', scope: 'card', cardId: 'gorilla_arms', paraphrase: 'Stealing 2 Gigs at once is one first steal: Gorilla Arms triggers once.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Heywood Ripperdoc #1
  { id: '89eca244-872c-4c28-bf2c-7dbf294e0e6c', scope: 'card', cardId: 'heywood_ripperdoc', paraphrase: 'Its {Play} may defeat a Gear whose cost matches no friendly Gig (no draw then).', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Jackie Welles: Ride or Die Choom #1
  { id: '801aa9c8-c507-44e9-89c1-3477c1f8a2b1', scope: 'card', cardId: 'jackie_welles_ride_or_die_choom', paraphrase: 'The {Attack} power bonus stays if a counted even Gig later turns odd.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Jackie Welles: Ride or Die Choom #2
  { id: 'c61101be-05ed-46e3-b027-d05f5981632f', scope: 'card', cardId: 'jackie_welles_ride_or_die_choom', paraphrase: 'Gaining another even Gig after the {Attack} resolved adds no more power.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Kerry Eurodyne: Axe, Attitude, Audience #1
  { id: '91ff465b-38fc-45b1-8db2-d8cbe6b465cc', scope: 'card', cardId: 'kerry_eurodyne_axe_attitude_audience', paraphrase: 'A min/max roll rerolled into a non-min/max value does not draw: only the final result counts.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Kiroshi Optics #1
  { id: '22d75516-cd32-4b86-bce5-915d075c3ec3', scope: 'card', cardId: 'kiroshi_optics', paraphrase: 'Its {Attack} must look at a friendly face-down Legend.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Live with the Aftermath #1
  { id: '3c7f6d4d-2ff5-42a8-a56b-71767d912551', scope: 'card', cardId: 'live_with_the_aftermath', paraphrase: 'Playable with no friendly Unit in the field.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Live with the Aftermath #2
  { id: 'a391a6fc-a480-4d18-b451-438ba58948e1', scope: 'card', cardId: 'live_with_the_aftermath', paraphrase: 'Playable with no rival Unit in the field.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Live with the Aftermath #3
  { id: '8ebfb418-5733-4153-a981-8076cb0e9f41', scope: 'card', cardId: 'live_with_the_aftermath', paraphrase: 'Playable when neither player has a Unit in the field.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Maelstrom Goons #1
  { id: 'bd1e1e2f-a20a-40dc-be90-265bfcb367aa', scope: 'card', cardId: 'maelstrom_goons', paraphrase: 'Equipped and stealing 2+ Gigs in one Steal step, it triggers once per Gig.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // MaxTac Suppression Team #1
  { id: '00a253c5-f0a2-4f13-a7a3-520c703c2402', scope: 'card', cardId: 'maxtac_suppression_team', paraphrase: 'A Legend that went solo this turn cannot attack while the rival has this Unit.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // MaxTac Suppression Team #2
  { id: '8923c8fb-4c07-4d04-84af-c759285c212a', scope: 'card', cardId: 'maxtac_suppression_team', paraphrase: 'Once this Unit is defeated, a rival Adrenaline Unit played earlier that turn may attack.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Muamar Reyes: El Capitán #1
  { id: '63f515ca-17b9-40ee-83ae-30abb4404bb4', scope: 'card', cardId: 'muamar_reyes_el_capitan', paraphrase: "The can't-be-defeated-in-a-fight mode may be chosen with no friendly Units; it does nothing then.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Muamar Reyes: El Capitán #2
  { id: '329babc2-5aa7-40ee-a760-126d86bdc2c5', scope: 'card', cardId: 'muamar_reyes_el_capitan', paraphrase: 'The protection applies to every fight that Unit has this turn.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Muamar Reyes: El Capitán #3
  { id: 'c155d52c-a1ee-42f6-8698-13721cb2b6b9', scope: 'card', cardId: 'muamar_reyes_el_capitan', paraphrase: "A Unit that can't be defeated in a fight can still lose the fight.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Muamar Reyes: El Capitán #4
  { id: '58c1eb56-21db-410b-842a-b06c4e931848', scope: 'card', cardId: 'muamar_reyes_el_capitan', paraphrase: 'It does not stop a defeat caused by an effect during the Fight step.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Offduty Malfini #1
  { id: 'b91fa741-e2c0-4974-8663-74d7f661d3e3', scope: 'card', cardId: 'offduty_malfini', paraphrase: 'Its {Play} spends it even with no rival Unit to spend.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // River Ward: Detective on the Hunt #1
  { id: '88707f62-0eaf-4383-9304-c28a50c995e3', scope: 'card', cardId: 'river_ward_detective_on_the_hunt', paraphrase: 'Its ability may be activated even when no Gear ends up played from your hand.', status: 'fixed', test: 'tests/faq/yellow.test.ts', note: 'Fixed in src/engine/scripts/yellow.ts: the ability needed a Gear with cost 2 or less in hand (and a host) to be activated.' },
  // River Ward: Detective on the Hunt #2
  { id: '81489d83-54af-42d9-a5b3-8eb4e5399ae6', scope: 'card', cardId: 'river_ward_detective_on_the_hunt', paraphrase: 'The free Gear may be equipped to any valid friendly host, not only River Ward.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // River Ward: Detective on the Hunt #3
  { id: 'a6ed37cc-f3f9-42e6-8246-0edf668b0bc5', scope: 'card', cardId: 'river_ward_detective_on_the_hunt', paraphrase: 'Its second effect must trash 1 of the top 2 cards.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // River Ward: Detective on the Hunt #4
  { id: '28a594b5-9188-4f9b-9d3d-8e0100d6ce5e', scope: 'card', cardId: 'river_ward_detective_on_the_hunt', paraphrase: 'The card not trashed by its second effect stays on top of the deck.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Rogue Amendiares: Preem Solo #1
  { id: 'e4837808-b775-4bbb-8e98-6c5c8441324e', scope: 'card', cardId: 'rogue_amendiares_preem_solo', paraphrase: 'Rogue stealing a Gig herself (gone solo) triggers her second effect.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Rogue Amendiares: Preem Solo #2
  { id: 'c66b9c47-a74d-4293-89ae-3d04bbb5bf92', scope: 'card', cardId: 'rogue_amendiares_preem_solo', paraphrase: 'Face-up in the Legends area, she triggers when another friendly Legend steals.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Rogue Amendiares: Preem Solo #3
  { id: 'b0f84fb0-46ee-4b99-ba25-565731cebbc8', scope: 'card', cardId: 'rogue_amendiares_preem_solo', paraphrase: "A defeated Legend's Gear goes to the trash and stays there while the Legend is removed from the game.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Safety Override #1
  { id: '6b38d8b1-470f-402a-aeca-024e1db97b4d', scope: 'card', cardId: 'safety_override', paraphrase: 'On resolution you choose a friendly Unit in the field; only its next lost fight this turn triggers the defeat.', status: 'fixed', test: 'tests/faq/yellow.test.ts', note: "Fixed in src/engine/scripts/yellow.ts: it chose no Unit and fired on any friendly Unit's next lost fight, including Units played later." },
  // Safety Override #2
  { id: 'b9a0ac9f-8d03-47e3-beb8-6f064cee49c0', scope: 'card', cardId: 'safety_override', paraphrase: 'The friendly Unit is still defeated for losing the fight when Safety Override defeats its opponent.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Sketchy Ripper #1
  { id: '9e6de445-d9cb-42cc-8e94-20c941da7cd9', scope: 'card', cardId: 'sketchy_ripper', paraphrase: 'Its {Attack} may reveal no Gear even if one is among the top 3; all 3 go to the bottom.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // T-Bug: Amateur Philosopher #1
  { id: '2110a5e9-a27c-42b5-b3e4-ca464f1d2dd0', scope: 'card', cardId: 't_bug_amateur_philosopher', paraphrase: 'The face-down Legends looked at by its {Defeated} are not revealed.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // T-Bug: Amateur Philosopher #2
  { id: '2a1bca2f-eaca-4418-baeb-96aab1b4e476', scope: 'card', cardId: 't_bug_amateur_philosopher', paraphrase: 'Its {Defeated} looks at all friendly face-down Legends.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // The Heist #1
  { id: '8151aa53-358f-4d39-b3f6-58b165127b8e', scope: 'card', cardId: 'the_heist', paraphrase: 'If a Gear was trashed, you must add one to your hand.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // The Heist #2
  { id: '4f2133a0-c3cc-4955-9815-6026ed16735d', scope: 'card', cardId: 'the_heist', paraphrase: 'A Gear whose cost matches a friendly Gig need not be played for free; it may go to hand.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // The Relic: Experimental Biochip #1
  { id: '91373c98-159f-48e1-a231-045b5fe34631', scope: 'card', cardId: 'the_relic_experimental_biochip', paraphrase: 'Bottom-decking the defeated Unit leaves The Relic itself in the trash.', status: 'covered', test: 'tests/yellow.test.ts > The Relic: host defeated -> play a Unit from trash for free, bottom-deck the host' },
  // Trauma Team Operatives #1
  { id: 'b7e62adb-5a98-482e-8ec7-39fc3d176aa1', scope: 'card', cardId: 'trauma_team_operatives', paraphrase: 'Its discount lowers the €$ paid, not its cost value.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Viktor Vektor: Drop Your Illusions #1
  { id: '80577b2c-f335-442e-9476-b2e38d0d03dd', scope: 'card', cardId: 'viktor_vektor_drop_your_illusions', paraphrase: "The -3 €$ also applies to a Cyberware Gear played on the rival's turn.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Viktor Vektor: Drop Your Illusions #2
  { id: '449ecd14-296c-4431-b445-261265f89c1d', scope: 'card', cardId: 'viktor_vektor_drop_your_illusions', paraphrase: 'The -3 €$ on your first Cyberware Gear is not optional.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Viktor Vektor: Drop Your Illusions #3
  { id: '9047f2f5-b97d-47ae-964c-11e58ed5e4b6', scope: 'card', cardId: 'viktor_vektor_drop_your_illusions', paraphrase: "The -3 €$ does not change the Gear's cost value.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Viktor Vektor: Sit Down and Relax #1
  { id: '03d7a874-2d53-4fc9-9f7d-905cebcedcc7', scope: 'card', cardId: 'viktor_vektor_sit_down_and_relax', paraphrase: 'Its {Call} may reveal no Gears even if valid ones are among the top 5; all 5 go to the bottom.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Viktor Vektor: You Might Feel a Little Pinch #1
  { id: '602f90aa-bda8-44dc-97b6-f3e23e59918f', scope: 'card', cardId: 'viktor_vektor_you_might_feel_a_little_pinch', paraphrase: 'Its {Play} must play a Cyberware Gear (cost 2 or less) from the trash if one can be played.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Zetatech Faceplate #1
  { id: 'a4b85193-1647-4001-a076-846f54d54481', scope: 'card', cardId: 'zetatech_faceplate', paraphrase: 'Spent to declare an attack, its trigger resolves before the React step.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Zetatech Faceplate #2
  { id: '9f87591e-514c-44ee-bba4-515fc488fb77', scope: 'card', cardId: 'zetatech_faceplate', paraphrase: "Its spend trigger and the Unit's {Attack} become pending together; the player picks the order.", status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Zetatech Faceplate #3
  { id: '9b281489-5883-47ca-80a9-fa6707655b12', scope: 'card', cardId: 'zetatech_faceplate', paraphrase: 'Spent to activate a {Spend} ability, it resolves only after that ability.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
  // Zetatech Faceplate #4
  { id: '62c60c04-72ec-4231-9ea7-f5b8048eb4d8', scope: 'card', cardId: 'zetatech_faceplate', paraphrase: 'A Legend wearing it spent to pay for a Program: it resolves only after the Program finishes.', status: 'covered', test: 'tests/faq/yellow.test.ts' },
];
