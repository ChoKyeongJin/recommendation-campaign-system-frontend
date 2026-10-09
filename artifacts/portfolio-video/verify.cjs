const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
const req=createRequire(path.join(process.env.TEMP,'rcs-portfolio-video-tools','package.json')),ffmpeg=req('ffmpeg-static');
const file=path.join(__dirname,'target-lab-targeting-1080p.mp4');
const edit=JSON.parse(fs.readFileSync(path.join(__dirname,'edit.json'),'utf8'));
const result=spawnSync(ffmpeg,['-hide_banner','-xerror','-i',file,'-af','volumedetect','-f','null','-'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
fs.writeFileSync(path.join(__dirname,'review','targeting-decode-check.log'),result.stderr);
const checks={fullDecode:result.status===0,duration45:/Duration: 00:00:45\.00/.test(result.stderr),resolution1080:/1920x1080/.test(result.stderr),fps30:/30 fps/.test(result.stderr),h264:/Video: h264/.test(result.stderr),aac:/Audio: aac/.test(result.stderr),frames1350:/frame=\s*1350/.test(result.stderr),targetCreationOnly:edit.scenes.length===4&&edit.scenes.every(s=>s.clip==='targeting'&&s.route==='')&&Object.keys(edit.clips).join(',')==='targeting'};
if(Object.values(checks).some(v=>!v)){console.error(checks,result.stderr);process.exit(1)}
const frames=[81,300,540,810,1080,1260];
const sheet=spawnSync(ffmpeg,['-hide_banner','-y','-i',file,'-vf',`select='${frames.map(n=>`eq(n,${n})`).join('+')}',scale=640:360,tile=3x2`,'-frames:v','1','-update','1',path.join(__dirname,'review','targeting-contact-sheet.jpg')],{encoding:'utf8',windowsHide:true});
if(sheet.status!==0){console.error(sheet.stderr);process.exit(1)}
const report={verifiedAt:new Date().toISOString(),file:path.basename(file),bytes:fs.statSync(file).size,checks,audio:result.stderr.match(/mean_volume: [^\r\n]+|max_volume: [^\r\n]+/g)};
fs.writeFileSync(path.join(__dirname,'review','targeting-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
