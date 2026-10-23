const test = require('node:test');
const assert = require('node:assert');
const { baseId, hasVariation, setVariation } = require('../assets/js/helpers/variations.js');

const map = { 1706: 1704, 1712: 1704 };

test('baseId maps a group member to its base and leaves other ids alone', () => {
  assert.strictEqual(baseId(map, 1712), 1704);
  assert.strictEqual(baseId(map, 1704), 1704);
  assert.strictEqual(baseId(map, 555), 555);
  assert.strictEqual(baseId(null, 1712), 1712);
});
test('hasVariation looks for the negative base id in the tag list', () => {
  assert.strictEqual(hasVariation([10354, 1704, -1704], 1712, map), true);
  assert.strictEqual(hasVariation([10354, 1704], 1712, map), false);
  assert.strictEqual(hasVariation(undefined, 1712, map), false);
});
test('enabling adds -base once and leaves the other entries and order alone', () => {
  assert.deepStrictEqual(setVariation([10354, 1704], 1712, map, true), [10354, 1704, -1704]);
  assert.deepStrictEqual(setVariation([-1704], 1706, map, true), [-1704]);
  assert.deepStrictEqual(setVariation(undefined, 1712, map, true), [-1704]);
});
test('an item outside any group gets -its own id', () => {
  assert.deepStrictEqual(setVariation([], 555, map, true), [-555]);
});
test('disabling removes -base but keeps the positive ids', () => {
  assert.deepStrictEqual(setVariation([10354, 1704, -1704], 1712, map, false), [10354, 1704]);
  assert.deepStrictEqual(setVariation([5], 1712, map, false), [5]);
});
test('setVariation does not change the list it is given', () => {
  const list = [1704];
  setVariation(list, 1712, map, true);
  assert.deepStrictEqual(list, [1704]);
});
