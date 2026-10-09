const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{createRequire}=require('node:module');
const req=createRequire(path.join(process.env.TEMP,'rcs-portfolio-video-tools','package.json'));
const {chromium}=req('playwright'),ffmpeg=req('ffmpeg-static');
const out=__dirname,FPS=30,DURATION=45,OUTRO_START=40;
const capture=JSON.parse(fs.readFileSync(path.join(out,'capture.json'),'utf8'));
const c=capture.clips,m=c.targeting.marks;
const scenes=[
 {id:'input',number:'01',tag:'INPUT',start:5,end:15,clip:'targeting',from:m.ready,to:m.submit+.25,route:'',title:'찾고 싶은 고객을 한 문장으로',caption:'원하는 고객 조건을 <b>자연어로 입력</b>합니다.'},
 {id:'processing',number:'02',tag:'PROCESS',start:15,end:22,clip:'targeting',from:m.submit+.3,to:m.result-.1,route:'',title:'조건 해석부터 SQL 생성·검증까지',caption:'요청이 처리되는 과정을 <b>단계별로 확인</b>합니다.',note:'실제 화면 녹화 · 처리 대기 구간 축약'},
 {id:'result',number:'03',tag:'RESULT',start:22,end:32,clip:'targeting',from:m.result+.6,to:m.resultScroll-.2,route:'',title:'생성된 SQL과 추출 결과를 함께',caption:'<b>타겟 고객 수와 실행된 SQL</b>을 한 화면에서 확인합니다.',zoom:.025},
 {id:'audience',number:'03',tag:'AUDIENCE',start:32,end:40,clip:'targeting',from:m.resultScroll+.8,to:m.resultReturn-.2,route:'',title:'선택된 고객을 더 깊이 이해하기',caption:'연령·지역·등급별 분포로 <b>오디언스의 특성</b>을 살펴봅니다.'}
];
fs.writeFileSync(path.join(out,'edit.json'),JSON.stringify({duration:DURATION,outroStart:OUTRO_START,fps:FPS,clips:{targeting:c.targeting},scenes},null,2));
const time=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
const subs=[{start:0,end:5,caption:'한 문장으로, 타겟 고객을 찾다.\n자연어 조건을 SQL과 오디언스로.'},...scenes,{start:OUTRO_START,end:DURATION,caption:'조건은 자연스럽게. 결과는 명확하게.\nTARGET LAB'}];
fs.writeFileSync(path.join(out,'target-lab-targeting.ko.srt'),subs.map((s,i)=>`${i+1}\n${time(s.start)} --> ${time(s.end)}\n${s.caption.replace(/<[^>]*>/g,'')}\n`).join('\n'),'utf8');
function music(){
 const sr=44100,n=sr*DURATION,left=new Float32Array(n),right=new Float32Array(n),beat=.6;
 const add=(start,duration,fn,pan=0)=>{const a=Math.round(start*sr),b=Math.min(n,a+Math.round(duration*sr));for(let i=Math.max(0,a);i<b;i++){const v=fn((i-a)/sr);left[i]+=v*(1-pan*.35);right[i]+=v*(1+pan*.35)}};
 const freq=m=>440*Math.pow(2,(m-69)/12);
 const chords=[[62,66,69,73],[57,61,64,69],[59,62,66,69],[55,59,62,66]];
 for(let bar=0;bar<Math.ceil(DURATION/(beat*4));bar++){
   const start=bar*beat*4,chord=chords[Math.floor(bar/2)%4];
   for(let j=0;j<4;j++) {const f=freq(chord[j]);add(start,3,t=>.017*Math.min(1,t/.32)*Math.max(0,1-t/3)*(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*1.002*t)),(j-1.5)/2)}
   for(let k=0;k<8;k++){const f=freq(chord[[0,2,1,3,2,1,3,2][k]]+12);add(start+k*beat/2,1.15,t=>.048*(1-Math.exp(-t*100))*Math.exp(-t*5.8)*(Math.sin(2*Math.PI*f*t)+.18*Math.sin(2*Math.PI*f*2*t)),k%2?.65:-.65)}
   for(let k=0;k<4;k++){add(start+k*beat,.18,t=>.05*Math.sin(2*Math.PI*(48*t+2.2*(1-Math.exp(-t*38))))*Math.exp(-t*27));const f=freq(chord[0]-24);add(start+k*beat,.48,t=>.035*(1-Math.exp(-t*90))*Math.exp(-t*7)*Math.sin(2*Math.PI*f*t));}
 }
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
 const gain=.57/Math.max(.57,peak),buffer=Buffer.alloc(44+n*4);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(sr,24);buffer.writeUInt32LE(sr*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){let t=i/sr,envelope=Math.min(1,t/1.8)*Math.min(1,(DURATION-t)/2.2)*gain;buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left[i]*envelope))*32767),44+i*4);buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right[i]*envelope))*32767),46+i*4)}
 fs.writeFileSync(path.join(out,'soundtrack-original.wav'),buffer);console.log('Original synth soundtrack generated, peak',peak.toFixed(3));
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
 const args=['-hide_banner','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-i',path.join(out,'soundtrack-original.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','aac','-b:a','192k','-af','loudnorm=I=-21:TP=-2:LRA=8','-t',String(DURATION),'-movflags','+faststart','-metadata','title=TARGET LAB | Target Creation','-metadata','comment=Target creation only. Actual localhost capture. Processing wait condensed. Original synthesized soundtrack.',path.join(out,'target-lab-targeting-1080p.mp4')];
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
