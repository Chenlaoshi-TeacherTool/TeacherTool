import {svgFrame,check,tick} from '../core.js';
import {raster} from './png.js';
export async function gif(data,o,signal,progress=()=>{}) {
  check(signal);
  const encoder=new GIF({workers:2,quality:10,width:o.size,height:o.size,repeat:0,workerScript:new URL('../vendor/gif.worker.js',import.meta.url).href});
  const abort=()=>encoder.abort(); signal?.addEventListener('abort',abort,{once:true});
  try {
    const frames=Math.max(3,Math.ceil(o.speed/100));
    encoder.addFrame(await raster(svgFrame(data,o,0),o.size),{copy:true,delay:200});
    for(let i=0;i<data.strokes.length;i++) for(let f=1;f<=frames;f++) {
      check(signal);
      const canvas=await raster(svgFrame(data,o,i+1,f/frames),o.size);
      encoder.addFrame(canvas,{copy:true,delay:o.speed/frames+(i===data.strokes.length-1&&f===frames?1500:0)});
      progress(.4*(i+f/frames)/data.strokes.length); await tick();
    }
    check(signal);
    return await new Promise((resolve,reject)=>{
      const cancel=()=>reject(new DOMException('已取消','AbortError'));
      signal?.addEventListener('abort',cancel,{once:true});
      encoder.on('progress',p=>progress(.4+.6*p));
      encoder.on('finished',b=>{signal?.removeEventListener('abort',cancel);resolve(b);});
      encoder.on('abort',cancel);
      encoder.render();
      encoder.activeWorkers.forEach(w=>w.addEventListener('error',()=>{encoder.abort();reject(new Error('GIF Worker 编码失败'));},{once:true}));
    });
  } finally {signal?.removeEventListener('abort',abort); encoder.abort(); encoder.freeWorkers.forEach(w=>w.terminate());}
}
