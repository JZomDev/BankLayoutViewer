// One-time migration of saved layouts from array-position ids to game item ids.
// `data` is items.json in load order; `items` are the built items (id = game id).
(function(){
  function migrateLayoutIds(layouts, data, items){
    (layouts || []).forEach(layout => {
      (layout.items || []).forEach(placed => {
        const entry = data[placed.id];
        if(entry && Number.isInteger(entry.id)) placed.id = entry.id;
      });
      if(layout.thumbnail && layout.thumbId !== undefined){
        const found = items.find(it => it.img === layout.thumbnail);
        if(found) layout.thumbId = found.id;
      }
    });
    return true;
  }

  try{ window.migrateLayoutIds = migrateLayoutIds; }catch(e){}
  try{ module.exports = { migrateLayoutIds }; }catch(e){}
})();
