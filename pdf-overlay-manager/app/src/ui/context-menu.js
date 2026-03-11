export function contextMenu(items){const txt=items.map((x,i)=>`${i+1}. ${x.label}`).join('\n');const pick=window.prompt(`Menu:\n${txt}`);const idx=Number(pick)-1;if(items[idx])items[idx].onClick();}
