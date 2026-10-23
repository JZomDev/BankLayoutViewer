// Editor: import/export JSON, validate, preview, download, copy
(function(){
  const pasteArea = document.getElementById('pasteArea');
  const loadBtn = document.getElementById('loadBtn');
  const validateBtn = document.getElementById('validateBtn');
  const preview = document.getElementById('preview');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');

  let currentJson = null;

  function showMessage(msg, isError){
    if(preview){
      preview.innerHTML = `<div style="color:${isError? 'crimson':'inherit'}">${escapeHtml(msg)}</div>`;
    } else {
      if(isError) console.error(msg); else console.log(msg);
      try{ alert(msg); }catch(e){}
    }
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
    window.current.tagItems = Array.isArray(parsed.tagItems) ? parsed.tagItems.slice() : [];
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


  if(downloadBtn){
    downloadBtn.addEventListener('click', () => {
      const obj = currentJson || (pasteArea.value ? parseText(pasteArea.value) : null);
      if(!obj){ showMessage('No JSON to download.', true); return; }
      const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'layouts-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if(copyBtn){
    copyBtn.addEventListener('click', async () => {
      const text = currentJson ? JSON.stringify(currentJson, null, 2) : pasteArea.value;
      if(!text) { showMessage('Nothing to copy.', true); return; }
      try{
        await navigator.clipboard.writeText(text);
        showMessage('Copied to clipboard.');
      }catch(e){ showMessage('Copy failed: '+e.message, true); }
    });
  }

  
  const openBtnImport = document.getElementById('open-import');
  const importModal = document.getElementById('importModal');
  const closeImport = document.getElementById('closeImport');
  const cancelImport = document.getElementById('cancelImport');
  const importConfirm = document.getElementById('importConfirm');

    
    document.addEventListener('DOMContentLoaded', () => {
      const openBtn = document.getElementById('open-import');
      const importModal = document.getElementById('importModal');
      const closeImport = document.getElementById('closeImport');
      const cancelImport = document.getElementById('cancelImport');
      const importConfirm = document.getElementById('importConfirm');
      const modalPaste = document.getElementById('pasteArea');

      function showModal(){ if(!importModal) return; importModal.style.display='flex'; importModal.setAttribute('aria-hidden','false'); }
      function hideModal(){ if(!importModal) return; importModal.style.display='none'; importModal.setAttribute('aria-hidden','true'); }

      if(openBtn){ openBtn.addEventListener('click', () => { showModal(); }); }
      if(closeImport){ closeImport.addEventListener('click', hideModal); }
      if(cancelImport){ cancelImport.addEventListener('click', hideModal); }

      if(importConfirm){
        importConfirm.addEventListener('click', async () => {
          const txt = modalPaste ? modalPaste.value.trim() : (pasteArea ? pasteArea.value.trim() : '');
          if(!txt){ showMessage('No Text to import.', true); return; }
          let parsed;
          try{
            parsed = parseText(txt);
            await applyImportedLayout(parsed);
          }catch(err){ showMessage(err.message, true); return; }
          hideModal();
        });
      }
    });

})();
