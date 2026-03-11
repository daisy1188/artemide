export const buildTextIndex=(items)=>items.map((x,i)=>({...x,norm:x.text.toLowerCase(),_i:i}));
export const queryText=(idx,q)=>idx.filter(i=>i.norm.includes(q.toLowerCase()));
