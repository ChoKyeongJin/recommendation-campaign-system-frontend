const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, 'web', 'dist');
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'capture.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });
for (const name of ['target-lab-targeting-1080p.mp4', 'target-lab-thumbnail.png']) {
  fs.copyFileSync(path.join(__dirname, name), path.join(out, name));
}
fs.copyFileSync(path.join(__dirname, 'audio', 'credits.txt'), path.join(out, 'credits.txt'));
fs.copyFileSync(path.resolve(__dirname, '../../public/fonts/PretendardVariable.woff2'), path.join(out, 'font.woff2'));
const srt = fs.readFileSync(path.join(__dirname, 'target-lab-targeting.ko.srt'), 'utf8');
fs.writeFileSync(path.join(out, 'target-lab-targeting.ko.vtt'), 'WEBVTT\n\n' + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'));
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(capture.capturedAt)).replaceAll('-', '.');
const htmlPath = path.join(out, 'index.html');
fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').replace(/\d{4}\.\d{2}\.\d{2} 업데이트/, date + ' 업데이트'));
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ capturedAt: capture.capturedAt, sourceCommit: capture.sourceCommit, duration: 45, resolution: '1920x1080' }, null, 2));
console.log('Web assets prepared:', out);
