/**
 * The AI intelligence core — a WebGL scene, deliberately framework-free.
 *
 * Kept out of React on purpose. A Three.js scene owns GPU memory that React's
 * lifecycle knows nothing about; keeping create/dispose in one plain module
 * means every buffer, geometry, material and the renderer itself are released
 * in the same place they were allocated, and the whole thing can be reasoned
 * about (and unit-tested) without mounting a component.
 *
 * Nothing here is imported at page load — the React wrapper dynamic-imports it
 * only after WebGL is confirmed and the element is on screen.
 */

import * as THREE from 'three';

/** Real application activity. Never decorative: each state is set from
 *  something that is actually happening, and `idle` is the honest default. */
export type CoreState =
  | 'idle'
  | 'thinking'
  | 'searching'
  | 'generating'
  | 'success'
  | 'error';

export interface CoreOptions {
  /** Accent colour, read from the live CSS token so the core matches whichever
   *  of the 64 app templates the user has chosen. */
  accent: string;
  /** Scaled down on small screens and low-power devices. */
  particles?: number;
  /** Render one frame and stop — used for prefers-reduced-motion. */
  still?: boolean;
}

export interface CoreHandle {
  setState(state: CoreState): void;
  /** Pointer position in 0..1 across the viewport, for parallax. */
  setPointer(x: number, y: number): void;
  resize(width: number, height: number): void;
  /** Advance and draw. The caller owns the loop so it can pause cheaply. */
  frame(elapsed: number): void;
  dispose(): void;
}

/** Per-state tuning. Amplitude is restrained on purpose — the difference
 *  between states should be legible at a glance without being a light show. */
const TUNING: Record<CoreState, {
  spin: number; pulse: number; spread: number; energy: number; hue: number;
}> = {
  idle:       { spin: 0.055, pulse: 0.35, spread: 1.00, energy: 0.55, hue: 0 },
  thinking:   { spin: 0.150, pulse: 0.85, spread: 1.06, energy: 0.95, hue: 0 },
  searching:  { spin: 0.230, pulse: 0.60, spread: 1.22, energy: 0.85, hue: 0.06 },
  generating: { spin: 0.115, pulse: 1.00, spread: 1.10, energy: 1.30, hue: -0.04 },
  success:    { spin: 0.070, pulse: 0.30, spread: 0.96, energy: 0.85, hue: 0.10 },
  error:      { spin: 0.040, pulse: 0.22, spread: 0.92, energy: 0.45, hue: -0.10 },
};

const CORE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    // A slow standing wave over the shell. Amplitude stays under 4% of the
    // radius so the silhouette reads as a solid object that is breathing,
    // not as a wobbling blob.
    float wave = sin(position.y * 5.0 + uTime * 1.4)
               * cos(position.x * 4.0 - uTime * 1.1);
    vec3 displaced = position * (1.0 + wave * 0.035 * uPulse);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const CORE_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Fresnel: bright where the surface turns away from the viewer. This is
    // what makes it look like a lit volume rather than a coloured wireframe.
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);

    // Alpha comes from the rim ALONE — no constant term. A flat base alpha
    // looks harmless in isolation, but this shell is double-sided and blended
    // additively, so every fragment is deposited twice and the interior of the
    // sphere accumulates into a solid, near-white disc. Weighting by fresnel
    // squared keeps the contribution where the silhouette is and leaves the
    // middle genuinely transparent, which is what makes it read as a volume
    // you can see through rather than a lit ball.
    float a = fres * fres * 0.85;
    vec3 col = uColor * (0.55 + fres * 1.15) * uEnergy;
    gl_FragColor = vec4(col * a, a);
  }
`;

const POINT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpread;
  uniform float uSize;
  attribute float aSeed;
  varying float vFade;

  void main() {
    vec3 p = position * uSpread;
    // Each particle drifts on its own phase so the shell never pulses in
    // lockstep, which is what makes a point cloud look mechanical.
    float t = uTime * (0.25 + aSeed * 0.5);
    p += vec3(sin(t + aSeed * 6.28), cos(t * 1.3 + aSeed * 3.14), sin(t * 0.8)) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = clamp(1.0 - (-mv.z - 2.0) / 6.0, 0.15, 1.0);
    gl_PointSize = uSize * (0.6 + aSeed * 0.9) * (300.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;

  void main() {
    // Round, soft-edged points. Discarding outside the disc avoids the square
    // sprites that give cheap particle systems away.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    float a = smoothstep(0.25, 0.0, r);
    gl_FragColor = vec4(uColor * a * vFade * 0.55, a * vFade * 0.55);
  }
`;

