import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works from any path (GitHub Pages, file server).
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'పలక! — Palaka',
        short_name: 'పలక!',
        description: 'A Telugu writing slate: type Palaka-HK roman, get exact Telugu Unicode. Works offline.',
        lang: 'te',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#fbfaf7',
        theme_color: '#1f6f5c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs, fonts included, so that it starts with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['tests/{engine,editor,chart,app,help}/**/*.test.ts'],
  },
});
