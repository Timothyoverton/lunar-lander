import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Vec2 { x: number; y: number; }

interface Lander {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  fuel: number;
  thrusting: boolean;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface Enemy {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  fireTimer: number;
}

interface EnemyBullet { x: number; y: number; vx: number; vy: number; }

interface PowerUp {
  x: number; y: number; vy: number;
  type: 'fuel' | 'pad';
  collected: boolean;
}

interface LandingPad {
  x: number; y: number;
  width: number;
  multiplier: number;
}

interface GameRecord { level: number; score: number; time: string; }

const GW = 960;
const GH = 700;
const GRAVITY   = 0.018;
const THRUST     = 0.045;
const ROT_SPEED  = 0.04;
const MAX_LAND_VX    = 1.2;
const MAX_LAND_VY    = 2.0;
const MAX_LAND_ANGLE = 0.35;

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  readonly GW = GW;
  readonly GH = GH;
  readonly MAX_LAND_VX = MAX_LAND_VX;
  readonly MAX_LAND_VY = MAX_LAND_VY;
  readonly MAX_LAND_ANGLE = MAX_LAND_ANGLE;

  score    = signal(0);
  lives    = signal(3);
  level    = signal(1);
  gameOver = signal(false);
  message  = signal('');

  lander!: Lander;
  terrain:      Vec2[]        = [];
  pads:         LandingPad[]  = [];
  particles:    Particle[]    = [];
  enemies:      Enemy[]       = [];
  enemyBullets: EnemyBullet[] = [];
  powerUps:     PowerUp[]     = [];

  private messageTimer       = 0;
  private gameLoop: number | null = null;
  private lastTime           = 0;
  landed             = false;
  crashed            = false;
  private landingPauseTimer  = 0;

  sessionHistory: GameRecord[] = [];
  private gameCount = 0;

  keys: Record<string, boolean> = {};

