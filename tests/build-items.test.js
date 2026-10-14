const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildItems } = require('../assets/js/helpers/build-items.js');

const skip = new Set([6678]);

test('uses meta name and placeholder, falls back to the items.json name', () => {
  const data = [
    { id: 1, name: 'Old one', imagepath: 'a b.png' },
    { id: 2, name: 'Old two', imagepath: 'b.png' },
  ];
  const meta = { names: { 1: 'New one' }, placeholders: { 2: 9002 } };
  assert.deepStrictEqual(buildItems(data, meta, skip), [
    { id: 1, name: 'New one', img: 'cdn/items/a%20b.png', externalId: 1, placeholderId: undefined },
    { id: 2, name: 'Old two', img: 'cdn/items/b.png', externalId: 2, placeholderId: 9002 },
  ]);
});

test('skips ids without an integer id, skipped ids and duplicates', () => {
  const data = [{ name: 'x' }, { id: 6678 }, { id: 3, name: 'a' }, { id: 3, name: 'dup' }];
  const out = buildItems(data, { names: {}, placeholders: {} }, skip);
  assert.deepStrictEqual(out.map(i => i.name), ['a']);
});

test('name falls back to the id when nothing else has one', () => {
  const out = buildItems([{ id: 5 }], { names: {}, placeholders: {} }, skip);
  assert.strictEqual(out[0].name, '5');
});

test('missing meta falls back to the items.json names', () => {
  const out = buildItems([{ id: 4, name: 'Four', imagepath: 'f.png' }], null, skip);
  assert.deepStrictEqual(out.map(i => [i.name, i.placeholderId]), [['Four', undefined]]);
});

// Reference for the behaviour this replaced: the first itemsmin.js entry per id / placeholderId.
function buildFirstMatch(data, data2) {
  const byId = new Map(), byPlaceholder = new Map();
  for (const x of data2) {
    if (!byId.has(x.id)) byId.set(x.id, x);
    if (x.placeholderId !== undefined && !byPlaceholder.has(x.placeholderId)) byPlaceholder.set(x.placeholderId, x);
  }
  const seen = new Set();
  return data.flatMap((it, idx) => {
    if (!Number.isInteger(it.id) || skip.has(it.id) || seen.has(it.id)) return [];
    seen.add(it.id);
    const ph = byPlaceholder.get(it.id), nm = byId.get(it.id);
    return [{ id: it.id, name: nm ? nm.name : it.name || String(it.id || ('item-' + (idx + 1))),
      img: 'cdn/items/' + encodeURIComponent(it.imagepath || ''), externalId: it.id,
      placeholderId: ph ? ph.id : undefined }];
  });
}

test('matches the old first-match build on every real item', () => {
  const root = path.join(__dirname, '..', 'cdn');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'json', 'items.json'), 'utf8'));
  const data2 = JSON.parse(fs.readFileSync(path.join(root, 'js', 'itemsmin.js'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'json', 'itemmeta.json'), 'utf8'));
  assert.deepStrictEqual(buildItems(data, meta, skip), buildFirstMatch(data, data2));
});
