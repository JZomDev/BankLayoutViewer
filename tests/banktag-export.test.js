const test = require('node:test');
const assert = require('node:assert');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');
const { buildBanktag } = require('../assets/js/helpers/banktag-export.js');

test('writes the header, tag items and layout cells', () => {
  const out = buildBanktag({ name: 'a,b', iconId: 952, tagItems: [10354, 1704, -1704], cells: [[0, 1712], [1, 12013]] });
  assert.strictEqual(out, 'banktags,1,a b,952,10354,1704,-1704,layout,0,1712,1,12013');
});
test('no tag items writes the layout straight after the icon', () => {
  assert.strictEqual(buildBanktag({ name: 'x', iconId: 1, cells: [[0, 5]] }), 'banktags,1,x,1,layout,0,5');
});
test('an import round-trips through export', () => {
  const text = 'banktags,1,spindel,13263,28327,-11941,-23685,-28327,-12625,-24592,12631,layout,0,2558,1,26674';
  const p = parseBanktag(text);
  const cells = p.items.map(i => [i.y * 8 + i.x, i.id]);
  assert.strictEqual(buildBanktag({ name: p.layoutName, iconId: p.layoutIcon, tagItems: p.tagItems, cells }), text);
});
