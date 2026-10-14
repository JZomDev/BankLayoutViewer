# Stored layouts tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Stored layouts" tab that lists example layouts from a JSON file, previews one read-only, and loads it into the editor.

**Architecture:** Layouts are stored as raw RuneLite bank tag export strings plus `author` and `description`. The import parser moves out of `editor.js` into a pure, node-tested helper that the import modal and the new tab share. A small pure helper builds the list rows; a DOM file renders the tab. Applying a layout to the editor becomes one shared function.

**Tech Stack:** Plain browser JS (IIFE files that also `module.exports` for node), `node --test`, Python `unittest` as the gate (`make check`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-stored-layouts-design.md`

## Global Constraints

- Files stay under 1,000 lines (`script.js` is at 837, so it gets only one added line).
- No new dependencies. Never edit lint, type-check or CI config. Never weaken or skip a test.
- Generated files (`cdn/items`, `cdn/json`, `data/layouts.json`) are never hand-edited. `data/stored-layouts.json` is a new hand-authored file and is not one of them.
- Work on branch `stored-layouts`. Do not push, merge or deploy; the human does. Commit messages carry no attribution trailer.
- Cell index maps to `x = index % 8`, `y = floor(index / 8)`, as the importer does today.
- User-supplied text (author, description, title) is rendered with `textContent`, never `innerHTML`.
- Run `make check` before saying anything is done, and paste its last line.

## Review Focus

- A stored entry that is not a valid export (no `layout`, or text that is not `banktags,...`) is skipped with a warning; the rest still list. (Task 4, `stored-list.test.js`)
- A truncated export with a dangling last cell (odd number of values) loads without throwing. (Task 1, `banktag-parse.test.js`)
- Author or description containing HTML such as `<b>hi</b>` shows as text. (Task 4 helper keeps it as plain text; the DOM uses `textContent`; checked by hand)
- Unknown item ids (not in the item list) show a `?` cell, not a crash. (Task 4, by hand: edit a copy of the JSON to use id 99999999)
- Editing the editor layout after "Load into editor" must not change the stored preview (items are copied, not shared). (Task 4, by hand)
- The JSON file missing or returning an error shows a message, not an empty broken tab. (Task 4, by hand: rename the file temporarily)

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `assets/js/helpers/banktag-parse.js` | Create | Pure `parseBanktag(text, { cols, resolveId })` |
| `assets/js/helpers/stored-list.js` | Create | Pure `buildStoredList(entries, parse, warn)` |
| `assets/js/stored-layouts.js` | Create | Tab switching, fetch, list, preview, load button (DOM) |
| `assets/js/editor.js` | Modify | Use the shared parser; extract `applyImportedLayout`; expose both |
| `assets/js/script.js` | Modify | Expose `window.itemsById` (one line) |
| `index.html`, `assets/css/styles.css` | Modify | Tab buttons, panels, styles, `[hidden]` rule |
| `data/stored-layouts.json` | Create | The examples; first entry is Potions |
| `tests/fixtures/potions-banktag.txt` | Create | The Potions export string |
| `tests/banktag-parse.test.js`, `tests/stored-list.test.js`, `tests/stored-layouts-data.test.js` | Create | Node tests |
| `tests/test_js.py` | Modify | Run every `tests/*.test.js` instead of a hard-coded list |

The spec lists `stored-layouts.js` as one file; the pure list-building part is split into `stored-list.js` so it can be tested in node.

---

### Task 1: Extract the parser

**Files:**
- Create: `assets/js/helpers/banktag-parse.js`, `tests/banktag-parse.test.js`, `tests/fixtures/potions-banktag.txt`
- Modify: `assets/js/editor.js` (replace `parseText`), `index.html` (script tag), `tests/test_js.py`

**Interfaces:**
- Produces: `parseBanktag(text: string, options?: { cols?: number, resolveId?: (externalId: string) => number|undefined }) -> { layoutName: string, layoutIcon: string|number, items: {x:number,y:number,id:number|string}[] }`. Throws `Error` with the same messages as the old `parseText` ('Empty input', 'Unsupported format, check your copy paste', 'Invalid header format: ...'). `layoutIcon` is the string from the export (`'249'`), or `1963` when absent. Also available as `window.parseBanktag`.
- Produces: `window.parseEditorBanktag(text)` in `editor.js` = the old `parseText` behaviour (cols from `window.current.width`, ids resolved through `window.reverseExternalIdMap` then `window.externalPlaceHolderMap`).

- [ ] **Step 1: Create the fixture**

Write `tests/fixtures/potions-banktag.txt` with exactly this single line (no trailing newline needed):

```
banktags,1,Potions,249,layout,0,199,1,249,2,227,3,221,4,91,5,121,6,29974,7,5291,8,201,9,251,10,227,11,235,12,93,13,175,14,29990,15,5292,16,203,17,253,18,227,19,592,20,95,21,3410,22,29996,23,5293,24,205,25,255,26,227,27,1975,28,97,29,3010,30,29998,31,5294,32,205,33,255,34,227,35,21622,36,97,37,6472,38,29988,39,5294,40,207,41,257,42,227,43,231,44,99,45,139,47,5295,48,3049,49,2998,50,227,51,6693,52,3002,53,6687,55,5296,56,209,57,259,58,227,59,221,60,101,61,145,63,5297,64,209,65,259,66,5935,67,6051,68,5951,69,5954,71,5297,72,211,73,261,74,227,75,2970,76,103,77,3018,79,5298,80,213,81,263,82,227,83,225,84,105,85,157,87,5299,88,3051,89,3000,90,227,91,223,92,3004,93,3026,95,5300,96,215,97,265,98,227,99,239,100,107,101,163,103,5301,104,2485,105,2481,106,227,107,241,108,2483,109,2454,111,5302,112,217,113,267,114,227,115,245,116,109,117,169,119,5303,120,217,121,267,122,227,123,27272,124,109,125,27205,127,5303,128,219,129,269,130,227,131,247,132,111,133,189,135,5304,136,30094,137,30097,138,227,139,29993,140,30100,141,30128,143,30088,144,12934,145,5952,146,12905,147,269,148,29784,149,12913,153,31487,154,227,155,31710,156,31668,157,31650,159,31515,168,946,169,233,170,233,171,233,172,233,173,12640,174,19662,175,21163,176,1973,177,5075,178,243,179,237,180,23962,181,3016,182,19659,184,1923,185,4456,186,111,187,249,188,255,189,4460,192,1921,193,1980,194,269,195,249,196,251,197,4419,200,23964,201,2440,202,2436,203,2442,204,12695,205,2444,208,2485,209,2481,210,227,211,3138,212,2483,213,3042
```

- [ ] **Step 2: Write the failing test**

Create `tests/banktag-parse.test.js`:

```js
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `tests/.node/*/bin/node --test tests/banktag-parse.test.js`
Expected: FAIL with "Cannot find module '../assets/js/helpers/banktag-parse.js'".

- [ ] **Step 4: Write the parser**

Create `assets/js/helpers/banktag-parse.js`:

```js
// Parses a RuneLite bank tag export: banktags,1,<name>,<icon id>,layout,<cell>,<item id>,<cell>,<item id>,...
// Pure: item ids are resolved through options.resolveId (return a falsy value to fall back to the number).
(function(){
  function parseBanktag(text, options){
    const opts = options || {};
    const cols = Number(opts.cols) || 8;
    const resolveId = opts.resolveId || (() => undefined);
    const t = String(text || '').trim();
    if(!t) throw new Error('Empty input');
    const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if(!lines[0].toLowerCase().startsWith('banktags')){
      throw new Error('Unsupported format, check your copy paste');
    }
    const out = { layoutName: 'Imported Layout', layoutIcon: 1963, items: [] };
    const splits = lines[0].split(',');
    if(splits.length < 7){
      throw new Error('Invalid header format: \n Format: banktags,1,currency,952,layout,8,995');
    }
    let startIndex = 0;
    for(let i = 0; i < splits.length; i++){
      const content = splits[i].trim();
      if(i === 2){ out.layoutName = content; continue; }
      if(i === 3){ out.layoutIcon = content; continue; }
      if(content === 'layout'){ startIndex = i + 1; break; }
    }
    for(let i = startIndex; i < splits.length - 1; i++){
      const cellIndex = Number(splits[i].trim());
      i = i + 1;
      const externalId = splits[i].trim();
      if(isNaN(cellIndex)) continue;
      let id = resolveId(externalId);
      if(!id){
        const n = Number(externalId);
        id = isNaN(n) ? externalId : n;
      }
      out.items.push({ x: cellIndex % cols, y: Math.floor(cellIndex / cols), id });
    }
    return out;
  }

  try{ window.parseBanktag = parseBanktag; }catch(e){}
  try{ module.exports = { parseBanktag }; }catch(e){}
})();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `tests/.node/*/bin/node --test tests/banktag-parse.test.js`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 6: Make the gate run every node test file**

In `tests/test_js.py`, replace the `subprocess.run([...])` call so the file list is discovered:

```python
        node_tests = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "tests").glob("*.test.js"))
        result = subprocess.run(
            [node, "--test", *node_tests], cwd=ROOT, capture_output=True, text=True
        )
```

- [ ] **Step 7: Use the shared parser in `editor.js`**

In `assets/js/editor.js`, delete the whole `function parseText(text){ ... }` (it starts at `  function parseText(text){` and ends with the `}` just before the line `  if(downloadBtn){`) and put this in its place:

```js
  function resolveExternalId(externalId){
    const key = String(externalId);
    if(window.reverseExternalIdMap && window.reverseExternalIdMap[key]) return window.reverseExternalIdMap[key];
    if(window.externalPlaceHolderMap && window.externalPlaceHolderMap[key]) return window.externalPlaceHolderMap[key];
    return undefined;
  }

  function parseText(text){
    const cols = (window.current && window.current.width) ? Number(window.current.width) : 8;
    return window.parseBanktag(text, { cols, resolveId: resolveExternalId });
  }
  try{ window.parseEditorBanktag = parseText; }catch(e){}
```

In `index.html`, add `<script src="assets/js/helpers/banktag-parse.js"></script>` directly after the `build-items.js` script tag (before `script.js`).

- [ ] **Step 8: Run the gate and check import by hand**

Run: `make check`. Expected: last line `OK`.
By hand: `python3 -m http.server 8089`, open http://127.0.0.1:8089/, click Import, paste the fixture line, click Import. The grid fills with potions, the name box says "Potions", and the icon is the item with id 249.

- [ ] **Step 9: Commit**

```bash
git add assets/js/helpers/banktag-parse.js assets/js/editor.js index.html tests/banktag-parse.test.js tests/fixtures/potions-banktag.txt tests/test_js.py
git commit -m "Move the bank tag parser into a tested helper"
```

---

### Task 2: The data file and its checks

**Files:**
- Create: `data/stored-layouts.json`, `tests/stored-layouts-data.test.js`

**Interfaces:**
- Consumes: `parseBanktag` (Task 1).
- Produces: `data/stored-layouts.json`, an array of `{ author: string, description: string, layout: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/stored-layouts-data.test.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `tests/.node/*/bin/node --test tests/stored-layouts-data.test.js`
Expected: FAIL (ENOENT: no such file `data/stored-layouts.json`).

- [ ] **Step 3: Create the data file from the fixture**

Run (this copies the string from the fixture so it cannot be mistyped):

```bash
tests/.node/*/bin/node -e "
const fs = require('fs');
const layout = fs.readFileSync('tests/fixtures/potions-banktag.txt', 'utf8').trim();
const data = [{ author: 'zom', description: 'potion making', layout }];
fs.writeFileSync('data/stored-layouts.json', JSON.stringify(data, null, 2) + '\n');
"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `tests/.node/*/bin/node --test tests/stored-layouts-data.test.js`
Expected: 2 tests pass (`# fail 0`).

- [ ] **Step 5: Run the gate and commit**

Run: `make check`. Expected: last line `OK`.

```bash
git add data/stored-layouts.json tests/stored-layouts-data.test.js
git commit -m "Add stored layouts data with the Potions example"
```

---

### Task 3: A shared "apply layout to the editor" function

**Files:**
- Modify: `assets/js/editor.js` (extract from the import button handler)

**Interfaces:**
- Produces: `async applyImportedLayout(parsed: { layoutName, layoutIcon, items }) -> true`, also `window.applyImportedLayout`. Throws `Error` with a user-facing message ('The editor is not ready yet.' or 'Invalid Layout.'). It copies the items, so callers keep their own array. Behaviour is otherwise exactly what the import button did: sets the `tagName` box, resolves and sets the icon and `current.thumbId`/`thumbnail`, replaces `window.current.items`, sets `height` to 8 then grows it to fit, and dispatches `bank-layouts:imported`.

This task has no automated test (the code needs a DOM and the item list). It is a behaviour-preserving move, checked by hand in Step 3.

- [ ] **Step 1: Add the function**

In `assets/js/editor.js`, add this directly after the `window.parseEditorBanktag = parseText` line from Task 1:

```js
  // Applies a parsed layout to the editor's current layout. Throws an Error with a user-facing message.
  async function applyImportedLayout(parsed){
    if(!window.current) throw new Error('The editor is not ready yet.');
    const layoutName = parsed.layoutName;
    const layoutIcon = parsed.layoutIcon;
    const itemsLayout = parsed.items;

    try{
      const nameInput = document.getElementById('tagName');
      if(nameInput && layoutName) nameInput.value = layoutName;
    }catch(e){}

    if(layoutIcon){
      try{
        const data = (window.getItemsJsonData
          ? await window.getItemsJsonData()
          : await (await fetch('cdn/json/items.json')).json());
        if(Array.isArray(data)){
          const foundIdx = data.findIndex(it => String(it.id) === String(layoutIcon));
          if(foundIdx > -1){
            const found = data[foundIdx];
            const imageName = found.imagepath || found.image || '';
            if(imageName){
              const imgUrl = 'cdn/items/' + encodeURIComponent(imageName);
              const iconEl = document.querySelector('.tag-card .icon');
              if(iconEl){ iconEl.innerHTML = `<img id="layoutimage" src="${imgUrl}" alt="${found.name||''}" itemid="${found.id}" style="border-radius:6px">`; }
              try{ window.leftIconId = found.id; }catch(e){}
              if(window.current){
                window.current.thumbId = found.id;
                window.current.thumbnail = imgUrl;
              }
            }
          } else if(window.reverseExternalIdMap && window.reverseExternalIdMap[String(layoutIcon)]){
            try{ window.leftIconId = window.reverseExternalIdMap[String(layoutIcon)]; if(window.current) window.current.thumbId = window.leftIconId; }catch(e){}
          }
        }
      }catch(e){ /* ignore errors resolving icon */ }
    }

    let itemsToAdd = [];
    if(Array.isArray(itemsLayout)) itemsToAdd = itemsLayout;
    else if(itemsLayout && Array.isArray(itemsLayout.layouts) && itemsLayout.layouts[0] && Array.isArray(itemsLayout.layouts[0].items)) itemsToAdd = itemsLayout.layouts[0].items;
    else throw new Error('Invalid Layout.');

    window.current.items = itemsToAdd.map(it => ({ ...it }));
    window.current.height = 8;
    // grow to fit imported items: if items use more rows than current height, expand +1 row
    if(window.current.items.length){
      let maxY = 0;
      window.current.items.forEach(it => { if(typeof it.y === 'number' && it.y > maxY) maxY = it.y; });
      const requiredRows = maxY + 1;
      if(requiredRows >= window.current.height){
        window.current.height = requiredRows + 1;
      }
    }
    // refresh UI by dispatching a custom event the main script listens for
    window.dispatchEvent(new CustomEvent('bank-layouts:imported', { detail: { layout: window.current } }));
    return true;
  }
  try{ window.applyImportedLayout = applyImportedLayout; }catch(e){}
```

- [ ] **Step 2: Make the import button use it**

In the `importConfirm.addEventListener('click', async () => {` handler, replace everything from the line `          let parsed;` through the line `          hideModal();` (inclusive) with:

```js
          let parsed;
          try{
            parsed = parseText(txt);
            await applyImportedLayout(parsed);
          }catch(err){ showMessage(err.message, true); return; }
          hideModal();
```

(Keep the `const txt = ...` and `if(!txt){ showMessage('No Text to import.', true); return; }` lines above it, and the closing `});` below it.)

- [ ] **Step 3: Check by hand and run the gate**

Run: `make check`. Expected: last line `OK`.
By hand (server from Task 1): import the Potions fixture as in Task 1 Step 8: same result as before. Import `hello`: the modal shows "Unsupported format, check your copy paste" and stays open. Refresh the page: the imported layout is still there.

- [ ] **Step 4: Commit**

```bash
git add assets/js/editor.js
git commit -m "Share one function for applying an imported layout"
```

---

### Task 4: The tab

**Files:**
- Create: `assets/js/helpers/stored-list.js`, `assets/js/stored-layouts.js`, `tests/stored-list.test.js`
- Modify: `index.html`, `assets/css/styles.css`, `assets/js/script.js` (one line)

**Interfaces:**
- Consumes: `window.parseEditorBanktag(text)`, `window.applyImportedLayout(parsed)` (Tasks 1, 3); `window.ensureItemsLoaded()` (exists); `window.current` (exists).
- Produces: `window.itemsById: Map<number, {id, name, img}>`; `buildStoredList(entries, parse, warn?) -> {index, title, author, description, iconId, items}[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/stored-list.test.js`:

```js
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
  const rows = buildStoredList([{ author: 'a' }, good, { layout: 'nonsense' }, null], parse, (i) => warnings.push(i));
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `tests/.node/*/bin/node --test tests/stored-list.test.js`
Expected: FAIL with "Cannot find module '../assets/js/helpers/stored-list.js'".

- [ ] **Step 3: Write the list helper**

Create `assets/js/helpers/stored-list.js`:

```js
// Turns data/stored-layouts.json entries into list rows. `parse` turns an export string into
// { layoutName, layoutIcon, items }. Entries that do not parse are skipped and reported to `warn`.
(function(){
  function buildStoredList(entries, parse, warn){
    const out = [];
    (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
      try{
        if(!entry || typeof entry.layout !== 'string') throw new Error('missing layout string');
        const parsed = parse(entry.layout);
        out.push({
          index,
          title: parsed.layoutName,
          author: String(entry.author || ''),
          description: String(entry.description || ''),
          iconId: parsed.layoutIcon,
          items: parsed.items
        });
      }catch(e){ if(warn) warn(index, e); }
    });
    return out;
  }

  try{ window.buildStoredList = buildStoredList; }catch(e){}
  try{ module.exports = { buildStoredList }; }catch(e){}
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `tests/.node/*/bin/node --test tests/stored-list.test.js`
Expected: `# pass 4`, `# fail 0`.

- [ ] **Step 5: Expose the item lookup**

In `assets/js/script.js`, directly after the line `items = window.buildItems(data, meta, new Set([6678]));` add:

```js
        window.itemsById = new Map(items.map(it => [it.id, it]));
```

- [ ] **Step 6: Page markup**

In `index.html`, replace the tabs block and the grid wrapper:

```html
        <div class="tabs">
            <button class="tab active">Layout</button>
        </div>
        <div class="bank-grid-wrap panel">
          <div id="layoutGrid" class="bank-grid" aria-live="polite"></div>
        </div>
```

with:

```html
        <div class="tabs">
            <button class="tab active" data-tab="layout">Layout</button>
            <button class="tab" data-tab="stored">Stored layouts</button>
        </div>
        <div id="layoutPanel" class="bank-grid-wrap panel">
          <div id="layoutGrid" class="bank-grid" aria-live="polite"></div>
        </div>
        <div id="storedPanel" class="panel stored-panel" hidden>
          <div id="storedList" class="stored-list"></div>
          <div id="storedPreview" class="stored-preview" hidden></div>
        </div>
```

Add these script tags: `<script src="assets/js/helpers/stored-list.js"></script>` after the `banktag-parse.js` tag, and `<script src="assets/js/stored-layouts.js"></script>` after the `editor.js` tag.

- [ ] **Step 7: Styles**

Append to `assets/css/styles.css`:

```css
/* Stored layouts tab */
[hidden]{display:none !important}
.stored-panel{width:100%;box-sizing:border-box}
.stored-list{display:flex;flex-direction:column;gap:8px}
.stored-row{display:flex;align-items:center;gap:12px;text-align:left;width:100%;background:#121918;color:inherit;border:1px solid #1b2a29;border-radius:6px;padding:10px;cursor:pointer}
.stored-row:hover{border-color:var(--accent-2)}
.stored-icon{width:36px;height:36px;object-fit:contain}
.stored-title{font-weight:600;color:var(--accent)}
.stored-meta,.stored-desc,.stored-message{color:var(--muted);font-size:13px}
.stored-preview-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.stored-preview-head strong{flex:1}
```

- [ ] **Step 8: The tab code**

Create `assets/js/stored-layouts.js`:

```js
// "Stored layouts" tab: example layouts from data/stored-layouts.json, a read-only preview, and a load button.
(function(){
  const COLS = 8;
  const tabs = document.querySelectorAll('.tabs .tab');
  const layoutPanel = document.getElementById('layoutPanel');
  const storedPanel = document.getElementById('storedPanel');
  const listEl = document.getElementById('storedList');
  const previewEl = document.getElementById('storedPreview');
  if(!layoutPanel || !storedPanel || !listEl || !previewEl) return;

  let loading = null; // promise of the built list, cleared on failure so a later visit retries

  function el(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text !== undefined) node.textContent = text;
    return node;
  }

  function showTab(name){
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    layoutPanel.hidden = name !== 'layout';
    storedPanel.hidden = name !== 'stored';
    if(name === 'stored') openList();
  }

  function loadStored(){
    if(!loading){
      loading = Promise.all([
        fetch('data/stored-layouts.json').then(r => {
          if(!r.ok) throw new Error('status ' + r.status);
          return r.json();
        }),
        window.ensureItemsLoaded ? window.ensureItemsLoaded() : Promise.resolve()
      ]).then(([entries]) => window.buildStoredList(entries, window.parseEditorBanktag,
        (i, e) => console.warn('stored layout ' + i + ' skipped:', e.message))
      ).catch(err => { loading = null; throw err; });
    }
    return loading;
  }

  function itemFor(id){ return window.itemsById ? window.itemsById.get(Number(id)) : undefined; }

  function iconFor(id){
    const item = itemFor(id);
    if(!item || !item.img) return null;
    const img = el('img', 'stored-icon');
    img.src = item.img;
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }

  function message(text){ listEl.replaceChildren(el('p', 'stored-message', text)); }

  function openList(){
    previewEl.hidden = true;
    listEl.hidden = false;
    message('Loading…');
    loadStored().then(renderList).catch(() => message('Could not load stored layouts. Try again later.'));
  }

  function renderList(list){
    if(!list.length){ message('No stored layouts yet.'); return; }
    listEl.replaceChildren(...list.map(rowFor));
  }

  function rowFor(entry){
    const row = el('button', 'stored-row');
    row.type = 'button';
    const icon = iconFor(entry.iconId);
    if(icon) row.appendChild(icon);
    const text = el('div', 'stored-text');
    text.append(
      el('div', 'stored-title', entry.title),
      el('div', 'stored-meta', 'by ' + (entry.author || 'unknown') + ' · ' + entry.items.length + ' items'),
      el('div', 'stored-desc', entry.description)
    );
    row.appendChild(text);
    row.addEventListener('click', () => openPreview(entry));
    return row;
  }

  function openPreview(entry){
    listEl.hidden = true;
    previewEl.hidden = false;
    const rows = Math.max(1, ...entry.items.map(i => i.y + 1));
    const byPos = new Map(entry.items.map(i => [i.x + ',' + i.y, i]));
    const grid = el('div', 'bank-grid');
    grid.style.gridTemplateColumns = 'repeat(' + COLS + ',var(--cell-size))';
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < COLS; c++){
        const cell = el('div', 'cell');
        const placed = byPos.get(c + ',' + r);
        if(placed){
          const item = itemFor(placed.id);
          const thumb = el('div', 'thumb');
          if(item && item.img){
            const img = document.createElement('img');
            img.src = item.img;
            img.alt = item.name;
            img.title = item.name;
            img.loading = 'lazy';
            thumb.appendChild(img);
          } else {
            thumb.textContent = '?';
            thumb.title = 'Unknown item ' + placed.id;
          }
          cell.appendChild(thumb);
        }
        grid.appendChild(cell);
      }
    }
    const back = el('button', 'small-btn', 'Back');
    back.type = 'button';
    back.addEventListener('click', openList);
    const load = el('button', 'small-btn', 'Load into editor');
    load.type = 'button';
    load.addEventListener('click', () => loadIntoEditor(entry));
    const head = el('div', 'stored-preview-head');
    head.append(back, el('strong', null, entry.title), load);
    previewEl.replaceChildren(head, el('p', 'stored-meta', 'by ' + (entry.author || 'unknown') + ' · ' + entry.description), grid);
  }

  async function loadIntoEditor(entry){
    const cur = window.current;
    if(cur && Array.isArray(cur.items) && cur.items.length && !confirm('Replace your current layout with "' + entry.title + '"?')) return;
    try{
      await window.applyImportedLayout({ layoutName: entry.title, layoutIcon: entry.iconId, items: entry.items.map(i => ({ ...i })) });
      showTab('layout');
    }catch(err){ alert(err.message); }
  }

  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
})();
```

- [ ] **Step 9: Run the gate**

Run: `make check`. Expected: last line `OK`.

- [ ] **Step 10: Check by hand and record it**

With the server from Task 1 running, in a browser:
1. Click "Stored layouts": a row shows the Potions icon, "Potions", "by zom · 182 items", "potion making".
2. Click it: a read-only grid of potions with names on hover. "Back" returns to the list.
3. Click "Load into editor" with items already placed: a confirm appears; Cancel keeps the editor, OK switches to the Layout tab with the potions and the name "Potions".
4. Move an item in the editor, open Stored layouts, open Potions again: the preview is unchanged.
5. Temporarily rename `data/stored-layouts.json`: the tab shows "Could not load stored layouts. Try again later." Rename it back.
6. Temporarily set `"description": "<b>hi</b>"`: the row shows the literal text `<b>hi</b>`. Restore it.
7. Temporarily change one export id to `99999999`: that cell shows `?` in the preview, with no error. Restore it.

Record in the PR description that this tab is verified by hand, not by an automated test.

- [ ] **Step 11: Commit**

```bash
git add assets/js/helpers/stored-list.js assets/js/stored-layouts.js assets/js/script.js index.html assets/css/styles.css tests/stored-list.test.js
git commit -m "Add the Stored layouts tab"
```

---

## Self-review

- **Spec coverage:** data file (Task 2), parser move and tests (Task 1), shared apply (Task 3), tab/list/preview/load with confirm and switch to Layout (Task 4), failure, bad-entry and unknown-id handling (Task 4), item lookup in `script.js` (Task 4 Step 5), data checks (Task 2). The one deviation from the spec is the extra `stored-list.js` helper, noted in File Structure.
- **Placeholders:** none; every step has code or an exact command.
- **Type consistency:** `parseBanktag`, `parseEditorBanktag`, `applyImportedLayout`, `buildStoredList`, `itemsById` and the `{x, y, id}` / `{layoutName, layoutIcon, items}` shapes are used with the same names and signatures in every task.
- **Review focus:** the six lines above each have a test or a hand-check step in the owning task.
