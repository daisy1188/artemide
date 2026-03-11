export function bindShortcuts({store,setTool,viewer,deleteSelection}){window.addEventListener('keydown',(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)store.redo(); else store.undo();}
if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();store.redo();}
if(e.key==='Delete')deleteSelection();if(e.key==='Escape')setTool('select');
if(e.key==='1')setTool('select');if(e.key==='2')setTool('pan');if(e.key==='3')setTool('box');if(e.key==='4')setTool('note');if(e.key==='5')setTool('measure');if(e.key==='6')setTool('crop');if(e.key==='7')setTool('exclude');
if(e.key===' ')viewer.host.dataset.spacePan='1';});window.addEventListener('keyup',e=>{if(e.key===' ')viewer.host.dataset.spacePan='0';});}
