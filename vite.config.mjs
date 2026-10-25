import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  // relative asset paths so the site still works if it's hosted under a sub-path
  base: './',
  plugins: [react()],
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
