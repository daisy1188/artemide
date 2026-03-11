import { h } from '../utils/dom.js';
import { buildEntityIndex, filterEntities, sortEntities, entityTypes } from '../pdf/entity-index.js';

const COLUMNS = [
  { key:'entityId', label:'entityId', min:190, sticky:true },
  { key:'page', label:'page', min:70, sticky:true },
  { key:'type', label:'type', min:110, sticky:true },
  { key:'subtype', label:'subtype', min:130 },
  { key:'label', label:'label/text', min:220 },
  { key:'x', label:'x', min:90 },
  { key:'y', label:'y', min:90 },
  { key:'width', label:'width', min:100 },
  { key:'height', label:'height', min:100 },
  { key:'centerX', label:'centerX', min:100 },
  { key:'centerY', label:'centerY', min:100 },
  { key:'visible', label:'visible', min:90 },
  { key:'hidden', label:'hidden', min:90 },
  { key:'pinned', label:'pinned', min:90 },
  { key:'rotation', label:'rotation', min:90, advanced:true },
  { key:'strokeColor', label:'strokeColor', min:130, advanced:true },
  { key:'fillColor', label:'fillColor', min:130, advanced:true },
  { key:'strokeWidth', label:'strokeWidth', min:110, advanced:true },
  { key:'strokeStyle', label:'strokeStyle', min:110, advanced:true },
  { key:'opacity', label:'opacity', min:90, advanced:true },
  { key:'fontName', label:'fontName', min:140, advanced:true },
  { key:'fontSize', label:'fontSize', min:100, advanced:true },
  { key:'pointCount', label:'pointCount', min:110, advanced:true },
  { key:'length', label:'length', min:100, advanced:true },
  { key:'area', label:'area', min:100, advanced:true },
  { key:'pathClosed', label:'pathClosed', min:110, advanced:true },
  { key:'rawType', label:'rawType', min:120, advanced:true },
  { key:'groupId', label:'groupId', min:120, advanced:true },
  { key:'symbolHint', label:'symbolHint', min:130, advanced:true },
  { key:'source', label:'source', min:180, advanced:true },
  { key:'extractionLevel', label:'extractionLevel', min:120, advanced:true },
  { key:'confidence', label:'confidence', min:110, advanced:true },
  { key:'layerId', label:'layerId', min:140, advanced:true },
  { key:'createdAt', label:'createdAt', min:180, advanced:true },
  { key:'updatedAt', label:'updatedAt', min:180, advanced:true },
  { key:'metaName', label:'meta.name', min:130, advanced:true },
  { key:'metaTags', label:'meta.tags', min:180, advanced:true },
  { key:'metaNotes', label:'meta.notes', min:200, advanced:true },
];

const colMap = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
const BASE_VISIBLE = COLUMNS.filter(c => !c.advanced).map(c => c.key);
const fmt = (v) => (v == null || v === '' ? '—' : String(v));
const short = (v, n=48) => { const s = fmt(v); return s.length>n?`${s.slice(0,n)}…`:s; };

