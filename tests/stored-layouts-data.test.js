const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseBanktag } = require('../assets/js/helpers/banktag-parse.js');

const dir = path.join(__dirname, '..', 'data', 'stored-layouts');
const names = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

test('the index is a non-empty array of file names', () => {
  assert.ok(Array.isArray(names) && names.length > 0);
});

names.forEach(name => {
  test(`${name} has text fields and a layout that parses to items`, () => {
    const entry = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const field of ['author', 'description', 'layout']) {
      assert.strictEqual(typeof entry[field], 'string', `${field} must be a string`);
      assert.ok(entry[field].trim(), `${field} must not be empty`);
    }
    assert.ok(parseBanktag(entry.layout).items.length > 0, 'layout must contain items');
  });
});
