import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rrbThemeInitPlugin } from '@rrb/ui/vite-theme-plugin';

export default defineConfig({
  plugins: [react(), rrbThemeInitPlugin()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
