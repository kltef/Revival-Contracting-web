# Revival-Contracting-web

The site is a React app built with [Vite](https://vite.dev). Its backend runs on [AWS Amplify Gen 2](https://docs.amplify.aws/react/) and covers:

- **Gallery** (Projects page): photos and their order are managed from the admin page and stored in S3. Until any are added there, the site shows the 10 built-in photos in `public/photos/`.
- **Estimate requests** (Contact page) and **reviews** (Reviews page): saved to the database for you to read in the admin page. Visitors can send them, but only a signed-in admin can read them.
- **Admin page** at `/admin/`: sign in to manage the gallery and read submissions. Only accounts you create in the Cognito console can sign in; self sign-up is switched off.

## Project layout

```
index.html            public site entry
admin/index.html      admin page entry (/admin/)
src/site/             public site: pages, header/footer, before/after slider
src/admin/            admin page: sign-in, gallery manager, submissions
src/lib/              shared data (built-in gallery, service ordering)
public/               photos, video, favicon and 404.html, copied as-is
amplify/              backend: auth, data (database) and storage
amplify.yml           Amplify Hosting build settings
```

## Local development

```
npm install
npm run dev          # http://localhost:5173 and http://localhost:5173/admin/
```

Without a backend the site still works: the forms show their thank-you message without sending anything, and the gallery shows the built-in photos.

To develop against a real backend, run a personal cloud sandbox (needs AWS credentials on your machine). It writes `amplify_outputs.json`, which the site picks up automatically:

```
npx ampx sandbox
```

## Deploying

1. Push this branch to GitHub.
2. In the AWS Amplify console, choose **Create new app** → **GitHub**, and pick this repository and branch. Amplify reads `amplify.yml`, deploys the backend, then builds and hosts the site.
3. Create your admin login: in the Amplify console open **Authentication** (or the Cognito console → User pools → this app's pool) → **Users** → **Create user**. Enter your email and a temporary password. The first time you sign in at `/admin/`, you'll be asked to set a new password.

## Admin page

- **Gallery**: upload photos with a caption and category, edit captions and categories, reorder with the arrow buttons, or delete. The first time, choose **Add the built-in photos** if you want to keep the current 10 photos alongside new ones. Once the gallery has any photos in the admin page, the site shows only those.
- **Estimate requests** and **Reviews**: newest first, with tap-to-call and email links. Reviews aren't published automatically.

## Portal video

Put the video in `public/video/` named `portal.mp4` (or `portal.webm`).

## Tests

Browser tests (Playwright + `node:test`) cover routing, the estimate and review forms, the gallery, the before/after slider, service ordering, the 404 page and the admin page. Static checks confirm referenced photos exist, in-page links resolve, images have alt text and ids are unique. `npm test` builds the site first, serves `dist/` locally and blocks all other network requests, so no backend is needed.

```
npm install
npx playwright install chromium   # first time only
npm test
```

To use a Chromium that's already installed, set `CHROMIUM_PATH` to its executable.
