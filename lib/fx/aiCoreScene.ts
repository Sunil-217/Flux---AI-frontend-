/**
 * The intelligence core — a WebGL scene, framework-free, in eight presets.
 *
 * Kept out of React so every buffer, geometry, material and the GL context are
 * released in the same module that allocated them. Nothing here loads at page
 * time: the wrapper dynamic-imports it after WebGL is confirmed and the element
 * is on screen.
 *
 * TWO THINGS THE FIRST VERSION GOT WRONG, fixed here:
 *
 * 1. It only worked on dark backgrounds. Additive blending is how you make
 *    light look like light — on black. On a pale template the same maths
 *    saturates to a solid pastel disc that sat on top of the headline. The scene
 *    now takes `mode` and switches to normal alpha blending with a darkened
 *    accent on light, so it reads as a translucent object in both worlds.
 *
 * 2. It was one shape. Eight presets share the shaders and the render loop but
 *    build genuinely different geometry — rings on tilted axes, a point
 *    lattice, torus reactor, two folded hemispheres, an accretion disc, spiral
 *    arms, nested octahedra. Not the same sphere in eight colours.
 */

import * as THREE from 'three';
import type { CorePreset } from '@/lib/fx/prefs';

export type CoreState = 'idle' | 'thinking' | 'searching' | 'generating' | 'success' | 'error';
export type { CorePreset };

export interface CoreOptions {
  accent: string;
  mode: 'light' | 'dark';
  preset?: CorePreset;
  particles?: number;
  /** Render one frame and stop (prefers-reduced-motion / motion=off). */
  still?: boolean;
  /** 0..1 — scales ambient rotation and pulse. */
  motion?: number;
}

export interface CoreHandle {
  setState(state: CoreState): void;
  setPointer(x: number, y: number): void;
  resize(width: number, height: number): void;
  frame(elapsed: number): void;
  dispose(): void;
}

const TUNING: Record<CoreState, { spin: number; pulse: number; spread: number; energy: number; hue: number }> = {
  idle:       { spin: 0.055, pulse: 0.35, spread: 1.00, energy: 0.55, hue: 0 },
  thinking:   { spin: 0.150, pulse: 0.85, spread: 1.06, energy: 0.95, hue: 0 },
  searching:  { spin: 0.230, pulse: 0.60, spread: 1.22, energy: 0.85, hue: 0.06 },
  generating: { spin: 0.115, pulse: 1.00, spread: 1.10, energy: 1.30, hue: -0.04 },
  success:    { spin: 0.070, pulse: 0.30, spread: 0.96, energy: 0.85, hue: 0.10 },
  error:      { spin: 0.040, pulse: 0.22, spread: 0.92, energy: 0.45, hue: -0.10 },
};

/* ── Shaders (shared by every preset) ──────────────────────────────────── */

const SHELL_VERT = /* glsl */ `
  uniform float uTime; uniform float uPulse;
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    float wave = sin(position.y * 5.0 + uTime * 1.4) * cos(position.x * 4.0 - uTime * 1.1);
    vec3 displaced = position * (1.0 + wave * 0.035 * uPulse);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

/* Fresnel-only alpha. No constant term: this shell is double-sided and every
   fragment is deposited twice, so a flat base alpha accumulates into a solid
   disc. uDark selects light-vs-dark tone mapping. */
const SHELL_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uEnergy; uniform float uDark;
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
    float a = fres * fres * mix(0.70, 0.85, uDark);
    vec3 col = uColor * (mix(0.35, 0.55, uDark) + fres * mix(0.6, 1.15, uDark)) * uEnergy;
    gl_FragColor = vec4(mix(col, col * a, uDark), a);
  }
`;

