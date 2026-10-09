const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.join(process.env.TEMP, 'rcs-portfolio-video-tools', 'package.json'));
const { chromium } = req('playwright');
const out = __dirname;
const raw = path.join(out, 'raw');
fs.mkdirSync(raw, {recursive:true});
const metadata = {capturedAt:new Date().toISOString(),origin:'http://localhost:3000',viewport:{width:1440,height:800},clips:{}};
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let browser;
async function newShot(name,url) {
  const context = await browser.newContext({viewport:metadata.viewport,deviceScaleFactor:1,recordVideo:{dir:raw,size:metadata.viewport}});
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded',()=>{
      const css=document.createElement('style');css.textContent='nextjs-portal{display:none!important}';document.head.append(css);
      const cursor=document.createElement('div');cursor.id='portfolio-cursor';cursor.style.cssText='position:fixed;left:-90px;top:-90px;width:20px;height:20px;pointer-events:none;z-index:2147483647;border:3px solid #bfe93a;border-radius:50%;background:#bfe93a22;box-shadow:0 0 0 5px #10203422;transform:translate(-50%,-50%);transition:width .12s,height .12s';document.body.append(cursor);
      document.addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});
      document.addEventListener('mousedown',()=>{cursor.style.width='30px';cursor.style.height='30px'});
      document.addEventListener('mouseup',()=>{cursor.style.width='20px';cursor.style.height='20px'});
    });
  });
  const page=await context.newPage();
  const start=Date.now();
  const clip={file:null,marks:{}};metadata.clips[name]=clip;
  const mark=key=>{clip.marks[key]=(Date.now()-start)/1000;console.log(name,key,clip.marks[key]);};
  await page.goto(metadata.origin+url,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await sleep(800);
  mark('ready');
  return {page,mark,clip,async close(){await page.screenshot({path:path.join(out,`inspect-${name}.png`)});clip.text=(await page.locator('body').innerText()).slice(0,14000);mark('end');await context.close();clip.file=path.relative(out,await page.video().path());fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(metadata,null,2));}};
}
async function point(page,locator) {
 const b=await locator.boundingBox(); if(b) await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:26});
}
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const shot=await newShot('targeting','/');const {page,mark,clip}=shot;
 await sleep(1500);
 await point(page,page.locator('#prompt'));await page.locator('#prompt').click();
 const prompt='30대 여성 고객을 찾아줘';
 mark('typing');await page.locator('#prompt').pressSequentially(prompt,{delay:95});
 await sleep(1300);await point(page,page.getByRole('button',{name:'타겟 추출하기',exact:true}));
 mark('submit');await page.getByRole('button',{name:'타겟 추출하기',exact:true}).click();
 await sleep(2500);await page.mouse.move(1015,180,{steps:20});
 await page.getByRole('heading',{name:'타겟 결과를 확인해 보세요'}).waitFor({timeout:240000});
 mark('result');await sleep(2500);
 await page.screenshot({path:path.join(out,'inspect-result.png')});
 clip.resultText=(await page.locator('body').innerText()).slice(0,15000);
 console.log('RESULT',clip.resultText.slice(0,6500));
 await sleep(3000);mark('resultScroll');await page.mouse.wheel(0,460);await sleep(4500);await page.screenshot({path:path.join(out,'inspect-audience.png')});
 mark('resultReturn');await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await sleep(1800);await shot.close();
 await browser.close();console.log('Capture complete');
})().catch(async e=>{console.error(e);fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(metadata,null,2));if(browser)await browser.close();process.exit(1)});
