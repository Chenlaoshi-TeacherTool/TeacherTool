import {extract,loadChar,color,download,check} from './core.js';
import {Player} from './player.js';
import {batch} from './zip.js';
import {gif} from './exporters/gif.js';
import {svg} from './exporters/svg.js';
import {png} from './exporters/png.js';
import {breakdown} from './exporters/breakdown.js';
const $=id=>document.getElementById(id);
let items=[],current=-1,lessons=[],controller=null,viewToken=0;
const options=()=>({grid:$('grid').value,scheme:$('scheme').value,color:$('color').value,speed:Number($('speed').value),size:Number($('size').value),pdf:$('pdf').checked});
const status=text=>$('status').textContent=text;
const player=new Player($('stage'),n=>{const total=items[current]?.data?.strokes.length||0;$('step').textContent=`${n} / ${total} 画`;$('strokeProgress').max=total||1;$('strokeProgress').value=n;});
function render(){
  $('chips').replaceChildren();
  items.forEach((item,i)=>{
    const chip=document.createElement('div');chip.className=`chip ${i===current?'active':''} ${item.data===null?'missing':''}`;
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.selected;checkbox.disabled=!item.data;checkbox.setAttribute('aria-label',`选择${item.char}`);checkbox.onchange=()=>{item.selected=checkbox.checked;selection();};
    const button=document.createElement('button');button.textContent=item.char;button.disabled=!item.data;button.title=item.data===null?'暂无笔顺数据':item.error?'网络加载失败，请重新生成重试':item.data?'预览笔顺':'正在加载';chip.title=button.title;button.onclick=()=>show(i);chip.append(checkbox,button);$('chips').append(chip);
  });
  $('count').textContent=items.length;selection();$('prev').disabled=current<=0;$('next').disabled=current<0||current>=items.length-1;
  document.querySelectorAll('[data-single],#play,#reset').forEach(b=>b.disabled=!items[current]?.data||!!controller);
}
function selection(){const valid=items.filter(x=>x.data);const n=valid.filter(x=>x.selected).length;$('selected').textContent=n;$('all').checked=valid.length>0&&n===valid.length;$('all').indeterminate=n>0&&n<valid.length;}
async function show(i){
  if(!items[i]?.data)return;current=i;const token=++viewToken;render();const item=items[i];
  $('char').textContent=item.char;$('strokes').textContent=`${item.data.strokes.length} 画`;$('position').textContent=`第 ${i+1} / ${items.length} 字`;
  await player.set(item.char,item.data,options());if(token!==viewToken)return;
  $('legend').replaceChildren();item.data.strokes.forEach((_,n)=>{const b=document.createElement('button');b.textContent=`第${n+1}笔`;b.style.background=color(n,options());b.onclick=()=>player.step(n+1);$('legend').append(b);});
}
async function add(text){
  const chars=extract(text);for(const char of chars)if(!items.some(x=>x.char===char))items.push({char,data:undefined,selected:false});render();
  const pending=items.filter(x=>x.data===undefined||x.error);let index=0;
  // Four requests at a time keeps large pasted lists from flooding the CDN.
  await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{while(index<pending.length){const item=pending[index++];try{item.data=await loadChar(item.char);item.error=false;item.selected=!!item.data;}catch(e){item.error=true;status(e.message);}render();}}));
  if(current<0){const first=items.findIndex(x=>x.data);if(first>=0)await show(first);}
  render();if(current>=0)$('position').textContent=`第 ${current+1} / ${items.length} 字`;
}
$('add').onclick=()=>add($('input').value);
$('clear').onclick=()=>{player.stop();viewToken++;items=[];current=-1;$('stage').replaceChildren();$('legend').replaceChildren();$('char').textContent='—';$('strokes').textContent='0 画';$('position').textContent='第 0 / 0 字';$('step').textContent='0 / 0 画';$('strokeProgress').value=0;render();};
$('all').onchange=()=>{items.forEach(x=>x.selected=!!x.data&&$('all').checked);render();};
for(const id of ['grid','scheme','color','speed'])$(id).onchange=()=>{if(current>=0)show(current);};
$('speed').oninput=()=>{$('speedLabel').textContent=`${$('speed').value} ms`;};
$('prev').onclick=()=>{for(let i=current-1;i>=0;i--)if(items[i].data){show(i);break;}};
$('next').onclick=()=>{for(let i=current+1;i<items.length;i++)if(items[i].data){show(i);break;}};
$('play').onclick=()=>player.play(()=>$('loop').checked).catch(e=>status(e.message));$('reset').onclick=()=>player.step(0);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('playerPanel').requestFullscreen();}catch(e){status('此浏览器不支持全屏显示');}};
function busy(value){$('hanziApp').querySelectorAll('button,input,select,textarea').forEach(el=>{if(el.id!=='cancel')el.disabled=value;});if(!value)render();$('cancel').hidden=!value;$('exportProgress').hidden=!value;}
async function run(job){
  if(controller)return;controller=new AbortController();const signal=controller.signal;player.stop();busy(true);$('exportProgress').value=0;
  try{await job(signal,(p,label)=>{$('exportProgress').value=p;status(`${label} · ${Math.round(p*100)}%`);});status('生成完成，文件已下载。');}
  catch(e){status(e.name==='AbortError'?'已取消生成，未下载未完成文件。':`生成失败：${e.message}`);}
  finally{controller=null;busy(false);}
}
$('cancel').onclick=()=>controller?.abort();
$('export').onclick=()=>{
  const selected=items.map((x,index)=>({...x,index})).filter(x=>x.data&&x.selected),formats=[...document.querySelectorAll('[name=format]:checked')].map(x=>x.value),o=options();
  if(!selected.length)return status('请先选择至少一个有笔顺数据的汉字。');if(!formats.length&&!o.pdf)return status('请选择导出格式或 A4 PDF。');
  run(async(signal,progress)=>{const result=await batch(selected,formats,o,signal,progress);check(signal);download(result,'汉字笔顺_批量导出.zip');});
};
document.querySelectorAll('[data-single]').forEach(b=>b.onclick=()=>{const item=items[current],format=b.dataset.single,o=options();if(!item?.data)return;run(async(signal,progress)=>{const result=await ({gif,svg,png,breakdown}[format])(item.data,o,signal,p=>progress(p,item.char));check(signal);download(result,`${item.char}${format==='breakdown'?'_分解图.png':'.'+format}`);});});
function fillLessons(){const book=lessons[Number($('book').value)];$('lesson').replaceChildren(...book.lessons.map((l,i)=>new Option(l.title,i)));}
$('book').onchange=fillLessons;$('lessonAdd').onclick=()=>add(lessons[Number($('book').value)].lessons[Number($('lesson').value)].chars);
async function init(){
  try{const response=await fetch(new URL('./data/lessons.json',import.meta.url));if(!response.ok)throw new Error();lessons=await response.json();$('book').replaceChildren(...lessons.map((b,i)=>new Option(b.book,i)));fillLessons();}catch{status('课程库加载失败，请用 HTTP 静态服务器打开并检查 lessons.json。');$('lessonAdd').disabled=true;}
  await add($('input').value);
}
init();
