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

// The behaviour this replaced: two linear finds over itemsmin.js per item.
function buildWithFinds(data, data2) {
  const seen = new Set();
  return data.flatMap((it, idx) => {
    if (!Number.isInteger(it.id) || skip.has(it.id) || seen.has(it.id)) return [];
    seen.add(it.id);
    const ph = data2.find(x => x.placeholderId === it.id);
    const nm = data2.find(x => x.id === it.id);
    return [{ id: it.id, name: nm ? nm.name : it.name || String(it.id || ('item-' + (idx + 1))),
      img: 'cdn/items/' + encodeURIComponent(it.imagepath || ''), externalId: it.id,
      placeholderId: ph ? ph.id : undefined }];
  });
}

test('matches the old find-based build on a slice of the real data', () => {
  const root = path.join(__dirname, '..', 'cdn');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'json', 'items.json'), 'utf8'));
  const data2 = JSON.parse(fs.readFileSync(path.join(root, 'js', 'itemsmin.js'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'json', 'itemmeta.json'), 'utf8'));
  const slice = data.filter((_, i) => i % 9 === 0); // ~1.5k items keeps the old O(n*m) path quick
  assert.deepStrictEqual(buildItems(slice, meta, skip), buildWithFinds(slice, data2));
});
