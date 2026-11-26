import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Publish the content the site was built from at /content.json, so the website-edit workflow
// can confirm an approved edit has actually gone live.
const contentJson = () => ({
  name: 'content-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'content.json', source: readFileSync(resolve(import.meta.dirname, 'src/content/site.json')) });
  },
});

export default defineConfig({
  // relative asset paths so the site still works if it's hosted under a sub-path
  base: './',
  plugins: [react(), contentJson()],
  build: {
    // the admin page bundles the Amplify sign-in UI; visitors never load it
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
