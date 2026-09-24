'use strict';

// Fan noise is synthesized once per speed into a seamless looping WAV and
// played through an <audio> element. Unlike a live Web Audio graph, an
// <audio> element keeps playing when the phone is locked or the app is
// in the background.

const SAMPLE_RATE = 24000;
const LOOP_SECONDS = 90;
const CROSSFADE_SECONDS = 2;

const SPEEDS = {
  1: { cutoff: 550,  brown: 1.0, pink: 0.15, flutterHz: 9,  flutter: 0.020, hum: 0.004, level: 0.14, spin: '2.4s' },
  2: { cutoff: 900,  brown: 1.0, pink: 0.30, flutterHz: 13, flutter: 0.025, hum: 0.005, level: 0.16, spin: '1.2s' },
  3: { cutoff: 1500, brown: 0.9, pink: 0.50, flutterHz: 17, flutter: 0.030, hum: 0.006, level: 0.18, spin: '0.6s' },
};

// ---------- synthesis ----------

// RBJ cookbook biquad, processed in place.
function biquad(data, type, freq, q) {
  const w = 2 * Math.PI * freq / SAMPLE_RATE;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
  } else {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
  }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0, na1 = a1 / a0, na2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    data[i] = y;
  }
}

// Snap a modulation rate so it completes a whole number of cycles per loop,
// which keeps the loop point seamless.
const loopRate = hz => Math.max(1, Math.round(hz * LOOP_SECONDS)) / LOOP_SECONDS;

function synthesize(speed) {
  const p = SPEEDS[speed];
  const loopLen = LOOP_SECONDS * SAMPLE_RATE;
  const fadeLen = CROSSFADE_SECONDS * SAMPLE_RATE;
  const total = loopLen + fadeLen;
  const buf = new Float32Array(total);

  // Brown + pink noise (Paul Kellet's pink filter).
  let brown = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < total; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    buf[i] = brown * 3.5 * p.brown + pink * p.pink;
  }

  biquad(buf, 'highpass', 35, 0.707);
  biquad(buf, 'lowpass', p.cutoff, 0.707);
  biquad(buf, 'lowpass', p.cutoff * 1.6, 0.707);

  // Slow "air" swell, faint blade flutter, and a quiet motor hum.
  const swellA = loopRate(0.11), swellB = loopRate(0.27);
  const flutter = loopRate(p.flutterHz), hum = loopRate(60);
  const tau = 2 * Math.PI;
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const amp = 1
      + 0.05 * Math.sin(tau * swellA * t)
      + 0.03 * Math.sin(tau * swellB * t + 1.3)
      + p.flutter * Math.sin(tau * flutter * t);
    buf[i] = buf[i] * amp + p.hum * Math.sin(tau * hum * t);
  }

  // Normalize to a target loudness.
  let sum = 0;
  for (let i = 0; i < total; i++) sum += buf[i] * buf[i];
  const scale = p.level / Math.sqrt(sum / total);

  // Equal-power crossfade of the tail into the head so the loop is seamless.
  const out = new Float32Array(loopLen);
  for (let i = 0; i < loopLen; i++) {
    let s = buf[i];
    if (i < fadeLen) {
      const f = i / fadeLen;
      s = s * Math.sqrt(f) + buf[loopLen + i] * Math.sqrt(1 - f);
    }
    out[i] = Math.max(-1, Math.min(1, s * scale));
  }
  return out;
}

function encodeWav(samples) {
  const bytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i] * 0x7fff, true);
  return new Blob([view], { type: 'audio/wav' });
}

const urls = {};
function soundUrl(speed) {
  if (!urls[speed]) urls[speed] = URL.createObjectURL(encodeWav(synthesize(speed)));
  return urls[speed];
}

// ---------- settings ----------

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('fan.' + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('fan.' + key, JSON.stringify(value)); } catch {}
  },
};

// ---------- UI ----------

const audio = document.getElementById('audio');
const powerBtn = document.getElementById('power');
const statusEl = document.getElementById('status');
const volumeEl = document.getElementById('volume');
const timerLeftEl = document.getElementById('timer-left');
const speedBtns = document.querySelectorAll('[data-speed]');
const timerBtns = document.querySelectorAll('[data-minutes]');

