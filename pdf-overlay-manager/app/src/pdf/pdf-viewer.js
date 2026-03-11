import { LRUCache } from '../utils/lru-cache.js';

export class PdfViewer{
  constructor({pdfCanvas,host,onError}){this.canvas=pdfCanvas;this.ctx=pdfCanvas.getContext('2d');this.host=host;this.onError=onError;this.doc=null;this.pageNo=1;this.scale=1;this.rotation=0;this.panX=0;this.panY=0;this.cache=new LRUCache(12);}
  async open(file,pdfjs){const buf=await file.arrayBuffer();try{this.doc=await pdfjs.getDocument({data:buf}).promise;this.pageNo=1;await this.render();}catch(e){this.onError(e.message)}}
  async render({quick=false}={}){if(!this.doc)return;const key=`${this.pageNo}_${this.scale}_${this.rotation}_${quick}`;const cached=this.cache.get(key);if(cached){this.canvas.width=cached.width;this.canvas.height=cached.height;this.ctx.putImageData(cached,0,0);return;}
    const page=await this.doc.getPage(this.pageNo);const viewport=page.getViewport({scale:quick?Math.max(.25,this.scale*.6):this.scale,rotation:this.rotation});this.canvas.width=viewport.width;this.canvas.height=viewport.height;
    await page.render({canvasContext:this.ctx,viewport}).promise;
    this.cache.set(key,this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height));
  }
  async next(){if(this.doc&&this.pageNo<this.doc.numPages){this.pageNo++;await this.render();}}
  async prev(){if(this.doc&&this.pageNo>1){this.pageNo--;await this.render();}}
  async zoomAt(f){this.scale=Math.min(6,Math.max(.2,this.scale*f));await this.render({quick:true});clearTimeout(this._idle);this._idle=setTimeout(()=>this.render(),140)}
  async fitWidth(w){if(!this.doc)return;const page=await this.doc.getPage(this.pageNo);const vp=page.getViewport({scale:1,rotation:this.rotation});this.scale=w/vp.width;await this.render();}
  async rotate(){this.rotation=(this.rotation+90)%360;await this.render();}
}
