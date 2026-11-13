// Locked codes (src/net/): an invite or reply code sealed with a phrase the two players share by another route, so a
// bystander who sees the code (a public channel, a screenshot, a shared browser history) learns nothing from it. Used by
// the live link's codes (webrtc.ts: invite and reply) and by the multi-day game's invite and reply packets (packet.ts).
//
// What it protects: the code's contents (for a live link, the network addresses in it; for a multi-day game, the two
// halves of the key that signs its packets) from anyone who has the code but not the phrase. What it does not: the other
// player still learns your address once a direct connection is made (they have the phrase), and a phrase sent next to
// the code in the same public place protects nothing.
//
// The lock (WebCrypto only): a key from the phrase by PBKDF2-SHA-256 (LOCK_ITERATIONS rounds, a random 16-byte salt),
// then AES-256-GCM with a random 12-byte nonce. The header (format version, cost, purpose, salt, nonce) is sent in the
// clear and bound in as additional data, with a fixed label, so a code cannot be passed off as another kind of code or
// have its header changed without the lock failing. Bytes:
//
//   [1: format 1][1: cost id][1: purpose][16: salt][12: nonce][AES-GCM ciphertext + 16-byte tag]
//
// The reply is locked with the invite's key (same salt, a new nonce), so the guest types the phrase once and the host
// never types it at all.

/** PBKDF2 rounds: about 0.23 s in Node 22 on a desktop, a second or two on a phone (each side derives the key once). */
export const LOCK_ITERATIONS = 600_000;
/** The costs a code may name (the id is in the header); an unknown id is refused unread, so a code can't ask for more. */
const COSTS: Record<number, number> = { 1: LOCK_ITERATIONS };
const COST_ID = 1;
const FORMAT = 1;
const SALT = 16;
const NONCE = 12;
export const LOCK_HEADER = 3 + SALT + NONCE;
const LABEL = 'nct-locked-code:v1:';

/** What a locked code is for (in its header, in the clear, and bound into the lock). */
// 5 and 6: a private connection's (relay only) invite and reply; 7: the relay server's invite (relayTransport.ts).
// An older copy of the site does not know these, so it refuses such a code as "not a code" instead of reading it as a
// direct connection's.
export const PURPOSES = { 'rtc-offer': 1, 'rtc-answer': 2, 'corr-invite': 3, 'corr-join': 4, 'rtc-offer-relay': 5, 'rtc-answer-relay': 6, 'relay-invite': 7 } as const;
export type LockPurpose = keyof typeof PURPOSES;
const purposeOf = (b: number): LockPurpose | null => (Object.keys(PURPOSES) as LockPurpose[]).find((k) => PURPOSES[k] === b) ?? null;

/** A key made from a phrase, with the salt it was made with (the reply reuses both). */
export interface CodeKey {
  key: CryptoKey;
  salt: Uint8Array;
  cost: number;
}

export const lockAvailable = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof TextEncoder !== 'undefined';

/** The phrase as both sides compare it: lower case, words separated by one space (spaces, dashes and dots alike). */
export function normalizePhrase(p: string): string {
  return p
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The rule a phrase must meet: at least four words, at least 16 characters, at least three different words. */
export const PHRASE_RULE = 'A phrase needs at least four words and 16 characters, with at least three different words.';
export const PHRASE_MIN_WORDS = 4;
export const PHRASE_MIN_CHARS = 16;

/** Why a phrase is too weak to lock a code with, or null. */
export function phraseProblem(p: string): string | null {
  const n = normalizePhrase(p);
  const words = n ? n.split(' ') : [];
  if (words.length < PHRASE_MIN_WORDS || n.length < PHRASE_MIN_CHARS || new Set(words).size < 3) return PHRASE_RULE;
  return null;
}

/** Make the key for a phrase (a new random salt unless one is given: the reply uses the invite's). */
export async function keyFromPhrase(phrase: string, salt?: Uint8Array, cost = COST_ID): Promise<CodeKey> {
  const iterations = COSTS[cost];
  if (!iterations) throw new Error('unknown lock cost');
  const s = salt ?? crypto.getRandomValues(new Uint8Array(SALT));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizePhrase(phrase)), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: s as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { key, salt: s, cost };
}