let speed = store.get('speed', 2);
let volume = store.get('volume', 0.8);
let timerMinutes = store.get('timer', 0);
let timerEnd = 0;
let fading = false;

// iOS ignores audio.volume (it's always 1); fall back to hardware buttons.
audio.volume = 0.5;
const volumeWorks = audio.volume === 0.5;
if (!volumeWorks) {
  document.getElementById('volume-group').hidden = true;
  document.getElementById('volume-hint').hidden = false;
}
volumeEl.value = volume;

// Play through the silent switch on iOS 16.4+.
if (navigator.audioSession) {
  try { navigator.audioSession.type = 'playback'; } catch {}
}

const isOn = () => !audio.paused;

function setRadio(buttons, attr, value) {
  buttons.forEach(b => b.setAttribute('aria-checked', String(b.dataset[attr] == value)));
}

function render() {
  const on = isOn();
  powerBtn.setAttribute('aria-pressed', String(on));
  powerBtn.setAttribute('aria-label', on ? 'Turn fan off' : 'Turn fan on');
  powerBtn.style.setProperty('--spin', SPEEDS[speed].spin);
  statusEl.textContent = on ? 'On' : 'Tap to turn on';
  setRadio(speedBtns, 'speed', speed);
  setRadio(timerBtns, 'minutes', timerMinutes);
  renderTimer();
}

function renderTimer() {
  if (!timerEnd || !isOn()) { timerLeftEl.textContent = ''; return; }
  const mins = Math.max(0, Math.ceil((timerEnd - Date.now()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  timerLeftEl.textContent = 'Turns off in ' + (h ? `${h}h ${m}m` : `${m}m`);
}

function startTimer() {
  timerEnd = timerMinutes ? Date.now() + timerMinutes * 60000 : 0;
  fading = false;
  renderTimer();
}

async function turnOn() {
  const url = soundUrl(speed);
  if (audio.src !== url) audio.src = url;
  audio.volume = volume;
  try {
    await audio.play();
  } catch (err) {
    statusEl.textContent = 'Could not start audio. Tap again.';
    return;
  }
  startTimer();
  updateMediaSession();
  render();
}

function turnOff() {
  audio.pause();
  timerEnd = 0;
  fading = false;
  audio.volume = volume;
  render();
}

powerBtn.addEventListener('click', () => (isOn() ? turnOff() : turnOn()));

speedBtns.forEach(btn => btn.addEventListener('click', async () => {
  speed = Number(btn.dataset.speed);
  store.set('speed', speed);
  if (isOn()) {
    audio.src = soundUrl(speed);
    try { await audio.play(); } catch {}
  }
  render();
}));

timerBtns.forEach(btn => btn.addEventListener('click', () => {
  timerMinutes = Number(btn.dataset.minutes);
  store.set('timer', timerMinutes);
  if (isOn()) { audio.volume = volume; startTimer(); }
  render();
}));

volumeEl.addEventListener('input', () => {
  volume = Number(volumeEl.value);
  store.set('volume', volume);
  if (!fading) audio.volume = volume;
});

// Sleep timer. timeupdate keeps firing while audio plays in the background,
// even when regular timers get throttled.
const FADE_MS = 60000;
function checkTimer() {
  if (!timerEnd || !isOn()) return;
  const left = timerEnd - Date.now();
  if (left <= 0) {
    turnOff();
  } else if (left < FADE_MS && volumeWorks) {
    fading = true;
    audio.volume = volume * (left / FADE_MS);
  }
  renderTimer();
}
audio.addEventListener('timeupdate', checkTimer);
setInterval(checkTimer, 1000);

audio.addEventListener('play', render);
audio.addEventListener('pause', render);

// Lock screen / headphone controls.
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Fan',
    artist: ['Low', 'Medium', 'High'][speed - 1] + ' speed',
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
}
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', turnOn);
  navigator.mediaSession.setActionHandler('pause', turnOff);
  try { navigator.mediaSession.setActionHandler('stop', turnOff); } catch {}
}

render();

// Build the sound ahead of time so the first tap starts instantly.
setTimeout(() => soundUrl(speed), 300);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
