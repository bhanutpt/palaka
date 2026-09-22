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
        name: 'పలక — Palaka',
        short_name: 'పలక',
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
        // Everything under trvk/ — the model, the ONNX Runtime files and the inference worker
        // — is left out of the precache on purpose. Phase 3 measured 4.7 MB gzipped, which
        // every visitor would pay whether or not they ever switch TRVK mode on. It is cached
        // at runtime instead, on the first switch-on, and the offline promise holds from then.
        globIgnores: ['**/trvk/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/trvk/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'trvk-model',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // The inference worker and its chunks land under trvk/ so that one ignore rule keeps the
  // whole of TRVK out of the precache.
  worker: {
    format: 'es',
    rollupOptions: { output: { entryFileNames: 'trvk/worker-[hash].js', chunkFileNames: 'trvk/[name]-[hash].js' } },
  },
  test: {
    include: ['tests/{engine,editor,chart,app,help,trvk}/**/*.test.ts'],
  },
});
