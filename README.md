# TD Codex

CORE://DEFENSE is a browser tower defence game built with Three.js and Vite.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

GitHub Actions runs the same checks on pull requests and deploys successful `main` builds to GitHub Pages.
