import * as THREE from 'three';
import type { Weather } from '@core/world/Weather';

const RAIN_COUNT = 1400;
const RAIN_BOX = { x: 40, y: 22, z: 40 };
const RAIN_SPEED = 26;

/**
 * 雨の仮表現: カメラ周辺に落ちる点群。
 * 空・フォグ・太陽の変化は render/Environment が Weather.intensity から行う。
 */
export class WeatherView {
  readonly object = new THREE.Group();
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly material: THREE.PointsMaterial;

  constructor(private readonly weather: Weather) {
    this.positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * RAIN_BOX.x;
      this.positions[i * 3 + 1] = Math.random() * RAIN_BOX.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({ color: 0xcfdce8, size: 0.08, transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.object.add(this.points);
  }

  update(frameDt: number, cameraPosition: THREE.Vector3): void {
    const k = this.weather.intensity;
    this.material.opacity = 0.55 * k;
    this.points.visible = k > 0.02;
    if (!this.points.visible) return;

    this.object.position.set(cameraPosition.x, cameraPosition.y - RAIN_BOX.y * 0.6, cameraPosition.z);
    const fall = RAIN_SPEED * frameDt;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = this.positions[i * 3 + 1] as number;
      y -= fall;
      if (y < 0) y += RAIN_BOX.y;
      this.positions[i * 3 + 1] = y;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
