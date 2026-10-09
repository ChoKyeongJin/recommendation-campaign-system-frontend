const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{createRequire}=require('node:module');
const req=createRequire(path.join(process.env.TEMP,'rcs-portfolio-video-tools','package.json'));
const {chromium}=req('playwright'),ffmpeg=req('ffmpeg-static');
const {createPianoSoundtrack}=require('./piano-music.cjs');
const AUDIO_FILTER='highpass=f=55,lowpass=f=5500,loudnorm=I=-29:TP=-9:LRA=4';
const AUDIO_CREDIT='Original piano arrangement. Samples: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 https://creativecommons.org/licenses/by/3.0/ ; source: https://archive.org/details/SalamanderGrandPianoV3 . Notes sequenced, pitch-adjusted and mixed for this video. Actual localhost capture; processing wait condensed.';
const audioOnly=process.argv.includes('--audio-only');
const out=__dirname,FPS=30,DURATION=45,OUTRO_START=40;
const capture=JSON.parse(fs.readFileSync(path.join(out,'capture.json'),'utf8'));
const c=capture.clips,m=c.targeting.marks;
const scenes=[
 {id:'input',number:'01',tag:'INPUT',start:5,end:15,clip:'targeting',from:m.ready,to:m.submit+.25,route:'',title:'찾고 싶은 고객을 한 문장으로',caption:'원하는 고객 조건을 <b>자연어로 입력</b>합니다.'},
 {id:'processing',number:'02',tag:'PROCESS',start:15,end:22,clip:'targeting',from:m.submit+.3,to:m.result-.1,route:'',title:'조건 해석부터 SQL 생성·검증까지',caption:'요청이 처리되는 과정을 <b>단계별로 확인</b>합니다.',note:'실제 화면 녹화 · 처리 대기 구간 축약'},
 {id:'result',number:'03',tag:'RESULT',start:22,end:32,clip:'targeting',from:m.result+.6,to:m.resultScroll-.2,route:'',title:'생성된 SQL과 추출 결과를 함께',caption:'<b>타겟 고객 수와 실행된 SQL</b>을 한 화면에서 확인합니다.',zoom:.025},
 {id:'audience',number:'03',tag:'AUDIENCE',start:32,end:40,clip:'targeting',from:m.resultScroll+.8,to:m.resultReturn-.2,route:'',title:'선택된 고객을 더 깊이 이해하기',caption:'연령·지역·등급별 분포로 <b>오디언스의 특성</b>을 살펴봅니다.'}
];
if(!audioOnly)fs.writeFileSync(path.join(out,'edit.json'),JSON.stringify({duration:DURATION,outroStart:OUTRO_START,fps:FPS,clips:{targeting:c.targeting},scenes},null,2));
const time=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
const subs=[{start:0,end:5,caption:'한 문장으로, 타겟 고객을 찾다.\n자연어 조건을 SQL과 오디언스로.'},...scenes,{start:OUTRO_START,end:DURATION,caption:'조건은 자연스럽게. 결과는 명확하게.\nTARGET LAB'}];
if(!audioOnly)fs.writeFileSync(path.join(out,'target-lab-targeting.ko.srt'),subs.map((s,i)=>`${i+1}\n${time(s.start)} --> ${time(s.end)}\n${s.caption.replace(/<[^>]*>/g,'')}\n`).join('\n'),'utf8');
function music(){
 createPianoSoundtrack({ffmpeg,output:path.join(out,'soundtrack-original.wav'),duration:DURATION});
}
const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.webm':'video/webm','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let file=req.url==='/font.woff2'?path.resolve(out,'../../public/fonts/PretendardVariable.woff2'):path.resolve(out,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(out)&&!file.endsWith('PretendardVariable.woff2')){res.writeHead(403).end();return}
 if(!fs.existsSync(file)){res.writeHead(404).end();return}
 const size=fs.statSync(file).size,range=req.headers.range;res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
 if(range){const [,a,b]=range.match(/bytes=(\d+)-(\d*)/);const start=Number(a),end=b?Math.min(Number(b),size-1):size-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res)}else{res.writeHead(200,{'Content-Length':size});fs.createReadStream(file).pipe(res)}
});
(async()=>{
 if(audioOnly){
   music();
   const destination=path.join(out,'target-lab-targeting-1080p.mp4');
   const temporary=path.join(out,'target-lab-targeting-audio-update.mp4');
   const args=['-hide_banner','-y','-i',destination,'-i',path.join(out,'soundtrack-original.wav'),'-map','0:v:0','-map','1:a:0','-map_metadata','0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-af',AUDIO_FILTER,'-t',String(DURATION),'-movflags','+faststart','-metadata','comment='+AUDIO_CREDIT,temporary];
   const encoder=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});let log='';encoder.stderr.on('data',d=>log+=d);
   await new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(new Error('Audio update failed: '+log)))});
   fs.renameSync(temporary,destination);console.log('Audio updated; video stream copied without re-encoding.');return;
 }
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--hide-scrollbars','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error('PAGE',e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/film.html`);await page.evaluate(()=>window.init());
 fs.mkdirSync(path.join(out,'review'),{recursive:true});
 for(const t of [2.7,10,18,27,36,42]) {await page.evaluate(t=>window.renderFrame(t),t);await page.screenshot({path:path.join(out,'review',`targeting-frame-${String(t).replace('.','-')}.jpg`),type:'jpeg',quality:90});}
 await page.evaluate(()=>window.renderFrame(2.7));await page.screenshot({path:path.join(out,'target-lab-thumbnail.png')});
 if(process.argv.includes('--preview')){await browser.close();server.close();console.log('Preview frames ready');return}
 music();
 const args=['-hide_banner','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-i',path.join(out,'soundtrack-original.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','aac','-b:a','192k','-ar','48000','-af',AUDIO_FILTER,'-t',String(DURATION),'-movflags','+faststart','-metadata','title=TARGET LAB | Target Creation','-metadata','comment='+AUDIO_CREDIT,path.join(out,'target-lab-targeting-1080p.mp4')];
 const encoder=spawn(ffmpeg,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});let log='';encoder.stderr.on('data',d=>{log+=d;fs.writeFileSync(path.join(out,'encode.log'),log)});
 const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(new Error('ffmpeg '+code+'\n'+log.slice(-2000))))});
 const started=Date.now();
 for(let i=0;i<DURATION*FPS;i++){
   await page.evaluate(t=>window.renderFrame(t),i/FPS);
   const frame=await page.screenshot({type:'jpeg',quality:94,animations:'disabled'});
   if(!encoder.stdin.write(frame))await new Promise(r=>encoder.stdin.once('drain',r));
   if(i%(FPS*5)===0)console.log(`Rendered ${(i/FPS).toFixed(0)}/${DURATION}s, elapsed ${((Date.now()-started)/1000).toFixed(0)}s`);
 }
 encoder.stdin.end();await done;await browser.close();server.close();console.log('Film complete',path.join(out,'target-lab-targeting-1080p.mp4'));
})().catch(e=>{console.error(e);server.close();process.exit(1)});
