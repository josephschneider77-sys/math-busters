/** Kid-safe juicy SFX via Web Audio — no downloads, unlocks on first tap. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let noise: AudioBuffer | null = null;

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function getCtx(): AudioContext | null {
  const AC = audioCtor();
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.88;
    master.connect(ctx.destination);
  }
  return ctx;
}

function ready(): boolean {
  return unlocked && !!getCtx() && !!master && ctx?.state !== "closed";
}

function noiseBuffer(): AudioBuffer {
  const c = getCtx()!;
  if (noise) return noise;
  const seconds = 1;
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

function env(
  start: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): GainNode {
  const g = getCtx()!.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), start + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  return g;
}

function tone(
  type: OscillatorType,
  freq: number,
  start: number,
): OscillatorNode {
  const o = getCtx()!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  return o;
}

/** Call from a user gesture so later plays aren’t blocked. */
export function unlockAudio(): void {
  unlocked = true;
  const c = getCtx();
  if (c && c.state === "suspended") {
    void c.resume().catch(() => {
      /* ignore */
    });
  }
}

export function armAudioUnlock(): void {
  const arm = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", arm, true);
    window.removeEventListener("keydown", arm, true);
    window.removeEventListener("touchstart", arm, true);
  };
  window.addEventListener("pointerdown", arm, true);
  window.addEventListener("keydown", arm, true);
  window.addEventListener("touchstart", arm, true);
}

/** Bright pop when Play starts a run. */
export function playStart(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;
  const notes = [659, 880, 1175];
  notes.forEach((freq, i) => {
    const start = t + i * 0.045;
    const o = tone("triangle", freq, start);
    const g = env(start, 0.14, 0.006, 0.025, 0.1);
    o.connect(g).connect(master!);
    o.start(start);
    o.stop(start + 0.14);
  });
}

/** Short candy click when a number block is selected. */
export function playSelect(): void {
  if (!ready()) return;
  const c = getCtx()!;
  const t = c.currentTime;

  const pop = tone("triangle", 880, t);
  pop.frequency.exponentialRampToValueAtTime(1320, t + 0.045);
  const pg = env(t, 0.2, 0.004, 0.018, 0.07);
  pop.connect(pg).connect(master!);
  pop.start(t);
  pop.stop(t + 0.12);

  const tick = tone("square", 1960, t);
  const tg = env(t, 0.045, 0.001, 0.006, 0.03);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  tick.connect(hp).connect(tg).connect(master!);
  tick.start(t);
  tick.stop(t + 0.05);
}

/** Softer reverse tick when a block is deselected. */
export function playDeselect(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;
  const o = tone("triangle", 760, t);
  o.frequency.exponentialRampToValueAtTime(480, t + 0.07);
  const g = env(t, 0.09, 0.004, 0.012, 0.06);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.1);
}

/** Shatter + thump + sparkle when a true equation busts blocks. */
export function playBust(): void {
  if (!ready()) return;
  const c = getCtx()!;
  const t = c.currentTime;

  const thump = tone("sine", 118, t);
  thump.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  const tg = env(t, 0.72, 0.004, 0.035, 0.2);
  thump.connect(tg).connect(master!);
  thump.start(t);
  thump.stop(t + 0.3);

  const punch = tone("triangle", 240, t);
  punch.frequency.exponentialRampToValueAtTime(86, t + 0.12);
  const pg = env(t, 0.26, 0.003, 0.025, 0.14);
  punch.connect(pg).connect(master!);
  punch.start(t);
  punch.stop(t + 0.2);

  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1600, t);
  bp.frequency.exponentialRampToValueAtTime(4600, t + 0.1);
  bp.Q.value = 0.65;
  const ng = env(t, 0.32, 0.006, 0.035, 0.2);
  src.connect(bp).connect(ng).connect(master!);
  src.start(t);
  src.stop(t + 0.3);

  const notes = [784, 988, 1175, 1568, 1976];
  notes.forEach((freq, i) => {
    const start = t + 0.035 + i * 0.042;
    const spark = tone("triangle", freq, start);
    const g = env(start, 0.11, 0.004, 0.018, 0.11);
    spark.connect(g).connect(master!);
    spark.start(start);
    spark.stop(start + 0.15);
  });
}

