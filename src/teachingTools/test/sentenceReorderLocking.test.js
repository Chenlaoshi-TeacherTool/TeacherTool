'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

for (const file of ['sentence-reorder.js', 'sentence-reorder-player.js']) {
  const source = fs.readFileSync(require.resolve('../public/low-prep/sentence-reorder/' + file), 'utf8');
  function setup(lockedIndices) {
    const chips = Array.from({ length: lockedIndices.length ? Math.max(...lockedIndices) + 2 : 3 }, (_, index) => ({
      id: index, style: {}, classList: { contains: (name) => name === 'is-locked' ? lockedIndices.includes(index) : name === 'word-chip' || name === 'reorder-student-chip', remove() {} },
      focus() {}, removeAttribute() {}, getBoundingClientRect: () => ({ left: index * 100, top: 0, width: 80, height: 40 })
    }));
    const track = {
      children: chips.slice(),
      appendChild(chip) { this.insertBefore(chip, null); },
      insertBefore(chip, before) {
        const old = this.children.indexOf(chip);
        if (old >= 0) this.children.splice(old, 1);
        const next = before ? this.children.indexOf(before) : this.children.length;
        this.children.splice(next, 0, chip);
        chip.parentElement = this;
      }
    };
    chips.forEach(chip => { chip.parentElement = track; });
    const context = { document: { getElementById: () => track, removeEventListener() {} }, assessment: false, syncOrderFromDom() {}, onPointerMove() {}, drag: null };
    for (const name of ['isLockedChip', 'restoreLockedPositions', 'onChipKeyDown', 'findNearestChip', 'onPointerUp']) {
      const start = source.indexOf('  function ' + name + '(');
      let end = source.indexOf('\n  function ', start + 1);
      if (name === 'onPointerUp' && file.includes('player')) end = source.indexOf('\n  elements.check', start);
      vm.runInNewContext(source.slice(start, end), context);
    }
    return { chips, track, context };
  }
  for (const locks of [[1], [1, 2], []]) {
    test(file + ': keyboard crosses locked positions ' + locks, () => {
      const { chips, track, context } = setup(locks);
      const last = chips.length - 1;
      context.onChipKeyDown({ currentTarget: chips[0], key: 'ArrowRight', preventDefault() {} });
      assert.equal(track.children[0], chips[locks.length ? last : 1]);
      locks.forEach(index => assert.equal(track.children[index], chips[index]));
      context.onChipKeyDown({ currentTarget: chips[0], key: 'ArrowLeft', preventDefault() {} });
      assert.deepEqual(track.children, chips);
    });
  }
  test(file + ': drag across locked middle preserves its slot', () => {
    const { chips, track, context } = setup([1]);
    track.children.shift();
    const placeholder = { classList: { contains: () => false }, parentElement: track, remove() { track.children.splice(track.children.indexOf(this), 1); } };
    track.children.push(placeholder);
    context.drag = { chip: chips[0], pointerId: 7, started: true, placeholder, originalChips: chips.slice() };
    assert.equal(context.findNearestChip(track, 240, 20).chip, chips[2]);
    context.onPointerUp({ pointerId: 7 });
    assert.deepEqual(track.children, [chips[2], chips[1], chips[0]]);
    assert.equal(context.drag, null);
  });
}

