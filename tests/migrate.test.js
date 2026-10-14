const test = require('node:test');
const assert = require('node:assert');
const { migrateLayoutIds } = require('../assets/js/helpers/migrate.js');

// data = items.json order at load time; items = built items (id is the game id)
const data = [{ id: 500 }, { id: 700 }, { id: 900 }];
const items = [
  { id: 500, img: 'cdn/items/a.png' },
  { id: 700, img: 'cdn/items/b.png' },
  { id: 900, img: 'cdn/items/c.png' },
];

test('placed item array positions become game item ids', () => {
  const layouts = [{ id: 1, items: [{ x: 0, y: 0, id: 2 }, { x: 1, y: 0, id: 0 }] }];
  assert.strictEqual(migrateLayoutIds(layouts, data, items), true);
  assert.deepStrictEqual(layouts[0].items.map(i => i.id), [900, 500]);
});

test('thumbId is resolved from the saved thumbnail path', () => {
  const layouts = [{ id: 1, items: [], thumbnail: 'cdn/items/b.png', thumbId: 1 }];
  migrateLayoutIds(layouts, data, items);
  assert.strictEqual(layouts[0].thumbId, 700);
});

test('thumbId without a matching thumbnail is left alone', () => {
  const layouts = [{ id: 1, items: [], thumbId: 1963 }];
  migrateLayoutIds(layouts, data, items);
  assert.strictEqual(layouts[0].thumbId, 1963);
});

test('out-of-range positions are left unchanged', () => {
  const layouts = [{ id: 1, items: [{ x: 0, y: 0, id: 99999 }] }];
  migrateLayoutIds(layouts, data, items);
  assert.strictEqual(layouts[0].items[0].id, 99999);
});

test('layouts without items do not throw', () => {
  assert.strictEqual(migrateLayoutIds([{ id: 1 }], data, items), true);
});
