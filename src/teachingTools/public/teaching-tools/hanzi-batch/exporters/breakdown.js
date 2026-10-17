import {svgFrame,check,tick} from '../core.js';
import {raster,blob} from './png.js';
export async function breakdown(data,o,signal) {
  const cell=Math.round(o.size/3), c=document.createElement('canvas');
  c.width=cell*data.strokes.length;c.height=cell+32;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
  for(let i=0;i<data.strokes.length;i++) {check(signal);ctx.drawImage(await raster(svgFrame(data,o,i+1,1,true),cell),i*cell,0);ctx.fillStyle='#555';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText(`${i+1}`,i*cell+cell/2,cell+22);await tick();}
  return blob(c);
}
export async function pdf(items,o,signal,progress) {
  const doc=new jspdf.jsPDF({unit:'mm',format:'a4'});let y=16;
  for(let n=0;n<items.length;n++) {
    const {data}=items[n];
    // Wrap cumulative steps into six columns so complex characters stay readable on A4.
    for(let start=0;start<data.strokes.length;start+=6) {
      check(signal);if(y+33>281){doc.addPage();y=16;}
      for(let i=start;i<Math.min(start+6,data.strokes.length);i++) {
        const canvas=await raster(svgFrame(data,o,i+1,1,true),300);
        const x=12+(i-start)*31;doc.addImage(canvas.toDataURL('image/png'),'PNG',x,y,29,29);doc.setFontSize(8);doc.text(`${n+1}.${i+1}`,x+14,y+32,{align:'center'});
      }
      y+=36;await tick();
    }
    y+=5;progress((n+1)/items.length);
  }
  return doc.output('blob');
}
