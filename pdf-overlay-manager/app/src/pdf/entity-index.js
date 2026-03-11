const str = (v) => (v == null ? '' : String(v).toLowerCase());

export function buildEntityIndex(records){
  return records.map((r, i) => ({
    ...r,
    _i: i,
    _search: [r.entityId,r.type,r.subtype,r.label,r.text,r.page,r.strokeColor,r.fillColor,r.source,r.symbolHint].map(str).join(' | ')
  }));
}

export function filterEntities(rows, f = {}){
  return rows.filter(r => {
    if (f.scopePages?.length && !f.scopePages.includes(r.page)) return false;
    if (f.query && !r._search.includes(f.query.toLowerCase())) return false;
    if (f.type && f.type !== 'all' && r.type !== f.type) return false;
    if (f.page && Number(f.page) !== r.page) return false;
    if (f.onlyText && !r.text) return false;
    if (f.onlyVector && !['line','rect','path','polylineLike','curve'].includes(r.type)) return false;
    if (f.onlyHidden && !f.hiddenSet?.has(r.entityId)) return false;
    if (f.onlyPinned && !f.pinnedSet?.has(r.entityId)) return false;
    if (f.onlySelected && !f.selectedSet?.has(r.entityId)) return false;
    if (f.color && !(str(r.strokeColor).includes(str(f.color)) || str(r.fillColor).includes(str(f.color)))) return false;
    return true;
  });
}

export function sortEntities(rows, sortBy='entityId', dir='asc'){
  const m = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a,b)=>{
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*m;
    return String(av).localeCompare(String(bv))*m;
  });
}

export const entityTypes = ['all','text','line','rect','path','polylineLike','curve','image','symbolCandidate','group','unknown','style'];
