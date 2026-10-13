import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const fixture=process.env.LILITH_TEST_AUDIO;
if(!fixture)throw new Error('Set LILITH_TEST_AUDIO to an absolute path of a short authorized audio fixture. Nothing is uploaded or downloaded as a fixture.');
const name=process.env.LILITH_BROWSER??'chromium',type=name==='firefox'?firefox:chromium;
const browser=await type.launch({headless:true,executablePath:process.env.LILITH_BROWSER_EXECUTABLE||undefined,args:name==='chromium'?['--enable-unsafe-webgpu','--use-angle=d3d11']:[]});
try{
  const page=await browser.newPage(),requests=[],errors=[];
  page.on('request',request=>requests.push({method:request.method(),url:request.url()}));page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.LILITH_TEST_URL??'http://127.0.0.1:3340/');
  assert.ok(requests.every(r=>!r.url.includes('huggingface.co')),'No model request before user action');
  await page.locator('input[type=file]').setInputFiles(fixture);
  const backend=process.env.LILITH_TEST_BACKEND??'auto';await page.locator('select').nth(1).selectOption(backend);
  await page.getByRole('button',{name:'Separate audio',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.status')?.textContent==='Ready for playback'||document.querySelector('.status')?.textContent?.startsWith('Unable to process'),null,{timeout:10*60*1000});
  assert.equal(await page.locator('.status').textContent(),'Ready for playback');assert.equal(await page.locator('canvas').count(),2);
  await page.getByRole('button',{name:'Play Both',exact:true}).click();
  await page.waitForFunction(()=>{const clock=document.querySelector('.player-controls span');return clock&&!clock.textContent.startsWith('0:00');},null,{timeout:15000});
  assert.ok(!(await page.locator('.player-controls').first().locator('span').first().textContent()).startsWith('0:00'));
  const pause=page.getByRole('button',{name:'Pause Both',exact:true});if(await pause.count())await pause.click();
  await page.locator('.stem-card > input').first().fill('2');await page.locator('.stem-card > input').first().dispatchEvent('input');
  await page.waitForFunction(()=>document.querySelector('.player-controls span')?.textContent?.startsWith('0:02'));
  await page.locator('.stem-card').first().getByRole('button',{name:'Mute',exact:true}).click();assert.equal(await page.locator('[aria-pressed=true]').count(),1);
  const wavWait=page.waitForEvent('download');await page.locator('.stem-card').first().getByRole('button',{name:'Download WAV',exact:true}).click();const wav=await wavWait;
  const zipWait=page.waitForEvent('download');await page.getByRole('button',{name:'Download Both · ZIP',exact:true}).click();const zip=await zipWait;
  mkdirSync('test-results',{recursive:true});await wav.saveAs('test-results/actual-stem.wav');await zip.saveAs('test-results/actual-stems.zip');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'test-results/studio-mobile.png',fullPage:true});
  assert.ok(requests.every(r=>r.method==='GET'),'No audio/network POST');assert.equal(errors.length,0);
  const measurement=await page.locator('.results .model-info').textContent();
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
