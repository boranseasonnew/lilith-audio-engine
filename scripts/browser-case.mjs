export default async function browserCase(page,fixture){
  const requests=[],errors=[];const onRequest=r=>requests.push({method:r.method(),url:r.url()});const onError=e=>errors.push(e.message);
  page.on('request',onRequest);page.on('pageerror',onError);
  try{
    await page.goto('http://127.0.0.1:3340/');
    if(requests.some(r=>r.url.includes('huggingface.co')))throw Error('Eager model download.');
    await page.locator('input[type=file]').setInputFiles(fixture);await page.getByRole('button',{name:'Separate audio',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.status')?.textContent==='Ready for playback'||document.querySelector('.status')?.textContent?.startsWith('Unable to process'),null,{timeout:600000});
    if(await page.locator('.status').textContent()!=='Ready for playback')throw Error(await page.locator('.status').textContent());
    if(await page.locator('canvas').count()!==2)throw Error('Waveforms missing.');
    await page.getByRole('button',{name:'Play Both',exact:true}).click();await page.waitForTimeout(1400);
    const playback=await page.locator('.player-controls').first().locator('span').first().textContent();if(playback.startsWith('0:00'))throw Error('Playback clock did not advance.');
    const pause=page.getByRole('button',{name:'Pause Both',exact:true});if(await pause.count())await pause.click();
    await page.locator('.stem-card > input').first().fill('2');await page.locator('.stem-card > input').first().dispatchEvent('input');
    await page.waitForFunction(()=>document.querySelector('.player-controls span')?.textContent?.startsWith('0:02'));
    await page.locator('.stem-card').first().getByRole('button',{name:'Mute',exact:true}).click();
    if(await page.locator('[aria-pressed=true]').count()!==1)throw Error('Mute control failed.');
    const wavWait=page.waitForEvent('download');await page.locator('.stem-card').first().getByRole('button',{name:'Download WAV',exact:true}).click();const wav=await wavWait;
    const zipWait=page.waitForEvent('download');await page.getByRole('button',{name:'Download Both · ZIP',exact:true}).click();const zip=await zipWait;
    await page.setViewportSize({width:390,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow.');
    const measurement=await page.locator('.results .model-info').textContent();
    if(requests.some(r=>r.method!=='GET')||errors.length)throw Error(JSON.stringify({requests,errors}));
    return {status:'PASS',measurement,playback,seek:'0:02',mute:true,waveforms:2,mobileOverflow:false,wavName:wav.suggestedFilename(),zipName:zip.suggestedFilename(),requests,errors};
  }finally{page.off('request',onRequest);page.off('pageerror',onError);}
}