/** Soft deny when a control is empty (no hints left). */
export function playDeny(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;
  const o = tone("triangle", 220, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.1);
  const g = env(t, 0.1, 0.006, 0.03, 0.08);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.14);
}

/** Soft miss — friendly “hmm” when an operator doesn’t make an equation. */
export function playMiss(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;

  const down = tone("triangle", 392, t);
  down.frequency.exponentialRampToValueAtTime(262, t + 0.14);
  const dg = env(t, 0.14, 0.008, 0.04, 0.14);
  down.connect(dg).connect(master!);
  down.start(t);
  down.stop(t + 0.22);

  const tap = tone("sine", 196, t);
  tap.frequency.exponentialRampToValueAtTime(140, t + 0.1);
  const tg = env(t, 0.1, 0.006, 0.03, 0.1);
  tap.connect(tg).connect(master!);
  tap.start(t);
  tap.stop(t + 0.16);
}

/** Gentle coach chime — math was true, but that order can’t finish the board. */
export function playPathWarn(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;

  const first = tone("sine", 523, t);
  const fg = env(t, 0.16, 0.012, 0.06, 0.12);
  first.connect(fg).connect(master!);
  first.start(t);
  first.stop(t + 0.22);

  const second = tone("triangle", 440, t + 0.16);
  second.frequency.exponentialRampToValueAtTime(392, t + 0.32);
  const sg = env(t + 0.16, 0.14, 0.012, 0.08, 0.16);
  second.connect(sg).connect(master!);
  second.start(t + 0.16);
  second.stop(t + 0.42);
}

/** Short win sparkle after the board is fully cleared. */
export function playWin(): void {
  if (!ready()) return;
  const t = getCtx()!.currentTime;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const start = t + i * 0.07;
    const spark = tone("triangle", freq, start);
    const g = env(start, 0.16, 0.008, 0.04, 0.16);
    spark.connect(g).connect(master!);
    spark.start(start);
    spark.stop(start + 0.22);
  });
}

/** Reverse whoosh + rebuild tones when Undo reforms busted blocks. */
export function playReform(): void {
  if (!ready()) return;
  const c = getCtx()!;
  const t = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3400, t);
  lp.frequency.exponentialRampToValueAtTime(380, t + 0.32);
  lp.Q.value = 0.4;
  const ng = env(t, 0.2, 0.018, 0.08, 0.26);
  src.connect(lp).connect(ng).connect(master!);
  src.start(t);
  src.stop(t + 0.42);

  const whoosh = tone("sine", 220, t);
  whoosh.frequency.exponentialRampToValueAtTime(620, t + 0.28);
  const wg = env(t, 0.1, 0.02, 0.08, 0.22);
  whoosh.connect(wg).connect(master!);
  whoosh.start(t);
  whoosh.stop(t + 0.36);

  const notes = [392, 523, 659, 784];
  notes.forEach((freq, i) => {
    const start = t + 0.1 + i * 0.068;
    const rebuild = tone("sine", freq, start);
    rebuild.frequency.exponentialRampToValueAtTime(freq * 1.22, start + 0.07);
    const g = env(start, 0.13, 0.01, 0.025, 0.09);
    rebuild.connect(g).connect(master!);
    rebuild.start(start);
    rebuild.stop(start + 0.15);
  });

  const dock = tone("triangle", 700, t + 0.4);
  const dg = env(t + 0.4, 0.15, 0.004, 0.018, 0.08);
  dock.connect(dg).connect(master!);
  dock.start(t + 0.4);
  dock.stop(t + 0.52);
}
