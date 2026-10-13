import {createSeparator,SynchronizedPlayer} from '@lilith/audio-engine';
export async function processLocalFile(file:File,signal:AbortSignal){
  const separator=await createSeparator({model:'mdx-default',backend:'auto'});
  try{
    const result=await separator.separate(file,{signal,onProgress:event=>console.log(event.stage,event.progress)});
    return {result,createPlayer:()=>new SynchronizedPlayer(result),zip:()=>result.exportZip(file.name)};
  }finally{await separator.dispose();}
}
