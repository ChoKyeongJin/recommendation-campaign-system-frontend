const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// A quiet original piano arrangement using actual softly played piano samples.
// Sample authorship and licence are recorded in audio/credits.txt.
function createPianoSoundtrack({ ffmpeg, output, duration = 45 }) {
  const sr = 44100;
  const count = Math.round(sr * duration);
  const left = new Float32Array(count);
  const right = new Float32Array(count);
  const keys = [
    ['F#2', 42], ['A2', 45], ['C3', 48], ['D#3', 51], ['F#3', 54],
    ['A3', 57], ['C4', 60], ['D#4', 63], ['F#4', 66], ['A4', 69],
  ];
  const samples = keys.map(([name, midi]) => {
    const source = path.join(__dirname, 'audio', 'piano-samples', name + 'v3.ogg');
    const decoded = spawnSync(ffmpeg, [
      '-v', 'error', '-i', source, '-t', '8', '-ar', String(sr),
      '-ac', '2', '-f', 'f32le', 'pipe:1',
    ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (decoded.status !== 0) throw new Error('Piano sample decode failed: ' + source);
    const pcm = new Float32Array(decoded.stdout.length / 4);
    for (let i = 0; i < pcm.length; i++) pcm[i] = decoded.stdout.readFloatLE(i * 4);
    return { midi, pcm, frames: pcm.length / 2 };
  });

  function note(midi, when, hold, velocity, pan = 0) {
    const sample = samples.reduce((a, b) => Math.abs(a.midi - midi) <= Math.abs(b.midi - midi) ? a : b);
    const rate = 2 ** ((midi - sample.midi) / 12);
    const start = Math.round(when * sr);
    const release = 0.75;
    const length = Math.min(Math.floor((sample.frames - 1) / rate), Math.round((hold + release) * sr), count - start);
    for (let i = 0; i < length; i++) {
      const read = i * rate, index = Math.floor(read), fraction = read - index;
      const t = i / sr;
      const tail = t <= hold ? 1 : Math.cos(Math.min(1, (t - hold) / release) * Math.PI / 2) ** 2;
      const envelope = velocity * Math.min(1, t / 0.004) * tail;
      const l = sample.pcm[index * 2] * (1 - fraction) + sample.pcm[(index + 1) * 2] * fraction;
      const r = sample.pcm[index * 2 + 1] * (1 - fraction) + sample.pcm[(index + 1) * 2 + 1] * fraction;
      left[start + i] += l * envelope * (1 - pan * 0.3);
      right[start + i] += r * envelope * (1 + pan * 0.3);
    }
  }

  // 72 BPM, 12 bars and a final resolving chord. Each bar leaves space between
  // a softly rolled left-hand chord and one or two right-hand melody notes.
  const beat = 60 / 72;
  const chords = [[48, 55, 60, 64], [45, 52, 55, 60], [41, 48, 57, 60], [43, 50, 55, 59]];
  const melody = [
    [67, 64], [64, 62], [64, 60], [62, 59],
    [64, 67], [69, 67], [64, 60], [62, null],
    [67, 64], [64, 62], [60, 64], [62, 59],
  ];
  for (let bar = 0; bar < 12; bar++) {
    const start = 0.3 + bar * beat * 4;
    const chord = chords[bar % 4];
    chord.forEach((midi, i) => {
      const gentleVariation = 0.96 + 0.04 * Math.sin(bar * 1.7 + i * 0.9);
      note(midi, start + i * 0.027, i === 0 ? 2.9 : 2.65, (i === 0 ? 0.56 : 0.45) * gentleVariation, -0.1);
    });
    melody[bar].forEach((midi, i) => {
      if (midi === null) return;
      const timing = i === 0 ? 1.45 : 2.95;
      note(midi, start + timing * beat + 0.015 * Math.sin(bar + i), 1.32, i === 0 ? 0.63 : 0.54, 0.1);
    });
  }
  [48, 55, 60, 64, 67].forEach((midi, i) => note(midi, 40.32 + i * 0.035, 4.4, i === 0 ? 0.5 : 0.42, (i - 2) * 0.04));

  // Short, quiet room reflections retain the piano's attack and natural decay.
  const dryLeft = left.slice(), dryRight = right.slice();
  for (const [seconds, gain] of [[0.043, 0.055], [0.071, 0.038], [0.109, 0.022]]) {
    const delay = Math.round(seconds * sr);
    for (let i = delay; i < count; i++) {
      left[i] += dryRight[i - delay] * gain;
      right[i] += dryLeft[i - delay] * gain;
    }
  }
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak < 0.00001) throw new Error('Piano soundtrack is silent');
  const gain = 0.65 / peak;
  const wav = Buffer.alloc(44 + count * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 4, 28); wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 4, 40);
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const fade = Math.min(1, t / 0.65) * Math.sin(Math.min(1, (duration - t) / 3.5) * Math.PI / 2) ** 2;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain * fade)) * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain * fade)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(output, wav);
  console.log('Soft piano arrangement generated: 72 BPM, natural sampled piano, no percussion.');
}

module.exports = { createPianoSoundtrack };
