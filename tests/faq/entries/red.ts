// FAQ conformance matrix: Red cards. See tests/faq/matrix.ts for the format.
import type { FaqEntry } from '../matrix';

export const RED: FaqEntry[] = [
  // 6th Street Recruits #1
  { id: 'ed0b637f-567a-418c-a759-ab8deb631ce4', scope: 'card', cardId: '6th_street_recruits', paraphrase: '6th Street Recruits triggers once for each d6 when a Unit steals two d6 at once', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Adam Smasher: Ender of Legends #1
  { id: '4dc5a7cb-cb53-4a44-bcd4-33e373dafbd3', scope: 'card', cardId: 'adam_smasher_ender_of_legends', paraphrase: 'Calling Adam Smasher (turning it face-up) does not trigger its {Play}', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Adam Smasher: Ender of Legends #2
  { id: '439b43af-068f-4296-923b-fd7a55ec73a9', scope: 'card', cardId: 'adam_smasher_ender_of_legends', paraphrase: 'Playing Adam Smasher with Go Solo triggers its {Play}', status: 'covered', test: 'tests/red.test.ts > Adam Smasher Ender of Legends defeats a rival Unit when going solo' },
  // Adam Smasher: Ender of Legends #3
  { id: '89104f80-8329-4ad9-85ff-cb23f3320d53', scope: 'card', cardId: 'adam_smasher_ender_of_legends', paraphrase: 'Adam Smasher sent anywhere but the Legends area or field is removed from the game', status: 'covered', test: 'tests/faq/red.test.ts' },
  // All is Lost #1
  { id: '6f7d6a80-3536-4417-bbb8-c27485f07557', scope: 'card', cardId: 'all_is_lost', paraphrase: 'All is Lost must add a Unit from among the trashed cards when one is there', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'The choice offered \'None\'; millAndTake (scripts/helpers.ts) now makes the pick mandatory when a card matches.' },
  // All is Lost #2
  { id: '086fb943-7bfb-4fee-8645-01f3cf132232', scope: 'card', cardId: 'all_is_lost', paraphrase: 'All is Lost only takes from the cards it trashed, never a Unit already in the trash', status: 'covered', test: 'tests/faq/red.test.ts' },
  // All is Lost #3
  { id: '8227301d-f845-4e94-b4ff-556fd7c9e5d0', scope: 'card', cardId: 'all_is_lost', paraphrase: 'All is Lost with two cards left trashes both, and that does not lose the game', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Appetite for Destruction #1
  { id: 'f7e7ce23-ddae-4f92-a770-e2e7a0fe368e', scope: 'card', cardId: 'appetite_for_destruction', paraphrase: 'Appetite for Destruction names a friendly Unit on the field as it resolves; only that Unit can benefit', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'The delayed trigger applied to any friendly Unit, including ones played after it resolved; it now asks for the Unit on resolution.' },
  // Appetite for Destruction #2
  { id: 'dd350a6e-8ee0-4c1f-9418-2d22a5160c40', scope: 'card', cardId: 'appetite_for_destruction', paraphrase: 'The Unit that won the fight is the one stealing the Gig from Appetite for Destruction', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Appetite for Destruction #3
  { id: '82802953-08ff-450a-8630-517546b3091a', scope: 'card', cardId: 'appetite_for_destruction', paraphrase: 'Appetite for Destruction still steals when the losing Unit cannot be defeated in a fight', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Arasaka Emergency Radioport #1
  { id: 'd3587386-2389-4745-b6e9-8953bc790bfe', scope: 'card', cardId: 'arasaka_emergency_radioport', paraphrase: 'Radioport\'s when-spent effect and an {Attack} trigger pending together can be ordered; Radioport may resolve fully (Call) first', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Arasaka Emergency Radioport #2
  { id: '7ea458e4-bb1c-4d06-b02c-0caf6bccbfdc', scope: 'card', cardId: 'arasaka_emergency_radioport', paraphrase: 'A Unit equipped with Arasaka Emergency Radioport does not gain its tags (it is not ARASAKA)', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Bonnie and Clyde #1
  { id: 'b3bcae3f-acb3-4891-a985-4d69fea65fc7', scope: 'card', cardId: 'bonnie_and_clyde', paraphrase: 'Bonnie and Clyde may defeat just one Unit even when it is allowed two', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Bonnie and Clyde #2
  { id: 'e4f428d9-4dfe-4d12-a42a-5755ae5afc79', scope: 'card', cardId: 'bonnie_and_clyde', paraphrase: 'Bonnie and Clyde can be played with no rival Units', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Carnage at the Colosseum #1
  { id: '31ed50ec-6a68-4eff-9f47-fc232e4e90e6', scope: 'card', cardId: 'carnage_at_the_colosseum', paraphrase: 'Carnage at the Colosseum\'s discount lowers the €$ paid, not its cost value', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Chrome Fang #1
  { id: '42c38a1d-103c-4c9a-adf0-e199853a16e9', scope: 'card', cardId: 'chrome_fang', paraphrase: 'Chrome Fang\'s steal ban from the rival\'s turn still binds my Adrenaline Unit on my turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Chrome Fang #2
  { id: 'eb37dc38-f33d-49c8-aade-383f879945c8', scope: 'card', cardId: 'chrome_fang', paraphrase: 'Chrome Fang\'s steal ban lasts until its controller\'s next turn even if Chrome Fang is defeated', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Chrome Fang #3
  { id: '28a0d1ab-e3a1-4dd4-a952-b0ad4403f831', scope: 'card', cardId: 'chrome_fang', paraphrase: 'Under Chrome Fang a Gig whose value equals the attacker\'s power can still be stolen', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Chrome Fang #4
  { id: '18a0c359-400b-43de-9055-c7fc79baf415', scope: 'card', cardId: 'chrome_fang', paraphrase: 'Under Chrome Fang the Gig area can still be attacked even when every Gig is above the attacker\'s power', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Chrome Fang #5
  { id: 'fa5d28f5-57df-451f-8246-cd8949f324ad', scope: 'card', cardId: 'chrome_fang', paraphrase: 'An extra steal from an effect also cannot take a Gig above the Unit\'s power under Chrome Fang', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Deadman Transmitter #1
  { id: '307b211e-ebe4-46db-9baa-e652918576fe', scope: 'card', cardId: 'deadman_transmitter', paraphrase: 'With two Deadman Transmitters, only one is defeated in place of the Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Deadman Transmitter #2
  { id: '4b85693e-f6d3-4895-8606-e9917f6c706a', scope: 'card', cardId: 'deadman_transmitter', paraphrase: 'A Unit saved by Deadman Transmitter in a fight still lost that fight', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Deadman Transmitter #3
  { id: 'fa2a899b-1345-4714-b803-4bc5c2f04f1d', scope: 'card', cardId: 'deadman_transmitter', paraphrase: 'A Unit equipped with Deadman Transmitter does not gain its tags', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Detonate #1
  { id: '2ae2b855-aecf-4b12-9858-234649764cf1', scope: 'card', cardId: 'detonate', paraphrase: 'Detonate may defeat Gear on a face-up Legend, in the Legends area or on the field', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Detonate #2
  { id: 'c459acd1-042d-47ae-9278-3cdd05d98283', scope: 'card', cardId: 'detonate', paraphrase: 'Detonate can be played with no rival Gear to defeat', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Dexter DeShawn: Off the Grid #1
  { id: '47feaf18-6dff-4cf7-b24f-ba01d2a92514', scope: 'card', cardId: 'dexter_deshawn_off_the_grid', paraphrase: 'Dexter DeShawn\'s Call may choose the +2 power effect even with no friendly Unit', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'With no friendly Unit only \'Draw 1\' was offered; both effects are now always offered.' },
  // Dexter DeShawn: Off the Grid #2
  { id: 'f868fe18-6a35-457a-9ed5-004b48956db9', scope: 'card', cardId: 'dexter_deshawn_off_the_grid', paraphrase: 'A {Quick} card drawn by Dexter DeShawn\'s Call in a React step can be played in that same React step', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Dexter DeShawn: Off the Grid #3
  { id: '2a8619f2-2d2b-4b22-a190-623617b0b515', scope: 'card', cardId: 'dexter_deshawn_off_the_grid', paraphrase: 'Dexter DeShawn\'s Spend ability may increase a friendly or a rival Gig', status: 'covered', test: 'tests/faq/red.test.ts' },
  // El Sombrerón: La Venganza Lenta #1
  { id: '2984e648-802f-48da-9ecd-0e0c0434f9e3', scope: 'card', cardId: 'el_sombreron_la_venganza_lenta', paraphrase: 'El Sombrerón may use any friendly max Gig when there are several', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'The script always used the highest-valued max Gig; it now asks which one (highest first) when their values differ.' },
  // El Sombrerón: La Venganza Lenta #2
  { id: '71386fef-475e-4a5f-9a81-084f6a32f02b', scope: 'card', cardId: 'el_sombreron_la_venganza_lenta', paraphrase: 'El Sombrerón\'s power gain is fixed when it resolves; later Gig changes don\'t alter it', status: 'covered', test: 'tests/faq/red.test.ts' },
  // El Sombrerón: La Venganza Lenta #3
  { id: 'a51b1f00-a914-4586-8baf-9926b76fcbec', scope: 'card', cardId: 'el_sombreron_la_venganza_lenta', paraphrase: 'El Sombrerón\'s 2 €$ payment may be declined', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Gunpoint Diplomacy #1
  { id: '2a901389-f319-4b65-ae4b-00483f4e80f5', scope: 'card', cardId: 'gunpoint_diplomacy', paraphrase: 'Gunpoint Diplomacy\'s two effects apply in printed order; the player cannot reorder them', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Gunpoint Diplomacy #2
  { id: 'e4e22bef-839b-49d6-9bed-8a34f59b95ce', scope: 'card', cardId: 'gunpoint_diplomacy', paraphrase: 'When the rival picks Gunpoint Diplomacy\'s effect, the player still picks the Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Industrial Assembly #1
  { id: 'ad3b75f8-1401-485f-891d-7e54fdbfe30f', scope: 'card', cardId: 'industrial_assembly', paraphrase: 'Industrial Assembly may increase a Gig by 0', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Industrial Assembly #2
  { id: '2f4ce47f-25ba-4321-a673-809fc8f75bd7', scope: 'card', cardId: 'industrial_assembly', paraphrase: 'Industrial Assembly may increase a rival\'s Gig', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Industrial Assembly #3
  { id: '8f2d9cb3-7782-4200-b06a-0ac764ed27cb', scope: 'card', cardId: 'industrial_assembly', paraphrase: 'Industrial Assembly can be played with no Gig to increase', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Japantown Jonin #1
  { id: 'cce96f5d-9d4d-4a30-b6ba-5e49c53280dc', scope: 'card', cardId: 'japantown_jonin', paraphrase: 'Japantown Jonin\'s {Play} may target itself', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Never Stop Fighting #1
  { id: '3cfb42c3-4d87-44db-9b06-7f48c24b912f', scope: 'card', cardId: 'johnny_silverhand_never_stop_fighting', paraphrase: 'Johnny Silverhand (Never Stop Fighting) is always the winner against a CORPO Unit, whatever the power', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Never Stop Fighting #2
  { id: 'e512816e-a856-491a-896b-fde16d661ea7', scope: 'card', cardId: 'johnny_silverhand_never_stop_fighting', paraphrase: 'Johnny\'s ready-on-first-win triggers on the rival\'s turn too', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Never Stop Fighting #3
  { id: 'd33a4200-b3f8-48ee-8a83-35c113ee45da', scope: 'card', cardId: 'johnny_silverhand_never_stop_fighting', paraphrase: 'Johnny\'s first win of the turn uses up the trigger even if he was already ready', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Never Stop Fighting #4
  { id: '69794180-6e80-4a4c-b0dc-df8c290bdc19', scope: 'card', cardId: 'johnny_silverhand_never_stop_fighting', paraphrase: 'Johnny at 0 power does not defeat the CORPO Unit he fights', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Rocking Renegade #1
  { id: '97a58f36-cd0e-4e0b-9be0-b1ff61a9d2b4', scope: 'card', cardId: 'johnny_silverhand_rocking_renegade', paraphrase: 'Johnny Silverhand (Rocking Renegade)\'s ability costs 0 €$ with two friendly 8+ Gigs', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Rocking Renegade #2
  { id: '7af4302f-2f3e-4ddc-9445-fe0ac9f755d7', scope: 'card', cardId: 'johnny_silverhand_rocking_renegade', paraphrase: 'Rocking Renegade\'s ability may choose a Unit already on the field from an earlier turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Rocking Renegade #3
  { id: 'e403c866-e7b1-4982-8c0c-0b7d672b7185', scope: 'card', cardId: 'johnny_silverhand_rocking_renegade', paraphrase: 'A Unit from an earlier turn chosen by Rocking Renegade can still attack the Gig area', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Rocking Renegade #4
  { id: '2e51228f-cea1-4185-9cd0-6a859932232b', scope: 'card', cardId: 'johnny_silverhand_rocking_renegade', paraphrase: 'A Rocker played this turn with Rocking Renegade\'s effect plus \'may attack ready Units\' can attack a ready Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Johnny Silverhand: Rocking Renegade #5
  { id: '2ffc8e87-969a-4e5c-8329-ee8ac132f2bd', scope: 'card', cardId: 'johnny_silverhand_rocking_renegade', paraphrase: 'Rocking Renegade\'s permission combined with \'may attack ready Units\' lets a just-played Unit attack ready Units', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Kerry Eurodyne: The Last Rockerboy #1
  { id: 'd23941b5-53c4-4036-b19d-cfa8bf059c5a', scope: 'card', cardId: 'kerry_eurodyne_the_last_rockerboy', paraphrase: 'Kerry Eurodyne (Last Rockerboy)\'s Spend ability can\'t be used the turn he is played', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Kerry Eurodyne: The Last Rockerboy #2
  { id: '1da9b201-025a-487d-b49b-b1c8523579a8', scope: 'card', cardId: 'kerry_eurodyne_the_last_rockerboy', paraphrase: 'Kerry Eurodyne\'s Spend can be activated without an 8+ Gig; it then draws nothing', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'The ability was only offered with an 8+ Gig; the condition is now checked on resolution only (tests/library-cards.test.ts updated).' },
  // Kerry Eurodyne: The Last Rockerboy #3
  { id: '498e223a-b488-4fc8-a8cf-35f5e800543a', scope: 'card', cardId: 'kerry_eurodyne_the_last_rockerboy', paraphrase: 'Kerry Eurodyne readied after using his Spend can use it again that turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // La Llorona: Ghost of the Past #1
  { id: '7cf45f7a-84df-4193-9f28-656d3054d183', scope: 'card', cardId: 'la_llorona_ghost_of_the_past', paraphrase: 'La Llorona\'s Gig increase from blocking happens before the fight', status: 'covered', test: 'tests/faq/red.test.ts' },
  // La Llorona: Ghost of the Past #2
  { id: '10236d8a-b781-4d18-8857-57f7b3555983', scope: 'card', cardId: 'la_llorona_ghost_of_the_past', paraphrase: 'La Llorona can block an attack another Unit already blocked in the same React step', status: 'covered', test: 'tests/faq/red.test.ts' },
  // La Llorona: Ghost of the Past #3
  { id: '287826c0-e5e6-4383-ab1a-a24314ebc44d', scope: 'card', cardId: 'la_llorona_ghost_of_the_past', paraphrase: 'La Llorona\'s \'up to 3\' allows 0, 1, 2 or 3', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Mantis Blades #1
  { id: 'dd7abf4b-52b3-4401-bfc3-ef07ce5974f6', scope: 'card', cardId: 'mantis_blades', paraphrase: 'A Unit equipped with Mantis Blades does not gain its tags', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Meredith Stout: Stone Cold Corpo #1
  { id: 'ae3bd50b-b937-4a8a-8c8a-24dab0acd367', scope: 'card', cardId: 'meredith_stout_stone_cold_corpo', paraphrase: 'Meredith Stout triggers once for a rival swap even though Gigs move on both sides', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Minotaur #1
  { id: '1528eec2-100f-4436-9874-d45f3589e9af', scope: 'card', cardId: 'minotaur', paraphrase: 'Minotaur\'s {Play} must defeat a valid rival Unit if one exists', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Octant #1
  { id: '79a2970c-40e7-4d7f-a419-57a4b8eb3c76', scope: 'card', cardId: 'octant', paraphrase: 'Octant\'s discount lowers the €$ paid, not its cost value', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Over the Edge #1
  { id: '3aec4fa6-6b30-466a-a4a8-7449ce7ab078', scope: 'card', cardId: 'over_the_edge', paraphrase: 'Over the Edge without a friendly d20 defeats nothing, even a 0-power Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Over the Edge #2
  { id: '6b61f796-5665-4ae0-bb6a-4b607cb20b28', scope: 'card', cardId: 'over_the_edge', paraphrase: 'Over the Edge may defeat a friendly Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Over the Edge #3
  { id: '00b41165-2bad-41c3-8a4a-be0c6747f4d7', scope: 'card', cardId: 'over_the_edge', paraphrase: 'Over the Edge can be played without a friendly d20', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Over the Edge #4
  { id: '995ef005-e877-4ffd-9fb4-2ac61ab90889', scope: 'card', cardId: 'over_the_edge', paraphrase: 'A d20 in the fixer area is not a friendly Gig', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Royce: Don't Call Me Simon #1
  { id: '506cd2e9-d647-404d-a713-14e340241fcc', scope: 'card', cardId: 'royce_don_t_call_me_simon', paraphrase: 'Royce (Don\'t Call Me Simon)\'s {Play} must defeat a valid rival Unit', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Royce: Don't Call Me Simon #2
  { id: '3ae8916f-514c-47dd-b078-a5844f21277d', scope: 'card', cardId: 'royce_don_t_call_me_simon', paraphrase: 'Royce (Simon) uses current power: a 4-power Unit lowered to 2 is a target', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Royce: Psycho on the Edge #1
  { id: '4c90424e-2603-4927-8bbd-067de4332a36', scope: 'card', cardId: 'royce_psycho_on_the_edge', paraphrase: 'Gear can be equipped to a face-up Royce (Psycho) in the Legends area', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Royce: Psycho on the Edge #2
  { id: '46c436af-2ee0-4b1a-b7d5-03df43ed5203', scope: 'card', cardId: 'royce_psycho_on_the_edge', paraphrase: 'Royce (Psycho) in the Legends area gets +2 per equipped Gear during your turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Royce: Psycho on the Edge #3
  { id: '903ccbd0-d2d9-46e0-9ffc-cd5ebddef04a', scope: 'card', cardId: 'royce_psycho_on_the_edge', paraphrase: 'A defeated Legend is removed from the game while its Gear stays in the trash', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Ruthless Lowlife #1
  { id: '76746ab1-b325-427c-a8ca-499dcff97fb3', scope: 'card', cardId: 'ruthless_lowlife', paraphrase: 'Ruthless Lowlife forced to attack with no rival Units still can\'t attack the Gig area', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Satori: Sword of Saburo #1
  { id: 'd9ad00b9-ab93-498f-a6fa-bab6d833d949', scope: 'card', cardId: 'satori_sword_of_saburo', paraphrase: 'Satori does not draw when both fighters lose on equal power', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Satori: Sword of Saburo #2
  { id: '8ba81187-0232-4320-b876-cae87a389ea5', scope: 'card', cardId: 'satori_sword_of_saburo', paraphrase: 'Satori draws when its Unit wins a fight while defending on the rival\'s turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Screw: Lovelorn Fool #1
  { id: '461379b1-06dd-4753-91b2-1fdabc5024e0', scope: 'card', cardId: 'screw_lovelorn_fool', paraphrase: 'Screw\'s {Defeated} must add another Unit from the trash if one is there', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Screw: Lovelorn Fool #2
  { id: '0db0dbe4-a10b-458b-9b5c-9e478b71c615', scope: 'card', cardId: 'screw_lovelorn_fool', paraphrase: 'Screw\'s {Defeated} may add another copy of Screw', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Shattered Memories #1
  { id: '0d03437c-9149-4ee7-8006-7bb8fd044608', scope: 'card', cardId: 'shattered_memories', paraphrase: 'Shattered Memories can be played when a player\'s hand is empty', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Swordwise Huscle #1
  { id: 'c41cdb0c-25d6-47ec-8c4c-5bb900a14b3e', scope: 'card', cardId: 'swordwise_huscle', paraphrase: 'Swordwise Huscle checks power when its {Attack} resolves; reaching 5 later draws nothing', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Valentino Guerrera #1
  { id: 'fbe43ae0-a606-4391-8183-342a43213365', scope: 'card', cardId: 'valentino_guerrera', paraphrase: 'A ready Blocker attacked by Valentino Guerrera cannot use Blocker itself', status: 'covered', test: 'tests/faq/red.test.ts' },
  // V: Roamer of the Badlands #1
  { id: '9eee394b-2dc7-4750-a5ef-5cb0fc988ee9', scope: 'card', cardId: 'v_roamer_of_the_badlands', paraphrase: 'V (Roamer of the Badlands) triggers once per Gig when stealing two at once', status: 'covered', test: 'tests/faq/red.test.ts' },
  // V: Streetkid #1
  { id: '1dd664ff-e61f-4b15-8e96-45f0dd31a13a', scope: 'card', cardId: 'v_streetkid', paraphrase: 'V (Streetkid)\'s Call must add a BRAINDANCE Program from the trash when there is one', status: 'covered', test: 'tests/faq/red.test.ts' },
  // V: Streetkid #2
  { id: 'ba7d3b2f-96f6-4570-8e03-b7f514512d9a', scope: 'card', cardId: 'v_streetkid', paraphrase: 'V (Streetkid)\'s Call trashes the last two cards when only two remain', status: 'covered', test: 'tests/faq/red.test.ts' },
  // V: Streetkid #3
  { id: '15ebfd43-82fa-4e07-a8e5-2432562e32ef', scope: 'card', cardId: 'v_streetkid', paraphrase: 'V (Streetkid)\'s Call adds just one BRAINDANCE Program however many are trashed', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Yorinobu Arasaka: Embracing Destruction #1
  { id: '61ad63b3-47d9-48ee-a3f6-4c2842b11c66', scope: 'card', cardId: 'yorinobu_arasaka_embracing_destruction', paraphrase: 'Yorinobu (Embracing Destruction) Called after an ARASAKA attack does not trigger on a later one that turn', status: 'covered', test: 'tests/engine-fixes.test.ts > Yorinobu (Embracing Destruction) does not draw for the second Arasaka attack after being Called' },
  // Yorinobu Arasaka: Embracing Destruction #2
  { id: '05b95e35-b2a6-4f3d-a7a4-01c4ad87e196', scope: 'card', cardId: 'yorinobu_arasaka_embracing_destruction', paraphrase: 'Yorinobu (Embracing Destruction) triggers only on the first ARASAKA attack each turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Yorinobu Arasaka: Steel Dragon #1
  { id: '16ff9b92-68eb-4215-9e05-eaa8bcd9afa4', scope: 'card', cardId: 'yorinobu_arasaka_steel_dragon', paraphrase: 'A Unit played by Yorinobu (Steel Dragon) that has Adrenaline can attack the Gig area that turn', status: 'covered', test: 'tests/faq/red.test.ts' },
  // Yorinobu Arasaka: Steel Dragon #2
  { id: '6e649617-ec75-42db-a1b0-a3c2b1ebee6c', scope: 'card', cardId: 'yorinobu_arasaka_steel_dragon', paraphrase: 'Yorinobu (Steel Dragon)\'s own defeat counts as the first ARASAKA defeat and draws 1', status: 'fixed', test: 'tests/faq/red.test.ts', note: 'Its unitDefeated trigger ran after it had left play, so its own defeat never drew; the script now looks back from its defeat (g.firstThisTurn).' },
  // Yorinobu Arasaka: Steel Dragon #3
  { id: 'd2074e1b-4efa-4cfb-bc7a-0ca063fcf804', scope: 'card', cardId: 'yorinobu_arasaka_steel_dragon', paraphrase: 'Yorinobu (Steel Dragon) played after an ARASAKA defeat does not draw for a later one that turn', status: 'covered', test: 'tests/engine-fixes.test.ts > Yorinobu (Steel Dragon) does not draw if an Arasaka Unit was already defeated this turn' },
  // Yorinobu Arasaka: Steel Dragon #4
  { id: 'e9b2a0af-407e-4b34-801e-1bd130e0e099', scope: 'card', cardId: 'yorinobu_arasaka_steel_dragon', paraphrase: 'Yorinobu (Steel Dragon)\'s permission to attack rival Units still needs a spent target', status: 'covered', test: 'tests/faq/red.test.ts' },
];
