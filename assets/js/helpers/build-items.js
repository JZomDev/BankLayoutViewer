// Builds the item list from items.json (`data`) and itemmeta.json (`meta`).
// meta.names maps game id -> name; meta.placeholders maps an item id -> its placeholder item's id.
(function(){
  function buildItems(data, meta, skipIds){
    const names = (meta && meta.names) || {};
    const placeholders = (meta && meta.placeholders) || {};
    // item ids are the stable game ids; skip entries without one and keep the first of any duplicate
    const seenIds = new Set();
    return data.flatMap((it, idx) => {
      if(!Number.isInteger(it.id) || skipIds.has(it.id) || seenIds.has(it.id)) return [];
      seenIds.add(it.id);
      const metaName = names[it.id];
      return [{
        id: it.id,
        name: metaName !== undefined ? metaName : it.name || String(it.id || ('item-'+(idx+1))),
        img: 'cdn/items/' + encodeURIComponent(it.imagepath || ''),
        externalId: it.id,
        placeholderId: placeholders[it.id]
      }];
    });
  }

  // Items to offer in item searches. An item without a placeholder (itemsmin placeholderId -1) is dropped.
  // Only searches use this; buildItems keeps every id so layouts that already hold one still resolve.
  function searchableItems(items){
    return (items || []).filter(it => it && it.placeholderId !== undefined);
  }

  try{ window.buildItems = buildItems; window.searchableItems = searchableItems; }catch(e){}
  try{ module.exports = { buildItems, searchableItems }; }catch(e){}
})();
