import {color,grid,svgFrame} from './core.js';
export class Player {
  constructor(host,update){this.host=host;this.update=update;this.token=0;}
  stop(){this.token++;if(this.writer)this.writer.pauseAnimation();}
  async set(char,data,o){
    this.stop();this.data=data;this.o=o;this.host.innerHTML=`<svg class="grid" viewBox="0 0 600 600" aria-hidden="true">${grid(o)}</svg><div class="writer"></div>`;
    this.writer=HanziWriter.create(this.host.lastElementChild,char,{width:400,height:400,padding:24,showOutline:false,showCharacter:false,strokeFadeDuration:0,charDataLoader:()=>data});
    const writer=this.writer;
    await writer.showCharacter({duration:0});if(writer!==this.writer)return;
    this.host.querySelector('.writer svg').setAttribute('viewBox','0 0 400 400');this.paint();this.update(data.strokes.length);
  }
  paint(){this.host.querySelectorAll('.writer path[clip-path]').forEach((p,i)=>{p.style.stroke=color(i%this.data.strokes.length,this.o);});}
  async step(n){this.stop();this.host.querySelector('.writer').style.visibility='hidden';this.host.querySelector('.grid').outerHTML=svgFrame(this.data,{...this.o,size:400},n).replace('<svg ','<svg class="grid" ');this.update(n);}
  async play(loop){
    this.stop();this.writer.resumeAnimation();const token=this.token;
    this.host.querySelector('.writer').style.visibility='visible';
    this.host.querySelector('.grid').innerHTML=grid(this.o);
    do {
      await this.writer.hideCharacter({duration:0});this.paint();this.update(0);
      for(let i=0;i<this.data.strokes.length;i++) {
        if(token!==this.token)return;
        // Adapter for pinned Hanzi Writer 3.5.0: its duration is (path length + 600) / (3 * speed).
        this.writer._options.strokeAnimationSpeed=(this.writer._character.strokes[i].getLength()+600)/(3*this.o.speed);
        await this.writer.animateStroke(i);if(token!==this.token)return;this.paint();this.update(i+1);
      }
      if(!loop())break;
      await new Promise(r=>setTimeout(r,1500));
    }while(token===this.token);
  }
}
