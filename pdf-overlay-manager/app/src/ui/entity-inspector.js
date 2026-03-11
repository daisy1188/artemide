import { h } from '../utils/dom.js';
import { buildEntityIndex, filterEntities, sortEntities, entityTypes } from '../pdf/entity-index.js';

const BASE_COLUMNS = [
  { key:'entityId', label:'entityId', sticky:true, min:180 },
  { key:'page', label:'page', sticky:true, min:70 },
  { key:'type', label:'type', sticky:true, min:110 },
  { key:'subtype', label:'subtype', min:130 },
  { key:'label', label:'label/text', min:200 },
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
  { key:'fontSize', label:'fontSize', min:90, advanced:true },
  { key:'pointCount', label:'pointCount', min:110, advanced:true },
  { key:'length', label:'length', min:90, advanced:true },
  { key:'area', label:'area', min:90, advanced:true },
  { key:'pathClosed', label:'pathClosed', min:100, advanced:true },
  { key:'rawType', label:'rawType', min:100, advanced:true },
  { key:'groupId', label:'groupId', min:100, advanced:true },
  { key:'symbolHint', label:'symbolHint', min:120, advanced:true },
  { key:'zIndex', label:'zIndex', min:80, advanced:true },
  { key:'source', label:'source', min:180, advanced:true },
  { key:'extractionLevel', label:'extractionLevel', min:120, advanced:true },
  { key:'confidence', label:'confidence', min:100, advanced:true },
  { key:'createdAt', label:'createdAt', min:160, advanced:true },
  { key:'updatedAt', label:'updatedAt', min:160, advanced:true },
  { key:'layerId', label:'layerId', min:140, advanced:true },
  { key:'metaName', label:'meta.name', min:120, advanced:true },
  { key:'metaTags', label:'meta.tags', min:160, advanced:true },
  { key:'metaNotes', label:'meta.notes', min:180, advanced:true },
];

const defaultVisible = BASE_COLUMNS.filter(c => !c.advanced).map(c => c.key);
const colByKey = Object.fromEntries(BASE_COLUMNS.map(c => [c.key, c]));
const ell = (v, n = 42) => v == null ? '—' : (String(v).length > n ? `${String(v).slice(0, n)}…` : String(v));