  ngOnInit()    { this.initGame(); }
  ngOnDestroy() { if (this.gameLoop) cancelAnimationFrame(this.gameLoop); }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    this.keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  }
  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) { this.keys[e.key] = false; }

  // ── Init ──────────────────────────────────────────────────────────────────
  initGame() {
    this.score.set(0);
    this.lives.set(3);
    this.level.set(1);
    this.gameOver.set(false);
    this.message.set('');
    this.sessionHistory = [];
    this.gameCount = 0;
    this.startLevel();
  }

  startLevel() {
    this.landed  = false;
    this.crashed = false;
    this.landingPauseTimer = 0;
    this.particles    = [];
    this.enemyBullets = [];
    this.powerUps     = [];
    this.buildTerrain();
    this.spawnLander();
    this.spawnEnemies();
    if (!this.gameLoop) this.beginLoop();
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  buildTerrain() {
    const lv   = this.level();
    const segs = 40;
    const segW = GW / segs;
    const heights: number[] = [];

    let h = GH * 0.55;
    for (let i = 0; i <= segs; i++) {
      const roughness = 70 + lv * 14;
      h += (Math.random() - 0.5) * roughness;
      h = Math.max(GH * 0.38, Math.min(GH * 0.80, h));
      heights.push(h);
    }

    // Landing pads — fewer, narrower on higher levels
    const padCount = Math.max(1, 3 - Math.floor(lv / 3));
    const padWidth = Math.max(55, 160 - lv * 13);
    const padSeg   = Math.max(1, Math.round(padWidth / segW));

    this.pads = [];
    for (let p = 0; p < padCount; p++) {
      const col = Math.min(segs - padSeg - 2,
        Math.floor(3 + (p * (segs - 6)) / padCount + 1 + Math.random() * 2));
      const flatH = heights[col];
      for (let i = col; i <= col + padSeg && i <= segs; i++) heights[i] = flatH;
      this.pads.push({
        x: col * segW,
        y: flatH,
        width: padSeg * segW,
        multiplier: padWidth <= 75 ? 4 : padWidth <= 100 ? 3 : padWidth <= 130 ? 2 : 1,
      });
    }

    const pts: Vec2[] = [];
    for (let i = 0; i <= segs; i++) pts.push({ x: i * segW, y: heights[i] });
    pts.push({ x: GW, y: GH }, { x: 0, y: GH });
    this.terrain = pts;
  }

  terrainPath(): string {
    return this.terrain.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
  }

  // ── Lander ────────────────────────────────────────────────────────────────
  spawnLander() {
    const lv = this.level();
    const startX = GW * (0.15 + ((lv * 137) % 70) / 100);
    this.lander = {
      x: startX, y: 55,
      vx: ((lv % 3) - 1) * 0.5,
      vy: 0.3,
      angle: 0,
      fuel: Math.max(280, 580 - lv * 22),
      thrusting: false,
    };
  }

  // ── Enemies ───────────────────────────────────────────────────────────────
  spawnEnemies() {
    this.enemies = [];
    const lv = this.level();
    const count = Math.min(Math.floor(lv / 2), 4);
    for (let i = 0; i < count; i++) {
      this.enemies.push({
        x: Math.random() * GW,
        y: 80 + Math.random() * 180,
        vx: (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.9),
        vy: 0,
        radius: 18,
        fireTimer: 90 + Math.random() * 150,
      });
    }
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  beginLoop() {
    this.lastTime = 0;
    const tick = (ts: number) => {
      if (this.lastTime === 0) this.lastTime = ts;
      const dt = Math.min(ts - this.lastTime, 50);
      this.lastTime = ts;
      const f = dt / (1000 / 60);
      if (!this.gameOver()) this.update(f);
      this.gameLoop = requestAnimationFrame(tick);
    };
    this.gameLoop = requestAnimationFrame(tick);
  }

  update(f: number) {
    if (this.messageTimer > 0) {
      this.messageTimer -= f;
      if (this.messageTimer <= 0) this.message.set('');
    }

    if (this.landed || this.crashed) {
      this.landingPauseTimer -= f;
      this.updateParticles(f);
      if (this.landingPauseTimer <= 0) {
        if (this.crashed) {
          if (this.lives() <= 1) { this.doGameOver(); return; }
          this.lives.update(l => l - 1);
        }
        this.startLevel();
      }
      return;
    }

    this.updateLander(f);
    this.updateEnemies(f);
    this.updateParticles(f);
    this.updatePowerUps(f);
    this.checkCollisions();
  }

  updateLander(f: number) {
    const l = this.lander;
    if (this.keys['ArrowLeft']  || this.keys['a']) l.angle -= ROT_SPEED * f;
    if (this.keys['ArrowRight'] || this.keys['d']) l.angle += ROT_SPEED * f;

    l.thrusting = !!(this.keys['ArrowUp'] || this.keys[' ']) && l.fuel > 0;
    if (l.thrusting) {
      l.vx += Math.sin(l.angle) * THRUST * f;
      l.vy -= Math.cos(l.angle) * THRUST * f;
      l.fuel = Math.max(0, l.fuel - f);
      this.emitThrust(f);
    }

    l.vy += GRAVITY * f;
    l.x  += l.vx * f;
    l.y  += l.vy * f;

    if (l.x < -20)      l.x = GW + 20;
    if (l.x > GW + 20)  l.x = -20;
    if (l.y < 10) { l.y = 10; l.vy = Math.max(0, l.vy); }
  }

  emitThrust(f: number) {
    const l = this.lander;
    const count = Math.ceil(3 * f);
    for (let i = 0; i < count; i++) {
      const dir   = l.angle + Math.PI + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        x: l.x - Math.sin(l.angle) * 10,
        y: l.y + Math.cos(l.angle) * 10,
        vx: Math.sin(dir) * speed, vy: -Math.cos(dir) * speed,
        life: 18 + Math.random() * 14, maxLife: 32,
        color: Math.random() > 0.5 ? '#ff8800' : '#ffdd00',
        size: 3 + Math.random() * 3,
      });
    }
  }

  emitExplosion(x: number, y: number) {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 30 + Math.random() * 30, maxLife: 60,
        color: ['#ff4400','#ff8800','#ffdd00','#ffffff'][Math.floor(Math.random() * 4)],
        size: 2 + Math.random() * 6,
      });
    }
  }

  updateParticles(f: number) {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * f; p.y += p.vy * f;
      p.vy += 0.04 * f; p.life -= f;
      return p.life > 0;
    });
  }

  updateEnemies(f: number) {
    const l = this.lander;
    for (const e of this.enemies) {
      e.x += e.vx * f; e.y += e.vy * f;
      if (e.x < 20)  { e.x = 20;  e.vx =  Math.abs(e.vx); }
      if (e.x > GW - 20) { e.x = GW - 20; e.vx = -Math.abs(e.vx); }
      e.vy += (Math.random() - 0.5) * 0.06 * f;
      e.vy  = Math.max(-0.6, Math.min(0.6, e.vy));
      if (e.y < 55)  e.vy = Math.abs(e.vy);
      if (e.y > 280) e.vy = -Math.abs(e.vy);

      e.fireTimer -= f;
      if (e.fireTimer <= 0) {
        e.fireTimer = 100 + Math.random() * 160;
        const dx = l.x - e.x, dy = l.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.enemyBullets.push({ x: e.x, y: e.y, vx: dx / dist * 2.8, vy: dy / dist * 2.8 });
      }
    }
    this.enemyBullets = this.enemyBullets.filter(b => {
      b.x += b.vx * f; b.y += b.vy * f;
      return b.x > 0 && b.x < GW && b.y > 0 && b.y < GH;
    });
  }

  updatePowerUps(f: number) {
    this.powerUps = this.powerUps.filter(p => {
      p.y += p.vy * f;
      return p.y < GH && !p.collected;
    });
  }

  // ── Collisions ────────────────────────────────────────────────────────────
  checkCollisions() {
    const l = this.lander;

    const terrY = this.getTerrainY(l.x);
    if (l.y + 14 >= terrY) {
      const pad = this.pads.find(p => l.x >= p.x && l.x <= p.x + p.width);
      if (pad && Math.abs(l.vx) <= MAX_LAND_VX && l.vy <= MAX_LAND_VY && Math.abs(l.angle) <= MAX_LAND_ANGLE) {
        this.doLand(pad);
      } else {
        this.doCrash(l.x, l.y);
      }
      return;
    }

    for (const e of this.enemies) {
      const dx = l.x - e.x, dy = l.y - e.y;
      if (dx * dx + dy * dy < (e.radius + 12) ** 2) { this.doCrash(l.x, l.y); return; }
    }

    for (const b of this.enemyBullets) {
      const dx = l.x - b.x, dy = l.y - b.y;
      if (dx * dx + dy * dy < 14 * 14) { this.doCrash(l.x, l.y); return; }
    }

    for (const p of this.powerUps) {
      const dx = l.x - p.x, dy = l.y - p.y;
      if (dx * dx + dy * dy < 22 * 22 && !p.collected) {
        p.collected = true;
        if (p.type === 'fuel') {
          this.lander.fuel = Math.min(this.lander.fuel + 160, 600);
          this.showMessage('+FUEL BOOST!');
        } else {
          this.growPads();
          this.showMessage('PADS WIDENED!');
        }
      }
    }
  }

  getTerrainY(x: number): number {
    const pts = this.terrain;
    for (let i = 0; i < pts.length - 3; i++) {
      if (x >= pts[i].x && x < pts[i + 1].x) {
        const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x);
        return pts[i].y + t * (pts[i + 1].y - pts[i].y);
      }
    }
    return GH;
  }

  doLand(pad: LandingPad) {
    this.landed = true;
    const fuelBonus  = Math.floor(this.lander.fuel * 0.5);
    const levelBonus = this.level() * 100;
    const padBonus   = pad.multiplier * 200;
    const pts = fuelBonus + levelBonus + padBonus;
    this.score.update(s => s + pts);
    this.showMessage(`NICE LANDING!  +${pts}`);
    this.landingPauseTimer = 150;
    // Maybe drop a power-up near the pad
    if (Math.random() < 0.35) {
      const type: 'fuel' | 'pad' = Math.random() < 0.5 ? 'fuel' : 'pad';
      this.powerUps.push({ x: pad.x + pad.width / 2, y: pad.y - 60, vy: 0, type, collected: false });
    }
    setTimeout(() => this.level.update(l => l + 1), 0);
  }

  doCrash(x: number, y: number) {
    if (this.crashed) return;
    this.crashed = true;
    this.emitExplosion(x, y);
    this.showMessage('CRASHED!');
    this.landingPauseTimer = 130;
  }

  growPads() {
    for (const p of this.pads) {
      const extra = 50;
      p.x     = Math.max(0, p.x - extra / 2);
      p.width = Math.min(p.width + extra, 280);
    }
  }

  showMessage(msg: string) {
    this.message.set(msg);
    this.messageTimer = 130;
  }

  doGameOver() {
    this.gameOver.set(true);
    this.gameCount++;
    this.sessionHistory.unshift({ level: this.level(), score: this.score(), time: new Date().toLocaleTimeString() });
  }

  restartGame() {
    if (this.gameLoop) { cancelAnimationFrame(this.gameLoop); this.gameLoop = null; }
    this.initGame();
  }

  // ── Template helpers ──────────────────────────────────────────────────────
  landerTransform(): string {
    const l = this.lander;
    return `translate(${l?.x ?? 0} ${l?.y ?? 0}) rotate(${((l?.angle ?? 0) * 180 / Math.PI).toFixed(2)})`;
  }

  particleOpacity(p: Particle): number { return Math.max(0, p.life / p.maxLife); }

  fuelPct(): number { return Math.round(((this.lander?.fuel ?? 0) / 580) * 100); }

  fuelColor(): string {
    const p = this.fuelPct();
    return p > 50 ? '#00ff88' : p > 25 ? '#ffdd00' : '#ff4444';
  }

  velColor(): string { return this.speedOk() ? '#00ff88' : '#ff4444'; }
  angColor(): string { return this.angleOk() ? '#00ff88' : '#ff4444'; }

  speedOk(): boolean {
    return Math.abs(this.lander?.vx ?? 0) <= MAX_LAND_VX && (this.lander?.vy ?? 0) <= MAX_LAND_VY;
  }
  angleOk(): boolean { return Math.abs(this.lander?.angle ?? 0) <= MAX_LAND_ANGLE; }

  padLabel(pad: LandingPad): string { return pad.multiplier > 1 ? `×${pad.multiplier}` : ''; }
  livesArray(): number[] { return Array(this.lives()).fill(0); }
  getBestScore(): number { return this.sessionHistory.length ? Math.max(...this.sessionHistory.map(r => r.score)) : 0; }
}
