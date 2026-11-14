const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../public/teaching-tools/vocabulary-gacha/gacha-core');
test('gacha parses spreadsheet rows and merges duplicate terms', () => {
 assert.deepEqual(core.parse('苹果\tpíng guǒ\tapple\n香蕉 | | banana\n苹果\n'),[{term:'苹果',py:'píng guǒ',en:'apple'},{term:'香蕉',py:'',en:'banana'}]);
});
test('gacha alternates teams, prevents repeat draws and scores, and undoes final round', () => {
 const g=core.create(core.parse('一\n二'),true,10,false,()=>0);
 g.draw();const first=g.current.word.term;assert.equal(g.draw(),false);assert.equal(g.answer(true),false);
 g.open();g.answer(true);assert.deepEqual(g.scores,[10,0]);assert.equal(g.turn,1);assert.equal(g.answer(true),false);
 g.draw();assert.notEqual(g.current.word.term,first);g.open();g.answer(false);assert.equal(g.phase,'done');assert.equal(g.draw(),false);
 g.undo();assert.equal(g.turn,1);assert.equal(g.phase,'answer');g.answer(true);assert.deepEqual(g.scores,[10,10]);g.undo();assert.deepEqual(g.scores,[10,0]);
});
test('gacha random points use all four values and whole class keeps its turn',()=>{
 [0,.25,.5,.999].forEach((r,i)=>{const g=core.create(core.parse('词'),false,10,true,()=>r);g.draw();assert.equal(g.current.points,[5,10,15,20][i]);g.open();g.answer(true);assert.equal(g.turn,0);});
});

test('teacher can award the other team once and undo restores scores and turn', () => {
 const g=core.create(core.parse('one\ntwo'),true,10,false,()=>0);
 g.draw();g.open();assert.equal(g.answer(true,2),false);
 assert.equal(g.answer(true,1),true);assert.deepEqual(g.scores,[0,10]);assert.equal(g.turn,1);
 assert.equal(g.answer(true,1),false);assert.deepEqual(g.scores,[0,10]);
 g.undo();assert.deepEqual(g.scores,[0,0]);assert.equal(g.turn,0);assert.equal(g.phase,'answer');
 g.answer(true,0);assert.deepEqual(g.scores,[10,0]);
 const solo=core.create(core.parse('word'),false,10,false);solo.draw();solo.open();
 assert.equal(solo.answer(true,1),false);assert.equal(solo.answer(true,0),true);
});

test('manual and timer modes refill the pool and undo restores the cycle boundary', () => {
 ['manual','timer'].forEach(ending => {
  const g=core.create(core.parse('one'),true,10,false,()=>0,ending);
  g.draw();g.open();g.answer(true,1);
  assert.equal(g.phase,'ready');assert.equal(g.pool.length,1);
  g.undo();assert.equal(g.pool.length,0);assert.deepEqual(g.scores,[0,0]);
  g.answer(false);assert.equal(g.pool.length,1);g.draw();g.open();
  assert.equal(g.end(),true);assert.equal(g.phase,'done');assert.deepEqual(g.scores,[0,0]);
  assert.equal(g.answer(true),false);assert.equal(g.draw(),false);assert.equal(g.undo(),false);assert.equal(g.end(),false);
 });
});
test('teacher can end during ready, capsule drop, or an unanswered card', () => {
 ['ready','closed','answer'].forEach(phase => {
  const g=core.create(core.parse('one\ntwo'),true,10,false);
  if(phase!=='ready')g.draw();if(phase==='answer')g.open();
  g.end();assert.equal(g.phase,'done');assert.equal(g.current,null);assert.deepEqual(g.scores,[0,0]);
 });
});
