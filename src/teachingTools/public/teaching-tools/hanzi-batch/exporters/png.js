import {svgFrame} from '../core.js';
export async function raster(svg, size) {
  const url = URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try { const img = new Image(); img.src=url; await img.decode(); const c=document.createElement('canvas'); c.width=c.height=size; c.getContext('2d').drawImage(img,0,0,size,size); return c; }
  finally { URL.revokeObjectURL(url); }
}
export const blob = canvas => new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败')),'image/png'));
export async function png(data,o) { return blob(await raster(svgFrame(data,o),o.size)); }
