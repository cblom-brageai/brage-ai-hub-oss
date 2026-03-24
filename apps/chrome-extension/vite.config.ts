import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { config as loadDotenv } from 'dotenv'

// Load root .env (two levels up from apps/chrome-extension) and remap to VITE_ names.
// This avoids a separate .env file in the extension directory.
const rootEnv = loadDotenv({ path: resolve(__dirname, '../../.env'), processEnv: {} })
const env = rootEnv.parsed ?? {}

export default defineConfig({
  define: {
    // Map root .env names → extension VITE_ names consumed by lib/supabase.ts and lib/api.ts
    'import.meta.env.VITE_SUPABASE_URL':  JSON.stringify(env.SUPABASE_URL  ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_KEY ?? ''),
    // FRONTEND_URL should be http://localhost:3001 in .env for dev branch
    'import.meta.env.VITE_HUB_URL': JSON.stringify(env.FRONTEND_URL ?? 'http://localhost:3001'),
  },
  plugins: [
    react(),
    // Copy manifest and icons into dist root
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icons', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        // Keep entry file names predictable (manifest references them)
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  // Needed so the sidepanel HTML output goes into dist/sidepanel/
  root: '.',
})
