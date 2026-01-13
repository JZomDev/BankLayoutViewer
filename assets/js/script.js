// Client that fetches sample layouts and renders a card grid.
(function(){
  const layoutsUrl = 'data/layouts.json';
  const itemsGrid = document.getElementById('itemsGrid');
  const layoutsList = document.getElementById('layoutsList');
  const layoutGrid = document.getElementById('layoutGrid');
  const itemSearch = document.getElementById('itemSearch');

  // Items will be loaded from cdn/json/items.json and images from cdn/items/
  let items = [];

  let layouts = [];
  let current = null;
  let selected = null; // { type: 'palette'|'placed', id, fromPos, tileEl }

  function renderItems(list){
    itemsGrid.innerHTML = '';
    const limited = Array.isArray(list) ? list.slice(0,20) : [];
    limited.forEach(it => {
      // skip items without a CDN image
      if(!it || !it.img || String(it.img).trim() === '') return;
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
    // enforce a fixed grid size: 8 columns x 100 rows
    const cols = 8;
    const rows = 40;
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
        cell.addEventListener('contextmenu', function(event) {
            event.preventDefault();
            event.stopPropagation();
            // ask user to confirm inserting a row below the clicked cell's row
            const pos = cell.dataset.pos || '0,0';
            const row = Number(pos.split(',')[1]);
            if(!Number.isFinite(row)) return;
            if(!confirm(`Insert a new row below row ${row}? Items on rows ${row+1} and below will shift down.`)) return;
            insertRowBelow(row);
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
        el.innerHTML = `<div class="thumb"><img src="${itemDef.img||''}" style="width:36px;height:36px" alt="${itemDef.name||''}" title="${itemDef.name||''}" draggable="true"></div>`;
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
    targetCell.innerHTML = `<div class="thumb"><img src="${item.img}" style="width:36px;height:36px" alt="${item.name}" title="${item.name}" draggable="true"></div>`;
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

  function insertRowBelow(rowIndex){
    if(!current) return;
    const cols = 8;
    const rows = 40;
    current.items = current.items || [];
    // shift items starting from bottom to avoid overwriting positions
    const sorted = current.items.slice().sort((a,b) => (b.y - a.y) || (b.x - a.x));
    sorted.forEach(it => {
      if(it.y >= rowIndex + 1){
        it.y = it.y + 1;
      }
    });
    // drop any items that moved beyond the grid
    current.items = current.items.filter(it => Number(it.y) < rows);
    // re-render the layout and list
    showLayout(current);
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
      targetCell.innerHTML = `<div class="thumb"><img src="${itemDef.img||''}" style="width:36px;height:36px" alt="${itemDef.name||''}" title="${itemDef.name||''}" draggable="true"></div>`;
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
    // load item definitions from CDN JSON
    await loadItems();
    if(layouts.length===0){
      layouts = [ {id:1,title:'New layout',author:'You',width:8,height:100,items:[]} ];
    }
    renderLayoutsList();
    renderItems(items);
    showLayout(layouts[0]);
  }

  async function loadItems(){
    try{
      const r = await fetch('cdn/json/items.json', {cache:'no-store'});
      const data = await r.json();

      const r2 = await fetch('cdn/js/itemsmin.js', {cache:'no-store'});
      const data2 = await r2.json();

      if(Array.isArray(data) && data.length>0){
        // map to internal items array and build externalIdMap
        // prefer `imagepath` from CDN JSON; fall back to `image` for backward compatibility
        items = data.map((it, idx) => ({ id: idx++, name: it.name || String(it.id || ('item-'+(idx+1))), img: 'cdn/items/'+encodeURIComponent(it.imagepath || ''), externalId: it.id }));
        for (let i=0;i<items.length;i++){
            // for (let j=0+1;j<data2.length;j++){
                const indexData2 = data2.findIndex(x => x.placeholderId === items[i].externalId);
                if (indexData2 > -1)
                {
                    items[i].placeholderId = data2[indexData2].id;
                }
            // }
        }
        externalIdMap = {};
        externalPlaceHolderMap = {};
        items.forEach(it => { if(it.externalId !== undefined)
            { externalIdMap[it.id] = it.externalId; 
            externalPlaceHolderMap[it.id] = it.placeholderId;
            }

        });
        // expose mappings on window
          try{ window.externalIdMap = externalIdMap; }catch(e){}
          try{ window.externalPlaceHolderMap = externalPlaceHolderMap; }catch(e){}
          try{ window.reverseExternalIdMap = {}; Object.keys(externalIdMap).forEach(k => { window.reverseExternalIdMap[String(externalIdMap[k])] = Number(k); }); }catch(e){}
          try{ window.externalPlaceHolderMap = {}; Object.keys(externalPlaceHolderMap).forEach(k => { window.externalPlaceHolderMap[String(externalPlaceHolderMap[k])] = Number(k); }); }catch(e){}
          // if the page has a default icon img, map it to leftIconId
          try{
            const iconImg = document.querySelector('.tag-card .icon img');
            if(iconImg){
              const iconSrcAttr = iconImg.getAttribute('src') || '';
              const resolved = iconImg.src || '';
              const found = items.find(it => it.img === iconSrcAttr || (new URL(it.img, location.href).href === resolved));
              if(found) window.leftIconId = found.id;
            }
          }catch(e){}
      }

    }catch(e){
      console.warn('Could not load cdn items:', e);
      // keep items empty or fallback to existing ones if desired
    }
  }

  // --- Choose item modal for selecting layout thumbnail ---
  let choosingLayoutId = null;
  const chooseModal = () => document.getElementById('chooseItemModal');
  const chooseGridEl = () => document.getElementById('chooseItemsGrid');
  const chooseSearchEl = () => document.getElementById('chooseSearch');

  function renderChooseItems(list){
    const grid = chooseGridEl(); if(!grid) return;
    grid.innerHTML = '';
    const limited = Array.isArray(list) ? list.slice(0,20) : [];
    limited.forEach(it => {
      // skip items without a CDN image
      if(!it || !it.img || String(it.img).trim() === '') return;
      const tile = document.createElement('div');
      tile.className = 'choose-item-tile';
      tile.innerHTML = `<img src="${it.img}" alt="${it.name}"><div class="name">${it.name}</div>`;
      tile.addEventListener('click', () => {
        // if choosing the left icon (no layout id), set the tag-card icon and update current
        if(choosingLayoutId === 'left-icon'){
          const iconEl = document.querySelector('.tag-card .icon');
          if(iconEl){ iconEl.innerHTML = `<img id="layoutimage" src="${it.img}" alt="${it.name}" itemid="${it.externalId}" style="width:36px;height:36px;border-radius:6px">`; }
          // record left icon id globally so exports use it when no layout thumb set
          try{ window.leftIconId = it.id; }catch(e){}
          if(current){ current.thumbId = it.id; current.thumbnail = it.img; try{ window.current = current; }catch(e){} }
          closeChooseModal();
          return;
        }
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
    empty.innerHTML = `<div class="thumb"><img src="${item.img}" style="width:36px;height:36px" alt="${item.name}" title="${item.name}" draggable="true"></div>`;
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

  // mapping from our internal item ids -> external codes (will be populated after loading items)
  let externalIdMap = {};
  let externalPlaceHolderMap = {};
    // expose mapping containers on window; they'll be populated by loadItems()
  try{ window.externalIdMap = externalIdMap; }catch(e){}
  try{ window.externalPlaceHolderMap = externalPlaceHolderMap; }catch(e){}
  try{ window.reverseExternalIdMap = {}; }catch(e){}

  function buildExportText(){
    if(!current) return '';
    const cols = 8;
    const name = (layoutNameInput && layoutNameInput.value) ? layoutNameInput.value : (current.title || 'New layout');
    const lines = [];
    // Determine the item id to place in the header (use current.thumbId, or left icon fallback)
    
    
    // header line: banktags,1,<tagName>,<itemid>,layout
    const header = ['banktags','1', name.replace(/,/g,' '), String(document.getElementById('layoutimage').getAttribute('itemid')), 'layout'].join(',');
    lines.push(header);
    // For each placed item, output a line in the format:
    // banktags,1,LayoutName,952,layout,<cellIndex>,<externalId>
    // cellIndex is linear index: y * cols + x
    (current.items || []).forEach(it => {
      const idx = (it.y * cols) + it.x;
      const ext = externalIdMap[it.id] || it.id;
      const line = [String(idx), String(ext)].join(',');
      lines.push(line);
    });
    return lines.join(',');
  }

  if(exportBtn){
    exportBtn.addEventListener('click', () => {
      const text = buildExportText();
      if(!text){ alert('No items to export.'); return; }
      // Fallback: populate the in-page export modal so user can copy the text
      const exportModal = document.getElementById('exportModal');
      const exportArea = document.getElementById('exportAreaInPage');
      if(exportModal && exportArea){
        exportArea.value = text;
        exportModal.style.display = 'flex'; exportModal.setAttribute('aria-hidden','false');
        const closeExp = document.getElementById('closeExport');
        const cancelExp = document.getElementById('cancelExport');
        const copyBtn = document.getElementById('copyExportBtn');
        if(copyBtn) copyBtn.addEventListener('click', async () => {
          try{ await navigator.clipboard.writeText(exportArea.value); alert('Copied to clipboard'); }
          catch(e){ alert('Copy failed: '+e.message); }
        });
        if(closeExp) closeExp.addEventListener('click', () => { exportModal.style.display='none'; exportModal.setAttribute('aria-hidden','true'); });
        if(cancelExp) cancelExp.addEventListener('click', () => { exportModal.style.display='none'; exportModal.setAttribute('aria-hidden','true'); });
        return;
      }
      alert('Could not open export window — please allow popups.\n\n'+text);
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
    if(q.length < 3){ renderItems([]); return; }
    const filtered = items.filter(i => i && i.name && i.name.toLowerCase().includes(q) && i.img && String(i.img).trim() !== '');
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
    if(chooseSearch) chooseSearch.value = '';
    if(chooseSearch) renderChooseItems([]);
    if(chooseSearch) chooseSearch.addEventListener('input', e => {
      const q = (e.target.value||'').trim().toLowerCase();
      if(q.length < 3){ renderChooseItems([]); return; }
      const filtered = items.filter(i => i && i.name && i.name.toLowerCase().includes(q) && i.img && String(i.img).trim() !== '');
      renderChooseItems(filtered);
    });
    // make left tag icon clickable to choose an item for the thumbnail
    const tagIcon = document.querySelector('.tag-card .icon');
    if(tagIcon){ tagIcon.style.cursor = 'pointer'; tagIcon.addEventListener('click', () => openChooseModal('left-icon')); }
    // set initial leftIconId from the default icon image if present
    try{
      const iconImg = document.querySelector('.tag-card .icon img');
      if(iconImg && iconImg.getAttribute('src')){
        const src = iconImg.getAttribute('src');
        const found = items.find(it => it.img === src);
        if(found) window.leftIconId = found.id;
      }
    }catch(e){}
  });
})();
