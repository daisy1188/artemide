import { rectCenter, distance } from '../utils/geometry.js';

const toViewportRect = (r, scale) => ({ x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale });
const toViewportPoint = (p, scale) => ({ x: p.x * scale, y: p.y * scale });

function drawEntityDebug(ctx, entityDebug, scale){
  if(!entityDebug) return;
  const { entitiesById = {}, selectedIds = [], hiddenIds = [], pinnedIds = [], hoveredIds = [], showPins = true, showHiddenMasks = true } = entityDebug;

  if (showHiddenMasks) {
    for (const id of hiddenIds) {
      const e = entitiesById[id];
      if (!e || e.x == null || e.y == null || e.width == null || e.height == null) continue;
      const r = toViewportRect({x:e.x,y:e.y,w:e.width,h:e.height}, scale);
      ctx.fillStyle='rgba(12,18,28,.95)';
      ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.strokeStyle='#ff687f';
      ctx.setLineDash([4,4]);
      ctx.strokeRect(r.x,r.y,r.w,r.h);
      ctx.setLineDash([]);
    }
  }


  for (const id of hoveredIds) {
    const e = entitiesById[id];
    if (!e || e.x == null || e.y == null || e.width == null || e.height == null) continue;
    const r = toViewportRect({x:e.x,y:e.y,w:e.width,h:e.height}, scale);
    ctx.fillStyle='rgba(101,182,255,.18)';
    ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.strokeStyle='#65b6ff';
    ctx.strokeRect(r.x,r.y,r.w,r.h);
  }

  for (const id of selectedIds) {
    const e = entitiesById[id];
    if (!e || e.x == null || e.y == null || e.width == null || e.height == null) continue;
    const r = toViewportRect({x:e.x,y:e.y,w:e.width,h:e.height}, scale);
    ctx.strokeStyle='#ffbe5c';
    ctx.lineWidth=2;
    ctx.setLineDash([8,5]);
    ctx.strokeRect(r.x,r.y,r.w,r.h);
    ctx.setLineDash([]);
  }

  if (showPins) {
    for (const id of pinnedIds) {
      const e = entitiesById[id];
      if (!e) continue;
      const c = toViewportPoint({x:e.centerX ?? e.x ?? 0,y:e.centerY ?? e.y ?? 0}, scale);
      ctx.fillStyle='#ffbe5c';
      ctx.beginPath(); ctx.arc(c.x,c.y,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#10131a'; ctx.stroke();
      ctx.fillStyle='#10131a'; ctx.fillRect(c.x+8,c.y-9,150,18);
      ctx.strokeStyle='#ffbe5c'; ctx.strokeRect(c.x+8,c.y-9,150,18);
      ctx.fillStyle='#ffbe5c'; ctx.font='11px Inter,sans-serif'; ctx.fillText(`${id} · ${e.type}`, c.x+12, c.y+3);
    }
  }
}

export function renderOverlays(ctx,state,page,selected=[],view={scale:1}){
  const scale=view.scale||1;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  for(const o of state.overlays.filter(x=>x.page===page)){
    if(o.meta.hidden) continue;
    const layer=state.layers.find(l=>l.id===o.layerId);
    if(layer && !layer.visible) continue;

    if(o.type==='box'||o.type==='crop'||o.type==='exclude'){
      const r=toViewportRect(o.geometry.rect,scale);
      const st=o.style;
      if(st.fill){ctx.globalAlpha=st.fill.opacity??1;ctx.fillStyle=st.fill.color;ctx.fillRect(r.x,r.y,r.w,r.h);}
      if(st.stroke){ctx.globalAlpha=st.stroke.opacity??1;ctx.strokeStyle=st.stroke.color;ctx.lineWidth=(st.stroke.width||1);ctx.setLineDash(st.stroke.style==='dashed'?[8,5]:st.stroke.style==='dotted'?[2,4]:[]);ctx.strokeRect(r.x,r.y,r.w,r.h);}      
      if(o.type==='box' && o.content?.label){ctx.globalAlpha=1;ctx.setLineDash([]);ctx.font='12px Inter, sans-serif';const text=o.content.label;const tw=ctx.measureText(text).width;const pad=6;const lh=18;const tx=r.x;const ty=Math.max(0, r.y - lh - 4);ctx.fillStyle='rgba(16,19,26,.9)';ctx.fillRect(tx,ty,tw+pad*2,lh);ctx.strokeStyle='#5ea9ff';ctx.strokeRect(tx,ty,tw+pad*2,lh);ctx.fillStyle='#dbe9ff';ctx.textBaseline='middle';ctx.fillText(text,tx+pad,ty+lh/2);}      
      ctx.globalAlpha=1;ctx.setLineDash([]);
    } else if(o.type==='note'){
      const a=toViewportPoint(o.geometry.anchor,scale);ctx.save();ctx.translate(a.x,a.y);ctx.rotate((o.style.rotation||0)*Math.PI/180);ctx.font=`${o.style.font.weight} ${Math.round(o.style.font.size*scale)}px ${o.style.font.family}`;const w=ctx.measureText(o.content.text).width+(o.style.bg.padding*2);const h=Math.round(o.style.font.size*scale)+o.style.bg.padding*2; if(o.style.bg.enabled){ctx.globalAlpha=o.style.bg.opacity;ctx.fillStyle=o.style.bg.color;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,o.style.bg.radius);ctx.fill();ctx.globalAlpha=1;}ctx.fillStyle=o.style.font.color;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(o.content.text,0,0);ctx.restore();
    } else if(o.type==='measure'){
      const a=toViewportPoint(o.geometry.a,scale);const b=toViewportPoint(o.geometry.b,scale);ctx.strokeStyle=o.style.line.color;ctx.lineWidth=o.style.line.width;ctx.globalAlpha=o.style.line.opacity;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;const c=rectCenter({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)});ctx.fillStyle='#30d09f';ctx.fillText(distance(o.geometry.a,o.geometry.b).toFixed(1),c.x,c.y-6);
    }

    if(selected.includes(o.id)&&o.geometry.rect){const r=toViewportRect(o.geometry.rect,scale);ctx.strokeStyle='#65b6ff';ctx.setLineDash([6,4]);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.setLineDash([]);}
  }

  drawEntityDebug(ctx, view.entityDebug, scale);
}
