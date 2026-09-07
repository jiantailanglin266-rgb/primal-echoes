import * as THREE from 'three';

/**
 * 外部テクスチャが無くても地形に質感を出すための手続き生成。
 * 値ノイズ（多段）で albedo と高さを作り、高さから法線を差分で求める。
 * `assets/textures/terrain/` に本物が置かれたら TerrainMaterial 側で差し替える。
 */
function hash(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** タイル可能な fBm（周期 = size セル）。 */
function fbm(x: number, y: number, seed: number, octaves: number, period: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    const px = ((x * freq) % period + period) % period;
    const py = ((y * freq) % period + period) % period;
    sum += valueNoise(px, py, seed + o * 17) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

export interface TerrainLayerTextures {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
}

export type TerrainLayerKind = 'grass' | 'dirt' | 'rock';

const PALETTES: Record<TerrainLayerKind, { base: [number, number, number]; alt: [number, number, number]; contrast: number; bump: number }> = {
  grass: { base: [0.28, 0.42, 0.2], alt: [0.42, 0.5, 0.22], contrast: 0.7, bump: 0.35 },
  dirt: { base: [0.36, 0.28, 0.2], alt: [0.5, 0.4, 0.28], contrast: 0.6, bump: 0.5 },
  rock: { base: [0.42, 0.4, 0.37], alt: [0.58, 0.55, 0.5], contrast: 0.9, bump: 1.0 },
};

export function createTerrainLayer(kind: TerrainLayerKind, size = 512, seed = 1): TerrainLayerTextures {
  const p = PALETTES[kind];
  const period = 8;
  const scale = period / size;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const n = fbm(x * scale, y * scale, seed, 5, period);
      const detail = fbm(x * scale * 4, y * scale * 4, seed + 101, 3, period * 4);
      const t = THREE.MathUtils.clamp((n - 0.5) * p.contrast + 0.5 + (detail - 0.5) * 0.35, 0, 1);
      height[i] = kind === 'rock' ? Math.pow(t, 0.8) : t;
      const r = p.base[0] + (p.alt[0] - p.base[0]) * t;
      const g = p.base[1] + (p.alt[1] - p.base[1]) * t;
      const b = p.base[2] + (p.alt[2] - p.base[2]) * t;
      albedo[i * 4] = Math.round(r * 255);
      albedo[i * 4 + 1] = Math.round(g * 255);
      albedo[i * 4 + 2] = Math.round(b * 255);
      albedo[i * 4 + 3] = 255;
    }
  }

  const normal = new Uint8Array(size * size * 4);
  const strength = 6 * p.bump;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const hl = height[y * size + ((x - 1 + size) % size)] as number;
      const hr = height[y * size + ((x + 1) % size)] as number;
      const hd = height[((y - 1 + size) % size) * size + x] as number;
      const hu = height[((y + 1) % size) * size + x] as number;
      const nx = (hl - hr) * strength;
      const ny = (hd - hu) * strength;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      normal[i * 4] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      normal[i * 4 + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      normal[i * 4 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      normal[i * 4 + 3] = 255;
    }
  }

  const map = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.DataTexture(normal, size, size, THREE.RGBAFormat);
  for (const tex of [map, normalMap]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }
  return { map, normalMap };
}
