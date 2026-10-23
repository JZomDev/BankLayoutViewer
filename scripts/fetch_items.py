"""
    Script to generate an items.json of all the items on the OSRS Wiki, and downloads images for each item.
    The JSON file is placed in ../src/lib/items.json.

    The images are placed in ../cdn/items/. This directory is NOT included in the Next.js app bundle, and should
    be deployed separately to our file storage solution.

    Written for Python 3.9.
"""
import argparse
import html
import os
import requests
import json
import urllib.parse
import time
from pathlib import Path

import item_meta
import item_variations
import item_updates

FILE_NAME = '../cdn/json/items.json'
WIKI_BASE = 'https://oldschool.runescape.wiki'
API_BASE = WIKI_BASE + '/api.php'
IMG_PATH = '../cdn/items/'
ITEMSMIN_URL = 'https://chisel.weirdgloop.org/moid/data_files/itemsmin.js'
HEADERS = {'User-Agent': 'JZomDev Bank Tags Layout helper'}

TIMEOUT = 30  # seconds, for every request
RETRIES = 3
# Safety nets so a bad wiki response cannot overwrite good data with a partial list.
MIN_ITEMS = 10000  # the wiki returns about 14k today
MAX_IMAGE_FAIL_RATIO = 0.05
MIN_IMAGE_SAMPLE = 50  # attempts before the failure ratio means anything

BUCKET_API_FIELDS = [
    'page_name',
    'page_name_sub',
    'item_name',
    'image',
    'item_id',
]

ITEMS_TO_SKIP = [
    'The dogsword',
    'Drygore blowpipe',
    'Amulet of the monarchs',
    'Emperor ring',
    'Devil\'s element',
    'Nature\'s reprisal',
    'Gloves of the damned',
    'Crystal blessing',
    'Sunlight spear',
    'Sunlit bracers',
    'Thunder khopesh',
    'Thousand-dragon ward',
    'Arcane grimoire',
    'Wristbands of the arena',
    'Wristbands of the arena (i)',
    'Armadyl chainskirt (or)',
    'Armadyl chestplate (or)',
    'Armadyl helmet (or)',
    'Dagon\'hai hat (or)',
    'Dagon\'hai robe bottom (or)',
    'Dagon\'hai robe top (or)',
    'Dragon warhammer (or)',
    'Centurion cuirass',
    'Ruinous powers (item)',
    'Battlehat',
    'Zaryte bow'
]

def get(url, **kwargs):
    """requests.get with a timeout, retries with backoff, and an exception on HTTP errors."""
    for attempt in range(RETRIES):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, **kwargs)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == RETRIES - 1:
                raise
            time.sleep(2 ** attempt)


def image_name(row):
    """The wiki file name for a bucket row. The API returns it HTML-escaped (&#39; for an apostrophe)."""
    if not row.get('image'):
        return ''
    return html.unescape(row['image'][-1]).replace('File:', '')


def image_path(name, item_id):
    """The name the image is saved under in cdn/items: the item id, so names that differ only by case cannot clash."""
    if not name or type(item_id) is not int:
        return ''
    return f'{item_id}{os.path.splitext(name)[1].lower()}'


def check_item_count(count):
    if count < MIN_ITEMS:
        raise RuntimeError(f'Only {count} items fetched (expected at least {MIN_ITEMS}); not overwriting {FILE_NAME}')


def check_image_failures(failed, attempted):
    if attempted >= MIN_IMAGE_SAMPLE and failed / attempted > MAX_IMAGE_FAIL_RATIO:
        raise RuntimeError(f'{failed} of {attempted} image downloads failed; the wiki is probably down')


