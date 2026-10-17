import {grid,color,median,length} from '../core.js';
export function svg(data,o) {
  const total=data.strokes.length*o.speed+1500;
  const paths=data.strokes.map((d,i)=>{
    const len=length(data.medians[i]), start=i*o.speed/total*100, end=(i+1)*o.speed/total*100;
    return `<defs><clipPath id="s${i}"><path d="${d}"/></clipPath></defs><style>@keyframes s${i}{0%,${start}%{stroke-dashoffset:${len}}${end}%,100%{stroke-dashoffset:0}}</style><path d="${median(data.medians[i])}" clip-path="url(#s${i})" fill="none" stroke="${color(i,o)}" stroke-width="200" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}" style="animation:s${i} ${total}ms linear infinite"/>`;
  }).join('');
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" viewBox="0 0 600 600">${grid(o)}<g transform="translate(36 500.0625) scale(.515625 -.515625)">${paths}</g></svg>`],{type:'image/svg+xml'});
}
