// Client that fetches sample layouts and renders a card grid.
(function(){
  const layoutsUrl = 'data/layouts.json';
  const itemsGrid = document.getElementById('itemsGrid');
  const layoutsList = document.getElementById('layoutsList');
  const layoutGrid = document.getElementById('layoutGrid');
  const itemSearch = document.getElementById('itemSearch');

  let layouts = [];
  let current = null;

  function renderItems(items){
    itemsGrid.innerHTML = '';
    items.forEach(it => {
      const tile = document.createElement('div');
      tile.className = 'item-tile';
      tile.innerHTML = `<div class="thumb">${it.icon||'□'}</div><div class="id">${it.id}</div>`;
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
    // attach handlers
    document.querySelectorAll('.use-btn').forEach(b=>b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      const l = layouts.find(x=>String(x.id)===String(id));
      if(l) showLayout(l);
    }));
  }

  function showLayout(l){
    current = l;
    // render grid (width x height) and place items
    const cols = l.width || 8;
    const rows = l.height || 7;
    layoutGrid.innerHTML = '';
    layoutGrid.style.gridTemplateColumns = `repeat(${cols},56px)`;
    // generate empty cells
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const idx = r*cols + c;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.pos = `${c},${r}`;
        layoutGrid.appendChild(cell);
      }
    }
    // place items
    (l.items||[]).forEach(it => {
      const pos = `${it.x},${it.y}`;
      const el = layoutGrid.querySelector(`[data-pos="${pos}"]`);
      if(el){
        el.innerHTML = `<div class="thumb">${it.icon||'◇'}</div><div class="qty">${it.qty||''}</div>`;
      }
    });
  }

  async function load(){
    try{
      const r = await fetch(layoutsUrl, {cache:'no-store'});
      const data = await r.json();
      layouts = Array.isArray(data) ? data : (data.layouts || []);
    }catch(e){
      layouts = [];
    }
    if(layouts.length===0){
      layouts = [
        {id:1,title:'New layout',author:'You',width:8,height:7,items:[{x:2,y:1,id:453,qty:1,icon:'⛏'}]}
      ];
    }
    renderLayoutsList();
    renderItems([ {id:31248,icon:'🍺'}, {id:5751,icon:'☕'}, {id:5819,icon:'🧪'}, {id:5821,icon:'🧪'} ]);
    // show first layout
    showLayout(layouts[0]);
  }

  itemSearch && itemSearch.addEventListener('input', e => {
    const q = (e.target.value||'').trim().toLowerCase();
    const tiles = Array.from(document.querySelectorAll('.item-tile'));
    tiles.forEach(t => {
      const id = t.querySelector('.id').textContent;
      t.style.display = id.includes(q) || q==='' ? '' : 'none';
    });
  });

  document.addEventListener('DOMContentLoaded', load);
})();
