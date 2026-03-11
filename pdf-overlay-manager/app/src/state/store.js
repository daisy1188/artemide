import { defaultProject } from './schema.js';
import { History } from './history.js';

export function createStore(){
  let state=defaultProject();
  const listeners=new Set();
  const history=new History();
  const notify=()=>listeners.forEach(l=>l(state));
  return {
    getState:()=>state,
    setState:(updater,{historyPush=true}={})=>{if(historyPush)history.push(state);state=typeof updater==='function'?updater(structuredClone(state)):updater;notify();},
    subscribe:(fn)=>{listeners.add(fn);return()=>listeners.delete(fn);},
    undo:()=>{state=history.undo(state);notify();},
    redo:()=>{state=history.redo(state);notify();}
  };
}
