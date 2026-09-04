import type { MonsterAttackDefinition } from '@data/schemas/monster';
import type { HeightProvider } from '@core/world/Terrain';
import { Vec3 } from '@shared/math/Vec3';

/**
 * モンスターの投射物（岩など）。放物線で飛び、地形か対象に当たると消える。
 */
export interface Projectile {
  id: number;
  ownerId: string;
  attack: MonsterAttackDefinition;
  position: Vec3;
  previousPosition: Vec3;
  velocity: Vec3;
  radius: number;
  gravity: number;
  age: number;
  alive: boolean;
  hasHitPlayer: boolean;
}

const MAX_AGE_SECONDS = 6;

export class ProjectileManager {
  readonly projectiles: Projectile[] = [];
  private nextId = 1;

  constructor(private readonly terrain: HeightProvider) {}

  get alive(): Projectile[] {
    return this.projectiles.filter((p) => p.alive);
  }

  /**
   * origin から target へ届くよう初速を解く。
   * 水平速度を固定し、飛行時間から必要な鉛直初速を逆算する（狙いが常に合う = 回避を「読み」で行える）。
   */
  spawnArc(ownerId: string, attack: MonsterAttackDefinition, origin: Vec3, target: Vec3, aimHeightOffset = 0): Projectile {
    const motion = attack.motion;
    const speed = motion.projectileSpeed ?? 15;
    const gravity = motion.projectileGravity ?? 10;
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const horizontal = Math.max(Math.sqrt(dx * dx + dz * dz), 0.5);
    const flightTime = horizontal / speed;
    // 足元ではなく胴体（被弾球の中心）を狙う。足元狙いだと手前で地面に触れて消える。
    const dy = target.y + aimHeightOffset - origin.y;
    const vy = dy / flightTime + 0.5 * gravity * flightTime;

    const projectile: Projectile = {
      id: this.nextId++,
      ownerId,
      attack,
      position: origin.clone(),
      previousPosition: origin.clone(),
      velocity: new Vec3((dx / horizontal) * speed, vy, (dz / horizontal) * speed),
      radius: motion.projectileRadius ?? 0.5,
      gravity,
      age: 0,
      alive: true,
      hasHitPlayer: false,
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  update(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.previousPosition.copy(p.position);
      p.velocity.y -= p.gravity * dt;
      p.position.addScaled(p.velocity, dt);
      p.age += dt;
      // 中心が地面に達したら消える（半径ぶん沈んで見えるが、浅い放物線でも狙った点まで届く）
      const ground = this.terrain.getHeight(p.position.x, p.position.z);
      if (p.position.y <= ground || p.age > MAX_AGE_SECONDS) {
        p.alive = false;
      }
    }
    // 死んだ弾は配列から外す（描画側は alive フラグで先に消している）
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!(this.projectiles[i] as Projectile).alive) this.projectiles.splice(i, 1);
    }
  }

  clear(): void {
    this.projectiles.length = 0;
  }
}
