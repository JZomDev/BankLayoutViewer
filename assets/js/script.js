// Client that fetches sample layouts and renders a card grid.
(function(){
  const layoutsUrl = 'data/layouts.json';
  const itemsGrid = document.getElementById('itemsGrid');
  const layoutsList = document.getElementById('layoutsList');
  const layoutGrid = document.getElementById('layoutGrid');
  const itemSearch = document.getElementById('itemSearch');

  // Five items with images
  const items = [
    { id: 1, name: 'Apple', img: 'assets/images/apple.svg' },
    { id: 2, name: 'Banana', img: 'assets/images/banana.svg' },
    { id: 3, name: 'Orange', img: 'assets/images/orange.svg' },
    { id: 4, name: 'Watermelon', img: 'assets/images/watermelon.svg' },
    { id: 5, name: 'Pineapple', img: 'assets/images/pineapple.svg' }
  ];

  let layouts = [];
  let current = null;
  let selected = null; // { type: 'palette'|'placed', id, fromPos, tileEl }

  function renderItems(list){
    itemsGrid.innerHTML = '';
    list.forEach(it => {
      const tile = document.createElement('div');
      tile.className = 'item-tile';
      tile.innerHTML = `
        <img src="${it.img}" alt="${it.name}">
        <div class="name">${it.name}</div>
        <div class="id" style="display:none">${it.id}</div>
      `;
      tile.addEventListener('click', () => {
        // select this palette item for placement
        clearSelection();
        selected = { type: 'palette', id: it.id, item: it, tileEl: tile };
        tile.classList.add('selected');
      });
      // allow dragging palette items into grid
      const img = tile.querySelector('img');
      if(img){
        img.setAttribute('draggable','true');
        img.addEventListener('dragstart', e => {
          const payload = JSON.stringify({ id: it.id });
          try{ e.dataTransfer.setData('application/json', payload); }catch(_){ e.dataTransfer.setData('text/plain', payload); }
          e.dataTransfer.effectAllowed = 'copy';
        });
      }
      tile.addEventListener('dblclick', () => {
        // double-click places the item into the first available slot
        clearSelection();
        placeItem(it);
      });
      itemsGrid.appendChild(tile);
    });
  }

  function renderLayoutsList(){
    layoutsList.innerHTML = '';
    layouts.forEach(l => {
      const li = document.createElement('li');
      // determine thumbnail image
      const thumbItem = items.find(it => it.id === l.thumbId) || items[0] || {};
      const thumbSrc = l.thumbnail || (thumbItem && thumbItem.img) || '';
      li.innerHTML = `<div class="layout-entry-left">
          <img src="${thumbSrc}" class="layout-thumb" data-layout-id="${l.id}" alt="thumb">
          <div>
            <strong>${l.title}</strong>
            <div class="meta">${l.author || '—'}</div>
          </div>
        </div>
        <div>
          <button data-id="${l.id}" class="use-btn">✔</button>
          <button data-id="${l.id}" class="del-btn">⛔</button>
        </div>`;
      layoutsList.appendChild(li);
    });
    document.querySelectorAll('.use-btn').forEach(b=>b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      const l = layouts.find(x=>String(x.id)===String(id));
      if(l) showLayout(l);
    }));
    // thumbnail click handlers: open chooser modal
    document.querySelectorAll('.layout-thumb').forEach(img => img.addEventListener('click', e => {
      const id = e.target.getAttribute('data-layout-id');
      openChooseModal && openChooseModal(Number(id));
    }));
  }

  function showLayout(l){
    current = l;
    // expose current layout to other scripts (import modal)
    try{ window.current = current; }catch(e){}
    const cols = l.width || 8;
    const rows = l.height || 7;
    layoutGrid.innerHTML = '';
    layoutGrid.style.gridTemplateColumns = `repeat(${cols},56px)`;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.pos = `${c},${r}`;
        // drag handlers
        cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragenter', e => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          try{
            const payload = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if(!payload) return;
            const data = JSON.parse(payload);
            handleDrop(data, cell);
          }catch(err){ console.warn('drop parse', err); }
        });
        // double-click to remove item in cell
        cell.addEventListener('dblclick', () => {
          if(cell.dataset.itemId){
            // remove from current.items
            if(current && Array.isArray(current.items)){
              const posKey = cell.dataset.pos;
              const idx = current.items.findIndex(x=>`${x.x},${x.y}` === posKey);
              if(idx > -1) current.items.splice(idx,1);
            }
            cell.innerHTML = '';
            delete cell.dataset.itemId;
            renderLayoutsList();
          }
        });
        // click handler for selection/placement
        cell.addEventListener('click', () => {
          // if a palette item is selected, place it at this cell
          if(selected && selected.type === 'palette'){
            placeAt(selected.item, cell);
            clearSelection();
            return;
          }
          // if clicking a populated cell, select it for moving
          if(cell.dataset.itemId){
            clearSelection();
            selected = { type: 'placed', id: Number(cell.dataset.itemId), fromPos: cell.dataset.pos, cellEl: cell };
            cell.classList.add('selected');
            return;
          }
          // if clicking an empty cell while a placed item is selected, move the selected item here
          if(selected && selected.type === 'placed' && !cell.dataset.itemId){
            moveItem(selected.fromPos, cell.dataset.pos);
            clearSelection();
            return;
          }
        });
        layoutGrid.appendChild(cell);
      }
    }
    (l.items||[]).forEach(it => {
      const pos = `${it.x},${it.y}`;
      const el = layoutGrid.querySelector(`[data-pos="${pos}"]`);
      if(el){
        const itemDef = items.find(x=>x.id===it.id) || {};
        el.innerHTML = `<div class="thumb"><img src="${itemDef.img||''}" style="width:36px;height:36px" alt="${itemDef.name||''}" draggable="true"></div><div class="qty">${it.qty||''}</div>`;
        el.dataset.itemId = it.id;
        // mark image draggable (delegated handlers will manage behavior)
        const img = el.querySelector('img');
        if(img) img.setAttribute('draggable','true');
      }
    });
  }

  // Listen for import events to refresh the UI when editor merges items
  window.addEventListener('bank-layouts:imported', (e) => {
    if(window.current) showLayout(window.current);
  });

  function clearSelection(){
    selected = null;
    // clear visual selection from tiles and cells
    document.querySelectorAll('.item-tile.selected').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
  }

  function placeAt(item, targetCell){
    if(!current) return;
    if(targetCell.dataset.itemId){
      // replace existing: append new item anyway
    }
    // compute x,y
    const [x,y] = targetCell.dataset.pos.split(',').map(Number);
    current.items = current.items || [];
    current.items.push({ x,y, id: item.id, qty: 1 });
    // render item into target cell
    targetCell.innerHTML = `<div class="thumb"><img src="${item.img}" style="width:36px;height:36px" alt="${item.name}" draggable="true"></div><div class="qty">1</div>`;
    targetCell.dataset.itemId = item.id;
    attachDragHandlersToCells();
    renderLayoutsList();
  }

  function moveItem(fromPos, toPos){
    if(!current) return;
    const fromCell = layoutGrid.querySelector(`[data-pos="${fromPos}"]`);
    const toCell = layoutGrid.querySelector(`[data-pos="${toPos}"]`);
    if(!fromCell || !toCell) return;
    // find indices in current.items
    const srcIdx = current.items.findIndex(x=>`${x.x},${x.y}` === fromPos);
    const tgtIdx = current.items.findIndex(x=>`${x.x},${x.y}` === toPos);
    if(tgtIdx > -1 && srcIdx > -1){
      // swap data positions
      const a = current.items[srcIdx];
      const b = current.items[tgtIdx];
      const ax = a.x, ay = a.y;
      a.x = b.x; a.y = b.y;
      b.x = ax; b.y = ay;
    } else if(srcIdx > -1){
      // move
      current.items[srcIdx].x = Number(toPos.split(',')[0]);
      current.items[srcIdx].y = Number(toPos.split(',')[1]);
    }
    // swap DOM or move
    const fromHtml = fromCell.innerHTML;
    const fromId = fromCell.dataset.itemId;
    if(toCell.dataset.itemId){
      // swap
      const toHtml = toCell.innerHTML;
      const toId = toCell.dataset.itemId;
      fromCell.innerHTML = toHtml; fromCell.dataset.itemId = toId;
      toCell.innerHTML = fromHtml; toCell.dataset.itemId = fromId;
    } else {
      toCell.innerHTML = fromHtml; toCell.dataset.itemId = fromId;
      fromCell.innerHTML = '';
      delete fromCell.dataset.itemId;
    }
    attachDragHandlersToCells();
    renderLayoutsList();
  }

  function handleDrop(data, targetCell){
    if(!current) return;
    const fromPos = data.from; // may be undefined for new items
    const itemId = data.id;
    // find if target has an item
    const targetItemId = targetCell.dataset.itemId ? Number(targetCell.dataset.itemId) : null;
    // if fromPos exists, move (or swap) within grid
    if(fromPos){
      const fromCell = layoutGrid.querySelector(`[data-pos="${fromPos}"]`);
      if(!fromCell) return;
      // swapping
      if(targetItemId){
        // find item entries in current.items
        const srcIdx = current.items.findIndex(x=>String(x.x)+','+String(x.y) === fromPos);
        const tgtIdx = current.items.findIndex(x=>String(x.x)+','+String(x.y) === targetCell.dataset.pos);
        if(srcIdx>-1 && tgtIdx>-1){
          const tmp = current.items[srcIdx].x; const tmpy = current.items[srcIdx].y;
          // swap positions
          const a = current.items[srcIdx];
          const b = current.items[tgtIdx];
          const ax = a.x, ay = a.y;
          a.x = b.x; a.y = b.y;
          b.x = ax; b.y = ay;
        }
        // swap DOM
        const fromHtml = fromCell.innerHTML;
        const tgtHtml = targetCell.innerHTML;
        fromCell.innerHTML = tgtHtml;
        targetCell.innerHTML = fromHtml;
        const tmpId = fromCell.dataset.itemId;
        fromCell.dataset.itemId = targetCell.dataset.itemId;
        targetCell.dataset.itemId = tmpId;
      } else {
        // move into empty target
        // update current.items position
        const idx = current.items.findIndex(x=>String(x.x)+','+String(x.y) === fromPos);
        if(idx>-1){ current.items[idx].x = Number(targetCell.dataset.pos.split(',')[0]); current.items[idx].y = Number(targetCell.dataset.pos.split(',')[1]); }
        // move DOM: transfer innerHTML and dataset
        targetCell.innerHTML = fromCell.innerHTML;
        targetCell.dataset.itemId = fromCell.dataset.itemId;
        fromCell.innerHTML = '';
        delete fromCell.dataset.itemId;
      }
      // reattach dragstart handlers on moved items
      attachDragHandlersToCells();
      renderLayoutsList();
      return;
    }
    // otherwise data may contain full item (e.g., from item list). In other flows, we call placeItem() directly.
    // if payload contains an id but no from, treat as new placement from palette
    if(!fromPos && itemId){
      // replace existing item at target or place into empty
      const itemDef = items.find(x=>x.id===Number(itemId));
      if(!itemDef) return;
      const [x,y] = targetCell.dataset.pos.split(',').map(Number);
      // remove existing at pos if present
      if(targetCell.dataset.itemId){
        const posKey = targetCell.dataset.pos;
        const idx = current.items.findIndex(i=>`${i.x},${i.y}`===posKey);
        if(idx>-1) current.items.splice(idx,1);
      }
      current.items = current.items || [];
      current.items.push({ x,y, id: Number(itemId), qty: 1 });
      targetCell.innerHTML = `<div class="thumb"><img src="${itemDef.img||''}" style="width:36px;height:36px" alt="${itemDef.name||''}" draggable="true"></div><div class="qty">1</div>`;
      targetCell.dataset.itemId = Number(itemId);
      attachDragHandlersToCells();
      renderLayoutsList();
      return;
    }
  }

  function attachDragHandlersToCells(){
    // attach dragstart on any placed item images
    // ensure images are draggable (handlers are delegated on the container)
    const placedImgs = layoutGrid.querySelectorAll('.cell img');
    placedImgs.forEach(img => img.setAttribute('draggable','true'));
  }

  // Delegate dragstart and click for placed items so handlers persist after DOM moves
  layoutGrid.addEventListener('dragstart', e => {
    const img = e.target.closest && e.target.closest('img');
    if(!img) return;
    const cell = img.closest && img.closest('.cell');
    if(!cell) return;
    const itemId = cell.dataset.itemId ? Number(cell.dataset.itemId) : null;
    const payload = JSON.stringify({ id: itemId, from: cell.dataset.pos });
    try{ e.dataTransfer.setData('application/json', payload); }catch(_){ e.dataTransfer.setData('text/plain', payload); }
    e.dataTransfer.effectAllowed = 'move';
  });

  layoutGrid.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('img');
    if(!img) return;
    const cell = img.closest && img.closest('.cell');
    if(!cell || !cell.dataset.itemId) return;
    e.stopPropagation();
    clearSelection();
    selected = { type: 'placed', id: Number(cell.dataset.itemId), fromPos: cell.dataset.pos, cellEl: cell };
    cell.classList.add('selected');
  });

  async function load(){
    try{
      const r = await fetch(layoutsUrl, {cache:'no-store'});
      const data = await r.json();
      layouts = Array.isArray(data) ? data : (data.layouts || []);
    }catch(e){ layouts = []; }
    if(layouts.length===0){
      layouts = [ {id:1,title:'New layout',author:'You',width:8,height:7,items:[]} ];
    }
    renderLayoutsList();
    renderItems(items);
    showLayout(layouts[0]);
  }

  // --- Choose item modal for selecting layout thumbnail ---
  let choosingLayoutId = null;
  const chooseModal = () => document.getElementById('chooseItemModal');
  const chooseGridEl = () => document.getElementById('chooseItemsGrid');
  const chooseSearchEl = () => document.getElementById('chooseSearch');

  function renderChooseItems(list){
    const grid = chooseGridEl(); if(!grid) return;
    grid.innerHTML = '';
    list.forEach(it => {
      const tile = document.createElement('div');
      tile.className = 'choose-item-tile';
      tile.innerHTML = `<img src="${it.img}" alt="${it.name}"><div class="name">${it.name}</div>`;
      tile.addEventListener('click', () => {
        const layout = layouts.find(x => Number(x.id) === Number(choosingLayoutId));
        if(!layout) return;
        layout.thumbId = it.id;
        layout.thumbnail = it.img;
        renderLayoutsList();
        // if this layout is currently loaded, update displayed layout header if needed
        if(current && current.id === layout.id) { try{ window.current = current; }catch(e){} }
        closeChooseModal();
      });
      grid.appendChild(tile);
    });
  }

  function openChooseModal(layoutId){
    choosingLayoutId = layoutId;
    const m = chooseModal(); if(!m) return;
    const search = chooseSearchEl(); if(search) search.value = '';
    renderChooseItems(items);
    m.style.display = 'flex'; m.setAttribute('aria-hidden','false');
  }

  function closeChooseModal(){
    const m = chooseModal(); if(!m) return; m.style.display = 'none'; m.setAttribute('aria-hidden','true'); choosingLayoutId = null;
  }

  function placeItem(item){
    if(!current){ alert('No layout loaded'); return; }
    const cells = Array.from(layoutGrid.querySelectorAll('.cell'));
    const empty = cells.find(c => !c.dataset.itemId && c.innerHTML.trim()==='');
    if(!empty){ alert('No available slot'); return; }
    empty.innerHTML = `<div class="thumb"><img src="${item.img}" style="width:36px;height:36px" alt="${item.name}" draggable="true"></div><div class="qty">1</div>`;
    empty.dataset.itemId = item.id;
    // compute x,y from dataset.pos and add to current.items
    const [x,y] = empty.dataset.pos.split(',').map(Number);
    current.items = current.items || [];
    current.items.push({x,y,id:item.id,qty:1});
    // ensure drag and click handlers are attached to newly placed item
    attachDragHandlersToCells();
    renderLayoutsList();
  }

  // Export current layout in the requested banktags format
  const exportBtn = document.getElementById('export-btn');
  const layoutNameInput = document.getElementById('tagName');

  // mapping from our internal item ids -> external codes (example values)
  const externalIdMap = {
    1: 6585, // Apple
    2: 6586, // Banana
    3: 6587, // Orange
    4: 6588, // Watermelon
    5: 6589  // Pineapple
  };

  // expose mapping so importers can map external ids back to internal ids
  try{ window.externalIdMap = externalIdMap; }catch(e){}
  try{
    const reverseExternalIdMap = {};
    Object.keys(externalIdMap).forEach(k => { reverseExternalIdMap[String(externalIdMap[k])] = Number(k); });
    window.reverseExternalIdMap = reverseExternalIdMap;
  }catch(e){}

  function buildExportText(){
    if(!current) return '';
    const cols = current.width || 8;
    const name = (layoutNameInput && layoutNameInput.value) ? layoutNameInput.value : (current.title || 'New layout');
    const lines = [];
    // For each placed item, output a line in the format:
    // banktags,1,LayoutName,952,layout,<cellIndex>,<externalId>
    // cellIndex is linear index: y * cols + x
    (current.items || []).forEach(it => {
      const idx = (it.y * cols) + it.x;
      const ext = externalIdMap[it.id] || it.id;
      const line = ['banktags','1', name.replace(/,/g,' '), '952', 'layout', String(idx), String(ext)].join(',');
      lines.push(line);
    });
    return lines.join('\n');
  }

  if(exportBtn){
    exportBtn.addEventListener('click', () => {
      const text = buildExportText();
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if(!w) { alert('Could not open window — check popup blocker'); return; }
      w.document.title = 'Export - banktags';
      const pre = w.document.createElement('pre');
      pre.textContent = text || '/* no items to export */';
      pre.style.padding = '16px';
      pre.style.background = '#0b0b0b';
      pre.style.color = '#e6f0ef';
      pre.style.whiteSpace = 'pre-wrap';
      w.document.body.style.background = '#0b0b0b';
      w.document.body.appendChild(pre);
    });
  }

  // Clear button: remove all placed items from the current layout and clear the grid
  const clearBtn = document.getElementById('clear-btn');
  if(clearBtn){
    clearBtn.addEventListener('click', () => {
      if(!current) return;
      if(!confirm('Clear all items from the current layout?')) return;
      // clear data
      current.items = [];
      // clear DOM cells
      const cells = layoutGrid.querySelectorAll('.cell');
      cells.forEach(c => { c.innerHTML = ''; delete c.dataset.itemId; });
      renderLayoutsList();
    });
  }

  itemSearch && itemSearch.addEventListener('input', e => {
    const q = (e.target.value||'').trim().toLowerCase();
    const filtered = items.filter(i => i.name.toLowerCase().includes(q));
    renderItems(filtered);
  });

  // wire choose modal controls after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    load();
    const closeChoose = document.getElementById('closeChoose');
    const cancelChoose = document.getElementById('cancelChoose');
    const chooseSearch = document.getElementById('chooseSearch');
    if(closeChoose) closeChoose.addEventListener('click', closeChooseModal);
    if(cancelChoose) cancelChoose.addEventListener('click', closeChooseModal);
    if(chooseSearch) chooseSearch.addEventListener('input', e => {
      const q = (e.target.value||'').trim().toLowerCase();
      const filtered = items.filter(i => i.name.toLowerCase().includes(q));
      renderChooseItems(filtered);
    });
  });
})();
