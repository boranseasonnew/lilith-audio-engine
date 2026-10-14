import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import browserCase from './browser-case.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const fixture=process.env.LILITH_TEST_AUDIO;
if(!fixture)throw new Error('Set LILITH_TEST_AUDIO to an absolute path of a short authorized audio fixture. Nothing is uploaded or downloaded as a fixture.');
const name=process.env.LILITH_BROWSER??'chromium',type=name==='firefox'?firefox:chromium;
const browser=await type.launch({headless:true,executablePath:process.env.LILITH_BROWSER_EXECUTABLE||undefined,args:name==='chromium'?['--enable-unsafe-webgpu','--use-angle=d3d11']:[]});
try{
  const page=await browser.newPage();const studio=await browserCase(page,fixture,process.env.LILITH_TEST_URL??'http://127.0.0.1:3340/');
  const {requests,errors,measurement}=studio;const backend=process.env.LILITH_TEST_BACKEND??'auto';
  mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/studio-mobile.png',fullPage:true});
  // Public SDK outside Studio: real File input, exact aligned PCM and valid WAV/ZIP.
  const metrics=await page.evaluate(async(backend)=>{
    const sdk=await import('./engine/index.js'),engine=await sdk.createSeparator({backend});
    const result=await engine.separate(document.querySelector('input[type=file]').files[0]);
    let finite=true,peak=0;for(const stem of [result.vocals,result.instrumental])for(const channel of stem.channels)for(const sample of channel){finite&&=Number.isFinite(sample);peak=Math.max(peak,Math.abs(sample));}
    const info={metadata:result.metadata,duration:result.vocals.duration,frames:result.vocals.channels[0].length,finite,peak,wavBytes:result.exportWav('vocals').size,zipBytes:(await result.exportZip('test.wav')).size};
    result.dispose();await engine.dispose();return info;
  },backend);
  assert.ok(metrics.finite&&metrics.peak>0&&metrics.peak<=1.00001);assert.equal(metrics.frames,Math.round(metrics.duration*44100));assert.ok(metrics.wavBytes>44);
  const report={status:'PASS',browser:name,browserVersion:browser.version(),backend,measurement,metrics,requests,errors};writeFileSync('test-results/inference.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,requests:requests.length},null,2));
}finally{await browser.close();}
