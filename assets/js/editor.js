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

  function previewJson(obj){
    currentJson = obj;
    try{
      const pretty = JSON.stringify(obj, null, 2);
      preview.innerHTML = `<pre>${escapeHtml(pretty)}</pre>`;
    }catch(e){ showMessage('Could not render JSON: '+e.message, true); }
  }

  function parseText(text){
    // Support two formats: JSON (legacy) or banktags CSV lines
    const t = text.trim();
    if(!t) throw new Error('Empty input');
    const lines = t.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    // If the first non-empty line starts with 'banktags', parse as CSV banktags format
    if(lines[0].toLowerCase().startsWith('banktags')){
      const out = [];
      const cols = (window.current && window.current.width) ? Number(window.current.width) : 8;
      for(const ln of lines){
        const parts = ln.split(',');
        if(parts.length < 7) continue;
        // Format: banktags,1,Name,952,layout,<cellIndex>,<externalId>
        const cellIndex = Number(parts[5]);
        const externalId = parts[6];
        if(isNaN(cellIndex)) continue;
        const x = cellIndex % cols;
        const y = Math.floor(cellIndex / cols);
        // try to map externalId to our internal id via window.reverseExternalIdMap
        let id = null;
        if(window && window.reverseExternalIdMap && window.reverseExternalIdMap[String(externalId)]){
          id = window.reverseExternalIdMap[String(externalId)];
        } else {
          // fallback: try numeric
          const n = Number(externalId);
          id = isNaN(n) ? externalId : n;
        }
        out.push({ x, y, id, qty: 1 });
      }
      return out;
    }

    try{ return JSON.parse(text); }catch(e){ throw new Error('Invalid JSON: '+e.message); }
  }

  // File upload removed — paste JSON directly into the textarea.

  if(loadBtn){
    loadBtn.addEventListener('click', () => {
    const txt = pasteArea.value.trim();
    if(!txt){ showMessage('No JSON provided.', true); return; }
    try{
      const obj = parseText(txt);
      previewJson(obj);
    }catch(err){ showMessage(err.message, true); }
    });
  }

  if(validateBtn){
    validateBtn.addEventListener('click', () => {
      if(!pasteArea.value.trim() && !currentJson){ showMessage('Nothing to validate.', true); return; }
      try{
        const obj = currentJson || parseText(pasteArea.value);
        // Basic validation: accept array or object with `layouts` array
        const ok = Array.isArray(obj) || (obj && Array.isArray(obj.layouts));
        showMessage(ok ? 'Valid layout JSON.' : 'JSON does not look like expected layouts format.', !ok);
      }catch(err){ showMessage(err.message, true); }
    });
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
        importConfirm.addEventListener('click', () => {
          const txt = modalPaste ? modalPaste.value.trim() : (pasteArea ? pasteArea.value.trim() : '');
          if(!txt){ showMessage('No JSON to import.', true); return; }
          let parsed;
          try{ parsed = parseText(txt); }catch(err){ showMessage(err.message, true); return; }
          // If Add to Layout is checked, try to merge item entries into current layout
              let itemsToAdd = [];
              if(Array.isArray(parsed)) itemsToAdd = parsed;
              else if(parsed && Array.isArray(parsed.layouts) && parsed.layouts[0] && Array.isArray(parsed.layouts[0].items)) itemsToAdd = parsed.layouts[0].items;
              else { showMessage('Imported JSON not recognized for merge.', true); return; }
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
