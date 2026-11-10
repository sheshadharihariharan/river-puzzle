// Every sound and the music are made in code with Web Audio: no sound files to download or license.
// Browsers only allow sound after the first click or key press, so audio starts then.

const KEY = 'river-puzzle-audio';
const settings = (() => {
  try {
    return { music: true, sound: true, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { music: true, sound: true };
  }
})();

let ctx = null;
let sfxBus, musicBus, reverbSend, noiseBuffer;

function setup() {
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  // Soft room echo shared by music and effects.
  const reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.8;
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  reverb.buffer = impulse;
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.25;
  reverbSend.connect(reverb).connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sound ? 1 : 0;
  sfxBus.connect(master);
  sfxBus.connect(reverbSend);
  musicBus = ctx.createGain();
  musicBus.gain.value = settings.music ? 0.32 : 0;
  musicBus.connect(master);
  musicBus.connect(reverbSend);

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const n = noiseBuffer.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

  startMusic();
}

// Start audio on the first click or key press anywhere.
export function unlockAudio() {
  const start = () => {
    if (!ctx) setup();
    if (ctx.state === 'suspended') ctx.resume();
  };
  // iPhones and iPads only allow it on a finished tap, so listen for that too.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, start);
}

// ---------- building blocks ----------

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One note: oscillator with a quick attack and a fading tail.
function tone(freq, at, dur, { type = 'sine', gain = 0.3, slideTo, attack = 0.005, bus = sfxBus } = {}) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(bus);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

// A burst of filtered hiss (water, footsteps, shaker).
function noise(at, dur, { type = 'lowpass', freq = 1000, freqTo, q = 1, gain = 0.3, bus = sfxBus } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

// Wooden marimba-like note: body plus a quick bright overtone.
function mallet(midi, at, { gain = 0.25, dur = 0.6, bus = sfxBus } = {}) {
  tone(hz(midi), at, dur, { gain, bus });
  tone(hz(midi) * 4, at, 0.08, { gain: gain * 0.35, bus });
}

// ---------- sound effects ----------

function play(fn) {
  if (!ctx || !settings.sound) return;
  fn(ctx.currentTime + 0.01);
}

export const sfx = {
  click: () => play((t) => tone(720, t, 0.05, { type: 'triangle', gain: 0.18 })),
  pickup: () => play((t) => tone(480, t, 0.09, { type: 'triangle', gain: 0.18, slideTo: 760 })),
  remove: () => play((t) => tone(700, t, 0.12, { type: 'triangle', gain: 0.16, slideTo: 380 })),
  nope: () => play((t) => {
    tone(170, t, 0.09, { type: 'square', gain: 0.06 });
    tone(150, t + 0.1, 0.12, { type: 'square', gain: 0.06 });
  }),
  // Wood landing in water: a low knock and a little plop.
  place: () => play((t) => {
    tone(150, t, 0.16, { gain: 0.45, slideTo: 70 });
    noise(t, 0.08, { freq: 900, gain: 0.25 });
    tone(320, t + 0.03, 0.09, { gain: 0.22, slideTo: 760 });
  }),
  turn: () => play((t) => {
    tone(330, t, 0.06, { type: 'triangle', gain: 0.25 });
    tone(262, t + 0.07, 0.07, { type: 'triangle', gain: 0.25 });
  }),
  step: (() => {
    let left = false;
    return () => play((t) => {
      left = !left;
      noise(t, 0.05, { type: 'bandpass', freq: left ? 1500 : 1900, q: 2, gain: 0.35 });
    });
  })(),
  hop: () => play((t) => tone(300, t, 0.16, { type: 'triangle', gain: 0.22, slideTo: 640 })),
  splash: () => play((t) => {
    noise(t, 0.55, { freq: 2200, freqTo: 300, gain: 0.18 });
    tone(220, t, 0.22, { gain: 0.14, slideTo: 80 });
    for (let i = 0; i < 4; i++) tone(900 + Math.random() * 700, t + 0.15 + i * 0.08, 0.06, { gain: 0.045, slideTo: 1700 });
  }),
  fail: () => play((t) => {
    tone(392, t, 0.35, { type: 'triangle', gain: 0.2, slideTo: 370 });
    tone(330, t + 0.35, 0.6, { type: 'triangle', gain: 0.2, slideTo: 290 });
  }),
  // Rising C major arpeggio and a sparkle on top.
  win: () => play((t) => {
    [60, 64, 67, 72, 76].forEach((m, i) => mallet(m, t + i * 0.1, { gain: 0.3, dur: 0.8 }));
    [84, 88, 91].forEach((m, i) => tone(hz(m), t + 0.55 + i * 0.08, 0.3, { gain: 0.07 }));
  }),
  // Sparkly chime when the flower is picked.
  collect: () => play((t) => {
    [79, 84, 88].forEach((m, i) => tone(hz(m), t + i * 0.07, 0.35, { gain: 0.12 }));
    tone(hz(91), t + 0.21, 0.5, { type: 'triangle', gain: 0.06 });
  }),
  // Glassy swish while sliding on ice.
  slide: () => play((t) => noise(t, 0.2, { type: 'bandpass', freq: 3000, freqTo: 4500, q: 4, gain: 0.08 })),
  // Crunch of thin ice cracking (or a lily pad going under).
  crack: () => play((t) => {
    for (let i = 0; i < 3; i++) noise(t + i * 0.05, 0.06, { type: 'highpass', freq: 1800 + i * 600, gain: 0.18 });
    tone(140, t + 0.1, 0.25, { gain: 0.12, slideTo: 60 });
  }),
  // Soft whoosh as a piece is carried by the current.
  drift: () => play((t) => noise(t, 0.45, { type: 'bandpass', freq: 500, freqTo: 1400, q: 1.5, gain: 0.12 })),
  // Little bell when a padlock pops off.
  unlock: () => play((t) => {
    noise(t, 0.04, { type: 'highpass', freq: 3000, gain: 0.3 });
    [1200, 1800, 2700].forEach((f, i) => tone(f, t + 0.02, 0.9 - i * 0.2, { gain: 0.12 / (i + 1) }));
    tone(hz(79), t + 0.25, 0.5, { gain: 0.12 });
    tone(hz(84), t + 0.35, 0.7, { gain: 0.12 });
  }),
};

// ---------- music: a gentle 8-bar loop, C – Am – F – G ----------

const BPM = 96;
const EIGHTH = 60 / BPM / 2;
const CHORDS = [
  { bass: 48, notes: [60, 64, 67] }, // C
  { bass: 45, notes: [57, 60, 64] }, // Am
  { bass: 41, notes: [53, 57, 60] }, // F
  { bass: 43, notes: [55, 59, 62] }, // G
];
// [eighth note step, midi note, length in eighths]
const MELODY = [
  [0, 76, 2], [2, 79, 2], [4, 81, 1], [5, 79, 1], [6, 76, 2],
  [8, 74, 2], [10, 72, 2], [12, 74, 1], [13, 76, 3],
  [16, 72, 2], [18, 76, 2], [20, 81, 2], [22, 79, 2],
  [24, 76, 4], [28, 74, 2], [30, 72, 2],
  [32, 69, 2], [34, 72, 2], [36, 77, 2], [38, 76, 2],
  [40, 74, 2], [42, 72, 2], [44, 69, 2], [46, 72, 2],
  [48, 71, 2], [50, 74, 2], [52, 79, 2], [54, 77, 2],
  [56, 76, 2], [58, 74, 6],
];
const LOOP_STEPS = 64;

let nextStep = 0;
let nextTime = 0;
let loop = 0;


function scheduleStep(step, at) {
  const bar = Math.floor(step / 8);
  const chord = CHORDS[Math.floor(bar / 2)];
  const beat = step % 8;
  const bus = musicBus;
  if (beat === 0 || beat === 4) tone(hz(chord.bass), at, EIGHTH * 3, { type: 'triangle', gain: 0.35, attack: 0.02, bus });
  if (beat === 2 || beat === 6) chord.notes.forEach((m, i) => mallet(m, at + i * 0.012, { gain: 0.09, dur: 0.5, bus }));
  if (beat === 7) mallet(chord.notes[2], at, { gain: 0.05, dur: 0.3, bus });
  noise(at, 0.04, { type: 'highpass', freq: 7000, gain: beat % 2 ? 0.05 : 0.025, bus });
  // Melody every other time round; long chord tones in between so it doesn't get tiring.
  if (loop % 2 === 0) {
    for (const [s, m, l] of MELODY) if (s === step) mallet(m, at, { gain: 0.2, dur: Math.max(0.4, l * EIGHTH * 1.4), bus });
  } else if (beat === 0 && bar % 2 === 0) {
    tone(hz(chord.notes[1] + 12), at, EIGHTH * 14, { type: 'sine', gain: 0.07, attack: 0.4, bus });
  }
}

function startMusic() {
  nextStep = 0;
  loop = 0;
  nextTime = ctx.currentTime + 0.2;
  // Schedule well ahead so the music keeps going even when the window is in the background.
  setInterval(() => {
    while (nextTime < ctx.currentTime + 1.5) {
      scheduleStep(nextStep, nextTime);
      nextTime += EIGHTH;
      nextStep = (nextStep + 1) % LOOP_STEPS;
      if (nextStep === 0) loop++;
    }
  }, 200);
}

// ---------- on / off ----------

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

export function audioSetting(name) {
  return settings[name];
}

export function toggleAudio(name) {
  settings[name] = !settings[name];
  save();
  if (ctx) {
    const bus = name === 'music' ? musicBus : sfxBus;
    const level = name === 'music' ? 0.32 : 1;
    bus.gain.setTargetAtTime(settings[name] ? level : 0, ctx.currentTime, 0.1);
  }
  return settings[name];
}
