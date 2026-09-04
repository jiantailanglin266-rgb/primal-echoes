import * as THREE from 'three';
import type { Vec3 } from '@shared/math/Vec3';

const MAX_PARTICLES = 400;
const GRAVITY = 12;

interface Particle {
  index: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

/**
 * ヒットスパークの仮 VFX。点群を使い回し、命中位置から弾ける。
 * 「敵の動きが見えなくならない」よう小さく短く、数も絞る。
 */
export class HitSparkView {
  readonly object: THREE.Points;
  private readonly positions = new Float32Array(MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_PARTICLES * 3);
  private readonly particles: Particle[] = [];
  private readonly free: number[] = [];
  private readonly color = new THREE.Color();

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.object = new THREE.Points(geometry, material);
    this.object.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.free.push(i);
      this.positions[i * 3 + 1] = -1000;
    }
  }

  burst(at: Vec3, count: number, colorHex: number, speed = 5): void {
    this.color.setHex(colorHex);
    for (let n = 0; n < count; n++) {
      const index = this.free.pop();
      if (index === undefined) return;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.positions[index * 3] = at.x;
      this.positions[index * 3 + 1] = at.y;
      this.positions[index * 3 + 2] = at.z;
      this.colors[index * 3] = this.color.r;
      this.colors[index * 3 + 1] = this.color.g;
      this.colors[index * 3 + 2] = this.color.b;
      const maxLife = 0.25 + Math.random() * 0.2;
      this.particles.push({ index, vx: Math.sin(phi) * Math.cos(theta) * s, vy: Math.abs(Math.cos(phi)) * s + 1.5, vz: Math.sin(phi) * Math.sin(theta) * s, life: maxLife, maxLife });
    }
  }

  update(frameDt: number): void {
    if (this.particles.length === 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as Particle;
      p.life -= frameDt;
      if (p.life <= 0) {
        this.positions[p.index * 3 + 1] = -1000;
        this.free.push(p.index);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * frameDt;
      const base = p.index * 3;
      this.positions[base] = (this.positions[base] ?? 0) + p.vx * frameDt;
      this.positions[base + 1] = (this.positions[base + 1] ?? 0) + p.vy * frameDt;
      this.positions[base + 2] = (this.positions[base + 2] ?? 0) + p.vz * frameDt;
      const fade = p.life / p.maxLife;
      this.colors[base] = (this.colors[base] ?? 0) * (0.9 + 0.1 * fade);
    }
    (this.object.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.object.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
