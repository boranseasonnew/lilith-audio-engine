export default async function browserCase(page,fixture,url='http://127.0.0.1:3340/'){
  const requests=[],errors=[],downloads=[];const onRequest=r=>requests.push({method:r.method(),url:r.url()});const onError=e=>errors.push(e.message);
  page.on('request',onRequest);page.on('pageerror',onError);
  try{
    await page.goto(url);await page.locator('#lilith-file').waitFor();
    if(requests.some(r=>r.url.includes('huggingface.co')||r.url.includes('audio-export-worker.js')))throw Error('Eager model or codec download.');
    if(await page.locator('#studio select,#studio input[type=radio]').count())throw Error('Manual action/model selection remains.');
    await page.locator('#lilith-file').setInputFiles(fixture);
    await page.waitForFunction(()=>document.querySelector('#studio')?.dataset.state==='results'||document.querySelector('.status')?.textContent?.startsWith('Unable to process'),null,{timeout:600000});
    if(await page.locator('.status').textContent()!=='Ready for playback')throw Error(await page.locator('.status').textContent());
    const rows=page.locator('.stem-card');if(await rows.locator('canvas').count()!==2)throw Error('Real waveform pair missing.');
    await rows.nth(0).getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.track-clock')?.textContent?.startsWith('0:01'),null,{timeout:15000});
    await rows.nth(1).getByRole('button',{name:'Play',exact:true}).click();
    const clocks=await rows.locator('.track-clock').allTextContents();if(clocks[0]!==clocks[1]||await page.locator('[data-playing=true]').count()!==2)throw Error('Concurrent aligned playback failed.');
    await rows.nth(0).getByRole('button',{name:'Pause',exact:true}).click();if(await rows.nth(1).getAttribute('data-playing')!=='true')throw Error('Pausing vocals stopped music.');
    await rows.nth(1).getByRole('button',{name:'Pause',exact:true}).click();
    await rows.nth(0).locator('.seek').fill('2');await rows.nth(0).locator('.seek').dispatchEvent('input');
    await page.waitForFunction(()=>document.querySelector('.track-clock')?.textContent?.startsWith('0:02'));
    await rows.nth(0).getByRole('button',{name:'Mute',exact:true}).click();if(await rows.nth(0).locator('[aria-pressed=true]').count()!==1)throw Error('Mute failed.');
    await rows.nth(0).getByRole('button',{name:'Vocals Download',exact:true}).click();await page.keyboard.press('Escape');
    if(await page.locator('.export-dialog').isVisible()||await page.evaluate(()=>document.activeElement.getAttribute('aria-label'))!=='Vocals Download')throw Error('Dialog dismissal/focus failed.');
    for(const format of ['mp3','flac','wav']){
      await rows.nth(0).getByRole('button',{name:'Vocals Download',exact:true}).click();const wait=page.waitForEvent('download',{timeout:60000});await page.locator(`[data-format=${format}]`).click();const d=await wait;
      if(await d.failure())throw Error('Download failed: '+format);downloads.push(d.suggestedFilename());
    }
    const zipWait=page.waitForEvent('download');await page.getByRole('button',{name:'Download Both · ZIP',exact:true}).click();downloads.push((await zipWait).suggestedFilename());
    await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow.');
    if(requests.some(r=>r.method!=='GET')||errors.length)throw Error(JSON.stringify({requests,errors}));
    return {status:'PASS',measurement:await page.locator('.results .model-info').textContent(),alignedClocks:clocks,independentPause:true,seek:'0:02',mute:true,dialogFocus:true,downloads,mobileOverflow:false,requests:requests.map(r=>({method:r.method,url:r.url.split('?')[0]})),errors};
  }finally{page.off('request',onRequest);page.off('pageerror',onError);}
}
