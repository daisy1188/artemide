import { h } from '../utils/dom.js';
export function panel(title,body,id,onToggle,collapsed){return h('section',{class:'psection',id},h('div',{class:'phead',onClick:()=>onToggle(id)},title,h('span',{},collapsed?'▸':'▾')),collapsed?null:h('div',{class:'pbody'},body));}
export function renderPanels(root,ctx){const s=ctx.store.getState();const c=s.ui.collapsed||{};const pageItems=(ctx.viewer.doc?Array.from({length:ctx.viewer.doc.numPages},(_,i)=>i+1):[]).map(p=>h('div',{class:`item ${p===ctx.viewer.pageNo?'active':''}`,onClick:()=>ctx.goPage(p)},`Page ${p}`));
const layerItems=s.layers.map(l=>h('div',{class:'item'},`${l.id===s.activeLayerId?'● ':''}${l.name} (${s.overlays.filter(o=>o.layerId===l.id).length})`,h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();ctx.toggleLayer(l.id,'visible')}},l.visible?'👁':'🚫'),h('button',{class:'btn',onClick:(e)=>{e.stopPropagation();ctx.toggleLayer(l.id,'locked')}},l.locked?'🔒':'🔓')));
const objs=s.overlays.filter(o=>o.page===ctx.viewer.pageNo).map(o=>h('div',{class:'item',onClick:()=>ctx.selectObject(o.id)},`${o.type} • ${o.id.slice(0,6)}`));
root.replaceChildren(
panel('Pages',[h('div',{class:'list'},...pageItems)],'pages',ctx.toggleCollapse,c.pages),
panel('Layers',[h('button',{class:'btn',onClick:ctx.addLayer},'+ Layer'),h('div',{class:'list'},...layerItems)],'layers',ctx.toggleCollapse,c.layers),
panel('Properties',[ctx.propertiesEl],'props',ctx.toggleCollapse,c.props),
panel('Objects',[h('button',{class:'btn',onClick:ctx.deleteSelected},'Delete selected'),h('div',{class:'list'},...objs)],'objects',ctx.toggleCollapse,c.objects),
panel('Text Search',[h('input',{class:'input',placeholder:'Search text',value:ctx.searchQ,onInput:(e)=>ctx.searchText(e.target.value)}),h('div',{class:'list'},...(ctx.searchResults||[]).map(r=>h('div',{class:'item',onClick:()=>ctx.jumpToText(r)},`${r.page}: ${r.text}`)))],'text',ctx.toggleCollapse,c.text)
)}
