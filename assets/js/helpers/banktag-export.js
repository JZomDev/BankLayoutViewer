// Builds a RuneLite bank tag export: banktags,1,<name>,<icon id>,<tag item ids>,layout,<cell>,<item id>,...
// Pure: `cells` is [[cellIndex, externalId], ...]; `tagItems` are raw ids, negative ones are variation flags.
(function(){
  function buildBanktag({ name, iconId, tagItems, cells }){
    const parts = ['banktags', '1', String(name).replace(/,/g, ' '), String(iconId)];
    (tagItems || []).forEach(id => parts.push(String(id)));
    parts.push('layout');
    (cells || []).forEach(([idx, id]) => parts.push(String(idx), String(id)));
    return parts.join(',');
  }

  try{ window.buildBanktag = buildBanktag; }catch(e){}
  try{ module.exports = { buildBanktag }; }catch(e){}
})();
