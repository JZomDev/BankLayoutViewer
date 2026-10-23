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

const hydra = fs.readFileSync(path.join(__dirname, 'fixtures', 'inventory-setups-hydra.json'), 'utf8').trim();
const hydraBanktag = 'banktags,1,hydra,12926,-23733,-139,-3144,layout,1,26674,4,23733,5,23733,6,2434,7,2434,8,28951,9,19547,10,22947,12,2434,13,139,14,2434,15,2434,16,12926,17,27229,20,2434,21,2434,22,2434,23,2434,25,30079,28,3144,29,3144,30,5952,31,391,32,7462,33,31095,34,25975,36,391,37,391,38,391,39,391,40,554,41,565,42,564,43,566,44,391,45,391,46,391,47,391,52,27281,53,9790,54,391,55,25818';

test('an Inventory Setups export imports the layout array like the equivalent banktag', () => {
  const out = parseBanktag(hydra);
  assert.strictEqual(out.layoutName, 'hydra');
  assert.deepStrictEqual(out.items, parseBanktag(hydraBanktag).items);
});
test('Inventory Setups: empty cells are skipped and the icon is the first item', () => {
  const out = parseBanktag('{"setup":{"name":"x"},"layout":[-1,null,7,-1,9]}');
  assert.deepStrictEqual(out.items, [{ x: 2, y: 0, id: 7 }, { x: 4, y: 0, id: 9 }]);
  assert.strictEqual(out.layoutIcon, 7);
});
test('Inventory Setups: resolveId and cols are honoured, missing name falls back', () => {
  const out = parseBanktag('{"setup":{},"layout":[-1,5]}', { cols: 1, resolveId: id => (id === '5' ? 50 : undefined) });
  assert.strictEqual(out.layoutName, 'Imported Layout');
  assert.deepStrictEqual(out.items, [{ x: 0, y: 1, id: 50 }]);
});
test('Inventory Setups: bad JSON or a missing layout array throws', () => {
  assert.throws(() => parseBanktag('{"setup":{"name":"x"'), /Invalid Inventory Setups/);
  assert.throws(() => parseBanktag('{"setup":{},"layout":"nope"}'), /Invalid Inventory Setups/);
  assert.throws(() => parseBanktag('{"setup":{}}'), /Invalid Inventory Setups/);
});

const toa = fs.readFileSync(path.join(__dirname, 'fixtures', 'layouts-plugin-toa.txt'), 'utf8').trim();

test('a Bank Tag Layouts plugin export imports its id:cell pairs', () => {
  const out = parseBanktag(toa);
  assert.strictEqual(out.layoutName, 'toa');
  assert.strictEqual(out.layoutIcon, 27275);
  assert.strictEqual(out.items.length, 61);
  assert.deepStrictEqual(out.items[0], { x: 0, y: 0, id: 20371 });
  assert.deepStrictEqual(out.items[out.items.length - 1], { x: 7, y: 7, id: 560 });
});
test('Bank Tag Layouts plugin: the same id in two cells is kept, and the tag section is not read as cells', () => {
  const out = parseBanktag(toa);
  assert.deepStrictEqual(out.items.filter(i => i.id === 565).map(i => [i.x, i.y]), [[6, 6], [5, 7]]);
  assert.ok(!out.items.some(i => i.id === 11212));
});
test('Bank Tag Layouts plugin: cols and resolveId are honoured, a missing banktag section uses the first item as icon', () => {
  const out = parseBanktag('banktaglayoutsplugin:x,10:0,11:3', { cols: 2, resolveId: id => (id === '11' ? 99 : undefined) });
  assert.deepStrictEqual(out.items, [{ x: 0, y: 0, id: 10 }, { x: 1, y: 1, id: 99 }]);
  assert.strictEqual(out.layoutIcon, 10);
});
test('Bank Tag Layouts plugin: a name with no cells throws', () => {
  assert.throws(() => parseBanktag('banktaglayoutsplugin:x'), /Invalid Bank Tag Layouts/);
  assert.throws(() => parseBanktag('banktaglayoutsplugin:x,banktag:x,1'), /Invalid Bank Tag Layouts/);
});
test('keeps the tag item list, including negative variation ids', () => {
  const text = 'banktags,1,bonemining,952,10354,1704,-1704,layout,0,1712,1,12013';
  const out = parseBanktag(text);
  assert.deepStrictEqual(out.tagItems, [10354, 1704, -1704]);
  assert.deepStrictEqual(out.items, [{ x: 0, y: 0, id: 1712 }, { x: 1, y: 0, id: 12013 }]);
});
test('tag item ids are not passed through resolveId', () => {
  const resolveId = () => 99;
  assert.deepStrictEqual(parseBanktag('banktags,1,x,1,5,-5,layout,0,10', { resolveId }).tagItems, [5, -5]);
});
test('an export without a tag item list gives an empty tagItems', () => {
  assert.deepStrictEqual(parseBanktag(potions).tagItems, []);
});