export function createEntityInspector({ toast, onRowHover, onRowLeave }) {
  let api = null;
  let rows = [];
  let filtered = [];
  let pageCursor = 0;
  let anchorSelectionIndex = null;

  const state = {
    open: false,
    query: '',
    type: 'all',
    subtype: '',
    page: '',
    color: '',
    layerId: '',
    extractionLevel: '',
    confidenceMin: '',
    confidenceMax: '',
    onlyText: false,
    onlyVector: false,
    onlyWithLabel: false,
    onlyWithGeometry: false,
    onlyHidden: false,
    onlyPinned: false,
    onlySelected: false,
    onlyVisible: false,
    sortBy: 'entityId',
    sortDir: 'asc',
    scope: 'current',
    density: 'compact',
    pageSize: 100,
    columns: [...defaultVisible],
    colWidths: {}
  };

  const root = h('div', { class:'ei-modal-backdrop', style:'display:none' });
  const panel = h('div', { class:'ei-modal panel' });
  root.append(panel);
  document.body.append(root);

  const head = h('div', { class:'ei-head' });
  const filters = h('div', { class:'ei-filters' });
  const body = h('div', { class:'ei-body' });
  const tableWrap = h('div', { class:'ei-table-wrap' });
  const detail = h('div', { class:'ei-detail' }, 'Select entity');
  body.append(tableWrap, detail);
  panel.append(head, filters, body);

  const close = () => { state.open = false; root.style.display = 'none'; api.persistUi?.(state); };
  const open = () => { state.open = true; root.style.display = 'flex'; render(); };

  const visibleCols = () => state.columns.map(k => colByKey[k]).filter(Boolean);
  const tablePages = () => Math.max(1, Math.ceil(filtered.length / state.pageSize));

  const normalizeRow = (r) => ({
    ...r,
    hidden: api.isHidden(r.entityId),
    pinned: api.isPinned(r.entityId),
    visible: !api.isHidden(r.entityId),
    metaName: r.meta?.name ?? r.metaName ?? null,
    metaTags: Array.isArray(r.meta?.tags) ? r.meta.tags.join('|') : (r.metaTags ?? null),
    metaNotes: r.meta?.notes ?? r.metaNotes ?? null
  });

  function renderCell(row, c){
    const full = row[c.key] == null ? '—' : (typeof row[c.key] === 'object' ? JSON.stringify(row[c.key]) : String(row[c.key]));
    return h('td',{title:full,class:c.sticky?'ei-sticky':''}, ell(full));
  }

  function applyFilter(rowsIn){
    const hiddenSet = api.getHiddenSet();
    const pinnedSet = api.getPinnedSet();
    const selectedSet = api.getSelectedSet();
    let out = filterEntities(rowsIn.map(normalizeRow), { ...state, hiddenSet, pinnedSet, selectedSet });
    if (state.subtype) out = out.filter(r => (r.subtype || '') === state.subtype);
    if (state.layerId) out = out.filter(r => String(r.layerId || '') === state.layerId);
    if (state.onlyWithLabel) out = out.filter(r => !!(r.label || r.text));
    if (state.onlyWithGeometry) out = out.filter(r => r.x != null && r.y != null && r.width != null && r.height != null);
    if (state.onlyVisible) out = out.filter(r => !hiddenSet.has(r.entityId));
    if (state.extractionLevel) out = out.filter(r => String(r.extractionLevel || '') === state.extractionLevel);
    if (state.confidenceMin !== '') out = out.filter(r => Number(r.confidence ?? -1) >= Number(state.confidenceMin));
    if (state.confidenceMax !== '') out = out.filter(r => Number(r.confidence ?? 2) <= Number(state.confidenceMax));
    return sortEntities(out, state.sortBy, state.sortDir);
  }

  function resizeHeader(colKey, startX){
    const current = state.colWidths[colKey] || colByKey[colKey]?.min || 100;
    const onMove = (e) => {
      const next = Math.max(colByKey[colKey]?.min || 80, current + (e.clientX - startX));
      state.colWidths[colKey] = next;
      panel.style.setProperty(`--col-${colKey}`, `${next}px`);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderTable();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function columnChooser(){
    const wrap = h('div',{class:'ei-col-chooser panel'});
    const list = h('div',{class:'ei-col-list'}, ...BASE_COLUMNS.map(c=>{
      const cb = h('input',{type:'checkbox',checked:state.columns.includes(c.key),onChange:(e)=>{
        if(e.target.checked && !state.columns.includes(c.key)) state.columns.push(c.key);
        if(!e.target.checked && state.columns.includes(c.key)) state.columns = state.columns.filter(k=>k!==c.key);
        renderTable();
      }});
      return h('label',{class:'small'},cb,` ${c.label}`);
    }));
    wrap.append(h('div',{class:'ei-actions'},
      h('button',{class:'btn',onClick:()=>{state.columns=[...defaultVisible]; state.colWidths={}; renderTable();}},'Reset columns'),
      h('button',{class:'btn',onClick:()=>wrap.remove()},'Close')
    ), list);
    panel.append(wrap);
  }

  function selectByEvent(entityId, e){
    const selected = new Set(api.getSelectedSet());
    const idx = filtered.findIndex(x => x.entityId === entityId);
    if (e.shiftKey && anchorSelectionIndex != null) {
      const [a,b] = [Math.min(anchorSelectionIndex, idx), Math.max(anchorSelectionIndex, idx)];
      for(let i=a;i<=b;i++) selected.add(filtered[i].entityId);
    } else if (e.ctrlKey || e.metaKey) {
      if (selected.has(entityId)) selected.delete(entityId); else selected.add(entityId);
      anchorSelectionIndex = idx;
    } else {
      selected.clear(); selected.add(entityId); anchorSelectionIndex = idx;
    }
    api.selectAll([...selected]);
  }

  function rowActions(r){
    return h('div',{class:'ei-actions ei-actions-row'},
      h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();api.zoomTo(r);}},'Zoom'),
      h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();api.togglePin(r.entityId);renderTable();}}, api.isPinned(r.entityId)?'Unpin':'Pin'),
      h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();api.toggleHide(r.entityId);renderTable();}}, api.isHidden(r.entityId)?'Show':'Hide'),
      h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();api.selectAll([r.entityId]);renderTable();}},'Select'),
      h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();navigator.clipboard?.writeText(JSON.stringify(r,null,2));toast('Copied');}},'Copy')
    );
  }

  function renderDetail(selectedSet){
    const selectedId = [...selectedSet][0];
    const one = rows.find(x=>x.entityId===selectedId);
    if (!one) { detail.replaceChildren('Select entity'); return; }
    const s = normalizeRow(one);
    detail.replaceChildren(
      h('h3',{},'Entity Detail'),
      h('div',{class:'ei-section'},h('h4',{},'Identity'),h('div',{},`ID: ${s.entityId}`),h('div',{},`Type: ${s.type} / ${s.subtype || '—'}`),h('div',{},`Page: ${s.page}`),h('div',{},`Layer: ${s.layerId || '—'}`)),
      h('div',{class:'ei-section'},h('h4',{},'Geometry'),h('div',{},`bbox: [${s.x ?? '—'}, ${s.y ?? '—'}, ${s.width ?? '—'}, ${s.height ?? '—'}]`),h('div',{},`center: (${s.centerX ?? '—'}, ${s.centerY ?? '—'})`),h('div',{},`length: ${s.length ?? '—'} area: ${s.area ?? '—'}`)),
      h('div',{class:'ei-section'},h('h4',{},'Style / Text'),h('div',{},`stroke: ${s.strokeColor ?? '—'} ${s.strokeWidth ?? ''} ${s.strokeStyle ?? ''}`),h('div',{},`fill: ${s.fillColor ?? '—'} opacity: ${s.opacity ?? '—'}`),h('div',{},`text: ${s.text || s.label || '—'}`),h('div',{},`font: ${s.fontName ?? '—'} ${s.fontSize ?? ''}`)),
      h('div',{class:'ei-section'},h('h4',{},'State / Extraction'),h('div',{},`hidden: ${s.hidden} pinned: ${s.pinned}`),h('div',{},`level: ${s.extractionLevel ?? '—'} confidence: ${s.confidence ?? '—'}`),h('div',{},`source: ${s.source ?? '—'}`)),
      h('details',{},h('summary',{},'Raw data'),h('pre',{class:'ei-json'},JSON.stringify(s.raw ?? s, null, 2))),
      h('div',{class:'ei-actions'},
        h('button',{class:'btn',onClick:()=>api.zoomTo(s)},'Zoom to'),
        h('button',{class:'btn',onClick:()=>{api.togglePin(s.entityId);renderTable();}}, api.isPinned(s.entityId)?'Unpin':'Pin'),
        h('button',{class:'btn',onClick:()=>{api.toggleHide(s.entityId);renderTable();}}, api.isHidden(s.entityId)?'Show':'Hide'),
        h('button',{class:'btn',onClick:()=>navigator.clipboard?.writeText(JSON.stringify(s,null,2)).then(()=>toast('Copied row JSON'))},'Copy row JSON'),
        h('button',{class:'btn',onClick:()=>navigator.clipboard?.writeText(`${s.entityId} | p${s.page} | ${s.type}/${s.subtype} | ${s.label || s.text || '—'}`).then(()=>toast('Copied summary'))},'Copy summary')
      )
    );
  }

  function renderTable(){
    filtered = applyFilter(rows);
    const pages = tablePages();
    if (pageCursor >= pages) pageCursor = pages - 1;

    const from = filtered.length ? pageCursor * state.pageSize + 1 : 0;
    const to = Math.min(filtered.length, (pageCursor + 1) * state.pageSize);
    const paged = filtered.slice(from ? from - 1 : 0, to);
    const selectedSet = api.getSelectedSet();

    const colgroup = h('colgroup',{}, h('col',{style:'width:40px'}), ...visibleCols().map(c=>{
      const w = state.colWidths[c.key] || c.min;
      return h('col',{style:`width:${w}px`});
    }), h('col',{style:'width:260px'}));

    const thead = h('thead',{}, h('tr',{},
      h('th',{class:'ei-sticky'}, '✓'),
      ...visibleCols().map((c,i)=>h('th',{class:c.sticky?'ei-sticky':'',title:c.key}, c.label, h('span',{class:'ei-resizer',onMousedown:(e)=>{e.preventDefault();resizeHeader(c.key,e.clientX);}}))),
      h('th',{},'actions')
    ));

    const tbody = h('tbody',{}, ...paged.map((r)=>{
      const sel = selectedSet.has(r.entityId);
      return h('tr',{class:sel?'active':'',onClick:(e)=>{selectByEvent(r.entityId,e); api.zoomTo(r); renderTable();},onMouseenter:()=>onRowHover?.(r),onMouseleave:()=>onRowLeave?.()},
        h('td',{class:'ei-sticky'}, h('input',{type:'checkbox',checked:sel,onClick:(e)=>{e.stopPropagation();selectByEvent(r.entityId,e);renderTable();}})),
        ...visibleCols().map((c)=>renderCell(r,c)),
        h('td',{}, rowActions(r))
      );
    }));

    const tbl = h('table',{class:`ei-table ${state.density==='compact'?'compact':'comfortable'}`}, colgroup, thead, tbody);
    tableWrap.replaceChildren(
      h('div',{class:'ei-table-tools'},
        h('span',{class:'small'},`Rows: ${filtered.length}`),
        h('span',{class:'small'},`Pages: ${pages}`),
        h('span',{class:'small'},`Table page: ${pageCursor+1}`),
        h('span',{class:'small'},`${from}–${to} / ${filtered.length}`),
        h('label',{class:'small'},'Rows/page ',h('select',{class:'input',value:String(state.pageSize),onChange:(e)=>{state.pageSize=Number(e.target.value);pageCursor=0;renderTable();}}, h('option',{value:'50'},'50'),h('option',{value:'100'},'100'),h('option',{value:'250'},'250'),h('option',{value:'500'},'500'))),
        h('button',{class:'btn',onClick:()=>{api.selectAll(filtered.map(x=>x.entityId));renderTable();}},'Select all filtered'),
        h('button',{class:'btn',onClick:()=>{api.togglePinMany([...selectedSet], true);renderTable();}},'Pin selected'),
        h('button',{class:'btn',onClick:()=>{api.togglePinMany([...selectedSet], false);renderTable();}},'Unpin selected'),
        h('button',{class:'btn',onClick:()=>{api.toggleHideMany([...selectedSet], true);renderTable();}},'Hide selected'),
        h('button',{class:'btn',onClick:()=>{api.toggleHideMany([...selectedSet], false);renderTable();}},'Show selected'),
        h('button',{class:'btn',onClick:()=>api.exportFilteredCsv(filtered)},'Export CSV'),
        h('button',{class:'btn',onClick:()=>api.exportFilteredJson(filtered)},'Export JSON'),
        h('button',{class:'btn',onClick:()=>{state.density = state.density==='compact'?'comfortable':'compact'; renderTable();}},`Density: ${state.density}`),
        h('button',{class:'btn',onClick:columnChooser},'Columns'),
        h('button',{class:'btn',onClick:()=>{state.colWidths={};renderTable();}},'Reset widths'),
        h('button',{class:'btn',onClick:()=>{pageCursor=Math.max(0,pageCursor-1);renderTable();}},'Prev'),
        h('button',{class:'btn',onClick:()=>{if (pageCursor+1<pages) pageCursor++;renderTable();}},'Next')
      ),
      h('div',{class:'ei-table-scroll'}, tbl)
    );

    renderDetail(selectedSet);
  }

  function render(){
    const subtypeSet = [...new Set(rows.map(r=>r.subtype).filter(Boolean))].sort();
    const extractionSet = [...new Set(rows.map(r=>r.extractionLevel).filter(Boolean))].sort();
    const layerSet = [...new Set(rows.map(r=>r.layerId).filter(Boolean))].sort();

    head.replaceChildren(
      h('div',{class:'brand'},'PDF Entity Inspector'),
      h('label',{class:'small'},'Scope', h('select',{class:'input',value:state.scope,onChange:(e)=>{state.scope=e.target.value;api.refresh(state.scope);}}, h('option',{value:'current'},'Current page'), h('option',{value:'visible'},'Visible pages'), h('option',{value:'whole'},'Whole document'))),
      h('button',{class:'btn',onClick:()=>api.refresh(state.scope)},'Refresh'),
      h('button',{class:'btn',onClick:()=>api.exportAllJson(rows)},'Export all JSON'),
      h('button',{class:'btn',onClick:close},'Close')
    );

    filters.replaceChildren(
      h('input',{class:'input',placeholder:'Search full text',value:state.query,onInput:(e)=>{state.query=e.target.value;renderTable();}}),
      h('select',{class:'input',value:state.type,onChange:(e)=>{state.type=e.target.value;renderTable();}}, ...entityTypes.map(t=>h('option',{value:t},t))),
      h('select',{class:'input',value:state.subtype,onChange:(e)=>{state.subtype=e.target.value;renderTable();}}, h('option',{value:''},'subtype:any'), ...subtypeSet.map(t=>h('option',{value:t},t))),
      h('input',{class:'input',placeholder:'page',type:'number',value:state.page,onInput:(e)=>{state.page=e.target.value;renderTable();}}),
      h('select',{class:'input',value:state.layerId,onChange:(e)=>{state.layerId=e.target.value;renderTable();}}, h('option',{value:''},'layer:any'), ...layerSet.map(t=>h('option',{value:t},t))),
      h('select',{class:'input',value:state.extractionLevel,onChange:(e)=>{state.extractionLevel=e.target.value;renderTable();}}, h('option',{value:''},'level:any'), ...extractionSet.map(t=>h('option',{value:t},t))),
      h('input',{class:'input',placeholder:'confidence min',type:'number',step:'0.01',min:'0',max:'1',value:state.confidenceMin,onInput:(e)=>{state.confidenceMin=e.target.value;renderTable();}}),
      h('input',{class:'input',placeholder:'confidence max',type:'number',step:'0.01',min:'0',max:'1',value:state.confidenceMax,onInput:(e)=>{state.confidenceMax=e.target.value;renderTable();}}),
      h('input',{class:'input',placeholder:'stroke/fill color',value:state.color,onInput:(e)=>{state.color=e.target.value;renderTable();}}),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyText,onChange:(e)=>{state.onlyText=e.target.checked;renderTable();}}),' only text'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyVector,onChange:(e)=>{state.onlyVector=e.target.checked;renderTable();}}),' only vector'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyWithLabel,onChange:(e)=>{state.onlyWithLabel=e.target.checked;renderTable();}}),' with label'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyWithGeometry,onChange:(e)=>{state.onlyWithGeometry=e.target.checked;renderTable();}}),' with geometry'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyHidden,onChange:(e)=>{state.onlyHidden=e.target.checked;renderTable();}}),' hidden'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyPinned,onChange:(e)=>{state.onlyPinned=e.target.checked;renderTable();}}),' pinned'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyVisible,onChange:(e)=>{state.onlyVisible=e.target.checked;renderTable();}}),' visible'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlySelected,onChange:(e)=>{state.onlySelected=e.target.checked;renderTable();}}),' selected'),
      h('button',{class:'btn',onClick:()=>{Object.assign(state,{query:'',type:'all',subtype:'',page:'',color:'',layerId:'',extractionLevel:'',confidenceMin:'',confidenceMax:'',onlyText:false,onlyVector:false,onlyWithLabel:false,onlyWithGeometry:false,onlyHidden:false,onlyPinned:false,onlyVisible:false,onlySelected:false}); render();}},'Clear filters')
    );

    renderTable();
  }

  return {
    mount(callbacks){ api = callbacks; },
    open,
    close,
    setRows(records){ rows = buildEntityIndex(records || []); pageCursor = 0; if (state.open) render(); },
    isOpen:()=>state.open,
    focusEntity:(entityId)=>{ const idx = filtered.findIndex(r=>r.entityId===entityId); if(idx>=0){ pageCursor = Math.floor(idx/state.pageSize); api.selectAll([entityId]); renderTable(); } },
    restoreUi:(ui={})=>{ Object.assign(state, ui); }
  };
}
