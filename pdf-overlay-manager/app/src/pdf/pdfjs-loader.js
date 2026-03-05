let loading;
export async function loadPdfJs(){
  if(loading) return loading;
  loading=(async()=>{
    try{
      const mod=await import('../../vendor/pdfjs/pdf.mjs');
      mod.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.mjs';
      return mod;
    }catch(e){
      console.error('PDF.js load failed',e);
      throw new Error('PDF.js worker non disponibile');
    }
  })();
  return loading;
}
