import { h } from '../utils/dom.js';
import { buildEntityIndex, filterEntities, sortEntities, entityTypes } from '../pdf/entity-index.js';

export function createEntityInspector({ toast, onRowHover, onRowLeave }) {
  let api = null;
  let rows = [];
  let filtered = [];
  let pageCursor = 0;
  const pageSize = 200;

  const state = {
    open: false,
    query: '',
    type: 'all',
    page: '',
    color: '',
    onlyText: false,
    onlyVector: false,
    onlyHidden: false,
    onlyPinned: false,
    onlySelected: false,
    sortBy: 'entityId',
    sortDir: 'asc',
    scope: 'current',
    columns: ['entityId','page','type','subtype','label','x','y','width','height','centerX','centerY','rotation','strokeColor','fillColor','strokeWidth','opacity','visible','pinned','extractionLevel','confidence','source']
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

  const close = () => { state.open = false; root.style.display = 'none'; };
  const open = () => { state.open = true; root.style.display = 'flex'; render(); };

  const colHeader = (k) => h('th',{ onClick:()=>{ if (state.sortBy===k) state.sortDir = state.sortDir==='asc'?'desc':'asc'; else {state.sortBy=k; state.sortDir='asc';} renderTable(); }},k);

  function rowActions(r){
    return h('div',{class:'ei-actions'},
      h('button',{class:'btn',onClick:()=>api.zoomTo(r)},'Zoom'),
      h('button',{class:'btn',onClick:()=>api.togglePin(r.entityId)}, api.isPinned(r.entityId)?'Unpin':'Pin'),
      h('button',{class:'btn',onClick:()=>api.toggleHide(r.entityId)}, api.isHidden(r.entityId)?'Show':'Hide')
    );
  }

  function renderTable(){
    const hiddenSet = api.getHiddenSet();
    const pinnedSet = api.getPinnedSet();
    const selectedSet = api.getSelectedSet();
    filtered = filterEntities(rows, { ...state, hiddenSet, pinnedSet, selectedSet });
    filtered = sortEntities(filtered, state.sortBy, state.sortDir);

    const paged = filtered.slice(pageCursor, pageCursor + pageSize);
    const thead = h('thead',{}, h('tr',{}, h('th',{},'✓'), ...state.columns.map(colHeader), h('th',{},'actions')));
    const tbody = h('tbody',{}, ...paged.map(r=>{
      const sel = selectedSet.has(r.entityId);
      return h('tr',{class:sel?'active':'',onClick:(e)=>api.selectRow(r.entityId,e),onMouseenter:()=>onRowHover?.(r),onMouseleave:()=>onRowLeave?.()},
        h('td',{}, h('input',{type:'checkbox',checked:sel,onClick:(e)=>{e.stopPropagation();api.selectRow(r.entityId,e);}})),
        ...state.columns.map(c=>h('td',{}, String(r[c] ?? 'unknown'))),
        h('td',{}, rowActions(r))
      );
    }));

    const tbl = h('table',{class:'ei-table'}, thead, tbody);
    tableWrap.replaceChildren(
      h('div',{class:'ei-table-tools'},
        h('span',{class:'small'},`Rows: ${filtered.length}`),
        h('button',{class:'btn',onClick:()=>{api.selectAll(filtered.map(x=>x.entityId));renderTable();}},'Select filtered'),
        h('button',{class:'btn',onClick:()=>{api.clearSelection();renderTable();}},'Clear selection'),
        h('button',{class:'btn',onClick:()=>api.exportFilteredCsv(filtered)},'Export CSV'),
        h('button',{class:'btn',onClick:()=>api.exportFilteredJson(filtered)},'Export JSON'),
        h('button',{class:'btn',onClick:()=>{pageCursor=Math.max(0,pageCursor-pageSize);renderTable();}},'Prev'),
        h('button',{class:'btn',onClick:()=>{if (pageCursor+pageSize<filtered.length) pageCursor+=pageSize; renderTable();}},'Next')
      ),
      tbl
    );

    const one = rows.find(x=>selectedSet.has(x.entityId));
    if (one) {
      detail.replaceChildren(
        h('h3',{},'Entity Detail'),
        h('pre',{class:'ei-json'},JSON.stringify(one,null,2)),
        h('div',{class:'ei-actions'},
          h('button',{class:'btn',onClick:()=>api.zoomTo(one)},'Zoom to'),
          h('button',{class:'btn',onClick:()=>api.togglePin(one.entityId)}, api.isPinned(one.entityId)?'Unpin':'Pin'),
          h('button',{class:'btn',onClick:()=>api.toggleHide(one.entityId)}, api.isHidden(one.entityId)?'Show':'Hide'),
          h('button',{class:'btn',onClick:()=>navigator.clipboard?.writeText(JSON.stringify(one,null,2)).then(()=>toast('Copied JSON')).catch(()=>toast('Clipboard non disponibile','warn'))},'Copy JSON')
        )
      );
    }
  }

  function render(){
    head.replaceChildren(
      h('div',{class:'brand'},'PDF Entity Inspector'),
      h('label',{class:'small'},'Scope', h('select',{class:'input',value:state.scope,onChange:(e)=>{state.scope=e.target.value;api.refresh(state.scope);}}, h('option',{value:'current'},'Current page'), h('option',{value:'visible'},'Visible pages'), h('option',{value:'whole'},'Whole document'))),
      h('button',{class:'btn',onClick:()=>api.refresh(state.scope)},'Refresh'),
      h('button',{class:'btn',onClick:()=>api.exportAllJson(rows)},'Export all JSON'),
      h('button',{class:'btn',onClick:close},'Close')
    );

    filters.replaceChildren(
      h('input',{class:'input',placeholder:'Search...',value:state.query,onInput:(e)=>{state.query=e.target.value;renderTable();}}),
      h('select',{class:'input',value:state.type,onChange:(e)=>{state.type=e.target.value;renderTable();}}, ...entityTypes.map(t=>h('option',{value:t},t))),
      h('input',{class:'input',placeholder:'page',type:'number',value:state.page,onInput:(e)=>{state.page=e.target.value;renderTable();}}),
      h('input',{class:'input',placeholder:'color',value:state.color,onInput:(e)=>{state.color=e.target.value;renderTable();}}),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyText,onChange:(e)=>{state.onlyText=e.target.checked;renderTable();}}),' only text'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyVector,onChange:(e)=>{state.onlyVector=e.target.checked;renderTable();}}),' only vector'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyHidden,onChange:(e)=>{state.onlyHidden=e.target.checked;renderTable();}}),' hidden'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlyPinned,onChange:(e)=>{state.onlyPinned=e.target.checked;renderTable();}}),' pinned'),
      h('label',{class:'small'},h('input',{type:'checkbox',checked:state.onlySelected,onChange:(e)=>{state.onlySelected=e.target.checked;renderTable();}}),' selected'),
      h('button',{class:'btn',onClick:()=>{Object.assign(state,{query:'',type:'all',page:'',color:'',onlyText:false,onlyVector:false,onlyHidden:false,onlyPinned:false,onlySelected:false}); render();}},'Clear filters')
    );

    renderTable();
  }

  return {
    mount(callbacks){ api = callbacks; },
    open,
    close,
    setRows(records){ rows = buildEntityIndex(records || []); pageCursor = 0; if (state.open) renderTable(); },
    isOpen:()=>state.open,
    getUiState:()=>({ ...state })
  };
}
