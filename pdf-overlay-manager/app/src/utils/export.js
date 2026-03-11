export function projectToCsv(state){
  const rows=[['id','type','page','layerId','geometry','style','text','meta']];
  for(const o of state.overlays){rows.push([o.id,o.type,o.page,o.layerId,JSON.stringify(o.geometry),JSON.stringify(o.style),o.content?.text||'',JSON.stringify(o.meta)]);}
  return rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
}

export function entitiesToCsv(rows){
  if(!rows?.length) return 'entityId,page,type,subtype,label';
  const cols = Object.keys(rows[0]).filter(k=>!k.startsWith('_') && k!=='raw');
  const out = [cols];
  for(const r of rows) out.push(cols.map(c=>r[c] == null ? '' : (typeof r[c]==='object'?JSON.stringify(r[c]):String(r[c]))));
  return out.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
}
