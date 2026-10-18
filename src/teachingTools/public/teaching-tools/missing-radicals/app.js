/* Browser-only worksheet studio. No teacher input is sent to a server. */
'use strict';
const $ = id => document.getElementById(id);
const SAMPLE = '请问 宿舍 语言 学生 餐厅 美国 汉语 空姐 学院 进来 加拿大 星空 知道 记者 空地 可以 朋友';
const DATA_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
const NS = 'http://www.w3.org/2000/svg';
const cache = new Map();
let components = {}, versions = { A: [], B: [] }, editing, generation = 0;
function rng(seed) { let n = 2166136261; for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled(items, random) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function parse(text) { return text.split(/[\n\r]+/).flatMap(line => { const [words, ...meaning] = line.split('|'); return words.split(/[\s,，、;；]+/).filter(Boolean).map(word => ({ word, meaning: meaning.join('|').trim() })); }); }
function chooseHidden(char, mode, random, avoid = []) {
  const d = cache.get(char), all = d.strokes.map((_, i) => i), rad = d.radStrokes || [];
  if (mode === 'mixed') mode = ['radical', 'component', 'strokes'][Math.floor(random() * 3)];
  if (mode === 'complete') return { hidden: [], mode, note: 'Context 上下文' };
  if (mode === 'strokes') {
    const count = Math.min(+$('count').value, all.length);
    let order = $('selection').value === 'first' ? all : $('selection').value === 'last' ? [...all].reverse() : shuffled(all, random);
    if (avoid.length) order = [...order.filter(i => !avoid.includes(i)), ...order.filter(i => avoid.includes(i))];
    return { hidden: order.slice(0, count).sort((a,b)=>a-b), mode, note: '' };
  }
  const matches = components[char];
  const groups = matches && matches.length === all.length ? [...new Set(matches.filter(i => i >= 0))].map(group => all.filter(i => matches[i] === group)) : [];
  if (all.length <= 3 || groups.length < 2) return { hidden: [], mode, note: 'Simple / unclassified 简单字或无部件数据' };
  let candidates = mode === 'radical' ? [rad].filter(g => g.length && g.length < all.length) : groups.filter(g => !g.some(i => rad.includes(i)) && g.length < all.length);
  if (avoid.length) candidates = candidates.filter(g => g.join() !== avoid.join());
  return candidates.length ? { hidden: candidates[Math.floor(random()*candidates.length)], mode, note: '' } : { hidden: [], mode, note: 'No suitable part 无可用部件' };
}
async function loadChar(char) {
  if (cache.has(char)) return;
  const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(), 15000);
  try { const response = await fetch(DATA_URL + encodeURIComponent(char) + '.json', {signal:controller.signal}); if (!response.ok) throw Error(char); const d = await response.json(); if (!d.strokes?.length || d.medians?.length !== d.strokes.length) throw Error(char); cache.set(char,d); } finally { clearTimeout(timeout); }
}
async function generate() {
  const token = ++generation;
  $('generate').disabled = true; $('status').textContent = 'Loading stroke data… 正在读取笔画…';
  try {
    if (!window.pinyinPro) throw Error('Pinyin library unavailable. Check your connection and reload. 拼音库未加载，请联网重试。');
    try { components = await (await fetch('data/components.json')).json(); } catch { components = {}; }
    const entries = shuffled(parse($('words').value), rng($('seed').value + ':order')), chars = [...new Set(entries.flatMap(e=>[...e.word]))];
    const failures = [];
    // Limit concurrent CDN requests for large classroom lists.
    for (let i=0;i<chars.length;i+=12) await Promise.all(chars.slice(i,i+12).map(c=>loadChar(c).catch(()=>failures.push(c))));
    if (token !== generation) return;
    const random = rng($('seed').value);
    versions = {A:[],B:[]};
    for (const entry of entries) {
      if ([...entry.word].some(c=>!cache.has(c))) continue;
      const readings = pinyinPro.pinyin(entry.word,{type:'array',toneType:'symbol'});
      const eligible = [...entry.word].map((c,i)=>cache.has(c)?i:-1).filter(i=>i>=0);
      const chosen = eligible[Math.floor(random()*eligible.length)];
      const a = {...entry,chars:[]}, b = {...entry,chars:[]};
      [...entry.word].forEach((char,i)=>{
        if (!cache.has(char)) return;
        const mode = $('scope').value === 'one' && i !== chosen ? 'complete' : $('mode').value;
        const first = {char,pinyin:readings[i] || char,...chooseHidden(char,mode,random)};
        let second = {...first,hidden:[...first.hidden]};
        if ($('strategy').value === 'different' && mode !== 'complete') {
          const other = first.mode === 'radical' ? 'component' : first.mode === 'component' ? 'radical' : 'strokes';
          second = {...second,...chooseHidden(char,other,random,first.hidden)};
          if (!second.hidden.length && first.hidden.length) second = {...second,note:'B alternative unavailable; edit manually 乙卷无替代部分'};
        }
        a.chars.push(first); b.chars.push(second);
      });
      if (a.chars.length) { versions.A.push(a); versions.B.push(b); }
    }
    if ($('strategy').value === 'shuffle') versions.B = shuffled(versions.B,random);
    render();
    $('status').textContent = `${versions.A.length} words 词语 · Seed ${$('seed').value}` + (failures.length ? '\nSkipped words containing unsupported characters 跳过含无数据字的词：' + failures.join(' ') : '') + (!Object.keys(components).length ? '\nComponent data unavailable 部件数据未加载' : '');
  } catch(error) { $('status').textContent = error.message; }
  finally { $('generate').disabled = false; }
}
function el(tag, cls, text) { const node=document.createElement(tag); if(cls) node.className=cls; if(text!==undefined) node.textContent=text; return node; }
function svgEl(tag,attrs={}) { const node=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs)) node.setAttribute(k,v); return node; }
function glyph(item,key=false,interactive=false) {
  const svg=svgEl('svg',{viewBox:'0 0 1024 1024',class:'glyph','aria-label':item.char});
  const guides=svgEl('path',{class:'guides',d:'M512 0V1024M0 512H1024'+($('grid').value==='mi'?'M0 0L1024 1024M1024 0L0 1024':'')}); svg.append(guides);
  const g=svgEl('g',{transform:'translate(0 900) scale(1 -1)'});
  cache.get(item.char).strokes.forEach((d,i)=>{ const path=svgEl('path',{d,class:'stroke'+(item.hidden.includes(i)?' missing':''),'data-stroke':i}); if(interactive) path.addEventListener('click',()=>{ item.hidden=item.hidden.includes(i)?item.hidden.filter(s=>s!==i):[...item.hidden,i].sort((a,b)=>a-b); render(); if(editing) renderEditor(); }); g.append(path); });
  svg.append(g); return svg;
}
function wordNode(word,key) {
  const node=el('div','word');
  word.chars.forEach(item=>{
    const cell=el('div','char'), pin=el('button','pinyin',item.pinyin); pin.title='Edit pinyin 编辑拼音';
    pin.addEventListener('click',()=>{ const value=prompt('Pinyin 拼音',item.pinyin); if(value!==null){item.pinyin=value;render();} });
    cell.append(pin,glyph(item,key,!key));
    if(!key){ const warning=item.note || (!item.hidden.length?'Nothing hidden 全显':item.hidden.length===cache.get(item.char).strokes.length?'All hidden 全隐':'');const edit=el('button','badge',warning?'⚠':'✎'); edit.title=warning || 'Edit 编辑';edit.setAttribute('aria-label',item.char+' '+edit.title); edit.addEventListener('click',()=>{editing=item;renderEditor();$('editor').showModal();}); cell.append(edit); }
    node.append(cell);
  }); return node;
}
function pageShell(version,key,index) {
  const page=el('article','sheet'+(key?' key':'')+($('outline').checked?' hint':'')); page.dataset.version=version; page.style.order=String((key?100000:0)+(index-1)*2+(version==='B'?1:0));
  page.append(el('h2','',$('title').value));
  const meta=el('div','meta'); meta.append(el('span','',`Version ${version}${key?' · Answer key 答案':''} · ${index}`),el('span','','Name 姓名: __________   Date 日期: __________')); page.append(meta,el('p','instruction',$('instructions').value));
  if($('bank').checked){const bank=el('div','word-bank'); versions[version].forEach(w=>{const span=el('span','',w.word); if(w.meaning) span.append(el('small','',' · '+w.meaning)); bank.append(span);});page.append(bank);}
  page.append(el('div','word-grid'),el('footer','','CLS Teaching Tools · clsteachingtools.com')); return page;
}
function render() {
  const host=$('pages');host.replaceChildren();
  const height=$('paper').value==='A4'?271:253;
  $('pageStyle').textContent=`@page{size:${$('paper').value} portrait;margin:12mm} :root{--page-height:${height}mm}`;
  for(const key of [false,true]) for(const version of ['A','B']) {
    let page=pageShell(version,key,1), row=0, used=0, number=1;
    // Conservative physical pagination: 3 columns, 14mm cells; long words wrap within a word.
    const bankText=versions[version].map(w=>w.word+' '+w.meaning).join(' ');
    const budget=height-48-($('bank').checked?Math.ceil(bankText.length/60)*7+12:0)-Math.ceil($('instructions').value.length/95)*5-Math.ceil($('title').value.length/35)*8;
    let rowHeight=0;
    versions[version].forEach(word=>{
      const h=Math.ceil(word.chars.length/3)*22+4;
      if(row===3){used+=rowHeight;row=0;rowHeight=0;}
      if((used+Math.max(rowHeight,h)>Math.max(35,budget)) && page.querySelector('.word-grid').children.length){host.append(page);page=pageShell(version,key,++number);used=0;row=0;rowHeight=0;}
      page.querySelector('.word-grid').append(wordNode(word,key));row++;rowHeight=Math.max(rowHeight,h);
    });host.append(page);
  }
  updatePrint();
}
function updatePrint(){ document.querySelectorAll('.sheet').forEach(p=>p.classList.toggle('print-hidden',($('printChoice').value!=='both'&&p.dataset.version!==$('printChoice').value)||(p.classList.contains('key')&&!$('keys').checked))); }
function renderEditor(){ $('editorTitle').textContent=editing.char+' · '+editing.mode; $('editGlyph').replaceChildren(glyph(editing,false,true)); $('override').value=editing.mode==='mixed'?'strokes':editing.mode; }
$('applyOverride').onclick=()=>{Object.assign(editing,chooseHidden(editing.char,$('override').value,rng($('seed').value+editing.char)));render();renderEditor();};
$('closeEditor').onclick=()=>{$('editor').close();editing=null;};
$('sample').onclick=()=>{$('words').value=SAMPLE;}; $('clear').onclick=()=>{$('words').value='';};
$('save').onclick=()=>{try{localStorage.setItem('cls.missingParts.list',$('words').value);$('status').textContent='List saved 已保存';}catch{$('status').textContent='Browser storage unavailable 无法保存';}};
$('load').onclick=()=>{try{const value=localStorage.getItem('cls.missingParts.list');if(value!==null)$('words').value=value;else $('status').textContent='No saved list 暂无保存词表';}catch{$('status').textContent='Browser storage unavailable 无法读取';}};
$('generate').onclick=generate;$('regenerate').onclick=()=>{$('seed').value=String(crypto.getRandomValues(new Uint32Array(1))[0]);generate();};
$('theme').onclick=()=>document.body.classList.toggle('dark');
for(const id of ['title','instructions','paper','grid','bank','outline']) $(id).addEventListener('change',render);
for(const id of ['keys','printChoice']) $(id).addEventListener('change',updatePrint);
$('print').onclick=()=>{updatePrint();window.print();};
document.querySelectorAll('[data-view]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>{$('pages').dataset.view=b.dataset.view;document.querySelectorAll('.tabs button').forEach(tab=>tab.setAttribute('aria-selected',String(tab===b)));};});

// Ordered subset checking: directed, resampled median shape + position + length.
function resample(points,count=32){const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const total=lengths.at(-1);if(!total)return Array.from({length:count},()=>points[0]);let j=1;return Array.from({length:count},(_,i)=>{const target=total*i/(count-1);while(j<lengths.length-1&&lengths[j]<target)j++;const t=(target-lengths[j-1])/(lengths[j]-lengths[j-1]||1);return points[j-1].map((v,k)=>v+(points[j][k]-v)*t);});}
function matchesStroke(points,median){if(points.length<2)return false;const a=resample(points),b=resample(median.map(([x,y])=>[x,900-y]));const distance=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);const length=p=>p.slice(1).reduce((n,v,i)=>n+distance(v,p[i]),0);const ratio=length(a)/(length(b)||1);return distance(a[0],b[0])<150&&distance(a.at(-1),b.at(-1))<170&&a.reduce((sum,p,i)=>sum+distance(p,b[i]),0)/a.length<110&&ratio>.5&&ratio<1.9;}
let teams=[],activeTeam=0,timer,deadline=0,boardPinyin=true,boardHint=false,roundEnded=false;
function teamName(i){return document.querySelectorAll('.team-heading input:not([type=color])')[i].value;}
function startBoard(){if(!versions.A.length){$('status').textContent='Generate a worksheet first 请先生成练习';return;}$('board').hidden=false;resetBoard();$('board').requestFullscreen?.().catch(()=>{});}
function resetBoard(){clearInterval(timer);$('clock').textContent='';$('winner').textContent='';roundEnded=false;teams=['A','B'].map(version=>({items:versions[version].flatMap(w=>w.chars).filter(c=>c.hidden.length).map(c=>({...c,hidden:[...c.hidden],completed:[],mistakes:0,done:false})),score:0,current:null,history:[]}));document.querySelectorAll('.pad-area').forEach(n=>n.replaceChildren());renderTeams();}
function renderTeams(){document.querySelectorAll('.team').forEach((panel,i)=>{const team=teams[i];panel.style.setProperty('--team-color',panel.querySelector('[type=color]').value);panel.classList.toggle('inactive',$('turns').checked&&i!==activeTeam);panel.querySelector('output').textContent=team.score;const roster=panel.querySelector('.roster');roster.replaceChildren();team.items.forEach((item,j)=>{const b=el('button',item.done?'done':'',item.char);b.title=item.pinyin;b.onclick=()=>openPad(i,j);roster.append(b);});});}
function complete(i,item){if(item.done)return;item.done=true;teams[i].score++;renderTeams();if(!roundEnded&&teams[i].items.length&&teams[i].items.every(c=>c.done)){roundEnded=true;$('winner').textContent=teamName(i)+' · First to finish! 率先完成！';clearInterval(timer);}}
function openPad(i,j){const team=teams[i],item=team.items[j];team.current=j;const area=document.querySelectorAll('.pad-area')[i];area.replaceChildren();const pin=el('div','board-pinyin',boardPinyin?item.pinyin:'');area.append(pin);const pad=el('div','pad'+(boardHint?' hint':''));pad.append(glyph(item));const ink=svgEl('svg',{viewBox:'0 0 1024 1024',class:'ink'});pad.append(ink);area.append(pad);
  item.completed.forEach(s=>pad.querySelector(`[data-stroke="${s}"]`).setAttribute('class','stroke completed'));
  const message=el('div','pad-message',item.done?'Completed 完成':'Write the missing strokes in order 按笔顺补写');area.append(message);
  const actions=el('div','pad-actions');for(const [text,fn] of [['Reveal 显示',()=>reveal(i)],['Hint 提示',()=>hint(pad,item)],['Animate 笔顺',()=>animate(pad,item)],['Undo 撤销',()=>undo(i)]]){const b=el('button','',text);b.onclick=fn;actions.append(b);}area.append(actions);
  let pointer=null,points=[],line;
  const point=e=>{const r=ink.getBoundingClientRect();return[(e.clientX-r.left)*1024/r.width,(e.clientY-r.top)*1024/r.height];};
  ink.onpointerdown=e=>{if(pointer!==null||item.done||roundEnded||($('turns').checked&&i!==activeTeam))return;e.preventDefault();pointer=e.pointerId;ink.setPointerCapture(pointer);points=[point(e)];line=svgEl('polyline');ink.append(line);};
  ink.onpointermove=e=>{if(e.pointerId!==pointer)return;e.preventDefault();points.push(point(e));line.setAttribute('points',points.map(p=>p.join(',')).join(' '));};
  ink.onpointerup=e=>{if(e.pointerId!==pointer)return;points.push(point(e));pointer=null;const stroke=item.hidden.find(s=>!item.completed.includes(s));if(stroke===undefined){line.remove();return;}if(matchesStroke(points,cache.get(item.char).medians[stroke])){team.history.push({j,completed:[...item.completed],done:item.done,score:team.score,mistakes:item.mistakes});item.completed.push(stroke);line.remove();pad.querySelector(`[data-stroke="${stroke}"]`).setAttribute('class','stroke completed');item.mistakes=0;message.textContent='Correct! 正确！';if(item.completed.length===item.hidden.length){complete(i,item);message.textContent='Completed 完成！';}}else{team.history.push({j,completed:[...item.completed],done:item.done,score:team.score,mistakes:item.mistakes});team.score-=+$('penalty').value;item.mistakes++;line.classList.add('wrong');const wrongLine=line;setTimeout(()=>wrongLine.remove(),650);renderTeams();message.textContent='Try again 再试一次';if(item.mistakes>=3){hint(pad,item);item.mistakes=0;}}};
  ink.onpointercancel=()=>{pointer=null;line?.remove();};
}
function hint(pad,item){const next=item.hidden.find(s=>!item.completed.includes(s));if(next===undefined)return;const p=pad.querySelector(`[data-stroke="${next}"]`);p.classList.remove('next-hint');void p.getBoundingClientRect();p.classList.add('next-hint');const trace=svgEl('polyline',{points:cache.get(item.char).medians[next].map(([x,y])=>[x,900-y].join(',')).join(' '),class:'hint-trace'});pad.querySelector('.ink').append(trace);setTimeout(()=>trace.remove(),3000);setTimeout(()=>p.classList.remove('next-hint'),3100);}
async function animate(pad,item){if(!window.HanziWriter)return;const layer=el('div','animation');pad.append(layer);try{const size=pad.getBoundingClientRect().width;const writer=HanziWriter.create(layer,item.char,{width:size,height:size,padding:0,showCharacter:false,charDataLoader:()=>cache.get(item.char)});await writer.animateCharacter();}finally{layer.remove();}}
function reveal(i){const team=teams[i],j=team.current;if(j===null)return;const item=team.items[j];team.history.push({j,completed:[...item.completed],done:item.done,score:team.score,mistakes:item.mistakes});item.completed=[...item.hidden];item.done=true;renderTeams();openPad(i,j);}
function undo(i){const team=teams[i],previous=team.history.pop();if(!previous)return;if(previous.type==='score'){team.score=previous.score;renderTeams();return;}const item=team.items[previous.j];Object.assign(item,{completed:previous.completed,done:previous.done,mistakes:previous.mistakes});team.score=previous.score;roundEnded=false;$('winner').textContent='';renderTeams();openPad(i,previous.j);}
document.querySelectorAll('[data-score]').forEach(button=>button.onclick=()=>{const i=Number(button.closest('.team').dataset.team),team=teams[i];team.history.push({type:'score',score:team.score});team.score+=Number(button.dataset.score);renderTeams();});
$('whiteboard').onclick=startBoard;$('reset').onclick=resetBoard;
$('exit').onclick=()=>{$('board').hidden=true;clearInterval(timer);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});};
$('turns').onchange=renderTeams;$('switch').onclick=()=>{activeTeam=1-activeTeam;renderTeams();};
document.querySelectorAll('.team [type=color]').forEach(n=>n.onchange=renderTeams);
$('boardPinyin').onclick=()=>{boardPinyin=!boardPinyin;teams.forEach((t,i)=>{if(t.current!==null)openPad(i,t.current);});};
$('boardHint').onclick=()=>{boardHint=!boardHint;document.querySelectorAll('.pad').forEach(p=>p.classList.toggle('hint',boardHint));};
$('revealAll').onclick=()=>{teams.forEach((t,i)=>{t.items.forEach(item=>{item.completed=[...item.hidden];item.done=true;});if(t.current!==null)openPad(i,t.current);});renderTeams();};
$('startTimer').onclick=()=>{clearInterval(timer);const seconds=Math.max(0,Number($('seconds').value)||0);if(!seconds){$('clock').textContent='Untimed 不计时';return;}roundEnded=false;deadline=Date.now()+seconds*1000;const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('clock').textContent=left+'s';if(!left){clearInterval(timer);roundEnded=true;$('winner').textContent=teams[0].score===teams[1].score?'Time! Tie 平局':teamName(teams[0].score>teams[1].score?0:1)+' wins 获胜';}};tick();timer=setInterval(tick,250);};
document.querySelector('.tabs button').setAttribute('aria-selected','true');
$('words').value=SAMPLE;generate();
