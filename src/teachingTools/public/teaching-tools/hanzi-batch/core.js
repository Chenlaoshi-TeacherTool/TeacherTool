export const extract = text => [...new Set([...text].filter(c => /\p{Unified_Ideograph}/u.test(c)))];
const cache = new Map();
export async function loadChar(char) {
  if (!cache.has(char)) cache.set(char, fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`).then(async r => {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('笔顺数据加载失败，请检查网络后重试');
    return r.json();
  }).catch(e => { cache.delete(char); throw e; }));
  return cache.get(char);
}
const palettes = { rainbow: ['#c3362b','#2b805f','#2c70b4','#b76255','#8d59a8','#d38b29','#358c90','#78468d','#b64e82','#4c70a9'], warm: ['#b93931','#da7436','#ab4b69','#c79529'], cool: ['#2e6da4','#318980','#6254a1','#458caf'] };
export function color(i, o) { return o.scheme === 'single' ? o.color : palettes[o.scheme][i % palettes[o.scheme].length]; }
export function grid(o) {
  const lines = o.grid === 'square' ? '' : '<path d="M300 18V582M18 300H582"/>' + (o.grid === 'mi' ? '<path d="M18 18L582 582M582 18L18 582"/>' : '');
  return `<rect width="600" height="600" fill="white"/><g fill="none" stroke="#e8bfc4" stroke-width="3"><rect x="18" y="18" width="564" height="564"/><g stroke-dasharray="18 16">${lines}</g></g>`;
}
export function median(points) {
  const extend=(a,b)=>{const distance=Math.hypot(a[0]-b[0],a[1]-b[1])||1;return [a[0]+100*(a[0]-b[0])/distance,a[1]+100*(a[1]-b[1])/distance];};
  const path=[extend(points[0],points[1]),...points,extend(points.at(-1),points.at(-2))];
  return path.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ');
}
export function length(points) { return points.slice(1).reduce((s,p,i) => s + Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0) + 200; }
export function svgFrame(data, o, count = data.strokes.length, partial = 1, highlight = false) {
  const paths = data.strokes.slice(0,count).map((d,i) => {
    const fill = highlight && i === count-1 ? '#d33232' : color(i,o);
    if (i !== count-1 || partial === 1) return `<path d="${d}" fill="${fill}"/>`;
    const len = length(data.medians[i]);
    return `<defs><clipPath id="current"><path d="${d}"/></clipPath></defs><path d="${median(data.medians[i])}" clip-path="url(#current)" fill="none" stroke="${fill}" stroke-width="200" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len*(1-partial)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" viewBox="0 0 600 600">${grid(o)}<g transform="translate(36 500.0625) scale(.515625 -.515625)">${paths}</g></svg>`;
}
export function check(signal) { if (signal?.aborted) throw new DOMException('已取消','AbortError'); }
export const tick = () => new Promise(r => setTimeout(r,0));
export function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); }
