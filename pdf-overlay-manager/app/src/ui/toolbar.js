import { h } from '../utils/dom.js';
import { icons } from './icons.js';
export function renderToolbar(root,current,setTool){const tools=['select','pan','box','note','measure','crop','exclude'];root.replaceChildren(...tools.map(t=>h('button',{class:`btn ${current===t?'active':''}`,title:`${t}`,onClick:()=>setTool(t)},icons[t]||t)));}
