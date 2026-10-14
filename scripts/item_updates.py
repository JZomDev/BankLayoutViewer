"""
    Caps how many items one fetch run may change in items.json.

    An "item" here is one game item id; entries without an id are grouped by name. Everything
    that changed for an id (entries added, removed or edited) is applied together or not at all,
    so a rename can never be half-applied. Ids are taken in ascending order, so repeated runs
    work through a backlog in a stable order.
"""
import json
from typing import NamedTuple

FIELDS = ('name', 'id', 'image', 'imagepath')


class Limited(NamedTuple):
    items: list    # the list to write to items.json, sorted by name
    changed: list  # entries added by the applied changes (these need images)
    applied: int   # item ids changed in this run
    pending: int   # item ids still waiting for a later run


def _record(entry):
    return json.dumps({k: entry.get(k) for k in FIELDS}, sort_keys=True)


def _group(entry):
    item_id = entry.get('id')
    return (0, item_id) if type(item_id) is int else (1, str(entry.get('name')))


def limit_updates(old, new, max_updates):
    old_records = {_record(e) for e in old}
    new_records = {_record(e) for e in new}
    added = [e for e in new if _record(e) not in old_records]
    removed = [e for e in old if _record(e) not in new_records]

    groups = sorted({_group(e) for e in added + removed})
    taken = set(groups if max_updates is None else groups[:max_updates])

    kept = [e for e in old if _group(e) not in taken or _record(e) in new_records]
    changed = [e for e in added if _group(e) in taken]
    # with nothing held back the result is exactly the fetched list, so ties keep the wiki's order
    items = sorted(new if not len(taken) < len(groups) else kept + changed, key=lambda e: e.get('name') or '')
    return Limited(items, changed, len(taken), len(groups) - len(taken))
