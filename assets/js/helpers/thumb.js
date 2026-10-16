// Picks the tag-card icon for a layout. Saved `thumbnail` paths can go stale when
// item images are renamed, so the item id is the source of truth.
(function(){
  const BANANA = { img: 'cdn/items/1963.png', itemId: 1963, name: 'banana' };

  function resolveThumb(layout, items){
    const list = Array.isArray(items) ? items : [];
    const id = layout && layout.thumbId;
    if(id !== undefined && id !== null && id !== ''){
      const found = list.find(it => Number(it.id) === Number(id));
      if(found && found.img) return { img: found.img, itemId: found.externalId || found.id, name: found.name || '' };
    }
    return BANANA;
  }

  try{ window.resolveThumb = resolveThumb; }catch(e){}
  try{ module.exports = { resolveThumb, BANANA }; }catch(e){}
})();
