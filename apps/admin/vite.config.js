import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { rrbThemeInitPlugin } from '@rrb/ui/vite-theme-plugin';

const PORT = 5174;

// `npm run analyze` -> dist/stats.html treemap
export default defineConfig(({ mode }) => ({
  plugins: [react(), rrbThemeInitPlugin(), ...(mode === 'analyze' ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, open: false })] : [])],
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  // no source maps in prod; strip console.log/info/debug + debugger (keep console.error/warn)
  esbuild: mode === 'development' ? {} : { pure: ['console.log', 'console.info', 'console.debug'], drop: ['debugger'] },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) return 'router';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('@radix-ui')) return 'radix';
        },
      },
    },
  },
}));
