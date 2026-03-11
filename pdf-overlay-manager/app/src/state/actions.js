import { nowIso } from '../utils/time.js';
const id=()=>crypto.randomUUID();
export const actions={
  addOverlay:(store,overlay)=>store.setState(s=>{s.overlays.push({...overlay,id:id(),createdAt:nowIso(),updatedAt:nowIso()});return s;}),
  updateOverlay:(store,oid,patch)=>store.setState(s=>{const o=s.overlays.find(x=>x.id===oid);if(o)Object.assign(o,patch,{updatedAt:nowIso()});return s;}),
  deleteOverlay:(store,ids)=>store.setState(s=>{const set=new Set([].concat(ids));s.overlays=s.overlays.filter(o=>!set.has(o.id));return s;}),
  addLayer:(store,name='Layer')=>store.setState(s=>{const l={id:id(),name,visible:true,locked:false};s.layers.push(l);s.activeLayerId=l.id;return s;}),
};
