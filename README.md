# FlopLab

FlopLab is a fast Texas Hold'em win-rate calculator with suit-first input. Click a suit, then type the rank to fill cards. Results are estimated with Monte Carlo simulation.

## Features

- Pre-flop, flop, turn, and river equity
- Known opponent hole cards
- Fast suit-first keyboard input
- Duplicate card validation

## Getting Started

Install dependencies and start the dev server:

```
npm install
npm run dev
```

Build for production:

```
npm run build
```

## GitHub Pages Deployment

This project is configured to deploy from GitHub Actions to GitHub Pages.

1. Push the repository to GitHub.
2. Ensure the default branch is named `main`.
3. Enable GitHub Pages to deploy from Actions.

The Vite base path is set to `/FlopLab/` in `vite.config.ts`. If your repository name is different, update the base path to match the repo name.
