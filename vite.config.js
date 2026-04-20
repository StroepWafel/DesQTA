import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { compileModule } from 'svelte/compiler';
// @ts-expect-error - path is a Node.js built-in module
import path from 'path';
// @ts-expect-error - fs is a Node.js built-in module
import fs from 'fs';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * Compiles layerchart's .svelte.js files (which contain Svelte 5 runes like $derived.by)
 * before Rollup's CommonJS plugin tries to parse them as plain JavaScript.
 * Uses resolveId + load to serve compiled content under a virtual .js id so the
 * Svelte module plugin (which runs with enforce: 'post') won't re-process it.
 */
function layerchartRunesPlugin() {
  const QUERY = '?layerchart-compiled';
  return {
    name: 'layerchart-runes',
    enforce: 'pre',
    /** @param {string} id @param {string} [importer] */
    resolveId(id, importer) {
      if (!id.endsWith('.svelte.js') || id.includes('?')) return;
      let resolvedPath = id;
      if (importer) {
        const importerPath = importer.includes(QUERY) ? importer.split(QUERY)[0] : importer.split('?')[0];
        const importerDir = path.dirname(importerPath);
        resolvedPath = path.resolve(importerDir, id);
      }
      if (resolvedPath.includes('layerchart')) {
        return resolvedPath + QUERY;
      }
    },
    /** @param {string} id */
    load(id) {
      if (id.endsWith(QUERY)) {
        const realPath = id.slice(0, -QUERY.length);
        let code = fs.readFileSync(realPath, 'utf-8');
        // Already-compiled files use "import * as $ from 'svelte/internal/client'" which
        // Svelte 5 reserves. Rewrite $ to __svelte__ to avoid the error.
        if (code.includes("from 'svelte/internal/client'") || code.includes('from "svelte/internal/client"')) {
          code = code
            .replace(/import \* as \$ from ['"]svelte\/internal\/client['"]/g, 'import * as __svelte__ from \'svelte/internal/client\'')
            .replace(/\b\$\./g, '__svelte__.');
          return code;
        }
        const result = compileModule(code, {
          filename: realPath,
          generate: 'client',
        });
        return result.js.code;
      }
    },
  };
}

// Custom plugin to import CSS as text
function cssAsText() {
  return {
    name: 'css-as-text',
    /**
     * @param {string} id
     */
    load(id) {
      if (id.endsWith('.css?text')) {
        const cssPath = id.replace('?text', '');
        const css = fs.readFileSync(cssPath, 'utf-8');
        return `export default ${JSON.stringify(css)}`;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [layerchartRunesPlugin(), tailwindcss(), sveltekit(), cssAsText()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*', 'TAURI_'],

  // Production build optimizations
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
    },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('@tiptap')) {
              return 'vendor-tiptap';
            }
            if (id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('dompurify') || id.includes('marked')) {
              return 'vendor-sanitization';
            }
            return 'vendor';
          }
        },
      },
    },
    // Increase chunk size warning limit (Tauri apps can be larger)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (can disable for smaller builds)
    sourcemap: false,
    // Target modern browsers for better optimization
    target: 'esnext',
  },
});
