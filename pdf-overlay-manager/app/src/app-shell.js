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
import { rectNormalize } from './utils/coords.js';
import { hitOverlay } from './utils/hit-test.js';
import { overlayDefaults } from './overlay/overlay-model.js';
import { renderOverlays } from './overlay/overlay-renderer.js';
import { OverlayController } from './overlay/overlay-controller.js';
import { buildTextIndex, queryText } from './pdf/text-index.js';
import { extractPageText } from './pdf/text-extractor.js';
import { extractPageEntities } from './pdf/entity-extractor.js';
import { createEntityInspector } from './ui/entity-inspector.js';
import { bindShortcuts } from './ui/shortcuts.js';
import { projectToCsv, entitiesToCsv } from './utils/export.js';

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
  let hoveredEntityId = null;

  const entityCache = new Map();
  const entityById = new Map();

  const currentScale = () => viewer.scale || 1;
  const pageToViewport = (pt) => ({ x: pt.x * currentScale(), y: pt.y * currentScale() });
  const pointer=(e)=>{const r=overlayCanvas.getBoundingClientRect(); return { x: (e.clientX-r.left)/currentScale(), y: (e.clientY-r.top)/currentScale() };};

  const download=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  const filePick=(accept)=>new Promise((res)=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>res(i.files[0]);i.click();});

  function getEntityState(){ return store.getState().entityInspector || {}; }
  function setEntityState(patch, historyPush=false){ store.setState(s=>{s.entityInspector={...(s.entityInspector||{}),...patch};return s;},{historyPush}); }
  const hiddenSet = () => new Set(getEntityState().hiddenIds || []);
  const pinnedSet = () => new Set(getEntityState().pinnedIds || []);
  const selectedSet = () => new Set(getEntityState().selectedIds || []);

  function setSelectedEntityIds(ids, persist=true){ if (persist) setEntityState({ selectedIds: [...new Set(ids)] }, false); redraw(); }
  function toggleEntitySet(id, field, force){ const curr = new Set(getEntityState()[field] || []); const willSet = force == null ? !curr.has(id) : !!force; if (willSet) curr.add(id); else curr.delete(id); setEntityState({ [field]: [...curr] }, false); redraw(); }
  function toggleMany(ids, field, force){ const curr = new Set(getEntityState()[field] || []); for(const id of ids){ if(force) curr.add(id); else curr.delete(id); } setEntityState({[field]: [...curr]}, false); redraw(); }

  function zoomToEntity(rec){
    if (!rec || rec.page == null) return;
    if (viewer.pageNo !== rec.page) { viewer.pageNo = rec.page; viewer.render().then(redraw); }
    const cx = rec.centerX ?? rec.x ?? 0;
    const cy = rec.centerY ?? rec.y ?? 0;
    host.scrollLeft = Math.max(0, cx * currentScale() - host.clientWidth / 2);
    host.scrollTop = Math.max(0, cy * currentScale() - host.clientHeight / 2);
  }

  function buildProjectEntities(pageNo){
    const out=[];
    const s = store.getState();
    s.overlays.filter(o=>o.page===pageNo).forEach((o, idx)=>{
      const r = o.geometry?.rect || (o.geometry?.a && o.geometry?.b ? {x:Math.min(o.geometry.a.x,o.geometry.b.x),y:Math.min(o.geometry.a.y,o.geometry.b.y),w:Math.abs(o.geometry.a.x-o.geometry.b.x),h:Math.abs(o.geometry.a.y-o.geometry.b.y)} : null);
      out.push({
        entityId:`ov-${o.id}`,
        page:o.page,
        type:o.type,
        subtype:'overlay',
        label:o.content?.label || o.content?.text || o.meta?.name || null,
        text:o.content?.text || null,
        x:r?.x ?? null, y:r?.y ?? null, width:r?.w ?? null, height:r?.h ?? null,
        centerX:r? r.x+r.w/2 : (o.geometry?.anchor?.x ?? null),
        centerY:r? r.y+r.h/2 : (o.geometry?.anchor?.y ?? null),
        visible:!o.meta?.hidden,
        hidden:!!o.meta?.hidden,
        pinned:false,
        strokeColor:o.style?.stroke?.color ?? null,
        fillColor:o.style?.fill?.color ?? null,
        strokeWidth:o.style?.stroke?.width ?? null,
        strokeStyle:o.style?.stroke?.style ?? null,
        opacity:o.style?.stroke?.opacity ?? o.style?.fill?.opacity ?? null,
        source:'project.overlay',
        extractionLevel:'high',
        confidence:1,
        createdAt:o.createdAt ?? null,
        updatedAt:o.updatedAt ?? null,
        layerId:o.layerId ?? null,
        meta:o.meta ?? null,
        raw:o,
        zIndex:idx
      });
    });

    const textRows = store.getState().textIndex?.[pageNo] || [];
    textRows.forEach((t, idx)=>out.push({
      entityId:`tx-${t.id}`,
      page:t.page,
      type:'text',
      subtype:'textIndex',
      label:t.text,
      text:t.text,
      x:t.bbox?.x ?? null,
      y:t.bbox?.y ?? null,
      width:t.bbox?.w ?? null,
      height:t.bbox?.h ?? null,
      centerX:t.bbox ? t.bbox.x + t.bbox.w/2 : null,
      centerY:t.bbox ? t.bbox.y + t.bbox.h/2 : null,
      visible:true,
      hidden:false,
      pinned:false,
      source:'project.textIndex',
      extractionLevel:'high',
      confidence:1,
      raw:t,
      zIndex:idx
    }));

    return out;
  }

  async function ensureEntities(scope='current', force=false){
    if (!viewer.doc) { toast('PDF non caricato','warn'); return []; }
    pdfjs = pdfjs || await loadPdfJs();
    let pages=[];
    if (scope==='whole') pages = Array.from({length:viewer.doc.numPages},(_,i)=>i+1);
    else if (scope==='visible') pages = [viewer.pageNo];
    else pages = [viewer.pageNo];

    const all=[];
    for (const p of pages){
      if (!force && entityCache.has(p)) { all.push(...entityCache.get(p)); continue; }
      const extracted = await extractPageEntities(viewer.doc, p, pdfjs);
      const merged = [...extracted, ...buildProjectEntities(p)];
      entityCache.set(p, merged);
      all.push(...merged);
    }
    entityById.clear();
    all.forEach(e=>entityById.set(e.entityId,e));
    inspector.setRows(all);
    return all;
  }

  const inspector = createEntityInspector({
    toast,
    onRowHover:(r)=>{ hoveredEntityId = r.entityId; redraw(); },
    onRowLeave:()=>{ hoveredEntityId = null; redraw(); }
  });

  const fitStack=()=>{overlayCanvas.width=pdfCanvas.width;overlayCanvas.height=pdfCanvas.height;stack.style.width=`${pdfCanvas.width}px`;stack.style.height=`${pdfCanvas.height}px`;};
  const redraw=()=>{
    fitStack();
    renderOverlays(overlayCtx,store.getState(),viewer.pageNo,overlayCtrl.selected,{ scale:currentScale(), entityDebug:{ entitiesById:Object.fromEntries(entityById.entries()), selectedIds:getEntityState().selectedIds||[], hiddenIds:getEntityState().hiddenIds||[], pinnedIds:getEntityState().pinnedIds||[], hoveredIds:hoveredEntityId?[hoveredEntityId]:[], showPins:getEntityState().showPins!==false, showHiddenMasks:getEntityState().showHiddenMasks!==false } });

    if(store.getState().ui.showTextBoxes){ for(const t of searchResults){ if(t.page!==viewer.pageNo)continue; const p=pageToViewport({x:t.bbox.x,y:t.bbox.y}); overlayCtx.strokeStyle='#ffbe5c'; overlayCtx.strokeRect(p.x,p.y,t.bbox.w*currentScale(),t.bbox.h*currentScale()); } }
    renderToolbar(toolbar,tool,setTool,openEntityInspector);
    renderPanels(sidebar,panelCtx());
    renderStatusbar(status,{page:viewer.pageNo,zoom:viewer.scale,tool,layer:store.getState().activeLayerId,snap:store.getState().ui.snap});
    renderProps();
  };

  async function openEntityInspector(){ if(!viewer.doc) return toast('Carica prima un PDF','warn'); inspector.open(); await ensureEntities(getEntityState().scope || 'current', false); }

  const panelCtx=()=>({store,viewer,propertiesEl:propsEl,goPage:async(p)=>{viewer.pageNo=p;await viewer.render();redraw();},toggleLayer:(id,k)=>store.setState(s=>{const l=s.layers.find(x=>x.id===id);l[k]=!l[k];return s;}),addLayer:()=>actions.addLayer(store,`Layer ${store.getState().layers.length+1}`),toggleCollapse:(id)=>store.setState(s=>{s.ui.collapsed[id]=!s.ui.collapsed[id];return s;},{historyPush:false}),deleteSelected:()=>deleteSelection(),selectObject:(id)=>{overlayCtrl.select(id);redraw();},searchQ,searchResults,searchText:doSearch,jumpToText:(r)=>{viewer.pageNo=r.page;viewer.render().then(redraw);overlayCtrl.select([]);searchResults=[r];redraw();}});

  const propsEl=document.createElement('div');
  const field=(label,type,value,onchange,extra={})=>{const wrap=document.createElement('label'); wrap.className='small'; wrap.textContent=label; const i=document.createElement('input'); i.type=type; i.className='input'; if(type==='checkbox') i.checked=!!value; else i.value=value; for(const [k,v] of Object.entries(extra)) i[k]=v; i.onchange=(e)=>onchange(type==='checkbox'?e.target.checked:e.target.value); wrap.append(i); return wrap;};
  function renderProps(){ const s=store.getState(); const sel=s.overlays.find(o=>o.id===overlayCtrl.selected[0]); propsEl.replaceChildren(); if(!sel){propsEl.textContent='Nessuna selezione';return;} if(sel.geometry.rect){for(const k of ['x','y','w','h']) propsEl.append(field(k,'number',sel.geometry.rect[k],(v)=>actions.updateOverlay(store,sel.id,{geometry:{...sel.geometry,rect:{...sel.geometry.rect,[k]:Number(v)}}})));} if(sel.type==='box'){propsEl.append(field('Label','text',sel.content?.label||'',(v)=>actions.updateOverlay(store,sel.id,{content:{...(sel.content||{}),label:v}})),field('Bordo colore','color',sel.style.stroke.color,(v)=>actions.updateOverlay(store,sel.id,{style:{...sel.style,stroke:{...sel.style.stroke,color:v}}})),field('Bordo opacità','range',sel.style.stroke.opacity??1,(v)=>actions.updateOverlay(store,sel.id,{style:{...sel.style,stroke:{...sel.style.stroke,opacity:Number(v)}}}),{min:0,max:1,step:0.05}),field('Bordo spessore','number',sel.style.stroke.width??2,(v)=>actions.updateOverlay(store,sel.id,{style:{...sel.style,stroke:{...sel.style.stroke,width:Number(v)}}}),{min:1,max:12}),); const styleSel=document.createElement('select'); styleSel.className='input'; ['solid','dashed','dotted'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;o.selected=(sel.style.stroke.style===v);styleSel.append(o);}); styleSel.onchange=(e)=>actions.updateOverlay(store,sel.id,{style:{...sel.style,stroke:{...sel.style.stroke,style:e.target.value}}}); const lbl=document.createElement('label'); lbl.className='small'; lbl.textContent='Stile bordo'; lbl.append(styleSel); propsEl.append(lbl);} if(sel.type==='note') propsEl.append(field('Text','text',sel.content.text,(v)=>actions.updateOverlay(store,sel.id,{content:{...sel.content,text:v}}))); }

  async function openPdf(){const i=document.createElement('input');i.type='file';i.accept='application/pdf';i.onchange=async()=>{try{pdfjs=pdfjs||await loadPdfJs();await viewer.open(i.files[0],pdfjs);entityCache.clear();entityById.clear();setEntityState({selectedIds:[],hiddenIds:[],pinnedIds:[]},false);redraw();await indexPage(viewer.pageNo);}catch(e){toast(e.message,'error');}};i.click();}
  function setTool(t){tool=t;redraw();}
  function deleteSelection(){if(!overlayCtrl.selected.length)return toast('Nessun oggetto selezionato','info');actions.deleteOverlay(store,overlayCtrl.selected);overlayCtrl.select([]);redraw();}

  overlayCanvas.addEventListener('mousedown',(e)=>{const p=pointer(e);const s=store.getState();if(tool==='select'){const hit=hitOverlay(s.overlays.filter(o=>o.page===viewer.pageNo),p);if(hit){overlayCtrl.select(e.shiftKey?[...overlayCtrl.selected,hit.id]:[hit.id]);drag={type:'move',start:p};}else{overlayCtrl.select([]);drag={type:'boxSelect',start:p};}redraw();return;} if(tool==='box'||tool==='crop'||tool==='exclude'){drag={type:tool,start:p};return;} if(tool==='note'){actions.addOverlay(store,{type:'note',page:viewer.pageNo,layerId:s.activeLayerId,geometry:{anchor:p,rect:{x:p.x-45,y:p.y-16,w:90,h:32}},content:{text:'Note'},style:structuredClone(overlayDefaults.note.style),meta:{name:'Note',tags:[],notes:'',hidden:false,locked:false}});redraw();return;} if(tool==='measure'){drag={type:'measure',start:p};return;}});

  overlayCanvas.addEventListener('mousemove',(e)=>{if(!drag)return;const p=pointer(e);const s=store.getState();if(drag.type==='move'){for(const id of overlayCtrl.selected){const o=s.overlays.find(x=>x.id===id);if(o?.geometry.rect){o.geometry.rect.x+=p.x-drag.start.x;o.geometry.rect.y+=p.y-drag.start.y;}if(o?.geometry.anchor){o.geometry.anchor.x+=p.x-drag.start.x;o.geometry.anchor.y+=p.y-drag.start.y;}if(o?.geometry.a){o.geometry.a.x+=p.x-drag.start.x;o.geometry.a.y+=p.y-drag.start.y;o.geometry.b.x+=p.x-drag.start.x;o.geometry.b.y+=p.y-drag.start.y;}}drag.start=p;redraw();} else {redraw();overlayCtx.strokeStyle='#65b6ff';overlayCtx.setLineDash([6,4]);const r=rectNormalize(drag.start,p);const rp={x:r.x*currentScale(),y:r.y*currentScale(),w:r.w*currentScale(),h:r.h*currentScale()};overlayCtx.strokeRect(rp.x,rp.y,rp.w,rp.h);overlayCtx.setLineDash([]);}});

  overlayCanvas.addEventListener('mouseup',(e)=>{if(!drag)return;const p=pointer(e);const s=store.getState();if(['box','crop','exclude'].includes(drag.type)){const r=rectNormalize(drag.start,p);actions.addOverlay(store,{type:drag.type,page:viewer.pageNo,layerId:s.activeLayerId,geometry:{rect:r},content:drag.type==='box'?{label:''}:undefined,style:structuredClone(overlayDefaults[drag.type].style),meta:{name:drag.type,tags:[],notes:'',hidden:false,locked:false}});} if(drag.type==='measure'){actions.addOverlay(store,{type:'measure',page:viewer.pageNo,layerId:s.activeLayerId,geometry:{a:drag.start,b:p},style:structuredClone(overlayDefaults.measure.style),meta:{name:'measure',tags:[],notes:'',hidden:false,locked:false}});}drag=null;redraw();});

  // click on entity bbox in PDF -> focus row in inspector
  overlayCanvas.addEventListener('click',(e)=>{
    if (!inspector.isOpen()) return;
    const p = pointer(e);
    const rows = [...entityById.values()].filter(r=>r.page===viewer.pageNo && r.x!=null && r.y!=null && r.width!=null && r.height!=null);
    for(let i=rows.length-1;i>=0;i--){
      const r=rows[i];
      if(p.x>=r.x && p.y>=r.y && p.x<=r.x+r.width && p.y<=r.y+r.height){
        inspector.focusEntity(r.entityId);
        setSelectedEntityIds([r.entityId],true);
        break;
      }
    }
  });

  overlayCanvas.addEventListener('dblclick',()=>{const sel=store.getState().overlays.find(o=>o.id===overlayCtrl.selected[0]);if(sel?.type==='note'){const t=prompt('Edit note text',sel.content.text);if(t!=null)actions.updateOverlay(store,sel.id,{content:{...sel.content,text:t}});redraw();}});
  host.addEventListener('wheel',async(e)=>{if(!viewer.doc)return;e.preventDefault();await viewer.zoomAt(e.deltaY<0?1.08:.92);redraw();},{passive:false});

  async function indexPage(p){if(!viewer.doc)return;try{const items=await extractPageText(viewer.doc,p);store.setState(s=>{s.textIndex[p]=buildTextIndex(items);return s;},{historyPush:false});}catch{}}
  function doSearch(q){searchQ=q;const all=Object.values(store.getState().textIndex).flat();searchResults=q?queryText(all,q):[];redraw();}

  renderTopbar(top,{openPdf,prevPage:async()=>{await viewer.prev();await indexPage(viewer.pageNo);redraw();},nextPage:async()=>{await viewer.next();await indexPage(viewer.pageNo);redraw();},fitWidth:async()=>{await viewer.fitWidth(host.clientWidth-40);redraw();},rotate:async()=>{await viewer.rotate();redraw();},saveProject:()=>{const blob=new Blob([JSON.stringify(store.getState(),null,2)],{type:'application/json'});download(blob,'project.overlay.json');},loadProject:()=>filePick('.json').then(async f=>{try{store.setState(JSON.parse(await f.text()),{historyPush:false});entityCache.clear(); entityById.clear(); redraw();}catch{toast('progetto JSON invalido','error')}}),exportCsv:()=>download(new Blob([projectToCsv(store.getState())],{type:'text/csv'}),'overlays.csv'),snapshot:()=>snapshot(pdfCanvas,overlayCanvas),showText:false,toggleText:(v)=>store.setState(s=>{s.ui.showTextBoxes=v;return s;},{historyPush:false})});
  function snapshot(pdf,over){const c=document.createElement('canvas');c.width=pdf.width;c.height=pdf.height;const x=c.getContext('2d');x.drawImage(pdf,0,0);x.drawImage(over,0,0);c.toBlob(b=>download(b,'snapshot.png'));}

  inspector.restoreUi(getEntityState().inspectorUi || {});
  inspector.mount({
    refresh: async (scope)=>{ setEntityState({scope},false); await ensureEntities(scope,true); redraw(); },
    getHiddenSet: hiddenSet,
    getPinnedSet: pinnedSet,
    getSelectedSet: selectedSet,
    toggleHide: (id)=>toggleEntitySet(id,'hiddenIds'),
    togglePin: (id)=>toggleEntitySet(id,'pinnedIds'),
    toggleHideMany: (ids, force)=>toggleMany(ids,'hiddenIds',force),
    togglePinMany: (ids, force)=>toggleMany(ids,'pinnedIds',force),
    isHidden: (id)=>hiddenSet().has(id),
    isPinned: (id)=>pinnedSet().has(id),
    selectAll:(ids)=>setSelectedEntityIds(ids,true),
    zoomTo: zoomToEntity,
    exportFilteredCsv:(rows)=>download(new Blob([entitiesToCsv(rows)],{type:'text/csv'}),'entities.filtered.csv'),
    exportFilteredJson:(rows)=>download(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}),'entities.filtered.json'),
    exportAllJson:(rows)=>download(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}),'entities.full.json'),
    persistUi:(ui)=>setEntityState({ inspectorUi: ui }, false)
  });

  bindShortcuts({store,setTool,viewer,deleteSelection});
  store.subscribe(redraw);
  redraw();
}
