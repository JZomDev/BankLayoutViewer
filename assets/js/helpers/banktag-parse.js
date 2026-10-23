// Parses a RuneLite bank tag export: banktags,1,<name>,<icon id>,layout,<cell>,<item id>,<cell>,<item id>,...
// Also accepts an Inventory Setups export ({"setup":...,"layout":[<item id or -1 per bank cell>]}); only layout is read.
// And a Bank Tag Layouts plugin export: banktaglayoutsplugin:<name>,<item id>:<cell>,...,banktag:<name>,<icon id>,<tag items>
// Pure: item ids are resolved through options.resolveId (return a falsy value to fall back to the number).
(function(){
  function parseInventorySetups(t, cols, resolveId){
    const bad = () => new Error('Invalid Inventory Setups export: expected a "layout" array');
    let data;
    try{ data = JSON.parse(t); }catch(e){ throw bad(); }
    if(!data || !Array.isArray(data.layout)) throw bad();
    const name = data.setup && data.setup.name;
    const out = { layoutName: name ? String(name) : 'Imported Layout', layoutIcon: 1963, items: [] };
    let iconSet = false;
    data.layout.forEach((raw, cellIndex) => {
      const n = Number(raw);
      if(raw === null || raw === '' || isNaN(n) || n < 0) return;
      if(!iconSet){ out.layoutIcon = n; iconSet = true; }
      out.items.push({ x: cellIndex % cols, y: Math.floor(cellIndex / cols), id: resolveId(String(n)) || n });
    });
    return out;
  }

  function parseLayoutsPlugin(t, cols, resolveId){
    const bad = () => new Error('Invalid Bank Tag Layouts export: expected banktaglayoutsplugin:name,id:cell,...');
    const parts = t.split(',').map(p => p.trim());
    const out = { layoutName: parts[0].slice(parts[0].indexOf(':') + 1) || 'Imported Layout', layoutIcon: 1963, items: [] };
    const tagAt = parts.findIndex(p => p.startsWith('banktag:'));
    const end = tagAt < 0 ? parts.length : tagAt;
    for(let i = 1; i < end; i++){
      const [rawId, rawCell] = parts[i].split(':');
      const n = Number(rawId);
      const cellIndex = Number(rawCell);
      if(rawCell === undefined || rawCell === '' || rawId === '' || isNaN(n) || isNaN(cellIndex)) continue;
      out.items.push({ x: cellIndex % cols, y: Math.floor(cellIndex / cols), id: resolveId(String(n)) || n });
    }
    if(!out.items.length) throw bad();
    const icon = tagAt >= 0 ? Number(parts[tagAt + 1]) : NaN;
    out.layoutIcon = isNaN(icon) ? Number(out.items[0].id) : icon;
    return out;
  }

  function parseBanktag(text, options){
    const opts = options || {};
    const cols = Number(opts.cols) || 8;
    const resolveId = opts.resolveId || (() => undefined);
    const t = String(text || '').trim();
    if(!t) throw new Error('Empty input');
    if(t.startsWith('{"setup":')) return parseInventorySetups(t, cols, resolveId);
    if(t.startsWith('banktaglayoutsplugin:')) return parseLayoutsPlugin(t, cols, resolveId);
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
