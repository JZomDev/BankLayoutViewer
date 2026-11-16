// Long-press on touch screens. iOS Safari never fires `contextmenu`, so menus bound to
// right-click are unreachable there. attachLongPress(el, onLongPress) calls
// onLongPress({ clientX, clientY, target }) after a touch is held still for `delay` ms.
// It also swallows the click that follows the press, and blocks a drag started by a
// touch press so the browser's own drag does not cancel the hold.
(function(){
  function attachLongPress(el, onLongPress, opts){
    const delay = (opts && opts.delay) || 500;
    const slop = (opts && opts.slop) || 10;
    let timer = null;
    let start = null;
    let touchDown = false;
    let fired = false;

    function cancel(){ if(timer !== null){ clearTimeout(timer); timer = null; } }

    el.addEventListener('pointerdown', e => {
      cancel();
      fired = false;
      touchDown = e.pointerType === 'touch' || e.pointerType === 'pen';
      if(!touchDown) return;
      start = { clientX: e.clientX, clientY: e.clientY, target: e.target };
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        onLongPress(start);
      }, delay);
    });
    el.addEventListener('pointermove', e => {
      if(timer === null) return;
      if(Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > slop) cancel();
    });
    el.addEventListener('pointerup', () => { cancel(); touchDown = false; });
    el.addEventListener('pointercancel', () => { cancel(); touchDown = false; });
    // Android fires a native contextmenu on long-press; let that handler win
    el.addEventListener('contextmenu', () => { if(timer !== null){ cancel(); fired = true; } }, true);
    el.addEventListener('dragstart', e => { if(touchDown) e.preventDefault(); }, true);
    el.addEventListener('click', e => {
      if(!fired) return;
      fired = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }

  try{ window.attachLongPress = attachLongPress; }catch(e){}
  try{ module.exports = { attachLongPress }; }catch(e){}
})();
