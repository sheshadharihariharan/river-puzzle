// The hero: plays Tripo animations when the model has them, otherwise animates the
// stand-in's body parts (or the whole model) in code.
import * as THREE from 'three';

// Words Tripo or Mixamo might use for each move.
const CLIP_WORDS = {
  idle: ['idle', 'stand', 'breath'],
  walk: ['walk', 'run'],
  hop: ['hop', 'jump'],
  fall: ['fall', 'flail', 'lose'],
  cheer: ['cheer', 'victory', 'celebrat', 'wave', 'jump'],
};

export class Hero {
  constructor(model) {
    this.root = new THREE.Group(); // moved around the board
    this.body = new THREE.Group(); // bounced and tipped by code
    this.root.add(this.body);
    this.body.add(model.object);
    this.parts = {};
    model.object.traverse((o) => {
      if (['legL', 'legR', 'armL', 'armR', 'head', 'body'].includes(o.name)) this.parts[o.name] = o;
    });
    this.mixer = model.animations.length ? new THREE.AnimationMixer(model.object) : null;
    this.clips = {};
    for (const [move, words] of Object.entries(CLIP_WORDS)) {
      this.clips[move] = model.animations.find((c) => words.some((w) => c.name.toLowerCase().includes(w)));
    }
    this.move = null;
    this.action = null;
    this.t = 0;
    this.play('idle');
  }

  play(move, restart = false) {
    if (this.move === move && !restart) return;
    this.move = move;
    this.t = 0;
    const clip = this.clips[move];
    if (this.mixer && clip) {
      const next = this.mixer.clipAction(clip);
      next.reset();
      const once = move === 'hop' || move === 'fall';
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat);
      next.clampWhenFinished = once;
      next.fadeIn(0.15).play();
      if (this.action && this.action !== next) this.action.fadeOut(0.15);
      this.action = next;
    }
  }

  // True when this move comes from the model's own animation.
  hasClip(move) {
    return !!(this.mixer && this.clips[move]);
  }

  update(dt) {
    this.t += dt;
    if (this.mixer) this.mixer.update(dt);
    if (this.hasClip(this.move)) return;
    const t = this.t;
    const p = this.parts;
    const swing = (a) => {
      if (p.legL) p.legL.rotation.x = a;
      if (p.legR) p.legR.rotation.x = -a;
      if (p.armL) p.armL.rotation.x = -a * 0.8;
      if (p.armR) p.armR.rotation.x = a * 0.8;
    };
    if (this.move === 'idle') {
      swing(0);
      this.body.scale.set(1, 1 + Math.sin(t * 3) * 0.02, 1);
      if (p.head) p.head.rotation.y = Math.sin(t * 0.8) * 0.25;
      if (p.armL) p.armL.rotation.z = 0;
      if (p.armR) p.armR.rotation.z = 0;
    } else if (this.move === 'walk') {
      swing(Math.sin(t * 14) * 0.6);
      this.body.position.y = Math.abs(Math.sin(t * 14)) * 0.035;
      this.body.rotation.z = Math.sin(t * 14) * 0.05;
      if (p.head) p.head.rotation.y = 0;
    } else if (this.move === 'hop') {
      swing(0.5);
      if (p.armL) p.armL.rotation.z = -0.8;
      if (p.armR) p.armR.rotation.z = 0.8;
    } else if (this.move === 'cheer') {
      swing(0);
      this.body.position.y = Math.abs(Math.sin(t * 7)) * 0.18;
      if (p.armL) p.armL.rotation.z = -2.6 + Math.sin(t * 14) * 0.3;
      if (p.armR) p.armR.rotation.z = 2.6 - Math.sin(t * 14) * 0.3;
    } else if (this.move === 'fall') {
      if (p.armL) p.armL.rotation.z = -2.2 + Math.sin(t * 30) * 0.6;
      if (p.armR) p.armR.rotation.z = 2.2 - Math.sin(t * 30) * 0.6;
      swing(Math.sin(t * 25) * 0.5);
    }
  }

  // Back to standing at a spot.
  reset(position, facing = 0) {
    this.root.position.copy(position);
    this.root.rotation.y = facing;
    this.root.scale.setScalar(1);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.scale.setScalar(1);
    this.root.visible = true;
    this.move = null;
    this.play('idle');
  }
}
