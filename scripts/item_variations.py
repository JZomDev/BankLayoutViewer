"""
    Builds cdn/json/itemvariations.json from RuneLite's item_variations.json.

    RuneLite lists each variation group as [base id, other ids...]. ItemVariationMapping.map(id) gives the
    base id for any id in a group, and the id itself otherwise. This file holds the non-base ids only:
    id (as a string) -> base id. Bank tags store a variation as the negative of the base id.

    Run on its own (python item_variations.py) to download and regenerate.
"""
import json
from pathlib import Path

VARIATIONS_URL = 'https://raw.githubusercontent.com/runelite/runelite/master/runelite-client/src/main/resources/item_variations.json'
VARIATIONS_PATH = Path(__file__).resolve().parent.parent / 'cdn' / 'json' / 'itemvariations.json'


def _is_id(value):
    return type(value) is int


def build_variations(raw):
    if not isinstance(raw, dict) or not raw:
        raise ValueError('expected a non-empty object of variation groups')
    mapping = {}
    for group in raw.values():
        if not isinstance(group, list):
            continue
        ids = [i for i in group if _is_id(i)]
        if len(ids) < 2:
            continue
        base = ids[0]
        for item_id in ids[1:]:
            mapping.setdefault(str(item_id), base)
    return dict(sorted(mapping.items(), key=lambda kv: int(kv[0])))


def write_variations(raw):
    mapping = build_variations(raw)
    VARIATIONS_PATH.write_text(json.dumps(mapping, separators=(',', ':')), encoding='utf-8')
    print(f'Saved {VARIATIONS_PATH} ({len(mapping)} ids)')


if __name__ == '__main__':
    import fetch_items
    write_variations(fetch_items.get(VARIATIONS_URL).json())
