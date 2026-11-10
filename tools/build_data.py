"""Normalize the raw sim catalog into src/data/cards.json used by the engine and UI.

Source: https://cyberpunk-tcg-sim.online/api/cards/catalog (saved to data/raw/sim_catalog.json).
Run: npm run build:data
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
raw = json.loads((ROOT / 'data/raw/sim_catalog.json').read_text(encoding='utf8'))

KW = {
    'blocker': r'\{Blocker\}',
    'adrenaline': r'\{Adrenaline\}',
    'goSolo': r'\{Go Solo\}',
    'quick': r'\{Quick\}',
}

def strip_reminder(text):
    # drop parenthetical reminder text, keep effect text
    return re.sub(r'\s*\([^()]*\)', '', text or '').strip()

cards = []
for c in raw['cards']:
    text = c['rules_text'] or ''
    eff = strip_reminder(text)
    # only count a keyword when it starts a line (intrinsic), not when other text mentions it
    kws = [k for k, pat in KW.items() if re.search(r'(?m)^\s*' + pat, eff)]
    # Gear grants keyword to host; record separately
    cards.append({
        'id': c['id'],
        'name': c['name'],
        'subname': c['subname'],
        'displayName': c['display_name'],
        'color': c['color'],
        'type': c['card_type'],
        'cost': c['cost'],
        'power': c['power'],
        'ram': c['ram'],
        'rarity': c['rarity'],
        'tags': c['classifications'],
        'text': text,
        'keywords': kws,
        'sellable': bool(c['is_eddiable']),
        'set': c['set_code'],
        'number': c['print_number'],
        # netdeck.gg external id: the site fetches fresh (short-lived, signed) art URLs for it at runtime
        'eid': (c.get('source') or {}).get('external_id'),
        'image': None,
        'url': (c.get('source') or {}).get('card_page_url'),
    })

cards.sort(key=lambda x: (x['type'] != 'Legend', x['color'], x['cost'] or 0, x['name']))
out = ROOT / 'src/data/cards.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(cards, ensure_ascii=False, indent=1), encoding='utf8')
print(f'wrote {len(cards)} cards -> {out}')
