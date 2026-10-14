"""
    Script to generate an items.json of all the items on the OSRS Wiki, and downloads images for each item.
    The JSON file is placed in ../src/lib/items.json.

    The images are placed in ../cdn/items/. This directory is NOT included in the Next.js app bundle, and should
    be deployed separately to our file storage solution.

    Written for Python 3.9.
"""
import os
import requests
import json
import urllib.parse
import re
import time
from pathlib import Path

import item_meta

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


def main():
    # Grab the equipment info using Bucket
    wiki_data = getEquipmentData()

    # Use an object rather than an array, so that we can't have duplicate items with the same page_name_sub
    data = {}
    required_imgs = []
    # Loop over the equipment data from the wiki
    for v in wiki_data:
        if v['page_name_sub'] in data:
            continue

        print(f"Processing {v['page_name_sub']}")

        try:
            item_id = int(v.get('item_id')[0]) if v.get('item_id') else None
        except ValueError:
            # Item has an invalid ID, do not show it here as it's probably historical or something.
            print("Skipping - invalid item ID (not an int)")
            continue

        equipment = {
            'name': v['item_name'],
            'id': item_id,
            'image': '' if not v.get('image') else v.get('image')[-1].replace('File:', ''),
            'imagepath': re.sub(r'[^a-zA-Z0-9\s._()-]', '_','' if not v.get('image') else v.get('image')[-1].replace('File:', '')),
        }

        if equipment['name'] in ITEMS_TO_SKIP:
            continue
        # Set the current equipment item to the calc's equipment list
        data[v['page_name_sub']] = equipment

        if not equipment['image'] == '':
            required_imgs.append(equipment['image'])

    new_data = list(data.values())

    print('Total equipment: ' + str(len(new_data)))
    check_item_count(len(new_data))
    new_data.sort(key=lambda d: d.get('name'))

    with open(FILE_NAME, 'w') as f:
        print('Saving to JSON at file: ' + FILE_NAME)
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    success_img_dls = 0
    failed_img_dls = 0
    skipped_img_dls = 0
    required_imgs = set(required_imgs)

    # Fetch all the images from the wiki and store them for local serving
    for idx, img in enumerate(required_imgs):

        imgName = re.sub(r'[^a-zA-Z0-9\s._()-]', '_', img)

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


if __name__ == '__main__':
    main()