const aad = (header: Uint8Array) => {
  const label = new TextEncoder().encode(LABEL);
  const out = new Uint8Array(label.length + header.length);
  out.set(label);
  out.set(header, label.length);
  return out;
};

/** Seal `plain` for `purpose` with a key from keyFromPhrase. */
export async function lockBytes(plain: Uint8Array, ck: CodeKey, purpose: LockPurpose): Promise<Uint8Array> {
  const header = new Uint8Array(LOCK_HEADER);
  header[0] = FORMAT;
  header[1] = ck.cost;
  header[2] = PURPOSES[purpose];
  header.set(ck.salt, 3);
  header.set(crypto.getRandomValues(new Uint8Array(NONCE)), 3 + SALT);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: header.slice(3 + SALT) as BufferSource, additionalData: aad(header) as BufferSource }, ck.key, plain as BufferSource));
  const out = new Uint8Array(header.length + ct.length);
  out.set(header);
  out.set(ct, header.length);
  return out;
}

/** What a locked code's header says (in the clear), or null when it is not one this version reads. */
export function lockedHeader(bytes: Uint8Array): { purpose: LockPurpose; salt: Uint8Array; cost: number } | null {
  if (bytes.length < LOCK_HEADER + 16 || bytes[0] !== FORMAT || !COSTS[bytes[1]!]) return null;
  const purpose = purposeOf(bytes[2]!);
  return purpose ? { purpose, salt: bytes.slice(3, 3 + SALT), cost: bytes[1]! } : null;
}

export type UnlockResult = { ok: true; plain: Uint8Array; key: CodeKey } | { ok: false; why: 'format' | 'purpose' | 'phrase' };

/**
 * Open a locked code made for `purpose` with a phrase or a key already made (the host opening the reply to its invite).
 * 'phrase': the phrase (or key) does not open it, or the code was changed; never a partial result.
 */
export async function unlockBytes(bytes: Uint8Array, with_: string | CodeKey, purpose: LockPurpose | readonly LockPurpose[]): Promise<UnlockResult> {
  const h = lockedHeader(bytes);
  if (!h) return { ok: false, why: 'format' };
  if (!(typeof purpose === 'string' ? [purpose] : purpose).includes(h.purpose)) return { ok: false, why: 'purpose' };
  let ck: CodeKey;
  if (typeof with_ === 'string') ck = await keyFromPhrase(with_, h.salt, h.cost);
  else {
    if (with_.cost !== h.cost || with_.salt.length !== h.salt.length || !with_.salt.every((b, i) => b === h.salt[i])) return { ok: false, why: 'phrase' };
    ck = with_;
  }
  const header = bytes.slice(0, LOCK_HEADER);
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: header.slice(3 + SALT) as BufferSource, additionalData: aad(header) as BufferSource }, ck.key, bytes.slice(LOCK_HEADER) as BufferSource));
    return { ok: true, plain, key: ck };
  } catch {
    return { ok: false, why: 'phrase' };
  }
}

/** The purpose a locked code says it has, without opening it (null when it is not a locked code). */
export function lockedPurpose(bytes: Uint8Array): LockPurpose | null {
  return lockedHeader(bytes)?.purpose ?? null;
}

export const WRONG_PHRASE = "That phrase doesn't open this code. Check the phrase with the other player (or ask for the code again: it may have been cut short).";

// ---------------------------------------------------------------- generated phrases

