// FAQ conformance matrix: general rulings (scope "game"). See tests/faq/matrix.ts for the format.
import type { FaqEntry } from '../matrix';

export const GENERAL: FaqEntry[] = [
  // General #1
  { id: '3783e495-b9c5-4843-839c-0a1e82dbdd85', scope: 'game', cardId: null, paraphrase: 'A Unit with Adrenaline still cannot use its {Spend} ability the turn it is played.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #2
  { id: '5ca60092-163a-4c34-a2c6-9478f712d5d4', scope: 'game', cardId: null, paraphrase: 'A Unit can use {Blocker} the turn it is played.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #3
  { id: 'c3602a95-5322-4bfb-84c8-5d9058fb3700', scope: 'game', cardId: null, paraphrase: 'After one Blocker redirects an attack, another Blocker may redirect it again.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #4
  { id: '7f3b28ce-2f88-4d36-96ad-5f64574c82e7', scope: 'game', cardId: null, paraphrase: 'A ready Blocker that is itself the target of the attack cannot use {Blocker}.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #5
  { id: 'e945f6ca-4886-41ff-b72a-ea15b52b4636', scope: 'game', cardId: null, paraphrase: '{Blocker} can be used when the rival attacks the Gig area.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #6
  { id: '24be8b8e-5034-471f-8f9e-1692529efb14', scope: 'game', cardId: null, paraphrase: '{Blocker} can be used when the rival attacks another Unit.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #7
  { id: '84df4181-958f-4308-a597-66b9e663f8a3', scope: 'game', cardId: null, paraphrase: 'A Legend uses {Blocker} only on the field, never from the Legends area.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #8
  { id: '3783f3cd-6ffd-42f9-8044-44907f873136', scope: 'game', cardId: null, paraphrase: 'A Legend may Go Solo the same turn it was Called.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #9
  { id: 'd623c586-4120-4400-95d8-85217458d538', scope: 'game', cardId: null, paraphrase: 'A spent Legend may Go Solo.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #10
  { id: 'bc136327-399a-4dde-837b-82883c61f0ac', scope: 'game', cardId: null, paraphrase: 'A Legend may be spent as one of the payments for its own Go Solo.', status: 'covered', test: 'tests/legend-play.test.ts > the Legend is spent to pay, still enters ready' },
  // General #11
  { id: '76cbd585-1b97-432e-8df8-9e19d7142826', scope: 'game', cardId: null, paraphrase: 'A Legend with Go Solo may also be played to the field without using Go Solo.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #12
  { id: '0e18028c-4e39-4218-87b3-ee73599c3040', scope: 'game', cardId: null, paraphrase: 'A Legend played to the field cannot use a {Spend} effect that turn.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #13
  { id: '0b681b30-8a97-48be-8e70-73e820e5b50c', scope: 'game', cardId: null, paraphrase: 'A Legend that went solo is still a Legend.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #14
  { id: '50377773-e5d9-4efc-877b-878a594087e5', scope: 'game', cardId: null, paraphrase: '{Quick} cards may be used during your own turn.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #15
  { id: '30222dcc-e521-4d51-b211-420d264e939b', scope: 'game', cardId: null, paraphrase: 'Several {Quick} cards may be used during one rival attack.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #16
  { id: '312c580c-a919-45ee-9524-6fd49671a731', scope: 'game', cardId: null, paraphrase: '{Quick} does not let a Unit use {Spend} the turn it is played.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #17
  { id: 'a80e4bdc-2603-46cc-9631-28c09c76c2e0', scope: 'game', cardId: null, paraphrase: "You cannot respond to a rival's {Quick} with a {Quick} of your own.", status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #18
  { id: '3bfca564-d31f-46c6-b15c-88c7e6f31f5e', scope: 'game', cardId: null, paraphrase: 'Several {Attack} effects pending at once can be resolved in the order you choose.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #19
  { id: '1d2ed684-e326-4423-ae2d-ba3d4d885b70', scope: 'game', cardId: null, paraphrase: 'An {Attack} effect and a "when a friendly Unit attacks" effect can be resolved in either order.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #20
  { id: '3d7dd7c9-f7aa-4540-a1e7-fd65f2ea474d', scope: 'game', cardId: null, paraphrase: 'A {Play} effect and a "when a friendly Legend is spent" effect can be resolved in either order.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #21
  { id: 'd05760ef-d02e-4be9-9cda-aee7a2fe196f', scope: 'game', cardId: null, paraphrase: 'A Unit or Legend whose defeat is prevented does not get its {Defeated} effect.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #22
  { id: '24fbf142-d9a7-4646-a8a1-5b28e692b652', scope: 'game', cardId: null, paraphrase: 'A Unit cannot use its {Spend} effect the turn it is played.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #23
  { id: '89f8938c-3523-458e-a5db-4a8a9faf169c', scope: 'game', cardId: null, paraphrase: 'A Legend can use its {Spend} effect the turn it is Called.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #24
  { id: '67f85db0-cb40-403f-b304-9cfc0d31e541', scope: 'game', cardId: null, paraphrase: 'A face-up Legend with a numeric cost may be played to the field by paying that cost: with Lag, in its Legends-area orientation.', status: 'covered', test: 'tests/faq/general.test.ts' },
  // General #25
  { id: '51e197ed-c63f-4f99-973a-67342836a059', scope: 'game', cardId: null, paraphrase: '"Adjust a Gig by up to X" may choose 0, but that is not adjusting a Gig for "when you adjust a Gig" effects.', status: 'covered', test: 'tests/faq/general.test.ts' },
];
