import { audioContext } from "./voice";

/** Procedural launch sound design (Web Audio, no files): a rocket engine whose rumble, hiss and crackle follow throttle, altitude and dynamic pressure,
 *  plus one-shots for ignition, stage separation, upper-stage ignition, loss of vehicle and a success chime. */
const seconds = (c: AudioContext, s: number) => c.currentTime + s;
function noise(c: AudioContext, kind: "white" | "brown", dur = 4): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w; else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return b;
}
function loop(c: AudioContext, buf: AudioBuffer): AudioBufferSourceNode { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s; }

export class RocketSound {
  private c: AudioContext;
  private master: GainNode;
  private rumble: GainNode; private rumbleLp: BiquadFilterNode;
  private hiss: GainNode; private hissBp: BiquadFilterNode;
  private sub: GainNode;
  private rattle: GainNode;
  private stops: (() => void)[] = [];
  private level = 0;
  constructor(c: AudioContext) {
    this.c = c;
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    const brown = loop(c, noise(c, "brown")), white = loop(c, noise(c, "white"));
    // deep rumble: brown noise, low-passed
    this.rumbleLp = c.createBiquadFilter(); this.rumbleLp.type = "lowpass"; this.rumbleLp.frequency.value = 500;
    this.rumble = c.createGain(); brown.connect(this.rumbleLp); this.rumbleLp.connect(this.rumble); this.rumble.connect(this.master);
    // roar / hiss: band-passed white noise with a slow flutter
    this.hissBp = c.createBiquadFilter(); this.hissBp.type = "bandpass"; this.hissBp.frequency.value = 1400; this.hissBp.Q.value = 0.6;
    this.hiss = c.createGain(); white.connect(this.hissBp); this.hissBp.connect(this.hiss); this.hiss.connect(this.master);
    const flutter = c.createOscillator(), flutterAmt = c.createGain(); flutter.frequency.value = 7; flutterAmt.gain.value = 0.25; flutter.connect(flutterAmt); flutterAmt.connect(this.hiss.gain);
    // sub-bass thump you feel more than hear
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.frequency.value = 38; o2.frequency.value = 57; o2.type = "triangle";
    this.sub = c.createGain(); o1.connect(this.sub); o2.connect(this.sub); this.sub.connect(this.master);
    // max-Q buffeting: amplitude-chopped noise
    const buf = loop(c, noise(c, "white", 2)), bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 260; bp.Q.value = 1.2;
    this.rattle = c.createGain(); this.rattle.gain.value = 0;
    const chop = c.createOscillator(), chopAmt = c.createGain(); chop.frequency.value = 17; chopAmt.gain.value = 0.5; chop.connect(chopAmt); chopAmt.connect(this.rattle.gain);
    buf.connect(bp); bp.connect(this.rattle); this.rattle.connect(this.master);
    for (const n of [brown, white, flutter, o1, o2, buf, chop]) { n.start(); this.stops.push(() => { try { n.stop(); } catch { /* already stopped */ } }); }
  }
  /** Called ~10x a second. throttle 0..1 (0 = engine off), alt in metres, q in Pa. */
  update(throttle: number, alt: number, q: number, on: boolean) {
    const t = this.c.currentTime, air = Math.exp(-Math.max(0, alt) / 7500); // outside air thins with height
    const thrust = on ? Math.max(0.12, throttle) : 0;
    const exterior = 0.22 + 0.78 * air; // in vacuum only the structure-borne rumble remains
    const target = thrust * (on ? 1 : 0);
    this.level += (target - this.level) * 0.35;
    const v = this.level;
    this.master.gain.setTargetAtTime(Math.min(0.5, v * 0.5 + 0.001), t, 0.12);
    this.rumble.gain.setTargetAtTime(1.0 * v, t, 0.15);
    this.rumbleLp.frequency.setTargetAtTime(160 + 700 * exterior * (0.4 + 0.6 * v), t, 0.2);
    this.hiss.gain.setTargetAtTime(0.5 * v * exterior, t, 0.15);
    this.hissBp.frequency.setTargetAtTime(700 + 1600 * v, t, 0.2);
    this.sub.gain.setTargetAtTime(0.35 * v, t, 0.2);
    this.rattle.gain.setTargetAtTime(Math.min(0.7, (q / 30000) * 0.7) * (v > 0.05 ? 1 : 0), t, 0.2);
  }
  silence() { this.master.gain.setTargetAtTime(0, this.c.currentTime, 0.1); this.level = 0; }
  dispose() { this.silence(); setTimeout(() => this.stops.forEach((s) => s()), 400); }
}

/** Short one-shot effects. */
export function playSfx(kind: "ignition" | "separation" | "ignite2" | "explosion" | "chime") {
  const c = audioContext(); if (!c || c.state !== "running") return;
  const out = c.createGain(); out.connect(c.destination);
  const burst = (type: "white" | "brown", dur: number, lp: [number, number], gain: number, attack = 0.005, decay = dur) => {
    const s = c.createBufferSource(); s.buffer = noise(c, type, Math.max(dur, 0.5));
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(lp[0], c.currentTime); f.frequency.exponentialRampToValueAtTime(lp[1], seconds(c, dur));
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(gain, seconds(c, attack)); g.gain.exponentialRampToValueAtTime(0.0001, seconds(c, decay));
    s.connect(f); f.connect(g); g.connect(out); s.start(); s.stop(seconds(c, dur + 0.1));
  };
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, seconds(c, delay)); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), seconds(c, delay + dur));
    g.gain.setValueAtTime(0.0001, seconds(c, delay)); g.gain.linearRampToValueAtTime(gain, seconds(c, delay + 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, seconds(c, delay + dur));
    o.connect(g); g.connect(out); o.start(seconds(c, delay)); o.stop(seconds(c, delay + dur + 0.05));
  };
  if (kind === "ignition") { out.gain.value = 0.55; burst("brown", 5, [120, 1800], 1.0, 1.6, 5); burst("white", 4.5, [600, 3500], 0.35, 1.4, 4.5); tone("sine", 34, 30, 4, 0.5); }
  else if (kind === "separation") { out.gain.value = 0.9; burst("white", 0.35, [6000, 400], 0.9, 0.002, 0.35); tone("sine", 95, 28, 0.5, 0.9); tone("square", 900, 300, 0.12, 0.12, 0.03); tone("triangle", 420, 180, 0.4, 0.2, 0.08); burst("white", 1.2, [3000, 800], 0.18, 0.05, 1.2); }
  else if (kind === "ignite2") { out.gain.value = 0.6; burst("brown", 2.2, [100, 700], 0.8, 0.9, 2.2); tone("sine", 40, 55, 1.8, 0.35); }
  else if (kind === "explosion") { out.gain.value = 0.8; burst("white", 3.6, [5000, 90], 1, 0.003, 3.6); burst("brown", 4.5, [400, 60], 1, 0.01, 4.5); tone("sine", 80, 22, 2.5, 1); }
  else { out.gain.value = 0.5; tone("sine", 880, 880, 0.9, 0.5); tone("sine", 1318, 1318, 1.1, 0.4, 0.18); }
}
