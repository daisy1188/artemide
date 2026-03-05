import { h } from '../utils/dom.js';
export function buildLayout(root){
  const top=h('div',{class:'topbar panel',id:'topbar'});
  const toolbar=h('div',{class:'toolbar panel',id:'toolbar'});
  const workspace=h('div',{class:'workspace panel'},h('div',{class:'canvas-host',id:'canvas-host'},h('div',{class:'canvas-stack',id:'canvas-stack'},h('canvas',{id:'pdf-canvas'}),h('canvas',{id:'overlay-canvas'}))));
  const sidebar=h('div',{class:'sidebar panel',id:'sidebar'});
  const main=h('div',{class:'main'},toolbar,workspace,sidebar);
  const status=h('div',{class:'statusbar panel',id:'statusbar'});
  root.append(h('div',{class:'app-shell'},top,main,status));
  return {top,toolbar,workspace,sidebar,status};
}
