import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'fs';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

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
export default defineConfig(async () => ({
  plugins: [sveltekit(), cssAsText()],

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
            if (id.includes('chart.js') || id.includes('d3-')) {
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
}));
