"""
    Finds item images that changed on the wiki after we downloaded them.

    The wiki's API reports a sha1 for every file, 50 files to a request. The bytes Special:Filepath serves
    do not hash to that value (the wiki re-encodes them), so a local file cannot be checked against it.
    Instead we store the wiki's sha1 when we download an image, and refetch when the wiki's sha1 moves.
"""
import json
import time

BATCH = 50
PAUSE = 0.5  # seconds between batches, to be polite to the wiki
API_URL = 'https://oldschool.runescape.wiki/api.php'
HASHES_FILE = '../cdn/json/image-hashes.json'


def fetch_hashes(get, names):
    """{wiki file name: sha1} for the names the wiki has. `get` is fetch_items.get."""
    result = {}
    for start in range(0, len(names), BATCH):
        if start:
            time.sleep(PAUSE)
        batch = names[start:start + BATCH]
        params = {
            'action': 'query', 'prop': 'imageinfo', 'iiprop': 'sha1', 'format': 'json',
            'titles': '|'.join('File:' + n for n in batch),
        }
        query = get(API_URL, params=params).json()['query']
        asked = {'File:' + n: n for n in batch}
        # the API normalises titles (underscores, capital first letter); map them back to what we asked for
        back = {n['to']: n['from'] for n in query.get('normalized', [])}
        for page in query['pages'].values():
            if 'imageinfo' not in page:
                continue
            title = back.get(page['title'], page['title'])
            if title in asked:
                result[asked[title]] = page['imageinfo'][0]['sha1']
    return result


def stale(wanted, stored, wiki, exists):
    """
    wanted: {local file: wiki file name}; stored: {local file: sha1 when downloaded}; wiki: {wiki file name: sha1}.
    Returns (stale, adopted). stale: local files on disk whose wiki sha1 differs from the stored one.
    adopted: {local file: sha1} for files on disk we never hashed; they are trusted as current and recorded,
    so the first run does not download all ~14k images again. Missing files are not listed: the download
    loop fetches those anyway.
    """
    stale_files = set()
    adopted = {}
    for local, name in wanted.items():
        current = wiki.get(name)
        if current is None or not exists(local):
            continue
        if local not in stored:
            adopted[local] = current
        elif stored[local] != current:
            stale_files.add(local)
    return stale_files, adopted


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save(path, hashes):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(hashes, f, indent=2, sort_keys=True)
        f.write('\n')
