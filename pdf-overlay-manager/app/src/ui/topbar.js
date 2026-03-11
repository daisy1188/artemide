import { h } from '../utils/dom.js';
export function renderTopbar(root,api){root.replaceChildren(
  h('div',{class:'brand'},h('img',{src:'./assets/logo.svg',width:'24'}),'IS Workbench'),
  h('button',{class:'btn',onClick:api.openPdf},'Apri PDF'),
  h('button',{class:'btn',onClick:api.prevPage},'Prev'),
  h('button',{class:'btn',onClick:api.nextPage},'Next'),
  h('button',{class:'btn',onClick:api.fitWidth},'Fit Width'),
  h('button',{class:'btn',onClick:api.rotate},'Rotate 90°'),
  h('button',{class:'btn',onClick:api.saveProject},'Save JSON'),
  h('button',{class:'btn',onClick:api.loadProject},'Load JSON'),
  h('button',{class:'btn',onClick:api.exportCsv},'Export CSV'),
  h('button',{class:'btn',onClick:api.snapshot},'Snapshot PNG'),
  h('label',{},h('input',{type:'checkbox',checked:api.showText, onChange:(e)=>api.toggleText(e.target.checked)}),' Text boxes')
)}
