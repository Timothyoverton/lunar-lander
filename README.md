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

---

## 📚 For Future Claude: Complete Workflow for Cloning, Building & Deploying

If you're a future Claude instance that needs to clone an Angular stub repo, create a new project, and deploy it to GitHub Pages, here's the complete process:

### 1. **Initial Setup**
```bash
# Initialize git in target directory
git init

# Clone the stub repo
git clone https://github.com/Timothyoverton/angular-web-stub /tmp/angular-web-stub

# Copy all files from stub (excluding .git)
cp -r /tmp/angular-web-stub/* .
cp /tmp/angular-web-stub/.gitignore .
cp /tmp/angular-web-stub/.editorconfig .
```

### 2. **Configure Project Files**
Update these files with the new project name:
- **package.json**: Update `name` field and all build paths
  - Line: `"name": "PROJECT-NAME"`
  - Build script: `"build:prod": "ng build --configuration production --base-href=\"/PROJECT-NAME/\""`
  - Deploy script: `"deploy": "ng build --configuration production --base-href=\"/PROJECT-NAME/\" && npx angular-cli-ghpages --dir=dist/PROJECT-NAME/browser"`

- **angular.json**: Update project name and output path
  - Project name: `"PROJECT-NAME"`
  - Build target references: `"buildTarget": "PROJECT-NAME:build:..."`

### 3. **Setup Git Remote**
```bash
git config --global user.email "USER@EMAIL.COM"
git config --global user.name "User Name"
git add -A
git commit -m "Initial project setup from angular-web-stub"
git remote add origin https://github.com/USERNAME/PROJECT-NAME.git
git push -u origin master
```

**Note**: User must provide GitHub Personal Access Token for authentication if not already authenticated

### 4. **Enable GitHub Pages**
Use GitHub API to enable Pages:
```bash
curl -X POST \
  -H "Authorization: token GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/USERNAME/PROJECT-NAME/pages \
  -d '{"source": {"branch": "master", "path": "/"}}'
```

Then update to serve from `/docs` folder:
```bash
curl -X PUT \
  -H "Authorization: token GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/USERNAME/PROJECT-NAME/pages \
  -d '{"source": {"branch": "master", "path": "/docs"}}'
```

### 5. **Build & Deploy**
```bash
# Download Node.js if not available (use v22+ for Angular 20)
curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz | tar -xJ -C /tmp
export PATH="/tmp/node-v22.12.0-linux-x64/bin:$PATH"

# Install and build
npm install
npm run build:prod

# Copy built files to /docs folder
mkdir -p docs
cp -r dist/breakout-game/browser/* docs/
touch docs/.nojekyll

# Commit and push
git add -f docs
git commit -m "Deploy to GitHub Pages"
git push -u origin master
```

**Alternative**: This repo uses `angular-cli-ghpages` for deployment. Run `npm run deploy` instead of the docs folder approach above — it builds and pushes directly to the `gh-pages` branch.

### 6. **Verification**
```bash
# Test that the page is loading
curl -s https://Timothyoverton.github.io/breakout-game/ | grep "app-root"
```

### ⚠️ Critical Notes

1. **Node.js Version**: Angular 20+ requires Node.js v20.19+ or v22.12+. Use v22 if the build fails with version warnings.

2. **GitHub Pages + Jekyll**: GitHub Pages runs Jekyll by default, which interferes with static assets:
   - Create `.nojekyll` file in `/docs` folder to disable Jekyll
   - Serve from `/docs` folder instead of repository root

3. **Token Scope**: GitHub Personal Access Token must have `repo` scope. Workflow scope is needed only if pushing GitHub Actions workflow files.

4. **Build Output**: Angular 17+ builds to `dist/PROJECT-NAME/browser/`, NOT `dist/PROJECT-NAME/`. Always copy from the `/browser` subfolder.

5. **base-href**: Must match GitHub Pages URL path exactly:
   - For `https://username.github.io/project-name/` use `--base-href="/project-name/"`
   - Update in both `package.json` build scripts AND `src/index.html` `<base href>`

6. **Deployment Timeline**: GitHub Pages may take 2-5 minutes to update after pushing changes. Wait and clear browser cache if needed.

### 📋 Quick Reference Checklist
- ✅ Clone stub and copy files
- ✅ Update project name in package.json (3 places)
- ✅ Update project name in angular.json
- ✅ Create git remote and push
- ✅ Enable GitHub Pages via API (POST then PUT to `/docs` path)
- ✅ Install Node.js v22+
- ✅ Run `npm install && npm run build:prod`
- ✅ Create `/docs` folder with built files (or use `npm run deploy` for gh-pages branch)
- ✅ Add `.nojekyll` to `/docs` folder
- ✅ Push `/docs` folder to GitHub
- ✅ Wait 2-5 minutes and verify site loads

### 🔗 Live Site URL
After deployment, the game will be live at:
```
https://Timothyoverton.github.io/breakout-game/
```

---
