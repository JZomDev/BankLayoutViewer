"""
    Builds data/stored-layouts/index.json, the list of layout files the Stored layouts tab loads.

    To add a layout, put a new <name>.json file in data/stored-layouts/ with author, description and
    layout (the RuneLite bank tag export string), then run: python build_stored_layouts.py
"""
import json
from pathlib import Path

FOLDER = Path(__file__).resolve().parent.parent / 'data' / 'stored-layouts'
INDEX_NAME = 'index.json'


def layout_files(folder=FOLDER):
    return sorted(p.name for p in Path(folder).glob('*.json') if p.name != INDEX_NAME)


def write_index(folder=FOLDER):
    names = layout_files(folder)
    (Path(folder) / INDEX_NAME).write_text(json.dumps(names, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {Path(folder) / INDEX_NAME} ({len(names)} layouts)')


if __name__ == '__main__':
    write_index()