function fibonacciSphere(count: number, radius: number): Float32Array {
  // Even distribution — random spherical coordinates cluster at the poles and
  // the clustering is very visible on a slowly rotating shell.
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

export function createAICore(
  canvas: HTMLCanvasElement,
  opts: CoreOptions,
): CoreHandle {
  const particleCount = Math.max(120, Math.min(opts.particles ?? 900, 2400));
  const base = new THREE.Color(opts.accent || '#7c6cff');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false, // the fresnel edge hides aliasing; AA costs more than it buys here
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6.6);

  const group = new THREE.Group();
  scene.add(group);

  // ── Shell ──────────────────────────────────────────────────────────────
  const coreGeo = new THREE.IcosahedronGeometry(1.18, 3);
  const coreUniforms = {
    uTime: { value: 0 },
    uPulse: { value: TUNING.idle.pulse },
    uEnergy: { value: TUNING.idle.energy },
    uColor: { value: base.clone() },
  };
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreUniforms,
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // A sparse wireframe over the shell reads as structure — the difference
  // between "a glowing ball" and "an engineered object".
  const wireGeo = new THREE.IcosahedronGeometry(1.19, 1);
  const wireMat = new THREE.MeshBasicMaterial({
    color: base.clone(),
    wireframe: true,
    transparent: true,
    opacity: 0.10,
    depthWrite: false,
  });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  group.add(wireMesh);

  // ── Orbiting particle field ────────────────────────────────────────────
  const positions = fibonacciSphere(particleCount, 1.95);
  const seeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) seeds[i] = Math.random();

  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const pointUniforms = {
    uTime: { value: 0 },
    uSpread: { value: TUNING.idle.spread },
    uSize: { value: 1.7 },
    uColor: { value: base.clone() },
  };
  const pointMat = new THREE.ShaderMaterial({
    uniforms: pointUniforms,
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(pointGeo, pointMat);
  group.add(points);

  // ── Neural connections ─────────────────────────────────────────────────
  // Short chords between nearby points. Capped hard: the visual gain flattens
  // long before the cost does, and this is the one part that can quietly turn
  // a cheap scene into an expensive one.
  const linkPositions: number[] = [];
  const maxLinks = Math.min(90, Math.floor(particleCount / 8));
  for (let i = 0; i < particleCount && linkPositions.length < maxLinks * 6; i += 7) {
    const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
    for (let j = i + 1; j < Math.min(i + 40, particleCount); j++) {
      const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
      const d = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
      if (d < 0.75) {
        linkPositions.push(ax, ay, az, bx, by, bz);
        break;
      }
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(linkPositions), 3));
  const linkMat = new THREE.LineBasicMaterial({
    color: base.clone(),
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const links = new THREE.LineSegments(linkGeo, linkMat);
  group.add(links);

  // ── State ──────────────────────────────────────────────────────────────
  let target = TUNING.idle;
  const current = { ...TUNING.idle };
  let pointerX = 0.5;
  let pointerY = 0.5;
  let disposed = false;
  const stateColor = base.clone();

  function applyColor(hueShift: number) {
    stateColor.copy(base);
    if (hueShift !== 0) {
      const hsl = { h: 0, s: 0, l: 0 };
      stateColor.getHSL(hsl);
      stateColor.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, hsl.l);
    }
    coreUniforms.uColor.value.copy(stateColor);
    pointUniforms.uColor.value.copy(stateColor);
    wireMat.color.copy(stateColor);
    linkMat.color.copy(stateColor);
  }

  return {
    setState(state) {
      target = TUNING[state] ?? TUNING.idle;
    },

    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },

    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      // Capped rather than native: a 3x retina buffer triples fragment cost for
      // an effect that is mostly soft gradients, where it is invisible.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    frame(elapsed) {
      if (disposed) return;

      // Ease towards the target so a state change is a transition, not a jump.
      const k = opts.still ? 1 : 0.045;
      current.spin += (target.spin - current.spin) * k;
      current.pulse += (target.pulse - current.pulse) * k;
      current.spread += (target.spread - current.spread) * k;
      current.energy += (target.energy - current.energy) * k;
      current.hue += (target.hue - current.hue) * k;

      coreUniforms.uTime.value = elapsed;
      coreUniforms.uPulse.value = current.pulse;
      coreUniforms.uEnergy.value = current.energy;
      pointUniforms.uTime.value = elapsed;
      pointUniforms.uSpread.value = current.spread;
      applyColor(current.hue);

      group.rotation.y = elapsed * current.spin;
      group.rotation.x = Math.sin(elapsed * 0.18) * 0.12;
      points.rotation.y = -elapsed * current.spin * 0.55;
      links.rotation.y = points.rotation.y;
      linkMat.opacity = 0.07 + current.energy * 0.09;

      // Parallax: the object leans toward the pointer. Small on purpose —
      // enough to feel physically present, not enough to swing about.
      const px = (pointerX - 0.5) * 0.5;
      const py = (pointerY - 0.5) * 0.35;
      camera.position.x += (px - camera.position.x) * 0.05;
      camera.position.y += (-py - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      // Everything allocated above, released here — geometries, materials and
      // the GL context itself. Leaving the context alive is how a page that
      // mounts this a few times ends up losing WebGL entirely.
      coreGeo.dispose();
      wireGeo.dispose();
      pointGeo.dispose();
      linkGeo.dispose();
      coreMat.dispose();
      wireMat.dispose();
      pointMat.dispose();
      linkMat.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
