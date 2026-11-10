import '@fontsource/lilita-one';
import './style.css';
import { Stage } from './three/stage.js';
import { showMap } from './screens/map.js';
import { showBoard } from './screens/board.js';
import { unlockAudio, audioSetting, toggleAudio, sfx } from './audio.js';

const stage = new Stage(document.getElementById('game'));
const ui = document.getElementById('ui');
let leave = () => {};
let switching = false;

// Switch screens behind a quick fade.
async function show(open) {
  if (switching) return;
  switching = true;
  ui.classList.add('fade');
  document.body.classList.add('fading');
  await new Promise((r) => setTimeout(r, 180));
  leave();
  ui.innerHTML = '';
  leave = await open();
  document.body.classList.remove('fading');
  ui.classList.remove('fade');
  switching = false;
}

const nav = {
  toMap: (justUnlocked = null) => show(() => showMap(stage, ui, nav, justUnlocked)),
  toLevel: (index) => show(() => showBoard(stage, ui, index, nav)),
};

nav.toMap();

// Sound: starts on the first click; music and sound buttons in the top-right corner.
unlockAudio();
const icons = {
  music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
};
const controls = document.getElementById('audio');
for (const name of ['music', 'sound']) {
  const btn = document.createElement('button');
  btn.className = 'btn small round';
  btn.title = name === 'music' ? 'Music on/off' : 'Sound effects on/off';
  btn.innerHTML = icons[name];
  btn.classList.toggle('off', !audioSetting(name));
  btn.onclick = () => btn.classList.toggle('off', !toggleAudio(name));
  controls.append(btn);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn')) sfx.click();
});

// Lets the browser console inspect the game while developing.
if (import.meta.env.DEV) window.game = { stage, nav };
