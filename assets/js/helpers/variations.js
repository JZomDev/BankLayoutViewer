// Bank tag variations, as RuneLite stores them: a variation tag is the negative of the base item id of
// the item's variation group (ItemVariationMapping.map). `map` is cdn/json/itemvariations.json, id -> base id,
// listing only the ids that are not their own base. `tagItems` is the raw tag list from the banktag import.
(function(){
  function baseId(map, id){
    const base = map ? map[id] : undefined;
    return base === undefined ? Number(id) : base;
  }

  function hasVariation(tagItems, id, map){
    return (tagItems || []).includes(-baseId(map, id));
  }

  function setVariation(tagItems, id, map, on){
    const list = (tagItems || []).slice();
    const flag = -baseId(map, id);
    const at = list.indexOf(flag);
    if(on && at < 0) list.push(flag);
    if(!on && at > -1) list.splice(at, 1);
    return list;
  }

  try{ window.variations = { baseId, hasVariation, setVariation }; }catch(e){}
  try{ module.exports = { baseId, hasVariation, setVariation }; }catch(e){}
})();
