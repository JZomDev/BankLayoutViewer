const test = require('node:test');
const assert = require('node:assert');
const { resolveThumb, BANANA } = require('../assets/js/helpers/thumb.js');

const items = [
  { id: 249, externalId: 249, img: 'cdn/items/249.png', name: 'Guam leaf' },
  { id: 5, externalId: 6, img: 'cdn/items/6.png', name: 'Noted' },
];

test('thumbId resolves to the current item image, ignoring a stale thumbnail path', () => {
  const layout = { thumbId: 249, thumbnail: 'cdn/items/Guam%20leaf.png' };
  assert.deepStrictEqual(resolveThumb(layout, items), { img: 'cdn/items/249.png', itemId: 249, name: 'Guam leaf' });
});

test('itemId prefers the external id', () => {
  assert.strictEqual(resolveThumb({ thumbId: 5 }, items).itemId, 6);
});

test('unknown thumbId falls back to the banana', () => {
  assert.strictEqual(resolveThumb({ thumbId: 999999, thumbnail: 'cdn/items/gone.png' }, items), BANANA);
});

test('no thumbId or no items falls back to the banana', () => {
  assert.strictEqual(resolveThumb({}, items), BANANA);
  assert.strictEqual(resolveThumb({ thumbId: 249 }, []), BANANA);
  assert.strictEqual(resolveThumb(null, null), BANANA);
});
