export function renderStatusbar(root,s){root.textContent=`Page ${s.page} • Zoom ${(s.zoom*100).toFixed(0)}% • Tool ${s.tool} • Layer ${s.layer} • Snap ${s.snap?'ON':'OFF'}`;}
