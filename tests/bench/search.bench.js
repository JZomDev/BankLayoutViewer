// Measures item-search costs on the real generated data. Not part of `make check`.
// Run: tests/.node/*/bin/node tests/bench/search.bench.js
// buildItems and itemmeta.json are the shipped code. `buildCurrent` is the old loadItems, kept only as a
// baseline; fuzzyScore is a copy of assets/js/script.js, so re-copy it if that changes.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { performance } = require('node:perf_hooks');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel));
const ms = (t0) => +(performance.now() - t0).toFixed(1);
const kb = n => `${(n / 1024).toFixed(0)} KB`;
const rows = [];
const report = (name, value) => { rows.push([name, value]); console.log(`${name.padEnd(46)} ${value}`); };

function timeIt(fn, runs = 1) {
  const samples = [];
  let out;
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); out = fn(); samples.push(performance.now() - t0); }
  samples.sort((a, b) => a - b);
  return { out, median: +samples[Math.floor(samples.length / 2)].toFixed(2) };
}

// --- payload: raw vs gzip (GitHub Pages serves text gzipped) ---
for (const rel of ['cdn/json/items.json', 'cdn/js/itemsmin.js']) {
  const buf = read(rel);
  report(`${rel} size (raw / gzip)`, `${kb(buf.length)} / ${kb(zlib.gzipSync(buf).length)}`);
}

// --- parse ---
const itemsText = read('cdn/json/items.json').toString();
const minText = read('cdn/js/itemsmin.js').toString();
let t0 = performance.now(); const data = JSON.parse(itemsText); report('JSON.parse items.json', `${ms(t0)} ms`);
t0 = performance.now(); const data2 = JSON.parse(minText); report('JSON.parse itemsmin.js', `${ms(t0)} ms`);
report('entries (items.json / itemsmin.js)', `${data.length} / ${data2.length}`);

// --- build items: current (two linear finds per item) vs. one-pass Maps ---
const skipIds = new Set([6678]);
function buildCurrent() {
  const seen = new Set();
  return data.flatMap((it, idx) => {
    if (!Number.isInteger(it.id) || skipIds.has(it.id) || seen.has(it.id)) return [];
    seen.add(it.id);
    const matchPlaceHolder = data2.find(x => x.placeholderId === it.id);
    const matchName = data2.find(x => x.id === it.id);
    return [{ id: it.id, name: matchName ? matchName.name : it.name || String(it.id || ('item-' + (idx + 1))),
      img: 'cdn/items/' + encodeURIComponent(it.imagepath || ''), placeholderId: matchPlaceHolder ? matchPlaceHolder.id : undefined }];
  });
}
function buildMaps() {
  const byId = new Map(), byPlaceholder = new Map();
  for (const x of data2) {
    byId.set(x.id, x);
    if (x.placeholderId !== undefined && !byPlaceholder.has(x.placeholderId)) byPlaceholder.set(x.placeholderId, x);
  }
  const seen = new Set();
  return data.flatMap((it, idx) => {
    if (!Number.isInteger(it.id) || skipIds.has(it.id) || seen.has(it.id)) return [];
    seen.add(it.id);
    const matchPlaceHolder = byPlaceholder.get(it.id);
    const matchName = byId.get(it.id);
    return [{ id: it.id, name: matchName ? matchName.name : it.name || String(it.id || ('item-' + (idx + 1))),
      img: 'cdn/items/' + encodeURIComponent(it.imagepath || ''), placeholderId: matchPlaceHolder ? matchPlaceHolder.id : undefined }];
  });
}
const { buildItems } = require('../../assets/js/helpers/build-items.js');
const meta = JSON.parse(read('cdn/json/itemmeta.json').toString());
report('cdn/json/itemmeta.json size (raw / gzip)', `${kb(read('cdn/json/itemmeta.json').length)} / ${kb(zlib.gzipSync(read('cdn/json/itemmeta.json')).length)}`);
const cur = timeIt(buildCurrent);
const fast = timeIt(() => buildItems(data, meta, skipIds), 5);
report('build items: current (find x2 per item)', `${cur.median} ms  -> ${cur.out.length} items`);
report('build items: shipped buildItems + itemmeta.json', `${fast.median} ms  -> ${fast.out.length} items`);
// Maps must give the same result, otherwise the speedup is meaningless.
const strip = list => list.map(({ externalId, ...rest }) => rest);
const same = JSON.stringify(strip(cur.out)) === JSON.stringify(strip(fast.out));
report('shipped build identical to current (ignoring externalId)', same ? 'yes' : 'NO - results differ');

// --- search: current fuzzyScore scan vs. precomputed lowercase names ---
function fuzzyScore(name, query) {
  if (!query) return 0;
  name = String(name || '').toLowerCase();
  query = String(query || '').toLowerCase();
  if (name.length === 0) return 0;
  if (name.indexOf(query) !== -1) return 100 + (query.length / Math.max(1, name.length));
  let qi = 0, score = 0, consec = 0;
  for (let i = 0; i < name.length && qi < query.length; i++) {
    if (name[i] === query[qi]) { qi++; consec++; score += 1 + (consec * 0.5); } else { consec = 0; }
  }
  if (qi !== query.length) return 0;
  return (score / name.length) * 10;
}
function searchCurrent(items, q) {
  return items.map(it => ({ it, score: fuzzyScore(it.name || '', q) })).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score).slice(0, 20).map(s => s.it);
}
const items = fast.out;
const lower = items.map(it => String(it.name || '').toLowerCase());
function fuzzyLower(name, query) { // same scoring as fuzzyScore, name already lowercase
  if (name.length === 0) return 0;
  if (name.indexOf(query) !== -1) return 100 + (query.length / Math.max(1, name.length));
  let qi = 0, score = 0, consec = 0;
  for (let i = 0; i < name.length && qi < query.length; i++) {
    if (name[i] === query[qi]) { qi++; consec++; score += 1 + (consec * 0.5); } else { consec = 0; }
  }
  if (qi !== query.length) return 0;
  return (score / name.length) * 10;
}
function searchLower(q) {
  const ql = q.toLowerCase(), hits = [];
  for (let i = 0; i < items.length; i++) { const s = fuzzyLower(lower[i], ql); if (s > 0) hits.push([s, i]); }
  hits.sort((a, b) => b[0] - a[0]);
  return hits.slice(0, 20).map(h => items[h[1]]);
}
const queries = ['dra', 'drag', 'dragon scim', 'abyssal whip', 'rune pla', 'zzz', 'amulet of'];
for (const q of queries) {
  const a = timeIt(() => searchCurrent(items, q), 15);
  const b = timeIt(() => searchLower(q), 15);
  // sort() is stable and both keep item order for ties, so ids should match exactly
  const ok = JSON.stringify(a.out.map(i => i.id)) === JSON.stringify(b.out.map(i => i.id));
  report(`search "${q}" current / lowercased`, `${a.median} ms / ${b.median} ms  ${ok ? '' : '(RESULTS DIFFER)'}  hits=${a.out.length}`);
}
