// FAQ conformance matrix: Green cards. See tests/faq/matrix.ts for the format.
import type { FaqEntry } from '../matrix';

export const GREEN: FaqEntry[] = [
  // Corporate Surveillance #1
  { id: '4496adf7-0641-4c06-a1f7-6eb120c075bf', scope: 'card', cardId: 'corporate_surveillance', paraphrase: 'Corporate Surveillance can be played with no rival Unit in play.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Corporate Surveillance #2
  { id: '00513475-b873-4eec-b582-c8bb969fe1e5', scope: 'card', cardId: 'corporate_surveillance', paraphrase: 'Corporate Surveillance may target a rival Unit that is already spent.', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The script only offered ready rival Units; it now offers spent ones too.' },
  // Corpo Security #1
  { id: '030e8902-1692-4ba3-86de-56b83c036897', scope: 'card', cardId: 'corpo_security', paraphrase: 'Corpo Security cannot attack even when it has Adrenaline.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // (Don't Fear) The Reaper #1
  { id: 'fc26a153-0d04-43ec-8f94-beaa97ce3a93', scope: 'card', cardId: 'don_t_fear_the_reaper', paraphrase: 'The Reaper can be played when every rival Unit is already spent.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // (Don't Fear) The Reaper #2
  { id: '1715a8ca-857b-4dcc-9c1c-4782ccd13c04', scope: 'card', cardId: 'don_t_fear_the_reaper', paraphrase: 'The Reaper may defeat a Unit that was spent before it was played.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Field Operator #1
  { id: 'e83fc5f6-3649-4162-9415-f1ff3fde56ed', scope: 'card', cardId: 'field_operator', paraphrase: 'Street Cred of 0 is not an even number (Field Operator draws nothing).', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Fool on the Hill #1
  { id: '7cc65141-2888-4258-9e95-b77b60f43754', scope: 'card', cardId: 'fool_on_the_hill', paraphrase: 'Cards revealed by Fool on the Hill stay part of the deck until they are moved.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Hands Unclean #1
  { id: '9ad7e1cf-9965-4ba0-8503-ac17c897ffbd', scope: 'card', cardId: 'goro_takemura_hands_unclean', paraphrase: 'Goro (Hands Unclean) cannot use Blocker while in the Legends area.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Losing His Way #1
  { id: '0c5b038a-705c-44ba-bff6-95403c35f032', scope: 'card', cardId: 'goro_takemura_losing_his_way', paraphrase: 'Goro (Losing His Way) checks its Legends once, on resolution: flipping them face-up later gives no +5.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Losing His Way #2
  { id: '998c10e4-6f82-4a35-83de-b4178f7f0ce7', scope: 'card', cardId: 'goro_takemura_losing_his_way', paraphrase: 'Goro (Losing His Way) keeps its +5 this turn even if a friendly Legend is later not face-up.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Losing His Way #3
  { id: '134dcec6-35cc-483b-b461-2962e7959998', scope: 'card', cardId: 'goro_takemura_losing_his_way', paraphrase: 'Goro (Losing His Way) gets no +5 later in the turn if its Legends become face-up after the effect resolved.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Losing His Way #4
  { id: '7afe8eca-66ce-4a6d-901c-bb36b456edd7', scope: 'card', cardId: 'goro_takemura_losing_his_way', paraphrase: 'Goro (Losing His Way) gets no +5 when you have no Legends at all.', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The script gave +5 when no Legend was face-down, including with no Legends; it now needs at least one face-up Legend.' },
  // Goro Takemura: Vengeful Bodyguard #1
  { id: 'c40c2c04-c8eb-453b-8a04-2cb0cb4fd1a4', scope: 'card', cardId: 'goro_takemura_vengeful_bodyguard', paraphrase: 'A Unit played this turn and given Blocker by Goro (Vengeful Bodyguard) during the React step can block.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Vengeful Bodyguard #2
  { id: '46be1b50-5788-41f0-92de-af2fb2f670be', scope: 'card', cardId: 'goro_takemura_vengeful_bodyguard', paraphrase: 'Goro (Vengeful Bodyguard)\'s discard-to-draw is optional.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Vengeful Bodyguard #3
  { id: '3e703f01-25ac-4255-ae2f-b3c0fb7a816c', scope: 'card', cardId: 'goro_takemura_vengeful_bodyguard', paraphrase: 'Discarding for Goro (Vengeful Bodyguard) with an empty deck forces the draw, and that player loses.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Goro Takemura: Vengeful Bodyguard #4
  { id: '048e77d0-3873-4e27-a4ee-b419fc503d3d', scope: 'card', cardId: 'goro_takemura_vengeful_bodyguard', paraphrase: 'Goro (Vengeful Bodyguard)\'s second effect triggers on any friendly Blocker, not only one it granted.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Hanako Arasaka: Daughter of the Emperor #1
  { id: 'b9dffd87-5e0a-45a6-92c3-dae20f68df5f', scope: 'card', cardId: 'hanako_arasaka_daughter_of_the_emperor', paraphrase: 'Hanako (Daughter of the Emperor) cannot swap while either player controls no Gig.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Hanako Arasaka: Daughter of the Emperor #2
  { id: '1b9a65e5-250a-446e-971f-867ab7f688fb', scope: 'card', cardId: 'hanako_arasaka_daughter_of_the_emperor', paraphrase: 'Hanako\'s Gig swap is not a steal.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Hanako Arasaka: Daughter of the Emperor #3
  { id: '4b611db2-a369-4b7f-b074-377613c6cada', scope: 'card', cardId: 'hanako_arasaka_daughter_of_the_emperor', paraphrase: 'Hanako\'s controller picks both Gigs that are swapped.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Jackie Welles: Mama's Favorite #1
  { id: '739fcd51-c571-4770-9ceb-dc6d7c785842', scope: 'card', cardId: 'jackie_welles_mama_s_favorite', paraphrase: 'When Jackie (Mama\'s Favorite) is defeated instead, the protected Unit\'s {Defeated} does not trigger.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Jackie Welles: Mama's Favorite #2
  { id: '659dec0e-519c-445d-966e-6e27e4ad5c1f', scope: 'card', cardId: 'jackie_welles_mama_s_favorite', paraphrase: 'Jackie (Mama\'s Favorite) can replace a friendly Unit\'s defeat while on the field.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Jackie Welles: Mama's Favorite #3
  { id: '2d22697d-50af-4372-bffb-29cae81f45cc', scope: 'card', cardId: 'jackie_welles_mama_s_favorite', paraphrase: 'Jackie (Mama\'s Favorite) can replace a friendly Unit\'s defeat while in the Legends area.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Jackie Welles: Mama's Favorite #4
  { id: 'ab195483-70b3-4bdf-9d42-488148b666ec', scope: 'card', cardId: 'jackie_welles_mama_s_favorite', paraphrase: 'Jackie alone on the field may use his own effect so that he is defeated by it instead of by the rival\'s effect.', status: 'divergence', test: 'tests/faq/green.test.ts', note: 'The engine never offers Jackie\'s replacement for Jackie himself (replaceDefeat skips victim === host), so the rival\'s effect defeats him directly. The outcome is the same (Jackie is removed) apart from the optional 1 €$; allowing it needs self-replacement handling in Game.defeat.' },
  // Jackie Welles: Mama's Favorite #5
  { id: 'f5220c5b-0204-44a8-b552-3fc139179fbb', scope: 'card', cardId: 'jackie_welles_mama_s_favorite', paraphrase: 'Against "defeat all Units", Jackie can still save another friendly Unit.', status: 'divergence', test: 'tests/faq/green.test.ts', note: '"Defeat all" effects (Adam Smasher: Metal Over Meat) defeat Units one at a time in field order; when Jackie comes first he is removed before the other Unit is defeated, so he cannot save it (it works when the other Unit comes first). Needs simultaneous defeat in the engine.' },
  // Maelstrom Zealots #1
  { id: '3dc2ff22-518e-4809-ae1e-f778621642f0', scope: 'card', cardId: 'maelstrom_zealots', paraphrase: 'A Unit that can\'t be defeated in a fight still loses it, so Maelstrom Zealots\' effect fires.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Maelstrom Zealots #2
  { id: 'be847e04-e0f7-4337-9ba1-d3a795024d1c', scope: 'card', cardId: 'maelstrom_zealots', paraphrase: 'Maelstrom Zealots is still defeated in the fight it lost while its effect defeats the opposing Unit.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // MaxTac AV #1
  { id: '9dfba4f9-6ebe-46ab-adcf-757a0e407d11', scope: 'card', cardId: 'maxtac_av', paraphrase: 'MaxTac AV\'s swap is optional.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // MaxTac Heavy #1
  { id: '86289bd1-7a4f-4b3e-b588-b8acc2212ad7', scope: 'card', cardId: 'maxtac_heavy', paraphrase: 'MaxTac Heavy\'s discount changes only the €$ paid, not its cost value.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // MaxTac Squadron #1
  { id: '36ecf80a-cd64-4a27-91ac-a079e8d4250b', scope: 'card', cardId: 'maxtac_squadron', paraphrase: 'MaxTac Squadron readies no Legend if it is ready at the end of your turn.', status: 'covered', test: 'tests/engine-fixes.test.ts > does nothing if it was ready at the end of turn' },
  // Memory Relapse #1
  { id: '5e7e7fa9-d975-45fd-aaaf-27cd449ac788', scope: 'card', cardId: 'memory_relapse', paraphrase: 'Memory Relapse may target a rival Unit that is already spent (it still cannot ready).', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The script only offered ready rival Units; it now offers spent ones too.' },
  // Memory Relapse #2
  { id: '5c2726d7-d041-482c-bcf3-30c164e23d22', scope: 'card', cardId: 'memory_relapse', paraphrase: 'Memory Relapse can be played with no rival Unit in play.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Nadia: Fighting Through Grief #1
  { id: '526169c5-08ff-4dfe-9690-c385754b658c', scope: 'card', cardId: 'nadia_fighting_through_grief', paraphrase: 'Nadia\'s Gig-area permission is checked when she attacks, not when she is played.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Overwatch: Panam's Gift #1
  { id: '7f11608a-92cf-4b9f-a3b0-9d170ef231c7', scope: 'card', cardId: 'overwatch_panam_s_gift', paraphrase: 'Overwatch\'s {Spend} ability can be activated with an empty hand (the discard is part of the effect).', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The discard was modelled as an activation cost (needing a card in hand); it is now part of the effect.' },
  // Overwatch: Panam's Gift #2
  { id: '5514dcc7-6fee-4f37-8049-922a23664c21', scope: 'card', cardId: 'overwatch_panam_s_gift', paraphrase: 'A Gear\'s pending "when spent" effect still resolves after the Gear moves to another Unit.', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'Zetatech Faceplate\'s script (src/engine/scripts/yellow.ts) returned early once the Gear was no longer on the spent Unit or Legend, so a Faceplate moved by Panam Palmer: Nomad Cavalry\'s {Spend} after its trigger became pending did nothing; it now resolves for the Unit or Legend that was spent.' },
  // Pacifica Netrunner #1
  { id: '933f4b48-5e65-48a8-97ba-3a2e255a8b7d', scope: 'card', cardId: 'pacifica_netrunner', paraphrase: 'Pacifica Netrunner\'s {Play} chooses among rival Units already on the field.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Padre: Man of the Cross #1
  { id: '2376d51c-ae2c-4eb6-aed9-d25a05d56e09', scope: 'card', cardId: 'padre_man_of_the_cross', paraphrase: 'Padre\'s Call may choose "spend a rival Unit" even with no rival Unit.', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The Call only offered "Draw 1" when no ready rival Unit existed; both modes are now always offered.' },
  // Padre: Man of the Cross #2
  { id: 'afa9a2eb-1766-49c4-95d5-2c1673aae7dd', scope: 'card', cardId: 'padre_man_of_the_cross', paraphrase: 'Padre\'s {Spend} ability can be activated when every Gig has the same value.', status: 'fixed', test: 'tests/faq/green.test.ts', note: 'The ability needed a Gig it could change; it can now always be activated (and then does nothing).' },
  // Panam Palmer: Nomad Cavalry #1
  { id: '097a8261-ba28-407e-9f81-1cf59c8e995b', scope: 'card', cardId: 'panam_palmer_nomad_cavalry', paraphrase: 'Panam (Nomad Cavalry) may move its Gear to a ready unequipped friendly Unit.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Panam Palmer: Nomad Cavalry #2
  { id: '5c29eb76-b653-47e4-a7c5-ad38e770890c', scope: 'card', cardId: 'panam_palmer_nomad_cavalry', paraphrase: 'Panam (Nomad Cavalry)\'s end-of-turn ready counts any mix of 5 equipped Units and Legends.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Panam Palmer: Strength Through Family #1
  { id: 'eb1edc97-4acc-49ca-b9e7-8c07cb28e1d9', scope: 'card', cardId: 'panam_palmer_strength_through_family', paraphrase: 'Panam (Strength Through Family) gives no second Call when you already Called this turn.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Panam Palmer: Strength Through Family #2
  { id: 'f8a56ec8-e7a1-401b-af72-95415aa2a792', scope: 'card', cardId: 'panam_palmer_strength_through_family', paraphrase: 'Panam (Strength Through Family)\'s {Attack} counts face-up Legends in the Legends area and on the field.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Peace Offering #1
  { id: '070c816a-ea6e-43b6-9408-cf976ef42dac', scope: 'card', cardId: 'peace_offering', paraphrase: 'Peace Offering draws with any friendly value-pair, whichever Gig was set.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Peace Offering #2
  { id: '42eac469-1258-4d90-ae2a-59f9459c5bae', scope: 'card', cardId: 'peace_offering', paraphrase: 'Peace Offering can be played when no Gig can be set.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Pepe Najarro: Working Doubles #1
  { id: '1f2d750b-a776-4d1c-bc79-a4621ab2cf0d', scope: 'card', cardId: 'pepe_najarro_working_doubles', paraphrase: 'A value-pair is two Gigs with the same value controlled by the same player.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Riot Shield #1
  { id: '06f40e31-2d2e-46d4-bfab-7670da4c189c', scope: 'card', cardId: 'riot_shield', paraphrase: 'Riot Shield does not force a rival to use Go Solo.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Saburo Arasaka: Stubborn Patriarch #1
  { id: '18318e94-6979-4623-9cf5-fee73924d728', scope: 'card', cardId: 'saburo_arasaka_stubborn_patriarch', paraphrase: 'Saburo\'s +1 for attacking ARASAKA Units applies in the fight and steal steps.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Sandayu Oda: Hanako's Guardian #1
  { id: '2507570b-3a3a-4c5e-bb34-451ebf248cc4', scope: 'card', cardId: 'sandayu_oda_hanako_s_guardian', paraphrase: 'Sandayu Oda cannot attack ready Units.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Sandayu Oda: Hanako's Guardian #2
  { id: '0ae5584d-2dcc-4dd3-811e-953c63363cf9', scope: 'card', cardId: 'sandayu_oda_hanako_s_guardian', paraphrase: 'Sandayu Oda\'s attack-the-turn-it\'s-played permission still needs a spent rival Unit target.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Sandevistan #1
  { id: '66f0aa50-b90c-4bf0-9a02-ddfbec146375', scope: 'card', cardId: 'sandevistan', paraphrase: 'Sandevistan must ready its spent Unit or Legend at the end of your turn.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Saul Bright: Stormrider #1
  { id: '1f7a2ac5-b236-4b1c-9f4b-6e0b34441174', scope: 'card', cardId: 'saul_bright_stormrider', paraphrase: 'Saul Bright\'s +2 for other attacking Units applies in the fight and steal steps.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Synapse Burnout #1
  { id: '9f5fa425-bb0f-4f5f-908c-d56b67d14862', scope: 'card', cardId: 'synapse_burnout', paraphrase: 'Synapse Burnout counts face-up Legends in the Legends area and on the field.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Synapse Burnout #2
  { id: '2a2b9c9f-1076-493c-aa0f-24a274fbf85a', scope: 'card', cardId: 'synapse_burnout', paraphrase: 'Synapse Burnout may target a Legend on the field, which gets the bonus while fighting.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Take Control #1
  { id: '4e9fde1b-cbe0-4025-9a04-c61b13ecde02', scope: 'card', cardId: 'take_control', paraphrase: 'Take Control also makes a rival Unit steal 1 fewer Gig through an effect.', status: 'covered', test: 'tests/engine-fixes.test.ts > FAQ Take Control #1' },
  // Take Control #2
  { id: 'b6be2042-7260-4c72-a7e0-0478c9cda9f9', scope: 'card', cardId: 'take_control', paraphrase: 'A Gorilla Arms Unit reduced to 0 steals by Take Control does not trigger Gorilla Arms.', status: 'covered', test: 'tests/engine-fixes.test.ts > FAQ Take Control #2' },
  // Tyger's Whisper #1
  { id: '0c12a0d1-b75a-4269-b1b5-68d5e80acf4b', scope: 'card', cardId: 'tyger_s_whisper', paraphrase: 'Declining Tyger\'s Whisper\'s free Call leaves the later Call at its normal cost.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Tyger's Whisper #2
  { id: '1dcc06cf-2c53-4507-88d8-f5f002e2d656', scope: 'card', cardId: 'tyger_s_whisper', paraphrase: 'Tyger\'s Whisper played on the rival\'s turn still Calls a Legend for free.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Tyger's Whisper #3
  { id: '92d69f9f-e14d-491e-8589-7f79d56b5320', scope: 'card', cardId: 'tyger_s_whisper', paraphrase: 'Tyger\'s Whisper gives no free Call if you already Called this turn.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Valentino Street Racer #1
  { id: 'c78f53c3-489c-4a0e-8d73-9ab7a8431419', scope: 'card', cardId: 'valentino_street_racer', paraphrase: 'Adrenaline from Valentino Street Racer on the rival\'s turn does not let the Unit attack that turn.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // We Gotta Live Together #1
  { id: '972b7a64-cc96-4e31-8e7f-5718d319914a', scope: 'card', cardId: 'we_gotta_live_together', paraphrase: 'Paying 3 €$ for We Gotta Live Together leaves its cost value at 5.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // We Gotta Live Together #2
  { id: 'abf24590-be16-41a4-9314-05cf9964a483', scope: 'card', cardId: 'we_gotta_live_together', paraphrase: 'We Gotta Live Together costs 3 €$ when the rival is 2+ Gigs ahead; paying 5 is not an option.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Wild in the Streets #1
  { id: 'd0d1a60f-cb84-4dbf-b131-c2ee9f7bae22', scope: 'card', cardId: 'wild_in_the_streets', paraphrase: 'Wild in the Streets can be played with no spent Unit in play.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Wild in the Streets #2
  { id: '192c3c09-2160-4818-840a-ae6b1d9cf27f', scope: 'card', cardId: 'wild_in_the_streets', paraphrase: 'Wild in the Streets may defeat a friendly spent Unit.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Wild in the Streets #3
  { id: '7ea036d0-1f07-4425-9a47-198eec19fef1', scope: 'card', cardId: 'wild_in_the_streets', paraphrase: 'Wild in the Streets must defeat your own spent Unit when it is the only one.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Wraith Marauders #1
  { id: '7ec76a28-572e-45e7-81b2-53c8f38b8ce3', scope: 'card', cardId: 'wraith_marauders', paraphrase: 'Wraith Marauders must ready a friendly Unit whose power equals the stolen Gig\'s value.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Zetatech Berserk #1
  { id: 'fc46987c-3869-4d97-b73b-686e1e08120e', scope: 'card', cardId: 'zetatech_berserk', paraphrase: 'Zetatech Berserk\'s discount changes only the €$ paid, not its cost value.', status: 'covered', test: 'tests/faq/green.test.ts' },
  // Zetatech Berserk #2
  { id: 'df287cf5-d06b-4958-8501-2ee0fb2c68cf', scope: 'card', cardId: 'zetatech_berserk', paraphrase: 'An equipped Unit or Legend does not gain its Gear\'s tags.', status: 'covered', test: 'tests/faq/green.test.ts' },
];
