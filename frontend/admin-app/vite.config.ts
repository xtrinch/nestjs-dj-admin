import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, '..', '..'),
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '..', '..', 'dist', 'admin-ui'),
    emptyOutDir: true,
  },
});
