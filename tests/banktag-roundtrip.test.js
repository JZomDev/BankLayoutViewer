const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');
const { buildBanktag } = require('../assets/js/helpers/banktag-export.js');
const { buildItems } = require('../assets/js/helpers/build-items.js');

const readJson = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cdn', 'json', name), 'utf8'));
const items = buildItems(readJson('items.json'), readJson('itemmeta.json'), new Set([6678]));

// Same id maps script.js builds after loading items: external id -> our id, placeholder id -> our id.
const external = {}, reverse = {}, placeholders = {};
items.forEach(it => {
  external[it.id] = it.externalId;
  reverse[String(it.externalId)] = it.id;
  placeholders[String(it.placeholderId)] = it.id;
});
const resolveId = key => reverse[key] || placeholders[key];

function roundTrip(text){
  const p = parseBanktag(text, { cols: 8, resolveId });
  const cells = p.items.map(i => [i.y * 8 + i.x, external[i.id] || i.id]);
  return buildBanktag({ name: p.layoutName, iconId: p.layoutIcon, tagItems: p.tagItems, cells });
}

test('a placeholder id exports as the item it is the placeholder of', () => {
  assert.strictEqual(placeholders['15259'], 2434); // data guard: 15259 is the placeholder of Prayer potion(4)
  assert.strictEqual(
    roundTrip('banktags,1,prayerpotions,952,layout,1,2434,2,15259'),
    'banktags,1,prayerpotions,952,layout,1,2434,2,2434'
  );
});
