const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');

const potions = fs.readFileSync(path.join(__dirname, 'fixtures', 'potions-banktag.txt'), 'utf8').trim();

test('parses the Potions export', () => {
  const out = parseBanktag(potions);
  assert.strictEqual(out.layoutName, 'Potions');
  assert.strictEqual(out.layoutIcon, '249');
  assert.strictEqual(out.items.length, 182);
  assert.deepStrictEqual(out.items[0], { x: 0, y: 0, id: 199 });
  assert.deepStrictEqual(out.items[1], { x: 1, y: 0, id: 249 });
  assert.deepStrictEqual(out.items[out.items.length - 1], { x: 5, y: 26, id: 3042 });
});
test('cells missing from the export stay empty', () => {
  const out = parseBanktag(potions);
  assert.ok(!out.items.some(i => i.x === 6 && i.y === 5)); // cell 46 is not in the string
});
test('a trailing newline does not change the result', () => {
  assert.strictEqual(parseBanktag(potions + '\n').items.length, 182);
});
test('cols sets the grid width', () => {
  assert.deepStrictEqual(parseBanktag('banktags,1,x,1,layout,5,10', { cols: 4 }).items, [{ x: 1, y: 1, id: 10 }]);
});
test('resolveId can map ids and falls back to the number when it returns nothing', () => {
  const resolveId = id => (id === '10' ? 99 : undefined);
  assert.deepStrictEqual(parseBanktag('banktags,1,x,1,layout,0,10,1,7', { resolveId }).items.map(i => i.id), [99, 7]);
});
test('errors for empty, unsupported and short input', () => {
  assert.throws(() => parseBanktag(''), /Empty input/);
  assert.throws(() => parseBanktag('hello'), /Unsupported format/);
  assert.throws(() => parseBanktag('banktags,1,x'), /Invalid header/);
});
test('a truncated export with a dangling cell is ignored without throwing', () => {
  assert.deepStrictEqual(parseBanktag('banktags,1,x,1,layout,0,10,1').items, [{ x: 0, y: 0, id: 10 }]);
});
test('a non-numeric cell is skipped with its id', () => {
  assert.deepStrictEqual(parseBanktag('banktags,1,x,1,layout,abc,10,1,7').items, [{ x: 1, y: 0, id: 7 }]);
});
