# Breakout Game

A neon retro Breakout game built with Angular 20 — smash all the bricks with a bouncing ball!

## Play Now

🚀 **Play the game:** https://timothyoverton.github.io/breakout-game/

## How to Play

1. Open the game in your browser (click the link above!)
2. Press **← → arrow keys** (or **A / D**) to move your paddle left and right
3. Press **SPACE** to launch the ball
4. Smash all the bricks to clear the level — don't let the ball fall!

## Power-ups

Power-ups drop from bricks when you destroy them. Catch them with your paddle:

| Icon | Power-up | What it does |
|------|----------|--------------|
| ⟷ | Wide Paddle | Your paddle gets much wider for 10 seconds |
| ● | Multi-Ball | Two extra balls join the game! |
| ↓ | Slow Ball | The ball slows down for 10 seconds |
| ♥ | Extra Life | Gain one extra life |
| ⚡ | Laser Shot | Press SPACE to fire lasers upward — destroys bricks! |

## Tips

- Hit the ball with the **edge of the paddle** to send it at a sharp angle
- Aim for the top rows first — they give the most points
- Bricks that take multiple hits will crack and go darker
- Clear all bricks to advance to the next level (ball gets faster!)

## Local Development

```bash
npm install
npm start
```

Visit http://localhost:4200/

## Build and Deploy

```bash
# Build for production
npm run build:prod

# Deploy to GitHub Pages
npm run deploy
```

---

Built with Angular 20 and deployed via GitHub Pages
