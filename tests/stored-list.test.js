const test = require('node:test');
const assert = require('node:assert');
const { buildStoredList } = require('../assets/js/helpers/stored-list.js');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');

const good = { author: 'zom', description: 'potion making', layout: 'banktags,1,Potions,249,layout,0,199,1,249' };
const parse = text => parseBanktag(text);

test('builds a row from an entry and its export string', () => {
  const [row] = buildStoredList([good], parse);
  assert.deepStrictEqual(row, {
    index: 0, title: 'Potions', author: 'zom', description: 'potion making', iconId: '249',
    items: [{ x: 0, y: 0, id: 199 }, { x: 1, y: 0, id: 249 }]
  });
});
test('a bad entry is skipped and reported, the others still list', () => {
  const warnings = [];
  const rows = buildStoredList([{ author: 'a' }, good, { layout: 'nonsense' }, null], parse, (i, e) => warnings.push(i));
  assert.deepStrictEqual(rows.map(r => r.index), [1]);
  assert.deepStrictEqual(warnings, [0, 2, 3]);
});
test('missing author and description become empty strings; markup stays plain text', () => {
  const [row] = buildStoredList([{ layout: good.layout, description: '<b>hi</b>' }], parse);
  assert.strictEqual(row.author, '');
  assert.strictEqual(row.description, '<b>hi</b>');
});
test('anything but an array gives an empty list', () => {
  assert.deepStrictEqual(buildStoredList({ not: 'an array' }, parse), []);
  assert.deepStrictEqual(buildStoredList(undefined, parse), []);
});