const POINT_VERT = /* glsl */ `
  uniform float uTime; uniform float uSpread; uniform float uSize; uniform float uMotion; uniform float uPixel;
  attribute float aSeed;
  varying float vFade;
  void main() {
    vec3 p = position * uSpread;
    float t = uTime * (0.25 + aSeed * 0.5) * uMotion;
    p += vec3(sin(t + aSeed * 6.28), cos(t * 1.3 + aSeed * 3.14), sin(t * 0.8)) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = clamp(1.0 - (-mv.z - 2.0) / 6.0, 0.15, 1.0);
    // uPixel is derived from the drawing buffer, so a point is a few device
    // pixels at any core size: the old constant made every particle ~40 CSS px
    // and the whole object collapsed into a blurred cloud.
    gl_PointSize = max(1.0, uSize * (0.6 + aSeed * 0.9) * (uPixel / max(-mv.z, 0.001)));
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uDark;
  varying float vFade;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    // Dark: a soft additive mote, the haze IS the effect. Light: a small crisp
    // dot with normal blending — soft motes overlap into a solid disc on paper.
    float edge = mix(0.16, 0.22, uDark);
    float a = smoothstep(edge, edge * 0.2, r) * vFade * mix(0.95, 0.8, uDark);
    gl_FragColor = vec4(mix(uColor, uColor * a, uDark), a);
  }
`;

/* ── Geometry builders ─────────────────────────────────────────────────── */

function fibonacciSphere(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    out[i * 3] = Math.cos(th) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(th) * r * radius;
  }
  return out;
}

function lattice(count: number, size: number): Float32Array {
  const n = Math.max(3, Math.round(Math.cbrt(count)));
  const out = new Float32Array(n * n * n * 3);
  let k = 0;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    out[k++] = ((x / (n - 1)) - 0.5) * size;
    out[k++] = ((y / (n - 1)) - 0.5) * size;
    out[k++] = ((z / (n - 1)) - 0.5) * size;
  }
  return out;
}