def download_itemsmin(url, out_path):
    """Downloads itemsmin.js, checks it parses, and replaces out_path only if it does."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f'Downloading {url} -> {out_path}')
    body = get(url).content[6:]  # the file starts with a 6-byte prefix that is not JSON
    try:
        parsed = json.loads(body)
    except ValueError as e:
        raise RuntimeError(f'{url} did not contain JSON after dropping the first 6 bytes: {e}')
    if not isinstance(parsed, list) or not parsed:
        raise RuntimeError(f'{url} did not contain a non-empty list')
    tmp = out_path.with_name(out_path.name + '.tmp')
    tmp.write_bytes(body)
    tmp.replace(out_path)
    print('Saved', out_path)


def getEquipmentData():
    equipment = []
    offset = 0
    fields_csv = ",".join(map(repr, BUCKET_API_FIELDS))
    while True:
        print('Fetching equipment info: ' + str(offset))
        innerQuery = {
            'query':
            (
                f"bucket('infobox_item')"
                f".select({fields_csv})"
                f".limit(500).offset({offset})"
                # must be an item
                f".where('Category:Items')"
                # must have an id and a name
                f".where('item_id', '!=', bucket.Null())"
                f".where('item_name', '!=', bucket.Null())"
                # can't be interface items, unobtainable items, discontinued content, or beta items
                f".where(bucket.Not('Category:Interface items'))"
                f".where(bucket.Not('Category:Unobtainable items'))"
                f".where(bucket.Not('Category:Pages using information from game APIs or cache'))"
                f".where(bucket.Not('Category:Discontinued content'))"
                f".where(bucket.Not('Category:Beta items'))"
                f".orderBy('item_name', 'asc').run()"
            )
        }
        query = {
            'action': 'bucket',
            'format': 'json',
           'query':  innerQuery.get('query')
        }

        # print('Query: ' + str(innerQuery.get('query')))

        data = get(API_BASE + '?' + urllib.parse.urlencode(query)).json()

        if 'bucket' not in data:
            raise RuntimeError('No bucket data in the wiki API response: ' + str(data)[:200])

        equipment = equipment + data['bucket']

        # Bucket's API doesn't tell you when there are more results, so we'll just have to guess
        if len(data['bucket']) == 500:
            offset += 500
        else:
            # If we are at the end of the results, break out of this loop
            break

    return equipment


def main(max_updates=None):
    # Grab the equipment info using Bucket
    wiki_data = getEquipmentData()

    # Use an object rather than an array, so that we can't have duplicate items with the same page_name_sub
    data = {}
    old_data = []
    if os.path.isfile(FILE_NAME):
        with open(FILE_NAME, encoding='utf-8') as f:
            old_data = json.load(f)
    known = {item_updates.record_key(e) for e in old_data}
    # Loop over the equipment data from the wiki
    for v in wiki_data:
        if v['page_name_sub'] in data:
            continue

        try:
            item_id = int(v.get('item_id')[0]) if v.get('item_id') else None
        except ValueError:
            # Item has an invalid ID, do not show it here as it's probably historical or something.
            print(f"Skipping {v['page_name_sub']} - invalid item ID (not an int)")
            continue

        equipment = {
            'name': v['item_name'],
            'id': item_id,
            'image': image_name(v),
            'imagepath': image_path(image_name(v), item_id),
        }

        if equipment['name'] in ITEMS_TO_SKIP:
            continue
        # items already in items.json are unchanged news, so only log the new and changed ones
        if item_updates.record_key(equipment) not in known:
            print(f"Processing {v['page_name_sub']}")
        # Set the current equipment item to the calc's equipment list
        data[v['page_name_sub']] = equipment

    new_data = list(data.values())

    print('Total equipment: ' + str(len(new_data)))
    check_item_count(len(new_data))

    limited = item_updates.limit_updates(old_data, new_data, max_updates)
    if max_updates is not None:
        print(f'Updating {limited.applied} items (limit {max_updates}); {limited.pending} more wait for a later run')

    with open(FILE_NAME, 'w') as f:
        print('Saving to JSON at file: ' + FILE_NAME)
        json.dump(limited.items, f, ensure_ascii=False, indent=2)

    # With a limit, only the items changed in this run get images; otherwise every item is checked
    image_source = new_data if max_updates is None else limited.changed
    # one file per item id; the first entry for an id supplies its image, as in build-items.js
    required_imgs = {}
    for e in image_source:
        if e['imagepath'] and e['imagepath'] not in required_imgs:
            required_imgs[e['imagepath']] = e['image']

    success_img_dls = 0
    failed_img_dls = 0
    skipped_img_dls = 0

    # Fetch all the images from the wiki and store them for local serving
    for idx, (imgName, img) in enumerate(required_imgs.items()):

        if os.path.isfile(IMG_PATH + imgName):
            skipped_img_dls += 1
            continue

        print(f'({idx}/{len(required_imgs)}) Fetching image: {img}')
        try:
            r = get(WIKI_BASE + '/w/Special:Filepath/' + img)
        except requests.RequestException as e:
            print(f'Unable to save image: {imgName} ({e})')
            failed_img_dls += 1
            check_image_failures(failed_img_dls, success_img_dls + failed_img_dls)
            continue
        with open(IMG_PATH + imgName, 'wb') as f:
            f.write(r.content)
        print('Saved image: ' + imgName)
        success_img_dls += 1

    print('Total images saved: ' + str(success_img_dls))
    print('Total images skipped (already exists): ' + str(skipped_img_dls))
    print('Total images failed to save: ' + str(failed_img_dls))

    # Download the itemsmin.js file into ../cdn/js/. A failure stops the run so item_meta never reads a stale copy.
    download_itemsmin(ITEMSMIN_URL, os.path.join(os.path.dirname(FILE_NAME), '..', 'js', 'itemsmin.js'))

    # The page loads this small lookup instead of itemsmin.js
    item_meta.write_item_meta()

    # RuneLite's variation groups, for the variation toggle on bank tag items
    item_variations.write_variations(get(item_variations.VARIATIONS_URL).json())


def positive_int(text):
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError('must be at least 1')
    return value


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fetch OSRS item data and images from the wiki.')
    parser.add_argument('--max-updates', type=positive_int, default=None,
                        help='change at most this many items in items.json this run (default: no limit)')
    main(parser.parse_args().max_updates)
