export const getEntityInspectorState = (state) => state.entityInspector || {};
export const getEntitySelectedIds = (state) => getEntityInspectorState(state).selectedIds || [];
export const getEntityHiddenIds = (state) => getEntityInspectorState(state).hiddenIds || [];
export const getEntityPinnedIds = (state) => getEntityInspectorState(state).pinnedIds || [];
export const setFromIds = (ids=[]) => new Set(ids);

export function getRepresentativePoint(entity){
  if (!entity) return { x:0, y:0 };
  if (entity.type === 'line' && entity.raw?.args?.[1]?.length >= 4) {
    const c = entity.raw.args[1];
    const x1 = Number(c[0]), y1 = Number(c[1]), x2 = Number(c[2]), y2 = Number(c[3]);
    if ([x1,y1,x2,y2].every(Number.isFinite)) return { x:(x1+x2)/2, y:(y1+y2)/2 };
  }
  if (entity.centerX != null && entity.centerY != null) return { x:entity.centerX, y:entity.centerY };
  if (entity.x != null && entity.y != null && entity.width != null && entity.height != null) return { x:entity.x+entity.width/2, y:entity.y+entity.height/2 };
  return { x:entity.x ?? 0, y:entity.y ?? 0 };
}
