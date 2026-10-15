// Parses a RuneLite bank tag export: banktags,1,<name>,<icon id>,layout,<cell>,<item id>,<cell>,<item id>,...
// Pure: item ids are resolved through options.resolveId (return a falsy value to fall back to the number).
(function(){
  function parseBanktag(text, options){
    const opts = options || {};
    const cols = Number(opts.cols) || 8;
    const resolveId = opts.resolveId || (() => undefined);
    const t = String(text || '').trim();
    if(!t) throw new Error('Empty input');
    const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if(!lines[0].toLowerCase().startsWith('banktags')){
      throw new Error('Unsupported format, check your copy paste');
    }
    const out = { layoutName: 'Imported Layout', layoutIcon: 1963, items: [] };
    const splits = lines[0].split(',');
    if(splits.length < 7){
      throw new Error('Invalid header format: \n Format: banktags,1,currency,952,layout,8,995');
    }
    let startIndex = 0;
    for(let i = 0; i < splits.length; i++){
      const content = splits[i].trim();
      if(i === 2){ out.layoutName = content; continue; }
      if(i === 3){ out.layoutIcon = content; continue; }
      if(content === 'layout'){ startIndex = i + 1; break; }
    }
    for(let i = startIndex; i < splits.length - 1; i++){
      const cellIndex = Number(splits[i].trim());
      i = i + 1;
      const externalId = splits[i].trim();
      if(isNaN(cellIndex)) continue;
      let id = resolveId(externalId);
      if(!id){
        const n = Number(externalId);
        id = isNaN(n) ? externalId : n;
      }
      out.items.push({ x: cellIndex % cols, y: Math.floor(cellIndex / cols), id });
    }
    return out;
  }

  try{ window.parseBanktag = parseBanktag; }catch(e){}
  try{ module.exports = { parseBanktag }; }catch(e){}
})();
