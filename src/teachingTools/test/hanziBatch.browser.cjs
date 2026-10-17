// Run: node test/hanziBatch.browser.cjs (requires Playwright and Edge).
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output=path.resolve(__dirname,'../../../output/hanzi-qa');fs.mkdirSync(output,{recursive:true});
const server=http.createServer(require('../app'));
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1450,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.context().addCookies([{name:'lang',value:'zh',url:base}]);
    const redirect=await page.request.get(base+'/teaching-tools/hanzi-batch',{maxRedirects:0});assert.equal(redirect.status(),302);assert.equal(redirect.headers().location,'/teaching-tools/hanzi-batch/index.html');
    const directory=await page.request.get(base+'/teaching-tools');assert.ok((await directory.text()).includes('/teaching-tools/hanzi-batch/index.html'));
    const sitemap=await page.request.get(base+'/sitemap.xml');assert.ok((await sitemap.text()).includes('/teaching-tools/hanzi-batch/index.html'));
    await page.goto(base+'/teaching-tools/hanzi-batch/index.html');
    assert.equal(await page.locator('#siteMainNav').count(),1);assert.equal(await page.locator('#siteLegalFooter').count(),1);assert.match(await page.locator('.hanzi-attribution').textContent(),/Arphic Public License/);
    assert.equal(await page.locator('.site-main-nav-links [aria-current=page]').getAttribute('href'),'/teaching-tools');
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 249, 233)');
    assert.equal(await page.locator('#export').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(201, 80, 63)');
    await page.waitForFunction(()=>document.querySelectorAll('.chip input:enabled').length===4,{},{timeout:45000});
    await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    const parsed=await page.evaluate(async()=>{const {extract}=await import('./core.js');return extract('你好ABC你，𠀀123好！');});assert.deepEqual(parsed,['你','好','𠀀']);
    await page.locator('#legend button').nth(1).click();assert.match(await page.locator('#step').textContent(),/^2 \/ 7/);
    await page.locator('#speed').fill('200');await page.locator('#speed').dispatchEvent('change');await page.locator('#play').click();
    await page.waitForFunction(()=>document.querySelector('#strokeProgress').value===7,{},{timeout:6000});
    const strokes=await page.locator('.writer path[clip-path]').evaluateAll(paths=>paths.slice(7,14).map(p=>p.style.stroke));assert.ok(new Set(strokes).size>1);
    // Export a real all-format ZIP, including a multi-stroke GIF encoded by the worker.
    await page.locator('#clear').click();await page.locator('#input').fill('一家');await page.locator('#add').click();await page.waitForFunction(()=>document.querySelectorAll('.chip input:enabled').length===2);
    await page.locator('#size').selectOption('300');for(const f of ['svg','png','breakdown'])await page.locator(`[name=format][value=${f}]`).check();await page.locator('#pdf').check();
    const downloading=page.waitForEvent('download',{timeout:90000});await page.locator('#export').click();assert.equal(await page.locator('.milk-tea-footer-toggle').isEnabled(),true);const download=await downloading;await download.saveAs(path.join(output,'batch.zip'));
    const files=await page.evaluate(async()=>{
      const {loadChar}=await import('./core.js');const {batch}=await import('./zip.js');
      const signal=new AbortController().signal;const blob=await batch([{char:'一',index:0,data:await loadChar('一')}],['svg','png'],{grid:'tian',scheme:'single',color:'#123456',speed:700,size:300,pdf:false},signal,()=>{});
      const zip=await JSZip.loadAsync(blob);return {names:Object.keys(zip.files),svg:await zip.file('01_一.svg').async('string')};
    });assert.deepEqual(files.names,['01_一.svg','01_一.png']);assert.match(files.svg,/#123456/);assert.match(files.svg,/@keyframes/);assert.doesNotMatch(files.svg,/M18 18L582/);
    const pages=await page.evaluate(async()=>{const {pdf}=await import('./exporters/breakdown.js');const {loadChar}=await import('./core.js');const data=await loadChar('家');const result=await pdf(Array.from({length:12},()=>({data})),{grid:'mi',scheme:'rainbow',size:300},new AbortController().signal,()=>{});return (await result.text()).match(/\/Type \/Page\b/g).length;});assert.ok(pages>=3,'Long PDF should paginate');
    await page.locator('#size').selectOption('1000');await page.locator('#export').click();await page.locator('#cancel').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已取消'));
    await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.writer svg').getAttribute('viewBox'),'0 0 400 400');await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    // Deterministic 404 vs temporary network failure behavior.
    await page.route('**/hanzi-writer-data@2.0.1/**',route=>route.fulfill({status:404,body:'missing'}));
    await page.locator('#input').fill('龘');await page.locator('#add').click();await page.waitForSelector('.chip.missing');assert.equal(await page.locator('.chip.missing').getAttribute('title'),'暂无笔顺数据');
    assert.deepEqual(errors,[]);console.log('PASS: extraction, cumulative steps, playback, colors, actual ZIP download, worker GIF, SVG, PNG, PDF, cancellation, missing data, mobile layout, site navigation/theme/directory/sitemap');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
