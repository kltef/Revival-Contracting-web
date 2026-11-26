# Revival-Contracting-web

The site is a React app built with [Vite](https://vite.dev). Its backend runs on [AWS Amplify Gen 2](https://docs.amplify.aws/react/) and covers:

- **Gallery** (Projects page): photos and their order are managed from the admin page and stored in S3. Until any are added there, the site shows the 10 built-in photos in `public/photos/`.
- **Estimate requests** (Contact page) and **reviews** (Reviews page): saved to the database for you to read in the admin page. Visitors can send them, but only a signed-in admin can read them. Reviews you publish from the admin page appear on the Reviews page.
- **Admin page** at `/admin/`: sign in to manage the gallery and read submissions. Only accounts you create in the Cognito console can sign in; self sign-up is switched off.
- **Website editor** at `/?edit`: the real site with editing turned on. Click words to change them, or use **Change photo**. Each batch of edits becomes a GitHub pull request that Claude reviews and publishes, or holds for a person. See [Website editor](#website-editor).

## Project layout

```
index.html            public site entry
admin/index.html      admin page entry (/admin/)
src/site/             public site: pages, header/footer, before/after slider
src/content/site.json every word and photo on the public pages (what the editor changes)
src/edit/             inline website editor (/?edit), loaded only for signed-in editors
src/admin/            admin page: sign-in, gallery manager, submissions, sent website edits
src/lib/              shared code (built-in gallery, service ordering, website-edit rules)
amplify/functions/    content-api: turns website edits into GitHub pull requests
scripts/              website-edit review, reply and live-check scripts run by GitHub Actions
.github/workflows/    CI, plus the website-edit review, messages and live check
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

- **Gallery**: choose or drag in photos, add a caption and category, and press **Publish**. You can also edit captions and categories, reorder with the arrow buttons, or delete. The first time, choose **Add the built-in photos** if you want to keep the current 10 photos alongside new ones. Once the gallery has any photos in the admin page, the site shows only those.
- **Estimate requests** and **Reviews**: newest first, with tap-to-call and email links.
- **Publishing reviews**: press **Publish** on a review to show it on the Reviews page (first name, village, project, highlights and text; never the email). **Remove from site** takes it down again. Reviews whose writer didn't give permission can't be published.

## Website editor

Open `https://<your site>/?edit` (or **Website → Open the website editor** on the admin page) and sign in with an admin account. The site looks exactly as visitors see it, with a toolbar at the bottom:

- **Change words** by clicking them and typing. Paragraphs take Enter for a new line; headings and buttons finish on Enter. Esc cancels. Words between `**` marks show in bold.
- **Change a photo** with the **Change photo** button on it, and describe the new photo for screen readers. Photos are resized in the browser before upload.
- **Review & send** lists every change, takes an optional note, and sends them. Unsent text edits are kept in the browser, so a reload doesn't lose them.
- **Sent changes** shows each request's progress (automatic check → Anthony's review if needed → going live → live) and its messages.

What can be edited is limited to the existing words and photos in `src/content/site.json`. New pages, sections, links and layout changes are code changes, made the usual way.

### What happens to an edit

1. The admin page's `content-api` function (the GitHub token never reaches the browser) commits the new `site.json` and any new photos (into `public/photos/uploads/`) to a `content/<time>` branch and opens a pull request labeled `content-change`.
2. **Website edit review** (`.github/workflows/content-review.yml`) checks the rules in `src/lib/content-edit.mjs`: only `site.json` and new photos may change; same structure; no contact-detail, link or web-address changes; no code-like text; photos must exist. Anything outside the rules is labeled `needs-human` without asking Claude.
3. Otherwise Claude reviews the wording and any new photos and either approves or holds. Held requests get `needs-human` and a message to the editor.
4. Approved edits wait for **CI** (`build-and-test`) to pass, get an approving review, and are squash-merged. Amplify then deploys `main`, so GitHub and the live site stay the same.
5. The workflow polls `<SITE_URL>/content.json` until the live site shows the edit, then labels the request `live`. If it doesn't appear within 40 minutes, it's labeled `needs-human`. When you merge a held request yourself, **Website edit live check** does the same.
6. A message the editor writes in **Sent changes** is posted as a PR comment; **Website edit messages** has Claude reply. Comment on the PR yourself to answer as Anthony.

The review and reply workflows run with `pull_request_target` / `issue_comment`, so they always use `main`'s copy of the workflow and scripts and never run code from the pull request.

### One-time setup

1. **GitHub token for the editor.** Create a fine-grained personal access token limited to this repository with *Contents*, *Pull requests* and *Issues* set to read and write. Save it as the backend secret `GITHUB_TOKEN`: Amplify console → your app → **Hosting → Secrets**, or `npx ampx sandbox secret set GITHUB_TOKEN` for a sandbox. The repository name is set in `amplify/functions/content-api/resource.ts`.
2. **Claude API key.** In GitHub: **Settings → Secrets and variables → Actions → New repository secret** `ANTHROPIC_API_KEY`.
3. **Live site address.** Same page, **Variables** tab: `SITE_URL`, e.g. `https://main.d123abc.amplifyapp.com`. Without it, merged edits are marked live without checking. Optional variable `REVIEW_MODEL` overrides the model (default `claude-opus-5-5`).
4. **Let the workflow approve.** **Settings → Actions → General → Workflow permissions**: allow GitHub Actions to create and approve pull requests.
5. **Protect `main` (recommended).** Require a pull request and the `build-and-test` status check before merging.
6. **Editor names.** Messages on GitHub show the editor's Cognito `name` attribute (never their email). Set it when creating the user, or the name shows as "Website editor".

If this repository is public, edit requests and their messages are public too.

## Portal video

Put the video in `public/video/` named `portal.mp4` (or `portal.webm`).

## Tests

Browser tests (Playwright + `node:test`) cover routing, the estimate and review forms, the gallery, the before/after slider, service ordering, the 404 page, the admin page and the `/?edit` entry. The website-edit rules, the `content-api` function and the review and reply scripts are tested against a fake GitHub and a fake Claude API (`tests/content*.test.js`). Static checks confirm referenced photos exist, in-page links resolve, images have alt text and ids are unique. `npm test` builds the site first, serves `dist/` locally and blocks all other network requests, so no backend is needed.

```
npm install
npx playwright install chromium   # first time only
npm test
```

To use a Chromium that's already installed, set `CHROMIUM_PATH` to its executable.
