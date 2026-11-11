// FAQ conformance matrix: Blue cards. See tests/faq/matrix.ts for the format.
import type { FaqEntry } from '../matrix';

export const BLUE: FaqEntry[] = [
  // Alt Cunningham: Soulkiller Architect #1
  { id: 'f6e95797-6d5e-4a78-b1ab-dbc01b1821f4', scope: 'card', cardId: 'alt_cunningham_soulkiller_architect', paraphrase: "Alt Cunningham's next-Program reduction also applies to (and is used up by) a Program played from the trash.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Alt Cunningham: Soulkiller Architect #2
  { id: 'c2b026c3-6e44-4b3e-97db-abef28faa220', scope: 'card', cardId: 'alt_cunningham_soulkiller_architect', paraphrase: "Resolving Alt Cunningham's first ability twice before the next Program stacks both reductions (still minimum 1 €$).", status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'The ability could not be activated again while its reduction was pending, and reductions did not stack; now each resolution adds its own amount (scripts/blue.ts).' },
  // Alt Cunningham: Soulkiller Architect #3
  { id: 'dd4138dc-c8ee-4d08-899a-d3f69fb00fc7', scope: 'card', cardId: 'alt_cunningham_soulkiller_architect', paraphrase: "Alt Cunningham's reduction is fixed at resolution; min Gigs gained before the Program is played don't increase it.", status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'The reduction counted min Gigs when the Program was played; it is now recorded when the ability resolves (scripts/blue.ts).' },
  // Chrome Reverie #1
  { id: '9caf46ed-3bf8-4dd7-9110-7d9e147e821e', scope: 'card', cardId: 'chrome_reverie', paraphrase: "A rival Unit locked by Chrome Reverie can't attack even if later allowed to attack spent Units.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Chrome Reverie #2
  { id: '5139f71f-b1f8-4819-8a83-51880067dbea', scope: 'card', cardId: 'chrome_reverie', paraphrase: 'A min Gig is a Gig showing its minimum value, 1.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Chrome Reverie #3
  { id: '1dc8b307-ebd1-43e8-9d14-d11a7893c1d1', scope: 'card', cardId: 'chrome_reverie', paraphrase: "Declining Chrome Reverie's free Call doesn't make a later Call this turn free.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Delamain Cab #1
  { id: '59552a2f-6661-4130-95cd-6f119a95f6b6', scope: 'card', cardId: 'delamain_cab', paraphrase: 'Delamain Cab that stole and was then defeated readies no Eddie at end of turn.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Delamain: Rideshare AI #1
  { id: 'cdc01e4e-6e36-43a8-a193-90564776528d', scope: 'card', cardId: 'delamain_rideshare_ai', paraphrase: "Delamain: Rideshare AI's {Play} draw 2 is mandatory.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Dying Night: V's Pistol #1
  { id: '881c635b-268e-4855-8617-a84587951a8f', scope: 'card', cardId: 'dying_night_v_s_pistol', paraphrase: "Dying Night's end-of-turn 2 Eddies still happen if V is defeated after the {Attack} resolved.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Dying Night: V's Pistol #2
  { id: '043520f5-44f4-48a7-9d4a-bdc820a6ddf5', scope: 'card', cardId: 'dying_night_v_s_pistol', paraphrase: 'A Unit or Legend does not gain the tags of its equipped Gear (Dying Night).', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Evelyn Parker: Beautiful Enigma #1
  { id: '6f60b8fc-5126-488c-9aeb-5ee39226a5f0', scope: 'card', cardId: 'evelyn_parker_beautiful_enigma', paraphrase: 'A Unit forced to attack by Evelyn Parker that attacked and is readied must attack again if it can.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'The engine removed the must-attack requirement when the Unit attacked; it now lasts its full duration (engine.ts attack()).' },
  // Evelyn Parker: Beautiful Enigma #2
  { id: '99f345a2-35ad-4d4e-8f7b-c6da08c50b4a', scope: 'card', cardId: 'evelyn_parker_beautiful_enigma', paraphrase: "A Unit forced by Evelyn Parker need not attack first; other actions are allowed, but the turn can't end while it can attack.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Evelyn Parker: Scheming Siren #1
  { id: '21199b77-ad4d-42ac-834c-416bf3d458b5', scope: 'card', cardId: 'evelyn_parker_scheming_siren', paraphrase: "Evelyn Parker: Scheming Siren's {Attack} draw 1 is mandatory.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Floor It #1
  { id: '2c3ac370-03ca-4a5c-9cf3-a61e9789b515', scope: 'card', cardId: 'floor_it', paraphrase: 'Floor It can be played with no rival Units.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Floor It #2
  { id: 'cf31b32f-6c76-4290-8d38-81516be33aba', scope: 'card', cardId: 'floor_it', paraphrase: 'Floor It may target a rival Unit that has 0 power.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Hacked Corpo #1
  { id: 'd7f37678-fda8-4c98-b027-af22cc68b7c6', scope: 'card', cardId: 'hacked_corpo', paraphrase: 'Hacked Corpo must add a Program from the trashed cards when there is one.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Jacked-In Voodoo Boy #1
  { id: '39c1b729-a65b-4cf6-81dd-150719aa38b3', scope: 'card', cardId: 'jacked_in_voodoo_boy', paraphrase: "Jacked-In Voodoo Boy given Adrenaline still can't attack before a Program is played that turn.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Jacked-In Voodoo Boy #2
  { id: '2e7fbbd3-de95-4da6-aae5-b21266ef3d03', scope: 'card', cardId: 'jacked_in_voodoo_boy', paraphrase: 'Jacked-In Voodoo Boy played with Adrenaline after a Program this turn can attack.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Jackie Welles: Pour One Out For Me #1
  { id: '15b27a52-f1e8-48fb-9c59-ac9d2d4c6824', scope: 'card', cardId: 'jackie_welles_pour_one_out_for_me', paraphrase: "Jackie Welles (Pour One Out) called after a Blue Unit was already played this turn doesn't trigger on the next one.", status: 'covered', test: 'tests/engine-fixes.test.ts > Jackie Welles (Pour One Out) does not trigger on the second Blue Unit after being Called' },
  // Jackie Welles: Pour One Out For Me #2
  { id: '763356ba-0750-492a-86d2-2b7b75325208', scope: 'card', cardId: 'jackie_welles_pour_one_out_for_me', paraphrase: 'A Blue Legend played from the Legends area counts as a Blue Unit played for Jackie Welles (Pour One Out).', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Jackie Welles: Pour One Out For Me #3
  { id: 'c58d792f-af25-4060-b261-dc7369c18aa2', scope: 'card', cardId: 'jackie_welles_pour_one_out_for_me', paraphrase: "Jackie Welles (Pour One Out) can't decrease a Gig already at 1, so no draw from it.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Judy Álvarez: Braindance Maestro #1
  { id: '3dbd8dd8-e076-4ca2-8103-e648718f35e6', scope: 'card', cardId: 'judy_alvarez_braindance_maestro', paraphrase: 'Judy Alvarez (Braindance Maestro) triggers on a BRAINDANCE Program played from the trash.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Judy Álvarez: Braindance Maestro #2
  { id: '179be304-b54b-47f7-8358-eac64e44f31e', scope: 'card', cardId: 'judy_alvarez_braindance_maestro', paraphrase: 'Judy Alvarez (Braindance Maestro) triggers once per BRAINDANCE Program played.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Judy Álvarez: Braindance Maestro #3
  { id: '5822e4e8-3878-49b3-b0d0-fb241272ae6d', scope: 'card', cardId: 'judy_alvarez_braindance_maestro', paraphrase: 'Judy Alvarez (Braindance Maestro) may pump the same Unit again on later triggers.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Judy Álvarez: Braindance Maestro #4
  { id: '284c60bf-247b-4ff1-8bcb-d60361138dad', scope: 'card', cardId: 'judy_alvarez_braindance_maestro', paraphrase: "Judy Alvarez (Braindance Maestro) triggers on a BRAINDANCE Program played during the rival's turn.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Judy Álvarez: Nothing to Doubt #1
  { id: '90d8581b-b42a-4061-a7d4-d589879389cc', scope: 'card', cardId: 'judy_alvarez_nothing_to_doubt', paraphrase: 'Judy Alvarez (Nothing to Doubt) can activate her {Spend} ability with an empty deck.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'The ability required a card in the deck; it can now be activated (and then does nothing) (scripts/blue.ts).' },
  // Les Élémens #1
  { id: '9a85bf8b-c371-4d1a-8d13-22976fb78130', scope: 'card', cardId: 'les_elemens', paraphrase: 'Les Elemens: the player who played it picks among tied lowest-power rival Units.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Les Élémens #2
  { id: '072482a5-a9f6-4f39-9d18-53f483613eed', scope: 'card', cardId: 'les_elemens', paraphrase: 'Les Elemens can be played with no rival Units.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Lizzy Wizzy: Delicate Weapon #1
  { id: '302a8e57-a185-4e0d-9dcd-1879e78900a8', scope: 'card', cardId: 'lizzy_wizzy_delicate_weapon', paraphrase: 'The Program Lizzy Wizzy plays goes straight to the bottom of the deck, not via the trash.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Lizzy Wizzy: Delicate Weapon #2
  { id: '7160b6d5-6c36-4951-9753-4bff17b3d3e8', scope: 'card', cardId: 'lizzy_wizzy_delicate_weapon', paraphrase: "A Program played by Lizzy Wizzy's {Play} resolves fully before other pending effects.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Maman Brigitte: Spirit of Death #1
  { id: '9d6d9ce9-9dca-42f9-bb90-0e89c5fed80b', scope: 'card', cardId: 'maman_brigitte_spirit_of_death', paraphrase: "Maman Brigitte can't discard just 1 Program; the discard is 2 Programs or nothing.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Misty Olszewski: Mender of Broken Spirits #1
  { id: 'e82502be-aaff-4d75-bd4b-87e00e760fa1', scope: 'card', cardId: 'misty_olszewski_mender_of_broken_spirits', paraphrase: 'Misty may choose Legend as the card type at end of turn.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'Misty offered only Unit, Gear and Program; Legend is now offered too (it never matches a deck card) (scripts/blue.ts).' },
  // Misty Olszewski: Mender of Broken Spirits #2
  { id: '9afdaa8c-8662-4a0d-aced-d69786b199d3', scope: 'card', cardId: 'misty_olszewski_mender_of_broken_spirits', paraphrase: "Misty can't attack even when an effect says she must attack if she can.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Modded Kusanagi #1
  { id: 'e6eaf7b6-9d18-41a9-8e01-d2d060dafc03', scope: 'card', cardId: 'modded_kusanagi', paraphrase: "Modded Kusanagi's return-to-hand does nothing while it is in the trash.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Modded Kusanagi #2
  { id: '4b894ff4-3838-4abf-ab05-67f4f7fc1811', scope: 'card', cardId: 'modded_kusanagi', paraphrase: 'Modded Kusanagi under Cyberpsychosis may return to hand first and avoid the end-of-turn defeat.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Modded Muramasa #1
  { id: 'd0a32e18-0674-4b46-ae37-e4f5dd4ab053', scope: 'card', cardId: 'modded_muramasa', paraphrase: 'Modded Muramasa must ready at end of turn when you have less Street Cred.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Mox Inciters #1
  { id: '993d5dde-b6f3-4e0a-b6de-48fe2efda10c', scope: 'card', cardId: 'mox_inciters', paraphrase: "Mox Inciters forcing a Unit that can't attack does not let it attack.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // MT0D12 Flathead #1
  { id: 'b0b79c55-4167-448c-8717-b9f9f60b7ea6', scope: 'card', cardId: 'mt0d12_flathead', paraphrase: 'MT0D12 Flathead can be sold for an Eddie although it is a Unit.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // MT0D12 Flathead #2
  { id: '4ab27f37-6192-43a3-97eb-cf81060bb6d3', scope: 'card', cardId: 'mt0d12_flathead', paraphrase: "Flathead's can't-be-blocked condition is re-checked during the React step; once it fails, Blockers may block.", status: 'covered', test: 'tests/faq/blue.test.ts', note: "The question's wording of the Street Cred change is ambiguous; tested as: the condition is checked again during the React step." },
  // NetWatch Netdriver #1
  { id: '44cc0af1-c683-4dd4-882e-7eefd4c443b3', scope: 'card', cardId: 'netwatch_netdriver', paraphrase: "NetWatch Netdriver's spent trigger from declaring an attack resolves before the React step.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // NetWatch Netdriver #2
  { id: 'e7efa410-6ebf-4195-9e8e-8a31a00f20b2', scope: 'card', cardId: 'netwatch_netdriver', paraphrase: "NetWatch Netdriver's spent trigger and the attacker's {Attack} trigger can be resolved in either order.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // NetWatch Netdriver #3
  { id: '6a903897-b1e2-486f-835e-3c702fcbe77c', scope: 'card', cardId: 'netwatch_netdriver', paraphrase: "NetWatch Netdriver's trigger from spending for a {Spend} ability resolves after that ability.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // NetWatch Netdriver #4
  { id: '52e98457-4afa-4996-972b-5ec373a331c5', scope: 'card', cardId: 'netwatch_netdriver', paraphrase: 'NetWatch Netdriver on a Legend spent to pay for a Program resolves after the Program.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Nocturne OP55 N1 #1
  { id: 'd1fecc2d-4186-438c-9de7-de02184f0ad7', scope: 'card', cardId: 'nocturne_op55_n1', paraphrase: "Nocturne's fixer area is empty when no die is left in it.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Nocturne OP55 N1 #2
  { id: 'd9d3bf9e-e13a-4a19-9220-7fcc74e47eae', scope: 'card', cardId: 'nocturne_op55_n1', paraphrase: "Nocturne's can't-attack mode may be chosen with no Units on the field.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Nocturne OP55 N1 #3
  { id: '0bba2dd4-1887-48bc-a577-9411b1081a64', scope: 'card', cardId: 'nocturne_op55_n1', paraphrase: "With an empty fixer area Nocturne costs 1 €$; you can't pay 3 instead.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Placide: Voodoo Sentinel #1
  { id: 'ae31fcd3-d3db-4bbe-b099-2a07cc0ba270', scope: 'card', cardId: 'placide_voodoo_sentinel', paraphrase: 'Placide may discard a Program for its {Play}/{Attack} even with no rival Units.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: "placide() in scripts/blue.ts skipped the optional discard when there was no rival Unit; it is now offered (intent 'harm', tag 'discardForNothing', so bots decline a discard that gains nothing)." },
  // Pyramid Song #1
  { id: '29b8e233-81e1-4660-9df8-eb9002af9562', scope: 'card', cardId: 'pyramid_song', paraphrase: 'Pyramid Song with both effects: -4 power first, then the bottom-deck; no choice of order.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Reboot Optics #1
  { id: 'e18d31dd-7ee1-4494-8098-a72db45bfa2d', scope: 'card', cardId: 'reboot_optics', paraphrase: 'A Unit protected by Reboot Optics still loses the fight.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Rita Wheeler: No Stupid Questions #1
  { id: '7b34456c-7332-4134-9650-5864aee59890', scope: 'card', cardId: 'rita_wheeler_no_stupid_questions', paraphrase: "Rita Wheeler's draw with an empty deck is mandatory, so its controller loses.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Rogue Amendiares: Queen of the Afterlife #1
  { id: '9ce8258b-6b6a-4157-9054-7923068292d5', scope: 'card', cardId: 'rogue_amendiares_queen_of_the_afterlife', paraphrase: "Rogue Amendiares (Queen) played on the rival's turn can't use her {Quick} {Spend} ability that turn (Lag).", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Rogue Amendiares: Queen of the Afterlife #2
  { id: '587d8011-4472-47ec-a36a-bfaea64d61da', scope: 'card', cardId: 'rogue_amendiares_queen_of_the_afterlife', paraphrase: 'Rogue Amendiares (Queen): a qualifying steal earlier in the turn, before she entered play, used up the first time.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: "The trigger was tracked per Rogue from when she was in play; it now reads the turn's steal history (each steal records the Gig value and the stealer's power: engine.ts stealGig, TurnEvent)." },
  // Rogue Amendiares: Queen of the Afterlife #3
  { id: '30697bfe-be0f-4a0a-8de4-09f71eb30bbe', scope: 'card', cardId: 'rogue_amendiares_queen_of_the_afterlife', paraphrase: "Rogue Amendiares (Queen)'s Eddie trigger happens only once per turn.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Rogue Amendiares: Queen of the Afterlife #4
  { id: '8d449d55-52c2-4586-ae43-1f796902a3fa', scope: 'card', cardId: 'rogue_amendiares_queen_of_the_afterlife', paraphrase: 'A second Rogue Amendiares (Queen) played after the first time this turn does not trigger.', status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'Same history fix as faq:587d8011: a newly played Rogue no longer gets a fresh first time.' },
  // Sasha Yakovleva: Won't Let You Down #1
  { id: '8b665720-9bdc-47ee-8930-9e8b6f6d41ef', scope: 'card', cardId: 'sasha_yakovleva_won_t_let_you_down', paraphrase: 'Sasha with 0 power steals no Gig.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Sasha Yakovleva: Won't Let You Down #2
  { id: 'f548eacd-802d-4101-b47c-36cf1155e1df', scope: 'card', cardId: 'sasha_yakovleva_won_t_let_you_down', paraphrase: "Sasha's {Attack} triggers only after an attack on a valid target is declared.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Tetratronic Rippler #1
  { id: '5ecbb33e-871b-40cd-bb66-6997a692e1a6', scope: 'card', cardId: 'tetratronic_rippler', paraphrase: 'The card Tetratronic Rippler searches is still in the deck while you decide.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Tetratronic Rippler #2
  { id: 'a241cffa-c134-4ea5-9692-c155375f63c3', scope: 'card', cardId: 'tetratronic_rippler', paraphrase: "Tetratronic Rippler's spent trigger from declaring an attack resolves before the React step.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Tetratronic Rippler #3
  { id: '07efe66d-4a02-424c-9d9f-a15163f36191', scope: 'card', cardId: 'tetratronic_rippler', paraphrase: "Tetratronic Rippler's spent trigger and the attacker's {Attack} trigger can be resolved in either order.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Tetratronic Rippler #4
  { id: 'b577753b-b94c-4429-9fab-a209ef0aac85', scope: 'card', cardId: 'tetratronic_rippler', paraphrase: "Tetratronic Rippler's trigger from spending for a {Spend} ability resolves after that ability.", status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Tetratronic Rippler #5
  { id: '0e2f7008-09dc-4eda-ae31-750c16f84419', scope: 'card', cardId: 'tetratronic_rippler', paraphrase: 'Tetratronic Rippler on a Legend spent to pay for a Program resolves after the Program.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Three Mouths, One Desire #1
  { id: '71b6fcd4-2bac-430b-8589-258ab1aae486', scope: 'card', cardId: 'three_mouths_one_desire', paraphrase: 'Cards searched by Three Mouths, One Desire still count as the deck while searched.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Three Mouths, One Desire #2
  { id: '1267e60c-913c-4e6a-8f12-b785b77b6cd5', scope: 'card', cardId: 'three_mouths_one_desire', paraphrase: 'Three Mouths, One Desire must add at least 1 searched card; extra ones from min Gigs are optional.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Towerfall #1
  { id: '2a2fadce-85ca-49cd-a9a5-76a77e5cf615', scope: 'card', cardId: 'towerfall', paraphrase: 'Towerfall with Street Cred equal to the rival gives only one effect.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Towerfall #2
  { id: 'cabf44d5-8f4c-420e-b149-e408e4fcc699', scope: 'card', cardId: 'towerfall', paraphrase: 'Towerfall with both effects applies -5 power before bottom-decking 0-power Units.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Trust No One #1
  { id: 'cc187a60-e949-4ff2-a8d2-38adf6ff32e9', scope: 'card', cardId: 'trust_no_one', paraphrase: 'Trust No One draws if you control any min Gig, not only the Gig it decreased.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Trust No One #2
  { id: 'd731ae05-e1b3-4811-a67f-6512e9a00146', scope: 'card', cardId: 'trust_no_one', paraphrase: 'Trust No One can be played with no Gigs to decrease.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Unlikely Bond #1
  { id: '51314e7a-dea5-4d38-aeeb-52f58dc2a55a', scope: 'card', cardId: 'unlikely_bond', paraphrase: 'Unlikely Bond must bottom-deck a ready friendly Unit even with no spent rival Unit.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // V: Corporate Exile #1
  { id: '22eadcab-b88a-45cd-9e07-ef51084da8cf', scope: 'card', cardId: 'v_corporate_exile', paraphrase: 'V: Corporate Exile can be played to the field by paying its cost instead of using Go Solo.', status: 'covered', test: 'tests/legend-play.test.ts > is offered next to Go Solo for a face-up Legend with a cost' },
  // Wakako Okada: Peace and Harmony #1
  { id: 'ab2739ef-ffc9-493d-b523-b6823ba1b618', scope: 'card', cardId: 'wakako_okada_peace_and_harmony', paraphrase: "Wakako Okada's {Call} may choose the -2 power mode with no rival Units.", status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'With no rival Unit the Call skipped the choice and drew 1; both modes are now always offered (scripts/blue.ts).' },
  // Wakako Okada: Peace and Harmony #2
  { id: '8bbbcb97-0cb0-41b9-a674-7647d6085163', scope: 'card', cardId: 'wakako_okada_peace_and_harmony', paraphrase: "Wakako Okada's {Spend} may choose a min Gig (decrease by 0).", status: 'fixed', test: 'tests/faq/blue.test.ts', note: 'The ability needed a Gig above 1 to be activated; it can now be used when every Gig is a min Gig (scripts/blue.ts).' },
  // Westbrook Netrunner #1
  { id: '6a19fd88-c002-4d46-914c-dfe3b13fd27b', scope: 'card', cardId: 'westbrook_netrunner', paraphrase: 'Westbrook Netrunner also stops a rival Legend played to the field afterwards from stealing Gigs below its power.', status: 'covered', test: 'tests/faq/blue.test.ts' },
  // Westbrook Netrunner #2
  { id: '5b17e2c5-e679-4dad-a131-815a6618dd48', scope: 'card', cardId: 'westbrook_netrunner', paraphrase: "Westbrook Netrunner's steal restriction lasts even if it is defeated during the rival's turn.", status: 'covered', test: 'tests/faq/blue.test.ts' },
];
