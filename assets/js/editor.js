// Editor: import/export JSON, validate, preview, download, copy
(function(){
  const fileInput = document.getElementById('fileInput');
  const pasteArea = document.getElementById('pasteArea');
  const loadBtn = document.getElementById('loadBtn');
  const validateBtn = document.getElementById('validateBtn');
  const preview = document.getElementById('preview');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');

  let currentJson = null;

  function showMessage(msg, isError){
    preview.innerHTML = `<div style="color:${isError? 'crimson':'inherit'}">${escapeHtml(msg)}</div>`;
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
    try{ return JSON.parse(text); }catch(e){ throw new Error('Invalid JSON: '+e.message); }
  }

  fileInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => { pasteArea.value = reader.result; showMessage('File loaded into paste area. Click Load.'); };
    reader.readAsText(f);
  });

  loadBtn.addEventListener('click', () => {
    const txt = pasteArea.value.trim();
    if(!txt){ showMessage('No JSON provided.', true); return; }
    try{
      const obj = parseText(txt);
      previewJson(obj);
    }catch(err){ showMessage(err.message, true); }
  });

  validateBtn.addEventListener('click', () => {
    if(!pasteArea.value.trim() && !currentJson){ showMessage('Nothing to validate.', true); return; }
    try{
      const obj = currentJson || parseText(pasteArea.value);
      // Basic validation: accept array or object with `layouts` array
      const ok = Array.isArray(obj) || (obj && Array.isArray(obj.layouts));
      showMessage(ok ? 'Valid layout JSON.' : 'JSON does not look like expected layouts format.', !ok);
    }catch(err){ showMessage(err.message, true); }
  });

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

  copyBtn.addEventListener('click', async () => {
    const text = currentJson ? JSON.stringify(currentJson, null, 2) : pasteArea.value;
    if(!text) { showMessage('Nothing to copy.', true); return; }
    try{
      await navigator.clipboard.writeText(text);
      showMessage('Copied to clipboard.');
    }catch(e){ showMessage('Copy failed: '+e.message, true); }
  });

})();
