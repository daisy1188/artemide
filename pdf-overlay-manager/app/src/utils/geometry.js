export const pointInRect=(p,r)=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h;
export const rectCenter=(r)=>({x:r.x+r.w/2,y:r.y+r.h/2});
export const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
