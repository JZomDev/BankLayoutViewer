const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const panel = html.slice(html.indexOf('id="storedPanel"'), html.indexOf('id="storedPreview"'));
const link = panel.match(/<a\b[^>]*class="[^"]*stored-submit[^"]*"[^>]*>[^<]*<\/a>/);

test('the Stored layouts panel links to the bank tag issue template', () => {
  assert.ok(link, 'no submit link inside #storedPanel');
  assert.match(link[0], /href="https:\/\/github\.com\/JZomDev\/BankLayoutViewer\/issues\/new\?template=submit-a-bank-tag\.md"/);
});
test('the link opens a new tab without giving the new page access to this one', () => {
  assert.match(link[0], /target="_blank"/);
  assert.match(link[0], /rel="noopener/);
});
test('the link text says what it does', () => {
  assert.match(link[0], />Submit your own layout</);
});
