"""
    Builds cdn/json/itemmeta.json, the small lookup the page loads instead of the 11 MB itemsmin.js.

    names:        game item id -> name, for ids in items.json
    placeholders: id of an item in items.json -> id of the placeholder item that points at it

    Run on its own (python item_meta.py) to regenerate from the files already in cdn/.
"""
import json
from pathlib import Path

CDN = Path(__file__).resolve().parent.parent / 'cdn'
ITEMS_PATH = CDN / 'json' / 'items.json'
ITEMSMIN_PATH = CDN / 'js' / 'itemsmin.js'
META_PATH = CDN / 'json' / 'itemmeta.json'


def build_item_meta(items, itemsmin):
    wanted = {it['id'] for it in items if type(it.get('id')) is int}
    names = {}
    placeholders = {}
    for entry in itemsmin:
        item_id = entry.get('id')
        if type(item_id) is not int:
            continue
        if item_id in wanted and item_id not in names and isinstance(entry.get('name'), str):
            names[item_id] = entry['name']
        target = entry.get('placeholderId')
        if type(target) is int and target in wanted and target not in placeholders:
            placeholders[target] = item_id
    return {
        'names': dict(sorted(names.items())),
        'placeholders': dict(sorted(placeholders.items())),
    }


def write_item_meta():
    items = json.loads(ITEMS_PATH.read_text(encoding='utf-8'))
    itemsmin = json.loads(ITEMSMIN_PATH.read_text(encoding='utf-8'))
    meta = build_item_meta(items, itemsmin)
    META_PATH.write_text(
        json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8'
    )
    print(f'Saved {META_PATH} ({len(meta["names"])} names, {len(meta["placeholders"])} placeholders)')


if __name__ == '__main__':
    write_item_meta()
