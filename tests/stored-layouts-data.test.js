const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');

const entries = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stored-layouts.json'), 'utf8'));

test('the file is a non-empty array', () => {
  assert.ok(Array.isArray(entries) && entries.length > 0);
});

entries.forEach((entry, i) => {
  test(`entry ${i} has text fields and a layout that parses to items`, () => {
    for (const field of ['author', 'description', 'layout']) {
      assert.strictEqual(typeof entry[field], 'string', `${field} must be a string`);
      assert.ok(entry[field].trim(), `${field} must not be empty`);
    }
    assert.ok(parseBanktag(entry.layout).items.length > 0, 'layout must contain items');
  });
});
