# Revival-Contracting-web
## Portal video

Put the video in the `video/` folder named `portal.mp4` (or `portal.webm`). The "Watch the portal video" button plays it on the page; no URL needed.

## Tests

Browser tests (Playwright + `node:test`) cover routing, the estimate and review forms, the gallery, the before/after slider, service ordering and the 404 page. Static checks confirm referenced photos exist, in-page links resolve, images have alt text and ids are unique. They open the HTML files directly and block network requests.

```
npm install
npx playwright install chromium   # first time only
npm test
```
