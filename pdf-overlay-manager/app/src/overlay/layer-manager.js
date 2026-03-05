export const isLayerLocked=(state,layerId)=>state.layers.find(l=>l.id===layerId)?.locked;
export const isLayerVisible=(state,layerId)=>state.layers.find(l=>l.id===layerId)?.visible!==false;