function disc(count: number, inner: number, outer: number, thickness: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const r = inner + (outer - inner) * Math.sqrt(t);
    const a = Math.random() * Math.PI * 2;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = (Math.random() - 0.5) * thickness * (1 - t * 0.6);
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

function spiral(count: number, arms: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const arm = i % arms;
    const t = (i / count);
    const r = 0.25 + t * radius;
    const a = t * Math.PI * 4 + (arm / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    out[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 0.12;
    out[i * 3 + 1] = (Math.random() - 0.5) * 0.18 * (1 - t);
    out[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 0.12;
  }
  return out;
}

function hemispheres(count: number, radius: number): Float32Array {
  // Two lobes, gap in the middle, surface-biased with a little fold noise.
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    const rr = radius * (0.86 + Math.random() * 0.14);
    const fold = Math.sin(ph * 6 + th * 3) * 0.05;
    out[i * 3] = (Math.sin(ph) * Math.cos(th) * 0.62 + side * 0.28) * rr * (1 + fold);
    out[i * 3 + 1] = Math.cos(ph) * rr * 0.8 * (1 + fold);
    out[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rr * (1 + fold);
  }
  return out;
}

/* ── The scene ─────────────────────────────────────────────────────────── */

export function createAICore(canvas: HTMLCanvasElement, opts: CoreOptions): CoreHandle {
  const preset: CorePreset = opts.preset ?? 'neural';
  const dark = opts.mode !== 'light';
  const motionScale = opts.motion ?? 1;
  // Paper carries fewer, smaller, crisper points: the same count that reads as
  // energy under additive blending reads as a filled blob under normal blending.
  const particleCount = Math.max(120, Math.min(Math.round((opts.particles ?? 900) * (dark ? 1 : 0.6)), 2400));

  const base = new THREE.Color(opts.accent || '#7c6cff');
  if (!dark) {
    // On paper the accent itself is too pale to read as an object. Pull it
    // toward ink so the geometry has body without a glow doing the work.
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    base.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0.22, hsl.l * 0.62));
  }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6.6);
  const group = new THREE.Group();
  scene.add(group);

  const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  const uDark = dark ? 1 : 0;
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(o: T): T => { disposables.push(o); return o; };

  /* Shared uniforms */
  const shellU = { uTime: { value: 0 }, uPulse: { value: TUNING.idle.pulse }, uEnergy: { value: TUNING.idle.energy }, uColor: { value: base.clone() }, uDark: { value: uDark } };
  const pointU = { uTime: { value: 0 }, uSpread: { value: 1 }, uSize: { value: 1.7 }, uColor: { value: base.clone() }, uDark: { value: uDark }, uMotion: { value: motionScale }, uPixel: { value: 14 } };

  const shellMat = track(new THREE.ShaderMaterial({ uniforms: shellU, vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, transparent: true, blending, depthWrite: false, side: THREE.DoubleSide }));
  const pointMat = track(new THREE.ShaderMaterial({ uniforms: pointU, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, blending, depthWrite: false }));
  const lineMat = track(new THREE.LineBasicMaterial({ color: base.clone(), transparent: true, opacity: dark ? 0.22 : 0.24, depthWrite: false, blending }));
  const wireMat = track(new THREE.MeshBasicMaterial({ color: base.clone(), wireframe: true, transparent: true, opacity: dark ? 0.16 : 0.17, depthWrite: false }));

  const colourTargets: THREE.Color[] = [shellU.uColor.value, pointU.uColor.value, lineMat.color, wireMat.color];

  /* Per-preset counter-rotating parts */
  const orbiters: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; rate: number }[] = [];
  let pointsObj: THREE.Points | null = null;
  let linksObj: THREE.LineSegments | null = null;

  const addPoints = (positions: Float32Array, size: number, spread = 1) => {
    const geo = track(new THREE.BufferGeometry());
    const n = positions.length / 3;
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    pointU.uSize.value = size * (dark ? 1 : 0.72);
    pointU.uSpread.value = spread;
    const pts = new THREE.Points(geo, pointMat);
    group.add(pts);
    pointsObj = pts;
    return pts;
  };

  const addLinks = (positions: Float32Array, maxLinks: number, reach: number, stride = 7) => {
    const n = positions.length / 3;
    const out: number[] = [];
    for (let i = 0; i < n && out.length < maxLinks * 6; i += stride) {
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      for (let j = i + 1; j < Math.min(i + 40, n); j++) {
        const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
        if ((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2 < reach) { out.push(ax, ay, az, bx, by, bz); break; }
      }
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
    const seg = new THREE.LineSegments(geo, lineMat);
    group.add(seg);
    linksObj = seg;
    return seg;
  };

  const addShell = (geo: THREE.BufferGeometry) => { track(geo); const m = new THREE.Mesh(geo, shellMat); group.add(m); return m; };
  const addWire = (geo: THREE.BufferGeometry) => { track(geo); const m = new THREE.Mesh(geo, wireMat); group.add(m); return m; };
  const ring = (radius: number, tube: number, rx: number, ry: number, rate: number, axis: 'x' | 'y' | 'z' = 'z') => {
    const geo = track(new THREE.TorusGeometry(radius, tube, 8, 96));
    const m = new THREE.Mesh(geo, shellMat);
    m.rotation.set(rx, ry, 0);
    group.add(m);
    orbiters.push({ obj: m, axis, rate });
    return m;
  };

  /* ── Build the chosen preset ── */
  switch (preset) {
    case 'orbital': {
      addShell(new THREE.SphereGeometry(0.55, 32, 24));
      ring(1.35, 0.012, Math.PI / 2.6, 0.2, 0.30);
      ring(1.70, 0.010, Math.PI / 4.0, 1.3, -0.22, 'x');
      ring(2.05, 0.008, Math.PI / 1.7, 2.4, 0.16, 'y');
      addPoints(fibonacciSphere(Math.floor(particleCount * 0.55), 2.3), 1.4);
      break;
    }
    case 'lattice': {
      const pts = lattice(particleCount, 3.2);
      addPoints(pts, 2.0);
      addLinks(pts, 140, 0.9, 3);
      addWire(new THREE.BoxGeometry(3.2, 3.2, 3.2));
      break;
    }
    case 'reactor': {
      addShell(new THREE.SphereGeometry(0.62, 32, 24));
      ring(1.1, 0.05, Math.PI / 2, 0, 0.40);
      ring(1.5, 0.035, Math.PI / 2, 0, -0.28);
      ring(1.95, 0.02, Math.PI / 2, 0, 0.18);
      addPoints(disc(Math.floor(particleCount * 0.6), 0.9, 2.3, 0.25), 1.5);
      break;
    }
    case 'cortex': {
      const pts = hemispheres(particleCount, 1.9);
      addPoints(pts, 2.2);
      addLinks(pts, 110, 0.35, 5);
      break;
    }
    case 'singularity': {
      // Dark centre: a normal-blended near-black sphere, then a hot disc.
      const holeMat = track(new THREE.MeshBasicMaterial({ color: dark ? 0x000000 : 0x1a1a1a, transparent: true, opacity: dark ? 0.9 : 0.85 }));
      const hole = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 32, 24)), holeMat);
      group.add(hole);
      ring(0.78, 0.03, Math.PI / 2.2, 0.3, 0.5);
      addPoints(disc(particleCount, 0.85, 2.6, 0.12), 1.6);
      break;
    }
    case 'galaxy': {
      addPoints(spiral(particleCount, 3, 2.4), 1.7);
      addShell(new THREE.SphereGeometry(0.42, 24, 18));
      group.rotation.x = 0.55;
      break;
    }
    case 'synthetic': {
      addShell(new THREE.OctahedronGeometry(1.05, 0));
      addWire(new THREE.OctahedronGeometry(1.55, 0));
      addWire(new THREE.OctahedronGeometry(2.05, 0));
      const inner = new THREE.Mesh(track(new THREE.OctahedronGeometry(1.55, 0)), wireMat);
      inner.rotation.set(0.4, 0.8, 0.2);
      group.add(inner);
      orbiters.push({ obj: inner, axis: 'y', rate: -0.35 });
      addPoints(fibonacciSphere(Math.floor(particleCount * 0.6), 2.35), 1.3);
      break;
    }
    case 'neural':
    default: {
      addShell(new THREE.IcosahedronGeometry(1.18, 3));
      addWire(new THREE.IcosahedronGeometry(1.19, 1));
      const pts = fibonacciSphere(particleCount, 1.95);
      addPoints(pts, 1.7);
      addLinks(pts, 90, 0.75, 7);
      break;
    }
  }

  /* ── State ── */
  let target = TUNING.idle;
  const current = { ...TUNING.idle };
  let px = 0.5, py = 0.5;
  let disposed = false;
  const tone = base.clone();

  const applyColour = (hueShift: number) => {
    tone.copy(base);
    if (hueShift !== 0) {
      const hsl = { h: 0, s: 0, l: 0 };
      tone.getHSL(hsl);
      tone.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, hsl.l);
    }
    for (const c of colourTargets) c.copy(tone);
  };

  return {
    setState(s) { target = TUNING[s] ?? TUNING.idle; },
    setPointer(x, y) { px = x; py = y; },
    resize(w, h) {
      if (disposed || w <= 0 || h <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(w, h, false);
      // Points scale with the object, not the screen: a 180px core keeps the
      // same visual density as a 560px one.
      pointU.uPixel.value = Math.max(7, renderer.domElement.height * 0.038);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    frame(elapsed) {
      if (disposed) return;
      const k = opts.still ? 1 : 0.045;
      current.spin += (target.spin - current.spin) * k;
      current.pulse += (target.pulse - current.pulse) * k;
      current.spread += (target.spread - current.spread) * k;
      current.energy += (target.energy - current.energy) * k;
      current.hue += (target.hue - current.hue) * k;

      shellU.uTime.value = elapsed;
      shellU.uPulse.value = current.pulse * motionScale;
      shellU.uEnergy.value = current.energy;
      pointU.uTime.value = elapsed;
      pointU.uSpread.value = pointU.uSpread.value * 0.9 + current.spread * 0.1;
      applyColour(current.hue);

      const spin = current.spin * motionScale;
      group.rotation.y = elapsed * spin;
      if (preset !== 'galaxy') group.rotation.x = Math.sin(elapsed * 0.18) * 0.12 * motionScale;
      if (pointsObj) pointsObj.rotation.y = -elapsed * spin * 0.55;
      if (linksObj && pointsObj) linksObj.rotation.y = pointsObj.rotation.y;
      for (const o of orbiters) o.obj.rotation[o.axis] += 0.015 * o.rate * motionScale;
      lineMat.opacity = (dark ? 0.13 : 0.14) + current.energy * (dark ? 0.12 : 0.1);

      camera.position.x += ((px - 0.5) * 0.5 - camera.position.x) * 0.05;
      camera.position.y += (-(py - 0.5) * 0.35 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const d of disposables) d.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
