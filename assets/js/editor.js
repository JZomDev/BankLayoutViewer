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
      // fallback when preview area isn't present (import modal on main page)
      if(isError) console.error(msg); else console.log(msg);
      try{ alert(msg); }catch(e){}
    }
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function parseText(text){
    // Support only banktags CSV lines
    const t = text.trim();
    if(!t) throw new Error('Empty input');
    const lines = t.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    // Require the banktags header
    if(!lines[0].toLowerCase().startsWith('banktags')){
      throw new Error('Unsupported format, check your copy paste');
    }
    const out = {
        layoutName: 'Imported Layout',
        layoutIcon: 1963,
        items: []
    };
    const cols = (window.current && window.current.width) ? Number(window.current.width) : 8;
    const splits = lines[0].split(',');
    if(splits.length < 7){
      throw new Error('Invalid header format: \n Format: banktags,1,currency,952,layout,8,995');
    }
    let startIndex = 0;
    for(let i=0;i<splits.length;i++)
    {
        const content = splits[i].trim();
        if (i == 2)
        {
            out.layoutName = splits[i].trim();
            continue;
        }
        if (i == 3)
        {
            out.layoutIcon = splits[i].trim();
            continue;
        }
        if (content === 'layout')
        {
            startIndex = i + 1;
            break;
        }
    }

    for(let i=startIndex;i<splits.length - 1;i++)
    {
        const cellIndex = Number(splits[i].trim());
        i = i + 1;
        const externalId = splits[i].trim();
        if(isNaN(cellIndex)) continue;
        const x = cellIndex % cols;
        const y = Math.floor(cellIndex / cols);
        // try to map externalId to our internal id via window.reverseExternalIdMap
        let id = null;
        if(window && window.reverseExternalIdMap && window.reverseExternalIdMap[String(externalId)]){
            id = window.reverseExternalIdMap[String(externalId)];
        } else if (window && window.externalPlaceHolderMap && window.externalPlaceHolderMap[String(externalId)]){
           id = window.externalPlaceHolderMap[String(externalId)];
        } else {
            // fallback: try numeric
            const n = Number(externalId);
            id = isNaN(n) ? externalId : n;
        }

        out.items.push({ x, y, id});
        
    }
    return out;

  }


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

  // --- Modal behaviors (only if running on index page) ---
  const openBtnImport = document.getElementById('open-import');
  const importModal = document.getElementById('importModal');
  const closeImport = document.getElementById('closeImport');
  const cancelImport = document.getElementById('cancelImport');
  const importConfirm = document.getElementById('importConfirm');

    // --- Modal behaviors (initialize after DOM is ready) ---
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
          let itemsLayout
          let layoutName;
          let layoutIcon
          try{ 
            parsed = parseText(txt);
            itemsLayout = parsed.items;
            layoutName = parsed.layoutName;
            layoutIcon = parsed.layoutIcon;
           }catch(err){ showMessage(err.message, true); return; }
          // Apply imported layout name to the UI input if present
          try{
            const nameInput = document.getElementById('tagName');
            if(nameInput && layoutName) nameInput.value = layoutName;
          }catch(e){}
          // If a layoutIcon was provided, try to resolve it to an item image and set the left/icon
          if(layoutIcon){
            try{
              // attempt to fetch the CDN items JSON to find the matching external id and image
              const r = await fetch('cdn/json/items.json', {cache:'no-store'});
              if(r && r.ok){
                const data = await r.json();
                if(Array.isArray(data)){
                  const foundIdx = data.findIndex(it => String(it.id) === String(layoutIcon));
                  if(foundIdx > -1){
                    const found = data[foundIdx];
                    const imageName = found.imagepath || found.image || '';
                    if(imageName){
                      const imgUrl = 'cdn/items/' + encodeURIComponent(imageName);
                      const iconEl = document.querySelector('.tag-card .icon');
                      if(iconEl){ iconEl.innerHTML = `<img id="layoutimage" src="${imgUrl}" alt="${found.name||''}" itemid="${found.id}" style="width:36px;height:36px;border-radius:6px">`; }
                      // compute internal id (index + 1) and set leftIconId and current thumb
                      try{ window.leftIconId = foundIdx + 1; }catch(e){}
                      if(window.current){ window.current.thumbId = foundIdx + 1; window.current.thumbnail = imgUrl; try{ window.current = window.current; }catch(e){} }
                    }
                  } else {
                    // fallback: try reverseExternalIdMap to compute internal id and leave thumbnail to main script
                    if(window && window.reverseExternalIdMap && window.reverseExternalIdMap[String(layoutIcon)]){
                      try{ window.leftIconId = window.reverseExternalIdMap[String(layoutIcon)]; if(window.current) window.current.thumbId = window.leftIconId; }catch(e){}
                    }
                  }
                }
              }
            }catch(e){ /* ignore errors resolving icon */ }
          }
          // If Add to Layout is checked, try to merge item entries into current layout
              let itemsToAdd = [];
              if(Array.isArray(itemsLayout)) itemsToAdd = itemsLayout;
              else if(itemsLayout && Array.isArray(itemsLayout.layouts) && itemsLayout.layouts[0] && Array.isArray(itemsLayout.layouts[0].items)) itemsToAdd = itemsLayout.layouts[0].items;
              else { showMessage('Invalid Layout.', true); return; }
              // add items to current
              if(window.current && Array.isArray(window.current.items)){
                itemsToAdd.forEach(it => { window.current.items.push(it); });
              } else if(window.current){ window.current.items = itemsToAdd.slice(); }
              // refresh UI by dispatching a custom event the main script can listen for
              window.dispatchEvent(new CustomEvent('bank-layouts:imported', { detail: { layout: window.current } }));
          
          hideModal();
        });
      }
    });

})();
