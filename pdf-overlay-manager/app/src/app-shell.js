import { buildLayout } from './ui/layout.js';
import { renderTopbar } from './ui/topbar.js';
import { renderToolbar } from './ui/toolbar.js';
import { renderPanels } from './ui/panels.js';
import { renderStatusbar } from './ui/statusbar.js';
import { createToasts } from './ui/toasts.js';
import { createStore } from './state/store.js';
import { actions } from './state/actions.js';
import { loadPdfJs } from './pdf/pdfjs-loader.js';
import { PdfViewer } from './pdf/pdf-viewer.js';
import { viewportToPage, rectNormalize } from './utils/coords.js';
import { hitOverlay } from './utils/hit-test.js';
import { overlayDefaults } from './overlay/overlay-model.js';
import { renderOverlays } from './overlay/overlay-renderer.js';
import { OverlayController } from './overlay/overlay-controller.js';
import { buildTextIndex, queryText } from './pdf/text-index.js';
import { extractPageText } from './pdf/text-extractor.js';
import { bindShortcuts } from './ui/shortcuts.js';
import { projectToCsv } from './utils/export.js';

export async function bootstrap(root){
  const store=createStore();
  const overlayCtrl=new OverlayController(store);
  const {top,toolbar,workspace,sidebar,status}=buildLayout(root);
  const toast=createToasts(root);
  const pdfCanvas=workspace.querySelector('#pdf-canvas');
  const overlayCanvas=workspace.querySelector('#overlay-canvas');
  const host=workspace.querySelector('#canvas-host');
  const stack=workspace.querySelector('#canvas-stack');
  const overlayCtx=overlayCanvas.getContext('2d');
  const viewer=new PdfViewer({pdfCanvas,host,onError:(m)=>toast(m,'error')});
  let pdfjs=null,tool='select',drag=null,searchQ='',searchResults=[];

  const fitStack=()=>{overlayCanvas.width=pdfCanvas.width;overlayCanvas.height=pdfCanvas.height;stack.style.width=`${pdfCanvas.width}px`;stack.style.height=`${pdfCanvas.height}px`;};
  const redraw=()=>{fitStack();renderOverlays(overlayCtx,store.getState(),viewer.pageNo,overlayCtrl.selected);if(store.getState().ui.showTextBoxes){for(const t of searchResults){if(t.page!==viewer.pageNo)continue;overlayCtx.strokeStyle='#ffbe5c';overlayCtx.strokeRect(t.bbox.x,t.bbox.y,t.bbox.w,t.bbox.h);}}renderToolbar(toolbar,tool,setTool);renderPanels(sidebar,panelCtx());renderStatusbar(status,{page:viewer.pageNo,zoom:viewer.scale,tool,layer:store.getState().activeLayerId,snap:store.getState().ui.snap});renderProps();};

  const panelCtx=()=>({store,viewer,propertiesEl:propsEl,goPage:async(p)=>{viewer.pageNo=p;await viewer.render();redraw();},toggleLayer:(id,k)=>store.setState(s=>{const l=s.layers.find(x=>x.id===id);l[k]=!l[k];return s;}),addLayer:()=>actions.addLayer(store,`Layer ${store.getState().layers.length+1}`),toggleCollapse:(id)=>store.setState(s=>{s.ui.collapsed[id]=!s.ui.collapsed[id];return s;},{historyPush:false}),deleteSelected:()=>deleteSelection(),selectObject:(id)=>{overlayCtrl.select(id);redraw();},searchQ,searchResults,searchText:doSearch,jumpToText:(r)=>{viewer.pageNo=r.page;viewer.render().then(redraw);overlayCtrl.select([]);searchResults=[r];redraw();}});

  const propsEl=document.createElement('div');
  function renderProps(){const s=store.getState();const sel=s.overlays.find(o=>o.id===overlayCtrl.selected[0]);propsEl.replaceChildren();if(!sel){propsEl.textContent='Nessuna selezione';return;} if(sel.geometry.rect){for(const k of ['x','y','w','h']){const inp=document.createElement('input');inp.className='input';inp.value=sel.geometry.rect[k];inp.onchange=()=>actions.updateOverlay(store,sel.id,{geometry:{...sel.geometry,rect:{...sel.geometry.rect,[k]:Number(inp.value)}}});propsEl.append(`${k}: `,inp);} }
    if(sel.type==='note'){const t=document.createElement('input');t.className='input';t.value=sel.content.text;t.onchange=()=>actions.updateOverlay(store,sel.id,{content:{...sel.content,text:t.value}});propsEl.append('text: ',t);} }

  async function openPdf(){const i=document.createElement('input');i.type='file';i.accept='application/pdf';i.onchange=async()=>{try{pdfjs=pdfjs||await loadPdfJs();await viewer.open(i.files[0],pdfjs);redraw();await indexPage(viewer.pageNo);}catch(e){toast(e.message,'error');}};i.click();}
  function setTool(t){tool=t;redraw();}
  function deleteSelection(){if(!overlayCtrl.selected.length)return toast('Nessun oggetto selezionato','info');actions.deleteOverlay(store,overlayCtrl.selected);overlayCtrl.select([]);redraw();}

  const pointer=(e)=>{const r=overlayCanvas.getBoundingClientRect();return viewportToPage({x:e.clientX-r.left,y:e.clientY-r.top},{scale:1,panX:0,panY:0});};
  overlayCanvas.addEventListener('mousedown',(e)=>{const p=pointer(e);const s=store.getState();if(tool==='select'){const hit=hitOverlay(s.overlays.filter(o=>o.page===viewer.pageNo),p);if(hit){overlayCtrl.select(e.shiftKey?[...overlayCtrl.selected,hit.id]:[hit.id]);drag={type:'move',start:p};}else{overlayCtrl.select([]);drag={type:'boxSelect',start:p};}redraw();return;}
    if(tool==='box'||tool==='crop'||tool==='exclude'){drag={type:tool,start:p};return;}
    if(tool==='note'){actions.addOverlay(store,{type:'note',page:viewer.pageNo,layerId:s.activeLayerId,geometry:{anchor:p,rect:{x:p.x-45,y:p.y-16,w:90,h:32}},content:{text:'Note'},style:structuredClone(overlayDefaults.note.style),meta:{name:'Note',tags:[],notes:'',hidden:false,locked:false}});redraw();return;}
    if(tool==='measure'){drag={type:'measure',start:p};return;}
  });
  overlayCanvas.addEventListener('mousemove',(e)=>{if(!drag)return;const p=pointer(e);const s=store.getState();if(drag.type==='move'){for(const id of overlayCtrl.selected){const o=s.overlays.find(x=>x.id===id);if(o?.geometry.rect){o.geometry.rect.x+=p.x-drag.start.x;o.geometry.rect.y+=p.y-drag.start.y;}if(o?.geometry.anchor){o.geometry.anchor.x+=p.x-drag.start.x;o.geometry.anchor.y+=p.y-drag.start.y;}if(o?.geometry.a){o.geometry.a.x+=p.x-drag.start.x;o.geometry.a.y+=p.y-drag.start.y;o.geometry.b.x+=p.x-drag.start.x;o.geometry.b.y+=p.y-drag.start.y;}}drag.start=p;redraw();}
    else {redraw();overlayCtx.strokeStyle='#65b6ff';const r=rectNormalize(drag.start,p);overlayCtx.strokeRect(r.x,r.y,r.w,r.h);} });
  overlayCanvas.addEventListener('mouseup',(e)=>{if(!drag)return;const p=pointer(e);const s=store.getState();if(['box','crop','exclude'].includes(drag.type)){const r=rectNormalize(drag.start,p);actions.addOverlay(store,{type:drag.type,page:viewer.pageNo,layerId:s.activeLayerId,geometry:{rect:r},style:structuredClone(overlayDefaults[drag.type].style),meta:{name:drag.type,tags:[],notes:'',hidden:false,locked:false}});} if(drag.type==='measure'){actions.addOverlay(store,{type:'measure',page:viewer.pageNo,layerId:s.activeLayerId,geometry:{a:drag.start,b:p},style:structuredClone(overlayDefaults.measure.style),meta:{name:'measure',tags:[],notes:'',hidden:false,locked:false}});}drag=null;redraw();});
  overlayCanvas.addEventListener('dblclick',()=>{const sel=store.getState().overlays.find(o=>o.id===overlayCtrl.selected[0]);if(sel?.type==='note'){const t=prompt('Edit note text',sel.content.text);if(t!=null)actions.updateOverlay(store,sel.id,{content:{...sel.content,text:t}});redraw();}})

  host.addEventListener('wheel',async(e)=>{if(!viewer.doc)return;e.preventDefault();await viewer.zoomAt(e.deltaY<0?1.08:.92);redraw();},{passive:false});

  async function indexPage(p){if(!viewer.doc)return;try{const items=await extractPageText(viewer.doc,p);store.setState(s=>{s.textIndex[p]=buildTextIndex(items);return s;},{historyPush:false});}catch{}}
  function doSearch(q){searchQ=q;const all=Object.values(store.getState().textIndex).flat();searchResults=q?queryText(all,q):[];redraw();}

  renderTopbar(top,{openPdf,prevPage:async()=>{await viewer.prev();await indexPage(viewer.pageNo);redraw();},nextPage:async()=>{await viewer.next();await indexPage(viewer.pageNo);redraw();},fitWidth:async()=>{await viewer.fitWidth(host.clientWidth-40);redraw();},rotate:async()=>{await viewer.rotate();redraw();},saveProject:()=>{const blob=new Blob([JSON.stringify(store.getState(),null,2)],{type:'application/json'});download(blob,'project.overlay.json');},loadProject:()=>filePick('.json').then(async f=>{try{store.setState(JSON.parse(await f.text()),{historyPush:false});redraw();}catch{toast('progetto JSON invalido','error')}}),exportCsv:()=>download(new Blob([projectToCsv(store.getState())],{type:'text/csv'}),'overlays.csv'),snapshot:()=>snapshot(pdfCanvas,overlayCanvas),showText:false,toggleText:(v)=>store.setState(s=>{s.ui.showTextBoxes=v;return s;},{historyPush:false})});

  const download=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  const filePick=(accept)=>new Promise((res)=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>res(i.files[0]);i.click();});
  function snapshot(pdf,over){const c=document.createElement('canvas');c.width=pdf.width;c.height=pdf.height;const x=c.getContext('2d');x.drawImage(pdf,0,0);x.drawImage(over,0,0);c.toBlob(b=>download(b,'snapshot.png'));}

  bindShortcuts({store,setTool,viewer,deleteSelection});
  store.subscribe(redraw);
  redraw();
}
