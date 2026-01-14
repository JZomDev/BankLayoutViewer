// Storage helpers for BankTagsHelper
(function(){
  function saveLayoutsToStorage(layouts){
    try{
      if(typeof layouts === 'undefined') layouts = window.layouts || window._bankLayouts || [];
      localStorage.setItem('banktags:layouts', JSON.stringify(layouts || []));
    }catch(e){ console.warn('save layouts failed', e); }
  }

  function loadLayoutsFromStorage(){
    try{
      const raw = localStorage.getItem('banktags:layouts');
      if(raw){
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed) && parsed.length) {
          window._bankLayouts = parsed;
          return parsed;
        }
      }
    }catch(e){ console.warn('load layouts failed', e); }
    window._bankLayouts = window._bankLayouts || [];
    return window._bankLayouts;
  }

  // expose helpers globally (non-module for simplicity)
  try{ window.saveLayoutsToStorage = saveLayoutsToStorage; }catch(e){}
  try{ window.loadLayoutsFromStorage = loadLayoutsFromStorage; }catch(e){}
})();
