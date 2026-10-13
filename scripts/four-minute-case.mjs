// Invoke startFourMinuteCase through the available browser harness after
// selecting an authorized short WAV. Poll readFourMinuteCase without blocking
// the UI driver; no fixture is uploaded or redistributed.
export async function startFourMinuteCase(page,backend='webgpu') {
  return page.evaluate(async backend=>{
    const sdk=await import('/engine/index.js'),file=document.querySelector('input[type=file]')?.files?.[0];
    if(!file)throw Error('Select an authorized short fixture first.');
    const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(await file.arrayBuffer());
    const channels=[0,1].map(ch=>{const pcm=new Float32Array(44100*240),source=audio.getChannelData(Math.min(ch,audio.numberOfChannels-1));for(let start=0;start<pcm.length;start+=source.length)pcm.set(source.subarray(0,Math.min(source.length,pcm.length-start)),start);return pcm;});
    const input=new File([sdk.encodeWav(channels,44100)],'authorized-240s.wav',{type:'audio/wav'}),engine=await sdk.createSeparator({backend});
    window.lilithLongTest={state:'running',bytes:input.size,started:performance.now()};
    window.lilithLongJob=engine.separate(input,{onProgress:event=>window.lilithLongTest.progress=event}).then(async result=>{
      try{
        let finite=true,peak=0;for(const stem of [result.vocals,result.instrumental])for(const channel of stem.channels)for(const x of channel){finite&&=Number.isFinite(x);peak=Math.max(peak,Math.abs(x));}
        const metrics={duration:result.vocals.duration,frames:result.vocals.channels[0].length,finite,peak,metadata:result.metadata,wavBytes:result.exportWav('vocals').size,zipBytes:(await result.exportZip('four-minutes')).size};
        if(!finite||peak>1.00001||metrics.duration!==240||metrics.frames!==10584000)throw Error('Invalid four-minute output.');
        window.lilithLongTest={...window.lilithLongTest,...metrics,state:'passed',wallSeconds:(performance.now()-window.lilithLongTest.started)/1000};
      }finally{result.dispose();}
    }).catch(error=>{window.lilithLongTest={...window.lilithLongTest,state:'failed',error:error.message};}).finally(()=>engine.dispose());
    return window.lilithLongTest;
  },backend);
}
export function readFourMinuteCase(page){return page.evaluate(()=>window.lilithLongTest);}
