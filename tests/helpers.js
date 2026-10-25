const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Tests run against the production build in dist/ (`npm test` builds it first)
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.json': 'application/json' };

function serve() {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing: run `npm run build` (or `npm test`, which builds first)');
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(dist, path.normalize(rel));
    const ok = file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile();
    res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(ok ? file : '.html')] || 'application/octet-stream' });
    fs.createReadStream(ok ? file : path.join(dist, '404.html')).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launch() {
  // CHROMIUM_PATH: use an already-installed browser instead of Playwright's own download
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const open = async (file = 'index.html', hash = '', query = '') => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    // keep tests offline and fast: block everything but the local build (fonts, video, backend)
    await page.route(u => !u.href.startsWith(base), r => r.abort());
    await page.goto(base + file + query + hash);
    if (file === 'index.html') await page.waitForSelector('.page.active'); // React has rendered
    return page;
  };
  const close = async () => { await browser.close(); server.close(); };
  return { browser: { close }, open };
}

module.exports = { launch, root, dist };
