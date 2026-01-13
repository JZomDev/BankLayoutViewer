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
      li.innerHTML = `<div>
          <strong>${l.title}</strong>
          <div class="meta">${l.author || '—'}</div>
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
  }

  function showLayout(l){
    current = l;
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
        // enable dragging from placed items
        const img = el.querySelector('img[draggable]');
        if(img){
          img.addEventListener('dragstart', e => {
            const payload = JSON.stringify({ id: it.id, from: el.dataset.pos });
            try{ e.dataTransfer.setData('application/json', payload); }catch(_){ e.dataTransfer.setData('text/plain', payload); }
            e.dataTransfer.effectAllowed = 'move';
          });
          // clicking the placed image should select the placed item for moving
          img.addEventListener('click', e => {
            e.stopPropagation();
            clearSelection();
            selected = { type: 'placed', id: it.id, fromPos: el.dataset.pos, cellEl: el };
            el.classList.add('selected');
          });
        }
      }
    });
  }

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
    const placedImgs = layoutGrid.querySelectorAll('.cell img[draggable]');
    placedImgs.forEach(img => {
      const cell = img.closest('.cell');
      const pos = cell && cell.dataset.pos;
      img.addEventListener('dragstart', e => {
        const itemId = cell.dataset.itemId ? Number(cell.dataset.itemId) : null;
        const payload = JSON.stringify({ id: itemId, from: pos });
        try{ e.dataTransfer.setData('application/json', payload); }catch(_){ e.dataTransfer.setData('text/plain', payload); }
        e.dataTransfer.effectAllowed = 'move';
      });
    });
  }

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

  function placeItem(item){
    if(!current){ alert('No layout loaded'); return; }
    const cells = Array.from(layoutGrid.querySelectorAll('.cell'));
    const empty = cells.find(c => !c.dataset.itemId && c.innerHTML.trim()==='');
    if(!empty){ alert('No available slot'); return; }
    empty.innerHTML = `<div class="thumb"><img src="${item.img}" style="width:36px;height:36px" alt="${item.name}"></div><div class="qty">1</div>`;
    empty.dataset.itemId = item.id;
    // compute x,y from dataset.pos and add to current.items
    const [x,y] = empty.dataset.pos.split(',').map(Number);
    current.items = current.items || [];
    current.items.push({x,y,id:item.id,qty:1});
    renderLayoutsList();
  }

  itemSearch && itemSearch.addEventListener('input', e => {
    const q = (e.target.value||'').trim().toLowerCase();
    const filtered = items.filter(i => i.name.toLowerCase().includes(q));
    renderItems(filtered);
  });

  document.addEventListener('DOMContentLoaded', load);
})();
