import { h } from '../utils/dom.js';
export function createToasts(root){const wrap=h('div',{class:'toast-wrap'});root.append(wrap);return (msg,type='info')=>{const t=h('div',{class:'toast'},`[${type}] ${msg}`);wrap.append(t);setTimeout(()=>t.remove(),3200);};}
