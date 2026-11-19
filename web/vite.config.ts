// The online STL generator: a static site that builds the parts in the browser.
//
//   npx vite web          dev server
//   npx vite build web    production build into web/dist
//
// The site is served from a subpath on GitHub Pages. BASE_PATH overrides it,
// for a custom domain ("/") or a fork under another name.
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const kernel = require.resolve('occt-wasm/dist/occt-wasm.wasm');

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.BASE_PATH ?? '/brepjs-gorillacart/',
  define: {
    // The kernel's size, so its download can show progress whatever encoding it
    // is served with.
    __KERNEL_BYTES__: JSON.stringify(statSync(kernel).size),
  },
  server: {
    // The parts in ../src and the renders in ../media.
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  optimizeDeps: {
    // Its glue finds the .wasm next to itself; pre-bundling would move it.
    exclude: ['occt-wasm'],
  },
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    // The worker carries brepjs: big, but loaded off the main thread.
    chunkSizeWarningLimit: 3000,
  },
});
