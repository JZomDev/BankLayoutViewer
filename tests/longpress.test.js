const test = require('node:test');
const assert = require('node:assert');
const { attachLongPress } = require('../assets/js/helpers/longpress.js');

// minimal element: records listeners, dispatches plain event objects
function fakeEl(){
  const ls = [];
  return {
    addEventListener(type, fn, capture){ ls.push({ type, fn, capture: !!capture }); },
    fire(type, props){
      const ev = Object.assign({ type, stopped: false, prevented: false,
        stopImmediatePropagation(){ this.stopped = true; }, preventDefault(){ this.prevented = true; } }, props);
      for(const l of ls.filter(l => l.type === type && l.capture)) l.fn(ev);
      if(!ev.stopped) for(const l of ls.filter(l => l.type === type && !l.capture)) l.fn(ev);
      return ev;
    }
  };
}
const touch = (x, y, target = 'cell') => ({ pointerType: 'touch', clientX: x, clientY: y, target });

function setup(t){
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const el = fakeEl();
  const calls = [];
  let clicks = 0;
  attachLongPress(el, ev => calls.push(ev));
  el.addEventListener('click', () => clicks++);
  return { el, calls, clicks: () => clicks };
}

test('holding a touch for 500ms fires with the press position and target', t => {
  const { el, calls } = setup(t);
  el.fire('pointerdown', touch(10, 20));
  t.mock.timers.tick(499);
  assert.strictEqual(calls.length, 0);
  t.mock.timers.tick(1);
  assert.deepStrictEqual(calls, [{ clientX: 10, clientY: 20, target: 'cell' }]);
});
test('a mouse press never fires (right-click already covers it)', t => {
  const { el, calls } = setup(t);
  el.fire('pointerdown', { pointerType: 'mouse', clientX: 0, clientY: 0, target: 'cell' });
  t.mock.timers.tick(1000);
  assert.strictEqual(calls.length, 0);
});
test('lifting, cancelling or moving the finger before 500ms does not fire', t => {
  const { el, calls } = setup(t);
  el.fire('pointerdown', touch(10, 10)); el.fire('pointerup', touch(10, 10));
  el.fire('pointerdown', touch(10, 10)); el.fire('pointercancel', touch(10, 10));
  el.fire('pointerdown', touch(10, 10)); el.fire('pointermove', touch(30, 10));
  t.mock.timers.tick(1000);
  assert.strictEqual(calls.length, 0);
});
test('a small wobble under 10px still fires', t => {
  const { el, calls } = setup(t);
  el.fire('pointerdown', touch(10, 10)); el.fire('pointermove', touch(16, 14));
  t.mock.timers.tick(500);
  assert.strictEqual(calls.length, 1);
});
test('the click after a long press is swallowed, the next tap is not', t => {
  const { el, clicks } = setup(t);
  el.fire('pointerdown', touch(10, 10)); t.mock.timers.tick(500); el.fire('pointerup', touch(10, 10));
  assert.strictEqual(el.fire('click', {}).stopped, true);
  el.fire('pointerdown', touch(10, 10)); el.fire('pointerup', touch(10, 10));
  el.fire('click', {});
  assert.strictEqual(clicks(), 1);
});
test('if the browser shows its own contextmenu (Android), the timer stands down', t => {
  const { el, calls } = setup(t);
  el.fire('pointerdown', touch(10, 10));
  // the cell under the finger stops contextmenu propagation, so only a capture listener on the grid sees it
  el.fire('contextmenu', { stopped: true });
  t.mock.timers.tick(1000);
  assert.strictEqual(calls.length, 0);
});
test('a drag started by a touch press is blocked; a mouse drag is not', t => {
  const { el } = setup(t);
  el.fire('pointerdown', touch(10, 10));
  assert.strictEqual(el.fire('dragstart', {}).prevented, true);
  el.fire('pointerup', touch(10, 10));
  el.fire('pointerdown', { pointerType: 'mouse', clientX: 0, clientY: 0, target: 'cell' });
  assert.strictEqual(el.fire('dragstart', {}).prevented, false);
});
