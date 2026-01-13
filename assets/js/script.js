// Client that fetches sample layouts and renders a card grid.
(function(){
  const grid = document.getElementById('card-grid');
  const loadingEl = document.getElementById('loading');
  const searchInput = document.getElementById('search');

  function renderGrid(items){
    loadingEl && loadingEl.remove();
    grid.innerHTML = '';
    if(!items || items.length===0){
      grid.innerHTML = '<div class="meta">No layouts found</div>';
      return;
    }
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="thumb">${it.thumbnail || 'Preview'}</div>
        <h3>${it.title}</h3>
        <div class="meta">By ${it.author} • ${it.tags.join(', ')}</div>
      `;
      grid.appendChild(card);
    });
  }

  async function loadData(){
    try{
      const resp = await fetch('data/layouts.json',{cache:'no-store'});
      if(!resp.ok) throw new Error('no data');
      const json = await resp.json();
      const items = Array.isArray(json) ? json : (json.layouts || []);
      renderGrid(items);
    }catch(e){
      // fallback sample
      renderGrid([
        {id:1,title:'Starter Bank',author:'Alice',tags:['starter','compact'],thumbnail:''},
        {id:2,title:'Pro Layout',author:'Bob',tags:['pro','large'],thumbnail:''}
      ]);
    }
  }

  function filterGrid(){
    const q = (searchInput.value||'').toLowerCase().trim();
    if(!q){ loadData(); return; }
    // Simple client-side filter using existing DOM cards
    const cards = Array.from(document.querySelectorAll('.card'));
    cards.forEach(c => {
      const text = c.innerText.toLowerCase();
      c.style.display = text.includes(q) ? '' : 'none';
    });
  }

  window.addEventListener('DOMContentLoaded', loadData);
  searchInput && searchInput.addEventListener('input', filterGrid);
})();
