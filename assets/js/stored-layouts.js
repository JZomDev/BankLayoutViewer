// "Stored layouts" tab: example layouts from data/stored-layouts/, a read-only preview, and load and copy buttons.
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

  function getJson(url){
    return fetch(url).then(r => {
      if(!r.ok) throw new Error(url + ': status ' + r.status);
      return r.json();
    });
  }

  // data/stored-layouts/index.json names the layout files; one that fails to load is skipped
  async function fetchLayouts(){
    const names = await getJson('data/stored-layouts/index.json');
    const entries = await Promise.all(names.map(name => getJson('data/stored-layouts/' + encodeURIComponent(name)).catch(err => {
      console.warn('stored layout ' + name + ' skipped:', err.message);
      return null;
    })));
    return entries.filter(Boolean);
  }

  function loadStored(){
    if(!loading){
      loading = Promise.all([
        fetchLayouts(),
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
    const copy = el('button', 'small-btn', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', () => copyLayout(entry, copy));
    const head = el('div', 'stored-preview-head');
    head.append(back, el('strong', null, entry.title), copy, load);
    previewEl.replaceChildren(head, el('p', 'stored-meta', 'by ' + (entry.author || 'unknown') + ' · ' + entry.description), grid);
  }

  // copies the RuneLite bank tag export string, ready to paste into Import
  async function copyLayout(entry, button){
    let label = 'Copied!';
    try{ await navigator.clipboard.writeText(entry.layout); }
    catch(err){ label = 'Copy failed'; }
    button.textContent = label;
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
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
