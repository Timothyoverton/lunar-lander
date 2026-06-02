import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Paddle { x: number; y: number; width: number; height: number; speed: number; }
interface Ball { x: number; y: number; radius: number; vx: number; vy: number; onPaddle: boolean; }
interface Brick { x: number; y: number; width: number; height: number; health: number; maxHealth: number; color: string; points: number; }
interface PowerUp { x: number; y: number; width: number; height: number; speed: number; type: string; color: string; label: string; }
interface LaserShot { x: number; y: number; }
interface GameRecord { gameNumber: number; score: number; level: number; time: string; }

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  gameWidth  = 960;
  gameHeight = 720;

  score    = signal(0);
  lives    = signal(3);
  level    = signal(1);
  gameOver = signal(false);

  paddle: Paddle = { x: 420, y: 672, width: 120, height: 16, speed: 8 };
  balls:      Ball[]      = [];
  bricks:     Brick[]     = [];
  powerUps:   PowerUp[]   = [];
  laserShots: LaserShot[] = [];

  activePowerUp: string | null = null;
  powerUpTimer = 0;
  readonly powerUpDuration = 600;
  shootCooldown = 0;

  sessionHistory: GameRecord[] = [];
  gameCount = 0;

  gameLoop: number | null = null;
  private lastTime = 0;
  keys: { [key: string]: boolean } = {};

  // Brick grid constants
  readonly BRICK_COLS     = 12;
  readonly BRICK_W        = 68;
  readonly BRICK_H        = 22;
  readonly BRICK_GAP_X    = 4;
  readonly BRICK_GAP_Y    = 6;
  readonly BRICK_OFFSET_X = 50;   // (960 - 12*68 - 11*4) / 2 = 50
  readonly BRICK_OFFSET_Y = 55;
  readonly BALL_RADIUS    = 9;
  readonly BASE_SPEED     = 6.5;

  readonly ROW_DEFS = [
    { color: '#ff2266', health: 3, points: 70 },
    { color: '#ff6600', health: 2, points: 50 },
    { color: '#ffdd00', health: 2, points: 40 },
    { color: '#44ff44', health: 1, points: 30 },
    { color: '#00ccff', health: 1, points: 20 },
    { color: '#aa44ff', health: 1, points: 15 },
    { color: '#ff44aa', health: 1, points: 12 },
    { color: '#aaaaff', health: 1, points: 10 },
  ];

  private readonly POWER_UP_DEFS: Record<string, { color: string; label: string; name: string }> = {
    wide:  { color: '#ffdd00', label: '⟷', name: 'WIDE PADDLE' },
    multi: { color: '#ff44ff', label: '●', name: 'MULTI-BALL'  },
    slow:  { color: '#00ccff', label: '↓', name: 'SLOW BALL'   },
    life:  { color: '#ff4444', label: '♥', name: 'EXTRA LIFE'  },
    laser: { color: '#00ff88', label: '⚡', name: 'LASER SHOT'  },
  };

  ngOnInit()    { this.initGame(); }
  ngOnDestroy() { if (this.gameLoop) cancelAnimationFrame(this.gameLoop); }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(e: KeyboardEvent) {
    this.keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') e.preventDefault();
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(e: KeyboardEvent) { this.keys[e.key.toLowerCase()] = false; }

  initGame() {
    this.score.set(0);
    this.lives.set(3);
    this.level.set(1);
    this.gameOver.set(false);
    this.activePowerUp = null;
    this.powerUpTimer  = 0;
    this.shootCooldown = 0;
    this.powerUps      = [];
    this.laserShots    = [];
    this.paddle = { x: (this.gameWidth - 120) / 2, y: 672, width: 120, height: 16, speed: 8 };
    this.spawnBricks();
    this.resetBall();
    this.startGameLoop();
  }

  spawnBricks() {
    this.bricks = [];
    const rows = Math.min(5 + Math.floor((this.level() - 1) / 2), 8);
    for (let row = 0; row < rows; row++) {
      const def = this.ROW_DEFS[Math.min(row, this.ROW_DEFS.length - 1)];
      for (let col = 0; col < this.BRICK_COLS; col++) {
        this.bricks.push({
          x:         this.BRICK_OFFSET_X + col * (this.BRICK_W + this.BRICK_GAP_X),
          y:         this.BRICK_OFFSET_Y + row * (this.BRICK_H + this.BRICK_GAP_Y),
          width:     this.BRICK_W,
          height:    this.BRICK_H,
          health:    def.health,
          maxHealth: def.health,
          color:     def.color,
          points:    def.points,
        });
      }
    }
  }

  resetBall() {
    const speed = this.BASE_SPEED + (this.level() - 1) * 0.3;
    this.balls = [{
      x: this.paddle.x + this.paddle.width / 2,
      y: this.paddle.y - this.BALL_RADIUS,
      radius: this.BALL_RADIUS,
      vx: 0,
      vy: -speed,
      onPaddle: true,
    }];
  }

  startGameLoop() {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    this.lastTime = 0;
    const tick = (timestamp: number) => {
      if (this.lastTime === 0) this.lastTime = timestamp;
      const dt = Math.min(timestamp - this.lastTime, 50);
      this.lastTime = timestamp;
      const f = dt / (1000 / 60);
      if (!this.gameOver()) this.update(f);
      this.gameLoop = requestAnimationFrame(tick);
    };
    this.gameLoop = requestAnimationFrame(tick);
  }

  update(f: number) {
    this.updatePaddle(f);
    this.updateBalls(f);
    this.updateLasers(f);
    this.updatePowerUps(f);
    if (this.powerUpTimer > 0) {
      this.powerUpTimer -= f;
      if (this.powerUpTimer <= 0) { this.powerUpTimer = 0; this.deactivatePowerUp(); }
    }
  }

  updatePaddle(f: number) {
    if (this.keys['arrowleft'] || this.keys['a'])
      this.paddle.x = Math.max(0, this.paddle.x - this.paddle.speed * f);
    if (this.keys['arrowright'] || this.keys['d'])
      this.paddle.x = Math.min(this.gameWidth - this.paddle.width, this.paddle.x + this.paddle.speed * f);

    for (const ball of this.balls) {
      if (ball.onPaddle) {
        ball.x = this.paddle.x + this.paddle.width / 2;
        ball.y = this.paddle.y - ball.radius;
      }
    }

    if (this.keys[' ']) {
      let launched = false;
      for (const ball of this.balls) {
        if (ball.onPaddle) { this.launchBall(ball); launched = true; }
      }
      if (!launched && this.activePowerUp === 'laser' && this.shootCooldown <= 0) {
        this.fireLaser();
        this.shootCooldown = 12;
      }
    }
    if (this.shootCooldown > 0) this.shootCooldown -= f;
  }

  launchBall(ball: Ball) {
    const speed = this.BASE_SPEED + (this.level() - 1) * 0.3;
    ball.onPaddle = false;
    ball.vx = speed * 0.35 * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = -speed;
  }

  fireLaser() {
    const cx = this.paddle.x + this.paddle.width / 2;
    this.laserShots.push({ x: cx - 18, y: this.paddle.y });
    this.laserShots.push({ x: cx + 14, y: this.paddle.y });
  }

  updateLasers(f: number) {
    this.laserShots = this.laserShots.filter(laser => {
      laser.y -= 14 * f;
      if (laser.y < 0) return false;
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const b = this.bricks[i];
        if (laser.x + 4 > b.x && laser.x < b.x + b.width && laser.y > b.y && laser.y < b.y + b.height) {
          b.health--;
          this.score.update(s => s + Math.floor(b.points / 2));
          if (b.health <= 0) this.bricks.splice(i, 1);
          return false;
        }
      }
      return true;
    });
  }

  updateBalls(f: number) {
    for (const ball of this.balls) {
      if (ball.onPaddle) continue;

      ball.x += ball.vx * f;
      ball.y += ball.vy * f;

      // Wall bounces
      if (ball.x - ball.radius <= 0)             { ball.x = ball.radius;                  ball.vx =  Math.abs(ball.vx); }
      if (ball.x + ball.radius >= this.gameWidth) { ball.x = this.gameWidth - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.radius <= 0)             { ball.y = ball.radius;                  ball.vy =  Math.abs(ball.vy); }

      // Paddle bounce — angle based on hit position
      if (ball.vy > 0 &&
          ball.x > this.paddle.x - ball.radius &&
          ball.x < this.paddle.x + this.paddle.width + ball.radius &&
          ball.y + ball.radius >= this.paddle.y &&
          ball.y < this.paddle.y + this.paddle.height) {
        const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
        const speed  = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
        const angle  = hitPos * (Math.PI / 3);  // -60° to +60°
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.max(Math.cos(angle) * speed, 2);
        ball.y  = this.paddle.y - ball.radius;
      }

      // Brick collisions
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        if (this.collideBallBrick(ball, this.bricks[i])) {
          const brick = this.bricks[i];
          brick.health--;
          this.score.update(s => s + brick.points);
          if (brick.health <= 0) {
            if (Math.random() < 0.12) this.dropPowerUp(brick);
            this.bricks.splice(i, 1);
          }
          break;
        }
      }
    }

    this.balls = this.balls.filter(b => b.onPaddle || b.y < this.gameHeight + 20);

    if (this.balls.length === 0) {
      if (this.lives() <= 1) { this.endGame(); return; }
      this.lives.update(l => l - 1);
      this.resetBall();
      return;
    }

    if (this.bricks.length === 0) this.nextLevel();
  }

  collideBallBrick(ball: Ball, brick: Brick): boolean {
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    if (dx * dx + dy * dy > ball.radius * ball.radius) return false;

    const overlapL = (ball.x + ball.radius) - brick.x;
    const overlapR = (brick.x + brick.width)  - (ball.x - ball.radius);
    const overlapT = (ball.y + ball.radius) - brick.y;
    const overlapB = (brick.y + brick.height) - (ball.y - ball.radius);
    const minH = Math.min(overlapL, overlapR);
    const minV = Math.min(overlapT, overlapB);

    if (minV <= minH) {
      ball.vy = -ball.vy;
      ball.y += (overlapT < overlapB ? -overlapT : overlapB);
    } else {
      ball.vx = -ball.vx;
      ball.x += (overlapL < overlapR ? -overlapL : overlapR);
    }
    return true;
  }

  updatePowerUps(f: number) {
    this.powerUps = this.powerUps.filter(pu => {
      pu.y += pu.speed * f;
      if (pu.x + pu.width > this.paddle.x && pu.x < this.paddle.x + this.paddle.width &&
          pu.y + pu.height >= this.paddle.y && pu.y <= this.paddle.y + this.paddle.height) {
        this.activatePowerUp(pu.type);
        return false;
      }
      return pu.y < this.gameHeight;
    });
  }

  dropPowerUp(brick: Brick) {
    const keys = Object.keys(this.POWER_UP_DEFS);
    const type = keys[Math.floor(Math.random() * keys.length)];
    const def  = this.POWER_UP_DEFS[type];
    this.powerUps.push({
      x: brick.x + brick.width / 2 - 14,
      y: brick.y + brick.height,
      width: 28, height: 28, speed: 2,
      type, color: def.color, label: def.label,
    });
  }

  activatePowerUp(type: string) {
    this.deactivatePowerUp();
    this.activePowerUp = type;
    this.powerUpTimer  = this.powerUpDuration;

    if (type === 'wide') {
      this.paddle.width = 200;
      this.paddle.x = Math.min(this.paddle.x, this.gameWidth - 200);
    } else if (type === 'multi') {
      const src = this.balls.find(b => !b.onPaddle) ?? this.balls[0];
      if (src) {
        const speed = Math.sqrt(src.vx ** 2 + src.vy ** 2);
        this.balls.push({ ...src, vx:  speed * 0.7, vy: -speed * 0.75 });
        this.balls.push({ ...src, vx: -speed * 0.7, vy: -speed * 0.75 });
      }
      this.powerUpTimer = 90;
    } else if (type === 'slow') {
      for (const b of this.balls) { if (!b.onPaddle) { b.vx *= 0.55; b.vy *= 0.55; } }
    } else if (type === 'life') {
      this.lives.update(l => Math.min(l + 1, 9));
      this.powerUpTimer = 90;
    }
  }

  deactivatePowerUp() {
    if (this.activePowerUp === 'wide') {
      this.paddle.width = 120;
      this.paddle.x = Math.min(this.paddle.x, this.gameWidth - 120);
    }
    if (this.activePowerUp === 'slow') {
      for (const b of this.balls) { if (!b.onPaddle) { b.vx /= 0.55; b.vy /= 0.55; } }
    }
    this.activePowerUp = null;
    this.powerUpTimer  = 0;
  }

  nextLevel() {
    this.level.update(l => l + 1);
    this.balls      = [];
    this.powerUps   = [];
    this.laserShots = [];
    this.deactivatePowerUp();
    this.paddle.width = 120;
    this.paddle.x     = (this.gameWidth - 120) / 2;
    this.spawnBricks();
    this.resetBall();
  }

  endGame() {
    this.gameOver.set(true);
    this.gameCount++;
    this.sessionHistory.unshift({
      gameNumber: this.gameCount,
      score:      this.score(),
      level:      this.level(),
      time:       new Date().toLocaleTimeString(),
    });
  }

  restartGame() {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    this.initGame();
  }

  brickDisplayColor(brick: Brick): string {
    return brick.health < brick.maxHealth ? brick.color + '88' : brick.color;
  }

  paddleBackground(): string {
    return this.activePowerUp === 'wide'
      ? 'linear-gradient(180deg, #ffff88 0%, #ffdd00 100%)'
      : 'linear-gradient(180deg, #88ff88 0%, #00ff00 100%)';
  }

  paddleShadow(): string {
    return this.activePowerUp === 'wide'
      ? '0 0 18px #ffdd00, 0 0 36px rgba(255,221,0,0.4)'
      : '0 0 18px #00ff00, 0 0 36px rgba(0,255,0,0.4)';
  }

  livesArray(): number[]   { return Array(this.lives()).fill(0); }
  hasBallOnPaddle(): boolean { return this.balls.some(b => b.onPaddle); }
  powerUpName(): string    { return this.activePowerUp ? (this.POWER_UP_DEFS[this.activePowerUp]?.name  ?? '') : ''; }
  powerUpColor(): string   { return this.activePowerUp ? (this.POWER_UP_DEFS[this.activePowerUp]?.color ?? '#fff') : '#fff'; }
  powerUpSeconds(): number { return Math.ceil(this.powerUpTimer / 60); }
  getBestScore(): number   { return this.sessionHistory.length ? Math.max(...this.sessionHistory.map(r => r.score)) : 0; }
}