// Written for this site: everyday nouns and a few gentle adjectives, 4–9 letters, lower case. Duplicates and words
// outside the rule are dropped when the list is built, and the test checks what is left (size and entropy).
const RAW = `
acorn actor admiral adobe agate album alcove almond alpine amber anchor angle ankle antler anvil apple apricot apron
arcade arch archer arena armchair arrow artist aspen atlas attic autumn avenue avocado award axle bacon badge badger
bagel bakery balcony ballad ballet balloon bamboo banana banjo banner barley barn barrel basil basket baton beacon
beagle beaker beam bean bedrock beetle bell bench berry bicycle birch biscuit bison blanket blazer blender blossom
blue bluff boat bobcat bonnet bonsai booklet border bottle boulder bouquet bracket branch brass bread breeze brick
bridge brook broom bubble bucket buckle budget buffalo bugle bundle burrow butter button buzzard cabin cable cactus
cadet cafe cake camel cameo camera camp canal canary candle candy canoe canopy canvas canyon captain caramel caravan
carbon cargo carpet carrot cart cascade cashew castle catalog cedar celery cellar cello cement cereal chalk channel
chapel chapter charcoal cheddar cherry chess chestnut chime chimney chisel cider cinema circle circus citrus city
clarinet clay cliff clock cloud clover coach coast cobalt cobble cocoa coconut comet compass concert condor cookie
copper coral cork corner cottage cotton cougar country cousin coyote crane crater crayon cricket crown crystal
cupboard curtain cushion cyclist cypress daisy dancer dawn deck delta denim desert desk dial diamond diary diesel
dinner dipper doctor dollar dolphin domino donkey doorway dove dragon drawer dream drift drum duck dune dusk eagle
easel echo eclipse elbow elder ember emerald engine envelope epoch errand espresso estate evening fabric falcon fable
fairway fanfare farm feather fence fern ferry festival fiddle field finch fjord flag flannel flute foam folder forest
fork fossil fountain frame freckle fresco frost fudge furnace gable galaxy galley garden garlic garnet gazebo gecko
geyser ginger giraffe glacier glider globe glove goblet golden goose gopher gourd granite grape graph gravel griddle
grove guitar gull gumbo habit hammer hamster harbor harp harvest hatch hazel helmet herald heron hickory hiker hill
hollow honey hoodie horizon hornet hotel husky hydrant iceberg icicle igloo index indigo inkwell island ivory jacket
jaguar jasmine jelly jersey jetty jigsaw jockey journal journey jumper juniper kayak kettle kernel keyboard kiosk
kitten kiwi knapsack knight koala label ladder ladle lagoon lake lantern lapel laptop larch lark lasso lattice lava
lawn leaf ledger legend lemon lens lentil letter lettuce library lilac lily limber linen lion lizard llama lobby
lobster locket lodge loft lotus lumber lunar lychee magnet magpie mallard mango mansion maple marble marigold market
marsh mascot meadow medal melody melon memo menu meridian mesa metro meteor midday mill mineral minnow mint mirror
mitten mocha molar monsoon moose mosaic moss motel motor mountain muffin mural museum mustard napkin narwhal nectar
needle nest nickel noodle north notebook nougat nutmeg oasis oatmeal ocean octave olive omelet onion opal opera
orange orbit orchard orchid organ origami osprey otter outpost oven oyster paddle pagoda palace palette panda panther
papaya parade parcel parka parrot pasta pastel pastry patio peach peacock peanut pear pebble pelican pencil penguin
pepper pewter piano pickle picnic pigeon pillow pilot pine pioneer pistachio pitcher pixel planet plaza plum poem
polka pollen pond pony poplar popcorn porch potato pottery prairie pretzel prism pudding puffin pumpkin puppet puzzle
pyramid quail quarry quartz quill quilt quiver rabbit raccoon radar radio radish raft rainbow raisin ranch ranger
raven ravine recipe reef relay ribbon ridge river robin rocket rodeo rooftop rose rover ruby rudder runway saddle
saffron sailor salad salmon sandal sapphire satchel saturn sauce savanna scarf scooter scroll seagull season sequoia
shadow shell sherbet shovel shrimp sierra silver skate sketch skylight sled slipper sloth snail sonnet sorbet spaniel
sparrow spinach spiral sponge spruce squash squid stable stadium stamp starfish station statue stencil stone stork
stream studio sugar summit sunset swallow sweater syrup table tablet taco tadpole tambour tangelo tango tapestry
teapot temple tender terrace thicket thimble thistle thunder tiger timber toast toffee tomato topaz torch tortoise
toucan tower tractor trail trellis trolley trophy trout tulip tundra tunnel turnip turtle tuxedo twig ukulele
umbrella unicorn uniform upland urchin valley vanilla vapor velvet venture veranda vessel vest village vine violet
violin visor voyage vulture waffle wagon walnut walrus wander warbler wasabi waterfall wave weasel whale wheat
whistle willow window winter wizard wombat woodland workshop wren yacht yarn yearling yogurt yonder zebra zenith
zephyr zigzag zinnia zipper
able agile ample brave bright brisk calm clever cosmic crisp curly dainty dapper eager early easy fancy fluffy frosty
gentle giant glossy grand happy hardy honest humble jolly keen kind lively loyal lucky mellow merry mighty misty
modest neat nimble noble plucky polite proud quick quiet rapid ready rosy royal rustic sandy shiny silky simple sleek
smooth snowy sunny swift tidy tiny tranquil vivid warm witty zesty
abacus airport alley alpaca amethyst anthem aqua arbor artwork asteroid aurora avalanche bandana barge basin bayou
bazaar beehive belfry bistro blizzard blueprint bobsled bonfire boomerang bowtie boxcar breakfast bridle brownie
buggy bulletin cabbage caboose calendar calypso camellia campfire capsule cardinal carousel cashmere cathedral
cauldron caviar ceiling centaur ceramic chamber chariot cheetah chimera chipmunk chorus cinnamon citadel clipper
coffee collar colony comic cornet corridor cosmos costume crumpet cube cupcake custard dahlia dandelion decal dewdrop
diploma doodle dragonfly drizzle dumpling durian dynamo earring eggplant elevator emblem empire encore equator
falafel fennel ferret figurine filament firefly flamingo flapjack flare fleece flotilla flower fondue footpath
freeway fritter gadget gallery gallon gargoyle gelato gemstone glimmer gnome goggles gondola gorilla gossamer gravy
greenery grotto guava gumdrop gymnast hacienda halibut hammock handbell harmony hayloft headland hedgehog heirloom
hemlock highway hilltop hippo homestead hopscotch horseshoe hourglass hummus hyacinth icecap impala inlet insignia
iris jamboree jellybean jetpack jukebox kangaroo karaoke keepsake kelp kimono kingdom kite knoll ladybug lamplight
landmark lanyard latte lemonade leopard limerick limestone lollipop longboat lute macaroni macaw mainsail mandolin
manatee mantle marina marmalade marquee masonry matinee meringue mermaid mesquite microbe milkshake minstrel mistral
moccasin monarch moonbeam moorland morning mulberry mushroom mystery nachos necklace nebula nettle nightcap nomad
oarlock obelisk oboe ocelot odyssey oilcloth okra omnibus opossum oracle orca ornament outfit overture oxbow
palomino pancake paprika papyrus parasol parsley partridge passport patchwork pathway pavilion peapod pecan pendant
peninsula penny pergola persimmon petal pheasant phoenix pigment pinecone pinwheel piper platypus plover plumage
pocket poncho porridge postcard potion pouch praline primrose propeller pueblo pumice quasar quiche quokka rafter
rapids raspberry rattan redwood reindeer rhubarb riddle ringlet riverbank roadway rosemary rotunda rowboat ruffle
saguaro sandbar sandstone sardine sashimi satellite sawmill scallop scepter schooner seashell sextant shamrock
shortcake shrub signal silo skiff skyline sleigh slope snowcap snowflake solstice sombrero songbird spatula sphinx
spindle spool sprocket squirrel stardust steamer stirrup strudel sundial sunflower surfboard swan sycamore tabby
tamarind tangerine teacup telescope tempo thermos thyme tiara tinsel toboggan tofu tollgate tombola topiary tornado
trapeze treehouse trinket triton trombone trumpet tugboat turquoise tutor typhoon valise vellum verbena vertex
viaduct vineyard voyager walkway wallaby warren waterway weather wetland whisker wildcat windmill wingspan wisteria
woodpile yodel yucca zeppelin
almanac amulet anemone antelope apiary aquarium arrowhead artichoke azalea backpack bagpipe baker balsam bandstand
barnacle barometer beanstalk bearing bedside beet bellhop bilberry binder birdbath blackbird bloom bluebell bluebird
bobbin bonbon bookcase bookmark boots bramble brigade brisket broccoli buckwheat bulldog bumblebee bungalow burlap
cabaret cadence calico camomile candor canteen cardigan carnival carton cassette catfish cavern celeste chaplet charm
chickpea chili chipotle chowder cinder clementine clove cobbler cogwheel comb conch conifer corduroy cornfield cowbell
crawfish creek crocus crossword crouton cuckoo cumin curry dart dewberry dinghy dingo doorbell doublet driftwood
drumbeat duckling dulcimer dustpan eiderdown elixir endive estuary falconer fanlight farmhouse fawn felt fiesta
filbert fireside fishbowl flagpole flatbread flint floret foothill forge foxglove freesia frond fruit galleon gamut
garland gingham glade glaze glen glowworm grackle granola greyhound griffin guppy halyard hamlet handcart hawthorn
haystack heather helix herring hobby holly honeybee hornpipe hutch inkpot jackal jade jasper jonquil kestrel keystone
kindling kipper knot lacquer lamb larkspur laurel lavender lemur lichen lilypad linnet lodestar loom lorikeet lupine
lynx mackerel madrigal magnolia mahogany malachite mallow mandarin mantis marlin marten mayfly medley merlin metronome
millet mimosa mohair mongoose moonlit moped mortar muskrat mussel myrtle nautilus nightjar nimbus nugget nuthatch
oatcake ocarina offshore oriole outback paddock pansy parfait parsnip pastille peony petunia piccolo pilgrim pimento
pinnacle pipette plankton plantain plateau pochard poppy porcupine portico possum prawn puffball quahog quince ragtime
rambler raptor redbud regatta ripple roadster roost rosette rowan rucksack rustle sable sagebrush salsa samba
sandpiper sassafras satsuma scarab sculpin seaweed sentinel serenade shallot shanty sheaf shingle shortbread siskin
skylark slate sorrel spearmint spigot spinnaker sprig starling steeple stingray stonefly sunbeam swordfish tamarack
tanager tarragon tassel teal tern thrush toadstool tortilla towpath treacle trillium truffle tumbler tupelo twine
vervain vireo wagtail walleye waxwing whippet whirlpool widgeon woodcraft yarrow yellowfin zucchini
`;

/** The word list for generated phrases (built once: unique, 4–9 lower-case letters). */
export const WORDS: readonly string[] = [...new Set(RAW.split(/\s+/).filter((w) => /^[a-z]{4,9}$/.test(w)))];

/** Bits of a generated phrase of `n` words. */
export const phraseBits = (n = 4) => n * Math.log2(WORDS.length);

/** A random index below n, without bias (rejection sampling on 32-bit values). */
function randomBelow(n: number): number {
  const limit = Math.floor(2 ** 32 / n) * n;
  const b = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(b);
    if (b[0]! < limit) return b[0]! % n;
  }
}

/** A new phrase: four words from WORDS, chosen at random (about 41 bits). */
export function newPassphrase(words = 4): string {
  return Array.from({ length: words }, () => WORDS[randomBelow(WORDS.length)]!).join(' ');
}