export function createEntityInspector({ toast, onRowHover, onRowLeave }) {
  let api = null;
  let rows = [];
  let filtered = [];
  let anchorRow = null;
  const state = {
    open:false,
    scope:'current',
    query:'', type:'all', subtype:'', page:'', layerId:'', extractionLevel:'', color:'',
    confidenceMin:'', confidenceMax:'',
    onlyText:false, onlyVector:false, onlyWithLabel:false, onlyWithGeometry:false,
    onlyHidden:false, onlyPinned:false, onlyVisible:false, onlySelected:false,
    sortBy:'entityId', sortDir:'asc',
    pageIndex:0, pageSize:100,
    columns:[...BASE_VISIBLE],
    widths:{},
    density:'compact'
  };

  const root = h('div',{class:'ei-modal-backdrop',style:'display:none'});
  const panel = h('section',{class:'ei-modal panel'});
  const head = h('header',{class:'ei-head'});
  const filters = h('section',{class:'ei-filters'});
  const toolbar = h('section',{class:'ei-table-tools'});
  const body = h('section',{class:'ei-body'});
  const gridWrap = h('div',{class:'ei-grid-wrap'});
  const detail = h('aside',{class:'ei-detail'},'Select entity');
  body.append(gridWrap, detail);
  panel.append(head, filters, toolbar, body);
  root.append(panel);
  document.body.append(root);

  const visibleColumns = () => state.columns.map(k => colMap[k]).filter(Boolean);
  const pagesCount = () => Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const selectedSet = () => api.getSelectedSet();

  const normalize = (r) => ({
    ...r,
    hidden: api.isHidden(r.entityId),
    pinned: api.isPinned(r.entityId),
    visible: !api.isHidden(r.entityId),
    metaName: r.meta?.name ?? r.metaName ?? null,
    metaTags: Array.isArray(r.meta?.tags) ? r.meta.tags.join('|') : (r.metaTags ?? null),
    metaNotes: r.meta?.notes ?? r.metaNotes ?? null,
  });

  function updateFiltered(){
    const hiddenSet = api.getHiddenSet();
    const pinnedSet = api.getPinnedSet();
    const selected = api.getSelectedSet();
    let out = filterEntities(rows.map(normalize), { ...state, hiddenSet, pinnedSet, selectedSet:selected });
    if (state.subtype) out = out.filter(r => (r.subtype || '') === state.subtype);
    if (state.layerId) out = out.filter(r => String(r.layerId || '') === state.layerId);
    if (state.extractionLevel) out = out.filter(r => String(r.extractionLevel || '') === state.extractionLevel);
    if (state.onlyWithLabel) out = out.filter(r => !!(r.label || r.text));
    if (state.onlyWithGeometry) out = out.filter(r => r.x != null && r.y != null && r.width != null && r.height != null);
    if (state.onlyVisible) out = out.filter(r => !hiddenSet.has(r.entityId));
    if (state.confidenceMin !== '') out = out.filter(r => Number(r.confidence ?? -1) >= Number(state.confidenceMin));
    if (state.confidenceMax !== '') out = out.filter(r => Number(r.confidence ?? 2) <= Number(state.confidenceMax));
    filtered = sortEntities(out, state.sortBy, state.sortDir);
    if (state.pageIndex >= pagesCount()) state.pageIndex = pagesCount()-1;
  }

  function colTemplate(){
    const cols = visibleColumns();
    return [`40px`, ...cols.map(c => `${Math.max(c.min, state.widths[c.key] || c.min)}px`), `280px`].join(' ');
  }

  function stickyOffsets(){
    let left = 0;
    const map = { check: left };
    left += 40;
    for (const c of visibleColumns()) {
      if (c.sticky) {
        map[c.key] = left;
      }
      left += Math.max(c.min, state.widths[c.key] || c.min);
    }
    return map;
  }

  function resizeColumn(key, startX){
    const base = Math.max(colMap[key].min, state.widths[key] || colMap[key].min);
    const onMove = (e) => {
      state.widths[key] = Math.max(colMap[key].min, base + (e.clientX - startX));
      renderGrid();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function fitColumnsToContent(){
    const sample = filtered.slice(0, 400);
    for (const c of visibleColumns()) {
      const maxChars = Math.max(c.label.length, ...sample.map(r => fmt(r[c.key]).length));
      state.widths[c.key] = Math.min(420, Math.max(c.min, maxChars * 7 + 26));
    }
    renderGrid();
  }

  function chooseColumns(){
    const popup = h('div',{class:'ei-col-chooser panel'});
    popup.append(
      h('div',{class:'ei-actions'},
        h('button',{class:'btn',onClick:()=>{state.columns=[...BASE_VISIBLE];renderGrid();}},'Base only'),
        h('button',{class:'btn',onClick:()=>{state.columns=COLUMNS.map(c=>c.key);renderGrid();}},'Show all'),
        h('button',{class:'btn',onClick:()=>popup.remove()},'Close')
      ),
      h('div',{class:'ei-col-list'}, ...COLUMNS.map(c=>h('label',{class:'small'},
        h('input',{type:'checkbox',checked:state.columns.includes(c.key),onChange:(e)=>{
          if(e.target.checked && !state.columns.includes(c.key)) state.columns.push(c.key);
          if(!e.target.checked) state.columns = state.columns.filter(k=>k!==c.key);
          renderGrid();
        }}),` ${c.label}`
      )))
    );
    panel.append(popup);
  }

  function selectRow(entityId, event){
    const selected = new Set(api.getSelectedSet());
    const idx = filtered.findIndex(x => x.entityId === entityId);
    if (event.shiftKey && anchorRow != null) {
      const [a,b] = [Math.min(anchorRow, idx), Math.max(anchorRow, idx)];
      for (let i=a;i<=b;i++) selected.add(filtered[i].entityId);
    } else if (event.ctrlKey || event.metaKey) {
      if (selected.has(entityId)) selected.delete(entityId); else selected.add(entityId);
      anchorRow = idx;
    } else {
      selected.clear(); selected.add(entityId); anchorRow = idx;
    }
    api.selectAll([...selected]);
    const rec = filtered.find(x=>x.entityId===entityId); if (rec) api.zoomTo(rec);
    renderGrid();
  }

  function renderDetail(){
    const selected = [...selectedSet()];
    const one = selected.length ? rows.find(r => r.entityId === selected[0]) : null;
    if (!one) { detail.replaceChildren('Select entity'); return; }
    const r = normalize(one);
    detail.replaceChildren(
      h('h3',{},'Entity Detail'),
      h('div',{class:'ei-section'}, h('h4',{},'Identity'), h('div',{},`ID: ${fmt(r.entityId)}`), h('div',{},`Type: ${fmt(r.type)} / ${fmt(r.subtype)}`), h('div',{},`Page: ${fmt(r.page)} Layer: ${fmt(r.layerId)}`)),
      h('div',{class:'ei-section'}, h('h4',{},'Geometry'), h('div',{},`x:${fmt(r.x)} y:${fmt(r.y)} w:${fmt(r.width)} h:${fmt(r.height)}`), h('div',{},`center: ${fmt(r.centerX)}, ${fmt(r.centerY)}`), h('div',{},`length:${fmt(r.length)} area:${fmt(r.area)}`)),
      h('div',{class:'ei-section'}, h('h4',{},'Style / Text'), h('div',{},`stroke ${fmt(r.strokeColor)} ${fmt(r.strokeWidth)} ${fmt(r.strokeStyle)}`), h('div',{},`fill ${fmt(r.fillColor)} opacity ${fmt(r.opacity)}`), h('div',{},`text: ${fmt(r.text || r.label)}`)),
      h('div',{class:'ei-section'}, h('h4',{},'State / Extraction'), h('div',{},`visible:${r.visible} hidden:${r.hidden} pinned:${r.pinned}`), h('div',{},`level:${fmt(r.extractionLevel)} confidence:${fmt(r.confidence)}`), h('div',{},`source:${fmt(r.source)}`)),
      h('details',{}, h('summary',{},'Raw data'), h('pre',{class:'ei-json'},JSON.stringify(r.raw ?? r,null,2))),
      h('div',{class:'ei-actions'},
        h('button',{class:'btn',onClick:()=>api.zoomTo(r)},'Zoom to'),
        h('button',{class:'btn',onClick:()=>{api.togglePin(r.entityId);renderGrid();}}, api.isPinned(r.entityId)?'Unpin':'Pin'),
        h('button',{class:'btn',onClick:()=>{api.toggleHide(r.entityId);renderGrid();}}, api.isHidden(r.entityId)?'Show':'Hide'),
        h('button',{class:'btn',onClick:()=>navigator.clipboard?.writeText(JSON.stringify(r,null,2)).then(()=>toast('Copied JSON'))},'Copy JSON'),
        h('button',{class:'btn',onClick:()=>navigator.clipboard?.writeText(`${r.entityId} | p${r.page} | ${r.type}/${r.subtype} | ${r.label||r.text||'—'}`).then(()=>toast('Copied summary'))},'Copy summary')
      )
    );
  }

  function renderGrid(){
    updateFiltered();
    const start = state.pageIndex * state.pageSize;
    const end = Math.min(filtered.length, start + state.pageSize);
    const pageRows = filtered.slice(start, end);
    const selected = selectedSet();
    const offsets = stickyOffsets();
    const tpl = colTemplate();

    const header = h('div',{class:'ei-grid-head',style:`grid-template-columns:${tpl}`},
      h('div',{class:'ei-cell ei-head-cell ei-sticky',style:`left:${offsets.check}px`},'✓'),
      ...visibleColumns().map(c=>h('div',{class:`ei-cell ei-head-cell ${c.sticky?'ei-sticky':''}`,style:c.sticky?`left:${offsets[c.key]}px`:''},
        h('button',{class:'ei-sort-btn',title:c.key,onClick:()=>{ if(state.sortBy===c.key) state.sortDir = state.sortDir==='asc'?'desc':'asc'; else { state.sortBy = c.key; state.sortDir='asc'; } renderGrid(); }},`${c.label} ${state.sortBy===c.key?(state.sortDir==='asc'?'▲':'▼'):''}`),
        h('span',{class:'ei-resizer',onMousedown:(e)=>{e.preventDefault();resizeColumn(c.key,e.clientX);}})
      )),
      h('div',{class:'ei-cell ei-head-cell'},'Actions')
    );

    const rowsDom = pageRows.map(r=>h('div',{class:`ei-grid-row ${selected.has(r.entityId)?'active':''}`,style:`grid-template-columns:${tpl}`,onMouseenter:()=>onRowHover?.(r),onMouseleave:()=>onRowLeave?.(),onClick:(e)=>selectRow(r.entityId,e)},
      h('div',{class:'ei-cell ei-sticky',style:`left:${offsets.check}px`},h('input',{type:'checkbox',checked:selected.has(r.entityId),onClick:(e)=>{e.stopPropagation();selectRow(r.entityId,e);}})),
      ...visibleColumns().map(c=>h('div',{class:`ei-cell ${c.sticky?'ei-sticky':''}`,title:fmt(r[c.key]),style:c.sticky?`left:${offsets[c.key]}px`:''},short(r[c.key]))),
      h('div',{class:'ei-cell'}, h('div',{class:'ei-actions ei-actions-row'},
        h('button',{class:'btn',title:'Zoom',onClick:(e)=>{e.stopPropagation();api.zoomTo(r);}},'Zoom'),
        h('button',{class:'btn',title:'Select',onClick:(e)=>{e.stopPropagation();api.selectAll([r.entityId]);renderGrid();}},'Select'),
        h('button',{class:'btn',title:'Pin/Unpin',onClick:(e)=>{e.stopPropagation();api.togglePin(r.entityId);renderGrid();}},api.isPinned(r.entityId)?'Unpin':'Pin'),
        h('button',{class:'btn',title:'Hide/Show',onClick:(e)=>{e.stopPropagation();api.toggleHide(r.entityId);renderGrid();}},api.isHidden(r.entityId)?'Show':'Hide'),
        h('button',{class:'btn',title:'Copy',onClick:(e)=>{e.stopPropagation();navigator.clipboard?.writeText(JSON.stringify(r,null,2)).then(()=>toast('Copied'));}},'Copy'),
        h('button',{class:'btn',title:'Inspect',onClick:(e)=>{e.stopPropagation();api.selectAll([r.entityId]);renderDetail();}},'Inspect')
      ))
    ));

    const empty = !pageRows.length ? h('div',{class:'ei-empty'},'No entities for current filters.') : null;

    gridWrap.replaceChildren(
      header,
      h('div',{class:'ei-grid-body'}, ...(empty?[empty]:rowsDom))
    );

    toolbar.replaceChildren(
      h('span',{class:'small'},`Rows: ${filtered.length}`),
      h('span',{class:'small'},`Pages: ${pagesCount()}`),
      h('span',{class:'small'},`Table page: ${state.pageIndex+1}`),
      h('span',{class:'small'},`Showing ${filtered.length?start+1:0}–${end} of ${filtered.length}`),
      h('label',{class:'small'},'Rows/page ',h('select',{class:'input',value:String(state.pageSize),onChange:(e)=>{state.pageSize=Number(e.target.value);state.pageIndex=0;renderGrid();}},h('option',{value:'50'},'50'),h('option',{value:'100'},'100'),h('option',{value:'250'},'250'),h('option',{value:'500'},'500'))),
      h('button',{class:'btn',onClick:()=>{api.selectAll(filtered.map(x=>x.entityId));renderGrid();}},'Select filtered'),
      h('button',{class:'btn',onClick:()=>{api.togglePinMany([...selected],true);renderGrid();}},'Pin selected'),
      h('button',{class:'btn',onClick:()=>{api.togglePinMany([...selected],false);renderGrid();}},'Unpin selected'),
      h('button',{class:'btn',onClick:()=>{api.toggleHideMany([...selected],true);renderGrid();}},'Hide selected'),
      h('button',{class:'btn',onClick:()=>{api.toggleHideMany([...selected],false);renderGrid();}},'Show selected'),
      h('button',{class:'btn',onClick:()=>api.exportFilteredCsv(filtered)},'Export filtered CSV'),
      h('button',{class:'btn',onClick:()=>api.exportFilteredJson(filtered)},'Export filtered JSON'),
      h('button',{class:'btn',onClick:()=>api.exportSelectedJson(filtered.filter(r=>selected.has(r.entityId)))},'Export selected JSON'),
      h('button',{class:'btn',onClick:()=>api.copySelectedSummary(filtered.filter(r=>selected.has(r.entityId)))},'Copy selected summary'),
      h('button',{class:'btn',onClick:()=>chooseColumns()},'Columns'),
      h('button',{class:'btn',onClick:()=>{state.widths={};renderGrid();}},'Reset widths'),
      h('button',{class:'btn',onClick:fitColumnsToContent},'Fit columns'),
      h('button',{class:'btn',onClick:()=>{state.density=state.density==='compact'?'comfortable':'compact'; root.dataset.density=state.density; renderGrid();}},`Density: ${state.density}`),
      h('button',{class:'btn',onClick:()=>{state.pageIndex=Math.max(0,state.pageIndex-1);renderGrid();}},'Prev'),
      h('button',{class:'btn',onClick:()=>{state.pageIndex=Math.min(pagesCount()-1,state.pageIndex+1);renderGrid();}},'Next'),
    );

    renderDetail();
  }

  function renderFilters(){
    const subtypeSet=[...new Set(rows.map(r=>r.subtype).filter(Boolean))].sort();
    const layerSet=[...new Set(rows.map(r=>r.layerId).filter(Boolean))].sort();
    const levelSet=[...new Set(rows.map(r=>r.extractionLevel).filter(Boolean))].sort();

    const activeChips = [
      state.query && `q:${state.query}`,
      state.type!=='all' && `type:${state.type}`,
      state.subtype && `sub:${state.subtype}`,
      state.page && `p:${state.page}`,
      state.layerId && `layer:${state.layerId}`,
      state.color && `color:${state.color}`,
      state.onlyHidden && 'hidden',
      state.onlyPinned && 'pinned',
      state.onlySelected && 'selected',
      state.onlyVisible && 'visible'
    ].filter(Boolean);

    filters.replaceChildren(
      h('input',{class:'input',placeholder:'Search full text',value:state.query,onInput:(e)=>{state.query=e.target.value;renderGrid();}}),
      h('select',{class:'input',value:state.type,onChange:(e)=>{state.type=e.target.value;renderGrid();}}, ...entityTypes.map(t=>h('option',{value:t},t))),
      h('select',{class:'input',value:state.subtype,onChange:(e)=>{state.subtype=e.target.value;renderGrid();}}, h('option',{value:''},'subtype:any'), ...subtypeSet.map(s=>h('option',{value:s},s))),
      h('input',{class:'input',type:'number',placeholder:'page',value:state.page,onInput:(e)=>{state.page=e.target.value;renderGrid();}}),
      h('select',{class:'input',value:state.layerId,onChange:(e)=>{state.layerId=e.target.value;renderGrid();}}, h('option',{value:''},'layer:any'), ...layerSet.map(s=>h('option',{value:s},s))),
      h('select',{class:'input',value:state.extractionLevel,onChange:(e)=>{state.extractionLevel=e.target.value;renderGrid();}}, h('option',{value:''},'level:any'), ...levelSet.map(s=>h('option',{value:s},s))),
      h('input',{class:'input',placeholder:'confidence min',type:'number',step:'0.01',value:state.confidenceMin,onInput:(e)=>{state.confidenceMin=e.target.value;renderGrid();}}),
      h('input',{class:'input',placeholder:'confidence max',type:'number',step:'0.01',value:state.confidenceMax,onInput:(e)=>{state.confidenceMax=e.target.value;renderGrid();}}),
      h('input',{class:'input',placeholder:'stroke/fill color',value:state.color,onInput:(e)=>{state.color=e.target.value;renderGrid();}}),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyText,onChange:(e)=>{state.onlyText=e.target.checked;renderGrid();}}),' text'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyVector,onChange:(e)=>{state.onlyVector=e.target.checked;renderGrid();}}),' vector'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyWithLabel,onChange:(e)=>{state.onlyWithLabel=e.target.checked;renderGrid();}}),' with label'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyWithGeometry,onChange:(e)=>{state.onlyWithGeometry=e.target.checked;renderGrid();}}),' with geometry'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyHidden,onChange:(e)=>{state.onlyHidden=e.target.checked;renderGrid();}}),' hidden'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyPinned,onChange:(e)=>{state.onlyPinned=e.target.checked;renderGrid();}}),' pinned'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyVisible,onChange:(e)=>{state.onlyVisible=e.target.checked;renderGrid();}}),' visible'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlySelected,onChange:(e)=>{state.onlySelected=e.target.checked;renderGrid();}}),' selected'),
      h('button',{class:'btn',onClick:()=>{Object.assign(state,{query:'',type:'all',subtype:'',page:'',layerId:'',extractionLevel:'',color:'',confidenceMin:'',confidenceMax:'',onlyText:false,onlyVector:false,onlyWithLabel:false,onlyWithGeometry:false,onlyHidden:false,onlyPinned:false,onlyVisible:false,onlySelected:false,pageIndex:0}); render();}},'Clear filters'),
      h('div',{class:'ei-chip-wrap'}, ...activeChips.map(c=>h('span',{class:'ei-chip'},c)))
    );
  }

  function render(){
    root.dataset.density=state.density;
    head.replaceChildren(
      h('div',{class:'brand'},'PDF Entity Inspector'),
      h('label',{class:'small'},'Scope ',h('select',{class:'input',value:state.scope,onChange:(e)=>{state.scope=e.target.value;api.refresh(state.scope);}},h('option',{value:'current'},'Current page'),h('option',{value:'visible'},'Visible pages'),h('option',{value:'whole'},'Whole document'))),
      h('button',{class:'btn',onClick:()=>api.refresh(state.scope)},'Refresh'),
      h('button',{class:'btn',onClick:()=>api.exportAllJson(rows)},'Export all JSON'),
      h('button',{class:'btn',onClick:()=>api.copySelectedRaw(filtered.filter(r=>selectedSet().has(r.entityId)))},'Copy selected raw'),
      h('button',{class:'btn',onClick:()=>{state.open=false;root.style.display='none';api.persistUi?.(state);}},'Close')
    );
    renderFilters();
    renderGrid();
  }

  return {
    mount(callbacks){ api = callbacks; },
    open(){ state.open=true; root.style.display='flex'; render(); },
    close(){ state.open=false; root.style.display='none'; api.persistUi?.(state); },
    setRows(records){ rows = buildEntityIndex(records || []); state.pageIndex = 0; if(state.open) render(); },
    isOpen:()=>state.open,
    restoreUi:(ui={})=>Object.assign(state, ui),
    focusEntity:(entityId)=>{ const idx = filtered.findIndex(x=>x.entityId===entityId); if(idx>=0){ state.pageIndex = Math.floor(idx/state.pageSize); api.selectAll([entityId]); renderGrid(); }}
  };
}
