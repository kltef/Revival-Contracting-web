const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const url = f => pathToFileURL(path.join(root, f)).href;

async function launch() {
  const browser = await chromium.launch();
  const open = async (file = 'index.html', hash = '', query = '') => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    // keep tests offline and fast: block remote fonts/video
    await page.route(/^https?:/, r => r.abort());
    await page.goto(url(file) + query + hash);
    return page;
  };
  return { browser, open };
}

module.exports = { launch, url };
