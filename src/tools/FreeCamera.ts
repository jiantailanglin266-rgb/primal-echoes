import * as THREE from 'three';

/**
 * 撮影用の自由カメラ（写真モード・トレーラーで共用）。
 * マウスドラッグで向き、ホイールで前後、W A S D で移動、Q / E で上下、Shift で速く。
 * ゲームの CameraRig を止めるのではなく、描画直前に camera へ上書きする。
 */
export class FreeCamera {
  readonly position = new THREE.Vector3(0, 6, -14);
  yaw = 0;
  pitch = -0.15;
  speed = 8;
  /** 地面より下へ潜らないための高さ関数（無ければ制限なし）。 */
  groundHeight: ((x: number, z: number) => number) | null = null;
  private readonly keys = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private wheel = 0;
  private detach: (() => void) | null = null;

  attach(canvas: HTMLElement): void {
    const down = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const move = (e: PointerEvent): void => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - this.lastX) * 0.0035;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.lastY) * 0.0035, -1.4, 1.4);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const up = (): void => {
      this.dragging = false;
    };
    const wheel = (e: WheelEvent): void => {
      this.wheel += -e.deltaY * 0.01;
      e.preventDefault();
    };
    const key = (pressed: boolean) => (e: KeyboardEvent): void => {
      if (pressed) this.keys.add(e.code);
      else this.keys.delete(e.code);
    };
    const kd = key(true);
    const ku = key(false);
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    this.detach = () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }

  dispose(): void {
    this.detach?.();
    this.detach = null;
  }

  /** 位置と向きを直接置く（トレーラーのキーフレーム用）。 */
  set(x: number, y: number, z: number, lookX: number, lookY: number, lookZ: number): void {
    this.position.set(x, y, z);
    const dx = lookX - x;
    const dy = lookY - y;
    const dz = lookZ - z;
    this.yaw = Math.atan2(dx, dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    const c = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * c, Math.sin(this.pitch), Math.cos(this.yaw) * c);
  }

  update(dt: number): void {
    const fwd = this.forward();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3 : 1;
    const step = this.speed * boost * dt;
    if (this.keys.has('KeyW')) this.position.addScaledVector(fwd, step);
    if (this.keys.has('KeyS')) this.position.addScaledVector(fwd, -step);
    if (this.keys.has('KeyD')) this.position.addScaledVector(right, step);
    if (this.keys.has('KeyA')) this.position.addScaledVector(right, -step);
    if (this.keys.has('KeyE')) this.position.y += step;
    if (this.keys.has('KeyQ')) this.position.y -= step;
    if (this.wheel !== 0) {
      this.position.addScaledVector(fwd, this.wheel * 2);
      this.wheel = 0;
    }
    if (this.groundHeight) this.position.y = Math.max(this.position.y, this.groundHeight(this.position.x, this.position.z) + 0.4);
  }

  apply(camera: THREE.PerspectiveCamera): void {
    camera.position.copy(this.position);
    const look = this.forward().add(this.position);
    camera.lookAt(look);
  }
}
