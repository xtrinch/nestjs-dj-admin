import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, '..', '..'),
  base: '/admin/',
  plugins: [
    react(),
    {
      name: 'dj-admin-trailing-slash-redirect',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = request.url ?? '';
          if (url === '/admin' || url.startsWith('/admin?')) {
            const query = url.slice('/admin'.length);
            response.statusCode = 308;
            response.setHeader('Location', `/admin/${query}`);
            response.end();
            return;
          }

          next();
        });
      },
    },
  ],
  build: {
    outDir: resolve(__dirname, '..', '..', 'dist', 'admin-ui'),
    emptyOutDir: true,
  },
});
