/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app under /<repo-name>/. The deploy workflow sets
// VITE_BASE from the repository name; locally the app runs at the root.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    // Installable and usable offline. The service worker is built only for `vite build` (not in `vite dev`);
    // try it with `npm run build && npm run preview`. A new version waits until the user taps «Aggiorna»
    // (see src/features/pwa/UpdatePrompt.tsx), so nobody loses what they are typing.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'D&D Pocket',
        short_name: 'D&D Pocket',
        description: 'Dadi, scheda del personaggio, zaino, mappe e gruppo per D&D 5e.',
        lang: 'it',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1b1a2e',
        background_color: '#1b1a2e',
        // Relative to the manifest, so the app works under /<repo-name>/ as well as at the root.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // The shell: every built script (the lazy PDF chunks too, so the export works offline), style, font and icon.
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        // The SRD lists (monsters, spells) are fetched when their tab opens: keep a copy, refresh it in the background.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/srd/') && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'srd-data', expiration: { maxEntries: 8 } },
          },
        ],
        // Firebase (Firestore, Auth) is never cached here: its SDK keeps its own offline cache.
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
