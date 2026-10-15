// Turns data/stored-layouts.json entries into list rows. `parse` turns an export string into
// { layoutName, layoutIcon, items }. Entries that do not parse are skipped and reported to `warn`.
(function(){
  function buildStoredList(entries, parse, warn){
    const out = [];
    (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
      try{
        if(!entry || typeof entry.layout !== 'string') throw new Error('missing layout string');
        const parsed = parse(entry.layout);
        out.push({
          index,
          title: parsed.layoutName,
          author: String(entry.author || ''),
          description: String(entry.description || ''),
          iconId: parsed.layoutIcon,
          layout: entry.layout,
          items: parsed.items
        });
      }catch(e){ if(warn) warn(index, e); }
    });
    return out;
  }

  try{ window.buildStoredList = buildStoredList; }catch(e){}
  try{ module.exports = { buildStoredList }; }catch(e){}
})();
