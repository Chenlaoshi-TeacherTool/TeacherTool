import {check} from './core.js';
import {gif} from './exporters/gif.js';
import {svg} from './exporters/svg.js';
import {png} from './exporters/png.js';
import {breakdown,pdf} from './exporters/breakdown.js';
export async function batch(items,formats,o,signal,progress) {
  const zip=new JSZip(),tasks=items.length*formats.length+(o.pdf?1:0);let done=0;
  for(const item of items) for(const format of formats) {
    check(signal);const update=p=>progress(.9*(done+p)/tasks,`${item.char} · ${format}`);
    const result=await ({gif,svg,png,breakdown}[format])(item.data,o,signal,update);
    check(signal);zip.file(`${String(item.index+1).padStart(2,'0')}_${item.char}${format==='breakdown'?'_分解图.png':'.'+format}`,result);done++;update(0);
  }
  if(o.pdf){zip.file('笔顺分解_A4.pdf',await pdf(items,o,signal,p=>progress(.9*(done+p)/tasks,'A4 PDF')));done++;}
  check(signal);return zip.generateAsync({type:'blob'},m=>{check(signal);progress(.9+.1*m.percent/100,'正在打包 ZIP');});
}
