export const saveLocal=(state)=>localStorage.setItem('overlay-manager-project',JSON.stringify(state));
export const loadLocal=()=>{try{return JSON.parse(localStorage.getItem('overlay-manager-project'));}catch{return null;}};
