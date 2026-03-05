export function pageToViewport(pt,view){return{x:pt.x*view.scale+view.panX,y:pt.y*view.scale+view.panY}};
export function viewportToPage(pt,view){return{x:(pt.x-view.panX)/view.scale,y:(pt.y-view.panY)/view.scale}};
export function rectNormalize(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)}}
