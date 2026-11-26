# Revival-Contracting-web

The site is a React app built with [Vite](https://vite.dev). Its backend runs on [AWS Amplify Gen 2](https://docs.amplify.aws/react/) and covers:

- **Gallery** (Projects page): photos and their order are managed from the admin page and stored in S3. Until any are added there, the site shows the 10 built-in photos in `public/photos/`.
- **Estimate requests** (Contact page) and **reviews** (Reviews page): saved to the database for you to read in the admin page. Visitors can send them, but only a signed-in admin can read them. Reviews you publish from the admin page appear on the Reviews page.
- **Admin page** at `/admin/`: sign in to manage the gallery and read submissions. Only accounts you create in the Cognito console can sign in; self sign-up is switched off.
- **Website editor** at `/?edit`: the real site with editing turned on. Click words to change them, or use **Change photo**. Each batch of edits becomes a change request that Claude (a Claude Code scheduled task) applies to this repository and publishes, or holds for a person. See [Website editor](#website-editor).

## Project layout

```
index.html            public site entry
admin/index.html      admin page entry (/admin/)
src/site/             public site: pages, header/footer, before/after slider
src/content/site.json every word and photo on the public pages (what the editor changes)
src/edit/             inline website editor (/?edit), loaded only for signed-in editors
src/admin/            admin page: sign-in, gallery manager, submissions, sent website edits
src/lib/              shared code (built-in gallery, service ordering, website-edit rules)
amplify/functions/    content-api: saves website edits, wakes Claude's routine, serves its webhook
scripts/              what Claude's website-edit routine runs: apply a request, rule check, live check
docs/                 website-edit-routine.md: how to set up the routine, and its prompt
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

1. The editor uploads any new photos to the site's storage, and the `content-api` function saves a **change request** (the edited words, the photos and an optional note) in the site's storage. Only that function can read requests.
2. It wakes **Claude's website-edit routine**, a Claude Code scheduled task set up at claude.ai/code/routines ([docs/website-edit-routine.md](docs/website-edit-routine.md)), through the routine's API trigger. The call names only the request; it's made once and never retried.
3. Claude reads the request through the website's **webhook** (the same function, at a public address that only answers requests carrying the website key), writes it to a `content/<id>` branch with `scripts/content-apply.mjs`, and opens a pull request labeled `content-change`.
4. `scripts/content-check.mjs` applies the rules in `src/lib/content-edit.mjs`: only `site.json` and new photos may change; same structure; no contact-detail, link or web-address changes; no code-like text; photos must exist. Anything outside the rules is held for Anthony.
5. Otherwise Claude reviews the wording and the photos, runs `npm test`, and squash-merges, or holds the request (label `needs-human`). Amplify deploys `main`, so GitHub and the live site stay the same, and `scripts/content-live-check.mjs` watches `/content.json` until the edit shows.
6. Along the way Claude reports each step and writes to the editor through the webhook; that's what **Sent changes** shows. When the editor writes back, the routine is woken again and replies.
7. The routine also runs every hour, to pick up anything a call missed, see whether Anthony merged or closed a held pull request, and finish live checks.

To publish a held request yourself, merge its pull request (or close it to reject it); the next hourly run tells the editor. Pull requests and merges appear under the GitHub account that owns the routine, so GitHub won't notify you about them; check **Sent changes** on the admin page.

### One-time setup

No AWS console access is needed: the backend deploys with `git push`, and the keys are entered on the admin page.

1. Push to `main` and wait for the deploy.
2. Follow [docs/website-edit-routine.md](docs/website-edit-routine.md): create the website key on **Website → Connect Claude**, create the routine (its prompt is in that file) with an hourly schedule, an API trigger and the website key as a network secret, then paste the routine's fire URL and token back on **Connect Claude**. The first person to save these settings is the only one who can change them.
3. **Editor names.** Claude and Anthony see the editor's Cognito `name` attribute (never their email). Set it when creating the user, or the name shows as "Website editor".
4. **Branch protection (optional).** If `main` requires approving reviews, the routine can't merge, because GitHub doesn't let an account approve its own pull request.

Runs count against the Claude subscription of the account that owns the routine. Change requests, messages and keys stay in the site's storage; pull requests show only the edits and the editor's note.

## Portal video

Put the video in `public/video/` named `portal.mp4` (or `portal.webm`).

## Tests

Browser tests (Playwright + `node:test`) cover routing, the estimate and review forms, the gallery, the before/after slider, service ordering, the 404 page, the admin page and the `/?edit` entry. The website-edit rules, the `content-api` function (with an in-memory store), the webhook and the routine's scripts are tested together: a request goes from the editor through the webhook into a throwaway git repo and through the rule check, with a fake live site for the live check (`tests/content*.test.js`). Static checks confirm referenced photos exist, in-page links resolve, images have alt text and ids are unique. `npm test` builds the site first, serves `dist/` locally and blocks all other network requests, so no backend is needed.

```
npm install
npx playwright install chromium   # first time only
npm test
```

To use a Chromium that's already installed, set `CHROMIUM_PATH` to its executable.
